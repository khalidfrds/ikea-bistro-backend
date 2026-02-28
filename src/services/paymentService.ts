/**
 * server/src/services/paymentService.ts — Stripe + Swish integration
 * Source: Domain Contract v2.0 §1.7, §1.8, §2.9
 * Stripe: real Checkout flow (test mode)
 * Swish: Commerce API v2 (requires merchant TLS certificate)
 */

import Stripe from 'stripe';
import { v4 as uuidv4 } from 'uuid';
import type { RequestOptions } from 'https';
import type { PaymentMethod, PaymentSession } from '../types.js';
import {
  savePaymentSession,
  getPaymentSession,
  getPaymentSessionByExternalRef,
  updatePaymentSession
} from '../store/database.js';
import { confirmOrder } from './orderService.js';

/** Stripe SDK instance — initialized from env */
let stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY is not set');
    }
    stripe = new Stripe(key, { apiVersion: '2024-12-18.acacia' });
  }
  return stripe;
}

/** Result from creating a payment */
export interface PaymentCreationResult {
  sessionId: string;
  clientSecret?: string;
  checkoutUrl?: string;
  swishUrl?: string;
}

/** Create payment for an order */
export async function createPaymentForOrder(
  orderId: string,
  amount: number,
  method: PaymentMethod
): Promise<PaymentCreationResult> {
  const sessionId = uuidv4();
  const now = new Date().toISOString();

  if (method === 'card') {
    return createStripePayment(sessionId, orderId, amount, now);
  }
  return createSwishPayment(sessionId, orderId, amount, now);
}

/** Card: Stripe Checkout flow (hosted payment page) */
async function createStripePayment(
  sessionId: string,
  orderId: string,
  amount: number,
  now: string
): Promise<PaymentCreationResult> {
  let externalReference = '';
  let checkoutUrl = '';

  try {
    const stripeInstance = getStripe();
    /** Stripe amounts are in the smallest currency unit. SEK uses öre (1 SEK = 100 öre). */
    const webappUrl = process.env.FRONTEND_URL || process.env.WEBAPP_URL || 'http://localhost:5173';
    const checkoutSession = await stripeInstance.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'sek',
            unit_amount: amount * 100,
            product_data: {
              name: 'IKEA Bistro order'
            }
          },
          quantity: 1
        }
      ],
      metadata: { orderId, sessionId },
      success_url: `${webappUrl}/?payment=success&orderId=${orderId}`,
      cancel_url: `${webappUrl}/?payment=cancel&orderId=${orderId}`
    });

    externalReference = checkoutSession.id;
    checkoutUrl = checkoutSession.url || '';
  } catch (err) {
    console.error('Stripe Checkout session creation failed:', err);
    throw new Error('Stripe Checkout session creation failed');
  }

  const session: PaymentSession = {
    id: sessionId,
    orderId,
    method: 'card',
    amount,
    status: 'created',
    externalReference,
    createdAt: now,
    updatedAt: now
  };
  savePaymentSession(session);

  return { sessionId, checkoutUrl };
}

/** Swish: Commerce API v2 payment request creation
 *  Requires merchant TLS certificate (.p12) via SWISH_CERT_PATH.
 *  Without certificate → error. No fake deep links (Domain Contract §2.6). */
async function createSwishPayment(
  sessionId: string,
  orderId: string,
  amount: number,
  now: string
): Promise<PaymentCreationResult> {
  const certPath = process.env.SWISH_CERT_PATH;
  const certPassphrase = process.env.SWISH_CERT_PASSPHRASE;
  const merchantNumber = process.env.SWISH_MERCHANT_NUMBER;

  if (!certPath || !merchantNumber) {
    throw new Error(
      'Swish is not configured. Set SWISH_CERT_PATH and SWISH_MERCHANT_NUMBER in .env. ' +
      'Real Swish integration requires a merchant TLS certificate (.p12) from your bank.'
    );
  }

  const callbackUrl = process.env.SWISH_CALLBACK_URL || 'http://localhost:3000/api/webhooks/swish';
  const swishApiUrl =
    process.env.SWISH_API_URL || 'https://mss.cpc.getswish.net/swish-cpcapi/api/v2/paymentrequests';
  const swishReference = uuidv4().replace(/-/g, '').toUpperCase();

  /**
   * Swish Commerce API v2: POST /api/v2/paymentrequests
   * Requires TLS client certificate (.p12).
   * Returns Location header with payment request ID → construct deep link.
   * callbackUrl: Swish POSTs result when user confirms/declines.
   */
  const fs = await import('fs');
  const https = await import('https');
  const cert = fs.readFileSync(certPath);

  const requestBody = JSON.stringify({
    payeeAlias: merchantNumber,
    amount: amount.toFixed(2),
    currency: 'SEK',
    callbackUrl: callbackUrl,
    payeePaymentReference: swishReference,
    message: `IKEA Bistro Order ${orderId.slice(0, 8)}`
  });

  const paymentResponse = await new Promise<{ statusCode: number; location: string }>((resolve, reject) => {
    const url = new URL(swishApiUrl);
    const options: RequestOptions = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody)
      },
      pfx: cert,
      passphrase: certPassphrase
    };

    const req = https.request(options, (res) => {
      resolve({
        statusCode: res.statusCode || 0,
        location: (res.headers.location as string) || ''
      });
      res.resume();
    });
    req.on('error', reject);
    req.write(requestBody);
    req.end();
  });

  if (paymentResponse.statusCode !== 201 || !paymentResponse.location) {
    throw new Error(
      `Swish API returned status ${paymentResponse.statusCode}. ` +
      'Check certificate and merchant number configuration.'
    );
  }

  const requestId = paymentResponse.location.split('/').pop() || '';
  const swishUrl = `swish://paymentrequest?token=${requestId}`;
  console.log('Swish payment request created:', requestId);

  const session: PaymentSession = {
    id: sessionId,
    orderId,
    method: 'swish',
    amount,
    status: 'created',
    externalReference: swishReference,
    createdAt: now,
    updatedAt: now
  };
  savePaymentSession(session);

  return { sessionId, swishUrl };
}

/** Handle Stripe webhook event — verify and confirm order */
export async function handleStripeWebhook(
  rawBody: Buffer,
  signature: string
): Promise<{ success: boolean; orderId?: string }> {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET is not set');
    return { success: false };
  }

  let event: Stripe.Event;
  try {
    const stripeInstance = getStripe();
    event = stripeInstance.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err);
    return { success: false };
  }

  if (event.type === 'checkout.session.completed') {
    const checkoutSession = event.data.object as Stripe.Checkout.Session;
    const session = getPaymentSessionByExternalRef(checkoutSession.id);
    if (!session) {
      console.error('No payment session found for Checkout Session:', checkoutSession.id);
      return { success: false };
    }

    updatePaymentSession(session.id, { status: 'succeeded' });
    const order = await confirmOrder(session.orderId);
    return { success: true, orderId: order?.id };
  }

  if (event.type === 'checkout.session.async_payment_failed') {
    const checkoutSession = event.data.object as Stripe.Checkout.Session;
    const session = getPaymentSessionByExternalRef(checkoutSession.id);
    if (session) {
      updatePaymentSession(session.id, { status: 'failed' });
    }
    return { success: false };
  }

  return { success: true };
}

/** Handle Swish callback — verify and confirm order */
export async function handleSwishCallback(
  data: { reference: string; status: string; amount?: number }
): Promise<{ success: boolean; orderId?: string }> {
  const session = getPaymentSessionByExternalRef(data.reference);
  if (!session) {
    console.error('No payment session found for Swish reference:', data.reference);
    return { success: false };
  }

  if (data.status === 'PAID') {
    updatePaymentSession(session.id, { status: 'succeeded' });
    const order = await confirmOrder(session.orderId);
    return { success: true, orderId: order?.id };
  }

  if (data.status === 'DECLINED' || data.status === 'ERROR') {
    updatePaymentSession(session.id, { status: 'failed' });
  }

  return { success: false };
}

/** Note: Swish simulation removed from production code.
 *  Payment confirmation only via real Swish callback (Domain Contract §2.6). */

import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import firebaseConfig from './firebase-applet-config.json' with { type: 'json' };
import {
  extractReceiptData,
  generateInvoiceDraft,
  generateReminderDraft,
  runInvoiceHealthCheck,
  runPilotAssistant,
} from './server/gemini.ts';
import { generateDocumentPdf, generateMonthlyReportPdf } from './server/pdf.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json({ limit: '10mb' }));

// Simple in-memory rate limiter for API routes
const rateHits = new Map<string, { count: number; resetAt: number }>();
function rateLimit(maxPerMin: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${req.ip || 'unknown'}:${req.path}`;
    const now = Date.now();
    const record = rateHits.get(key);
    if (!record || record.resetAt < now) {
      rateHits.set(key, { count: 1, resetAt: now + 60_000 });
      return next();
    }
    if (record.count >= maxPerMin) {
      return res.status(429).json({ error: 'Rate limit exceeded. Please wait a moment and retry.' });
    }
    record.count += 1;
    next();
  };
}

// Lightweight Firebase ID token verification via Google Identity Toolkit
interface VerifiedUser {
  uid: string;
  email: string;
  emailVerified: boolean;
}
const tokenCache = new Map<string, { user: VerifiedUser; expiresAt: number }>();

async function requireFirebaseAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing authentication token.' });
  }
  const token = authHeader.slice(7).trim();
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Empty token.' });
  }

  const cached = tokenCache.get(token);
  if (cached && cached.expiresAt > Date.now()) {
    (req as Request & { authUser?: VerifiedUser }).authUser = cached.user;
    return next();
  }

  try {
    const resp = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseConfig.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token }),
      }
    );
    if (!resp.ok) {
      return res.status(401).json({ error: 'Unauthorized: Invalid or expired session token.' });
    }
    const data = (await resp.json()) as {
      users?: Array<{ localId: string; email?: string; emailVerified?: boolean }>;
    };
    const u = data.users?.[0];
    if (!u || !u.localId) {
      return res.status(401).json({ error: 'Unauthorized: User account not found.' });
    }
    const verified: VerifiedUser = {
      uid: u.localId,
      email: u.email || '',
      emailVerified: Boolean(u.emailVerified),
    };
    tokenCache.set(token, { user: verified, expiresAt: Date.now() + 60_000 });
    (req as Request & { authUser?: VerifiedUser }).authUser = verified;
    next();
  } catch (err) {
    console.error('Auth verification error:', err);
    return res.status(500).json({ error: 'Unable to verify authentication session.' });
  }
}

// Health & Integration capabilities
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'InvoicifyPro', timestamp: new Date().toISOString() });
});

app.get('/api/integrations/status', (_req, res) => {
  res.json({
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
    resendConfigured: Boolean(process.env.RESEND_API_KEY),
    appUrl: process.env.APP_URL || '',
  });
});

// AI Endpoints
app.post('/api/ai/generate-invoice', rateLimit(30), requireFirebaseAuth, async (req, res) => {
  try {
    const { prompt, clients, defaultTaxRateBps, defaultDueDays } = req.body || {};
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 4) {
      return res.status(400).json({ error: 'Please provide a descriptive invoice prompt.' });
    }
    const draft = await generateInvoiceDraft({
      prompt: prompt.trim(),
      clients: Array.isArray(clients) ? clients : [],
      defaultTaxRateBps: Number(defaultTaxRateBps || 0),
      defaultDueDays: Number(defaultDueDays || 30),
    });
    res.json(draft);
  } catch (err: any) {
    console.error('AI generate-invoice error:', err);
    res.status(500).json({ error: err?.message || 'Failed to generate invoice draft.' });
  }
});

app.post('/api/ai/health-check', rateLimit(30), requireFirebaseAuth, async (req, res) => {
  try {
    const { invoice, businessName } = req.body || {};
    if (!invoice) {
      return res.status(400).json({ error: 'Missing invoice payload.' });
    }
    const result = await runInvoiceHealthCheck({
      invoice,
      businessName: String(businessName || 'Business'),
    });
    res.json(result);
  } catch (err: any) {
    console.error('AI health-check error:', err);
    res.status(500).json({ error: err?.message || 'Failed to run invoice health check.' });
  }
});

app.post('/api/ai/generate-reminder', rateLimit(30), requireFirebaseAuth, async (req, res) => {
  try {
    const payload = req.body || {};
    if (!payload.clientName || !payload.invoiceNumber) {
      return res.status(400).json({ error: 'Missing required invoice reminder fields.' });
    }
    const draft = await generateReminderDraft({
      clientName: String(payload.clientName),
      invoiceNumber: String(payload.invoiceNumber),
      balanceDueFormatted: String(payload.balanceDueFormatted || '$0.00'),
      dueDate: String(payload.dueDate || ''),
      daysDelta: Number(payload.daysDelta || 0),
      tone: String(payload.tone || 'friendly'),
      previousRemindersCount: Number(payload.previousRemindersCount || 0),
      businessName: String(payload.businessName || 'Your Business'),
      ownerName: String(payload.ownerName || 'Owner'),
    });
    res.json(draft);
  } catch (err: any) {
    console.error('AI generate-reminder error:', err);
    res.status(500).json({ error: err?.message || 'Failed to generate reminder draft.' });
  }
});

app.post('/api/ai/extract-receipt', rateLimit(20), requireFirebaseAuth, async (req, res) => {
  try {
    const { base64Data, mimeType } = req.body || {};
    if (!base64Data || !mimeType) {
      return res.status(400).json({ error: 'Receipt file data and MIME type are required.' });
    }
    const cleanBase64 = String(base64Data).includes(',')
      ? String(base64Data).split(',')[1]
      : String(base64Data);
    const extracted = await extractReceiptData({
      base64Data: cleanBase64,
      mimeType: String(mimeType),
    });
    res.json(extracted);
  } catch (err: any) {
    console.error('AI extract-receipt error:', err);
    res.status(500).json({ error: err?.message || 'Failed to extract receipt data.' });
  }
});

app.post('/api/ai/pilot-chat', rateLimit(40), requireFirebaseAuth, async (req, res) => {
  try {
    const { message, history, context } = req.body || {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required.' });
    }
    const result = await runPilotAssistant({
      message: message.trim(),
      history: Array.isArray(history) ? history : [],
      context,
    });
    res.json(result);
  } catch (err: any) {
    console.error('Pilot AI error:', err);
    res.status(500).json({ error: err?.message || 'Pilot AI request failed.' });
  }
});

// Server-side PDF Endpoints
app.post('/api/pdf/document', rateLimit(60), async (req, res) => {
  try {
    const payload = req.body;
    if (!payload || !payload.docNumber || !Array.isArray(payload.items)) {
      return res.status(400).json({ error: 'Invalid document payload for PDF export.' });
    }
    const buffer = await generateDocumentPdf(payload);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${payload.kind}-${payload.docNumber}.pdf"`);
    res.send(buffer);
  } catch (err: any) {
    console.error('PDF document error:', err);
    res.status(500).json({ error: 'Failed to generate PDF document.' });
  }
});

app.post('/api/pdf/monthly-report', rateLimit(30), requireFirebaseAuth, async (req, res) => {
  try {
    const payload = req.body;
    if (!payload || !payload.metrics) {
      return res.status(400).json({ error: 'Invalid monthly report payload.' });
    }
    const buffer = await generateMonthlyReportPdf(payload);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="InvoicifyPro-Monthly-Report.pdf"`);
    res.send(buffer);
  } catch (err: any) {
    console.error('PDF monthly-report error:', err);
    res.status(500).json({ error: 'Failed to generate monthly business report.' });
  }
});

// Transactional Email via Resend (explicitly checks configuration, never pretends!)
app.post('/api/email/send', rateLimit(20), requireFirebaseAuth, async (req, res) => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      configured: false,
      error: 'Transactional email delivery requires RESEND_API_KEY in server environment variables.',
    });
  }
  try {
    const { to, subject, text, replyTo } = req.body || {};
    if (!to || !subject || !text) {
      return res.status(400).json({ error: 'Recipient, subject, and message body are required.' });
    }
    const from = process.env.RESEND_FROM_EMAIL || 'billing@invoicifypro.app';
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: [to], subject, text, reply_to: replyTo }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      return res.status(resp.status).json({ error: data?.message || 'Email provider error.' });
    }
    res.json({ sent: true, id: data.id });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to send email.' });
  }
});

// Stripe Checkout Session (explicitly checks configuration, never fakes payment!)
app.post('/api/stripe/create-checkout', rateLimit(20), async (req, res) => {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return res.status(503).json({
      configured: false,
      error: 'Live Stripe Checkout requires STRIPE_SECRET_KEY and merchant onboarding.',
    });
  }
  try {
    const { amountCents, description, successUrl, cancelUrl, customerEmail } = req.body || {};
    if (!amountCents || Number(amountCents) < 50) {
      return res.status(400).json({ error: 'Valid payment amount (>= $0.50) is required.' });
    }
    const body = new URLSearchParams({
      mode: 'payment',
      success_url: String(successUrl || `${process.env.APP_URL || 'http://localhost:3000'}/?payment=success`),
      cancel_url: String(cancelUrl || `${process.env.APP_URL || 'http://localhost:3000'}/?payment=cancelled`),
      'line_items[0][price_data][currency]': 'usd',
      'line_items[0][price_data][product_data][name]': String(description || 'Invoice Payment'),
      'line_items[0][price_data][unit_amount]': String(Math.round(Number(amountCents))),
      'line_items[0][quantity]': '1',
    });
    if (customerEmail) {
      body.set('customer_email', String(customerEmail));
    }

    const resp = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
    const data = await resp.json();
    if (!resp.ok) {
      return res.status(resp.status).json({ error: data?.error?.message || 'Stripe error.' });
    }
    res.json({ url: data.url, sessionId: data.id });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Stripe Checkout creation failed.' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`InvoicifyPro server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();

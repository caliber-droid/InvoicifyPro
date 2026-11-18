# InvoicifyPro

**Smart Invoicing. Faster Payments. Better Business.**

InvoicifyPro is an AI-powered invoicing, billing, expense tracking, and financial management SaaS built for US freelancers, independent contractors, consultants, agencies, and small businesses.

## Core Architecture

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Motion for React (`motion/react`), Lucide Icons, and custom SVG financial charts.
- **Backend (`server.ts`)**: Node.js + Express serving Vite (development) or `dist/` (production), Firebase ID token verification, rate-limited API routes, server-side Gemini AI endpoints (`@google/genai`), and server-side PDF generation (`pdfkit`).
- **Database & Auth**: Firebase Authentication (Google Sign-In + Email/Password with email verification & password reset) and Cloud Firestore with strict schema-enforcing security rules (`firestore.rules`).

## Implemented Features

1. **Public SaaS Marketing Website**:
   - SEO metadata, OpenGraph tags, and Schema.org `WebApplication` JSON-LD.
   - How It Works, Bento Feature Highlights, Monthly/Annual USD Pricing, and FAQ.
2. **Authentication & 3-Step Business Onboarding**:
   - Google OAuth and Email/Password registration, verification gate, and password reset.
   - Onboarding wizard capturing US entity details, USD defaults, sales tax configuration, invoice numbering, and payment methods.
3. **Invoicing Engine**:
   - AI natural-language & Voice-to-Invoice line-item extraction (`POST /api/ai/generate-invoice`).
   - 6 invoice PDF templates (`corporate`, `minimal`, `modern`, `creative`, `elegant`, `professional`) rendered server-side via `pdfkit`.
   - Pre-send AI Health Check (`POST /api/ai/health-check`), client share portal links (`/?portal=<token>`), duplicate/void/delete draft support.
4. **Estimates & Proposals**:
   - Standard and optional line items, PDF downloads, public client approval/rejection portal with comments, and 1-click conversion into an invoice.
5. **Clients CRM & Payments**:
   - Client CRUD, CSV import/export, duplicate email protection, Client Detail Drawer, partial & full payment recording, and PDF payment receipts.
6. **AI Payment Reminders**:
   - Due/overdue aging buckets, 5 selectable tones, Gemini reminder drafting (`POST /api/ai/generate-reminder`), and mandatory human approval before sending or scheduling.
7. **Expenses & Receipt OCR**:
   - Manual expense logging, category analytics, CSV export, and multimodal Gemini Receipt OCR (`POST /api/ai/extract-receipt`) with user verification.
8. **Recurring Billing, Analytics & Pilot AI**:
   - Automated recurring schedules (`weekly`, `biweekly`, `monthly`, `quarterly`, `annual`, `custom`) with idempotent daily generation.
   - 7/30/60/90-day cash flow forecast and One-Click Monthly Business Report PDF (`POST /api/pdf/monthly-report`).
   - Pilot AI Assistant (`POST /api/ai/pilot-chat`) with server-side function calling grounded in the authenticated user's stored records and confirmation cards for draft actions.
9. **Documents Vault, Settings, Subscription & Admin**:
   - Document vault, full JSON business data export, permanent account deletion, Sandbox Plan switcher, and Admin console.

## Environment Variables

See `.env.example` for supported server environment variables:
- `GEMINI_API_KEY` — Required for AI Invoice Generator, Health Check, Reminder Writer, Receipt OCR, and Pilot AI.
- `APP_URL` — Application base URL for checkout redirects.
- `STRIPE_SECRET_KEY` *(Optional)* — Enables live Stripe Checkout sessions when configured; otherwise online checkout honestly reports sandbox/unconfigured status.
- `RESEND_API_KEY` *(Optional)* & `RESEND_FROM_EMAIL` *(Optional)* — Enables direct server-side transactional email delivery; otherwise offers native `mailto:` and copyable client portal links.

## Development & Build

```bash
# Install dependencies
npm install

# Run full-stack development server (port 3000)
npm run dev

# Build production frontend bundle
npm run build

# Start production server
npm start
```

## Firestore Security Rules

Security rules are defined in `firestore.rules` and validated with `@firebase/eslint-plugin-security-rules`:

```bash
npx eslint firestore.rules
```

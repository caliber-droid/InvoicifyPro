import React, { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  ArrowRight,
  BarChart3,
  Bot,
  Check,
  ChevronDown,
  Clock,
  FileSpreadsheet,
  FileText,
  Receipt,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';
import { AnimatedButton } from '../lib/motion';
import { PLAN_CONFIGS, PlanId } from '../types/models';

interface LandingPageProps {
  onStartAuth: (mode: 'login' | 'register', preselectedPlan?: PlanId) => void;
  isAuthenticated: boolean;
  onEnterApp: () => void;
}

const FAQS = [
  {
    q: 'How does the AI invoice generator avoid making up client details or prices?',
    a: 'InvoicifyPro extracts only the services, quantities, and prices you specify in your prompt or match against your existing Client CRM. Any missing email, due date, or tax setting is flagged for your review before an invoice is issued.',
  },
  {
    q: 'Does InvoicifyPro send automated payment reminders without my approval?',
    a: 'No. You configure your reminder cadence and tone preferences, review AI-drafted messages, and approve sending or scheduling. No legally consequential collection message is ever sent automatically without your authorization.',
  },
  {
    q: 'Can clients view and pay invoices online without creating an account?',
    a: 'Yes. Every issued invoice and estimate can generate a secure client-facing portal link where your customer can review line items, download a PDF copy, approve or comment on estimates, and submit payment when online checkout is configured.',
  },
  {
    q: 'Is InvoicifyPro certified tax or accounting software?',
    a: 'No. InvoicifyPro is an invoicing, billing, expense tracking, and operational cash flow management platform. It supports configurable US sales tax rates per business and exports structured records for your CPA or bookkeeper.',
  },
];

export const LandingPage: React.FC<LandingPageProps> = ({
  onStartAuth,
  isAuthenticated,
  onEnterApp,
}) => {
  const reduced = useReducedMotion();
  const [annualBilling, setAnnualBilling] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [studioImgFailed, setStudioImgFailed] = useState(false);

  const plans = Object.values(PLAN_CONFIGS);

  return (
    <div className="min-h-screen bg-[#F5F7FA] text-[#172033]">
      {/* Strict 3-Zone Top Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80">
        <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <a href="#top" className="focus-visible:outline-2 focus-visible:outline-[#2563EB] rounded">
            <BrandLogo />
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
            <a href="#how-it-works" className="hover:text-[#172B4D] transition-colors whitespace-nowrap shrink-0">
              How It Works
            </a>
            <a href="#features" className="hover:text-[#172B4D] transition-colors whitespace-nowrap shrink-0">
              Features
            </a>
            <a href="#pricing" className="hover:text-[#172B4D] transition-colors whitespace-nowrap shrink-0">
              Pricing
            </a>
            <a href="#faq" className="hover:text-[#172B4D] transition-colors whitespace-nowrap shrink-0">
              FAQ
            </a>
          </nav>

          <div className="flex items-center shrink-0">
            {isAuthenticated ? (
              <AnimatedButton size="sm" onClick={onEnterApp}>
                <span>Open Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </AnimatedButton>
            ) : (
              <AnimatedButton size="sm" onClick={() => onStartAuth('register')}>
                <span>Start for Free</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </AnimatedButton>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section id="top" className="relative overflow-hidden bg-white border-b border-slate-200">
        <div className="max-w-[1200px] mx-auto px-6 py-16 lg:py-24">
          <div className="grid lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
            <motion.div
              initial={reduced ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="lg:col-span-6 flex flex-col justify-center"
            >
              <p className="text-xs font-semibold tracking-wide text-[#2563EB] mb-3">
                Built for US freelancers, consultants, and service businesses
              </p>
              <h1
                className="font-display font-bold tracking-tight text-[#172B4D] leading-[1.1] mb-5"
                style={{ fontSize: 'clamp(2.25rem, 4vw, 3.5rem)', textWrap: 'balance' }}
              >
                Get Paid Faster. Manage Your Business Smarter.
              </h1>
              <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl mb-8">
                Create professional invoices, automate payment reminders, and take control of your business finances with AI.
              </p>

              <div className="flex flex-wrap items-center gap-3.5 mb-8">
                <AnimatedButton
                  size="lg"
                  onClick={() => (isAuthenticated ? onEnterApp() : onStartAuth('register'))}
                >
                  <span>{isAuthenticated ? 'Go to Workspace' : 'Start for Free'}</span>
                  <ArrowRight className="w-4 h-4" />
                </AnimatedButton>
                <a
                  href="#features"
                  className="inline-flex items-center justify-center px-5 py-2.5 min-h-[44px] text-sm font-medium text-[#172B4D] bg-slate-100 hover:bg-slate-200/80 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  Explore Features
                </a>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
                <span>USD ($) native billing</span>
                <span aria-hidden="true">·</span>
                <span>6 invoice PDF templates</span>
                <span aria-hidden="true">·</span>
                <span>Free plan available</span>
              </div>
            </motion.div>

            <motion.div
              initial={reduced ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="lg:col-span-6 relative flex flex-col"
            >
              <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 flex-1 min-h-[340px]">
                {!heroImgFailed ? (
                  <img
                    src="/src/assets/images/hero_fintech_workspace_1795032859343.jpg"
                    alt="Independent American design and consulting workspace"
                    referrerPolicy="no-referrer"
                    onError={() => setHeroImgFailed(true)}
                    className="w-full h-full object-cover min-h-[340px]"
                  />
                ) : (
                  <div className="w-full h-full min-h-[340px] bg-gradient-to-br from-[#172B4D] to-[#2563EB] flex items-center justify-center p-8 text-white">
                    <FileText className="w-12 h-12 opacity-75" />
                  </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-[#0F1D36]/80 via-[#0F1D36]/20 to-transparent" />

                {/* Floating Illustrative Invoice Preview Card */}
                <motion.div
                  animate={reduced ? undefined : { y: [0, -5, 0] }}
                  transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute bottom-4 left-4 right-4 sm:left-6 sm:right-6 bg-white/96 backdrop-blur-md border border-slate-200 rounded-xl p-4 shadow-lg"
                >
                  <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-2.5 mb-2.5">
                    <div>
                      <p className="text-[11px] font-medium text-slate-500">
                        Illustrative invoice preview · #INV-1042
                      </p>
                      <p className="font-display text-sm font-bold text-[#172033]">
                        Northstar Web Studio → Horizon Retail LLC
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-[#16A34A] bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                      Paid
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div>
                      <p className="text-slate-500">Subtotal</p>
                      <p className="font-mono font-semibold text-[#172033] tabular-nums">$3,250.00</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Terms</p>
                      <p className="font-medium text-[#172033]">Net 15</p>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-500">Collected</p>
                      <p className="font-mono font-bold text-[#2563EB] tabular-nums">$3,250.00</p>
                    </div>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="max-w-[1200px] mx-auto px-6 py-20">
        <div className="max-w-2xl mb-12">
          <h2 className="font-display text-3xl font-bold text-[#172B4D] tracking-tight mb-3" style={{ textWrap: 'balance' }}>
            From project scope to settled payment in four clear steps
          </h2>
          <p className="text-slate-600 text-base">
            Every workflow keeps your business profile, client ledger, and receivables synchronized in real time.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              num: '01. Business Setup',
              title: 'Configure defaults once',
              desc: 'Set USD billing, Net terms, invoice numbering, logo branding, and local sales tax rates.',
            },
            {
              num: '02. Draft & Verify',
              title: 'Generate with AI or manually',
              desc: 'Dictate or type line items, run the pre-send Health Check, and choose from 6 PDF templates.',
            },
            {
              num: '03. Share & Remind',
              title: 'Deliver with follow-up control',
              desc: 'Share client portal links, track views, and schedule tailored payment reminders you approve.',
            },
            {
              num: '04. Track & Forecast',
              title: 'Monitor cash flow live',
              desc: 'Record full or partial payments, scan expense receipts, and review 7–90 day cash flow projections.',
            },
          ].map((step) => (
            <div
              key={step.num}
              className="bg-white border border-slate-200 rounded-xl p-6 hover:border-slate-300 transition-colors"
            >
              <p className="text-xs font-mono font-semibold text-[#2563EB] mb-2">{step.num}</p>
              <h3 className="font-display text-lg font-semibold text-[#172033] mb-2">{step.title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Core Capabilities Asymmetric Bento */}
      <section id="features" className="bg-white border-y border-slate-200 py-20">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="max-w-2xl mb-12">
            <h2 className="font-display text-3xl font-bold text-[#172B4D] tracking-tight mb-3" style={{ textWrap: 'balance' }}>
              Complete billing, CRM, and AI financial operations
            </h2>
            <p className="text-slate-600 text-base">
              Built with exact integer-cent arithmetic so totals, partial payments, and balances never suffer floating-point drift.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-2 bg-[#F5F7FA] border border-slate-200 rounded-xl p-7 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2.5 text-[#2563EB] mb-3">
                  <FileText className="w-5 h-5" />
                  <h3 className="font-display text-xl font-bold text-[#172033]">
                    AI Invoice &amp; Smart Estimate Generator
                  </h3>
                </div>
                <p className="text-sm text-slate-600 max-w-xl leading-relaxed mb-6">
                  Describe work in plain English or dictate by voice. InvoicifyPro extracts line items, quantities, rates, and expenses into a draft you review before issuing—complete with 6 PDF templates, Health Check validation, and 1-click Estimate-to-Invoice conversion.
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-4 text-xs font-mono text-slate-700">
                &ldquo;Create an invoice for John Smith for 10 hours of web design at $75/hr, plus $100 hosting expenses.&rdquo;
              </div>
            </div>

            <div className="bg-[#F5F7FA] border border-slate-200 rounded-xl p-7">
              <div className="flex items-center gap-2.5 text-[#172B4D] mb-3">
                <Clock className="w-5 h-5 text-[#2563EB]" />
                <h3 className="font-display text-xl font-bold text-[#172033]">AI Payment Reminders</h3>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed mb-4">
                Detect invoices approaching due dates or overdue by 1–15+ days. Generate Friendly, Polite, Firm, or Final Notice drafts tailored to client history—always reviewed by you before sending.
              </p>
              <div className="text-xs text-slate-500 space-y-1.5 border-t border-slate-200 pt-3">
                <p>3 days before due · Friendly nudge</p>
                <p>Due date · Payment due notice</p>
                <p>7 days overdue · Professional follow-up</p>
              </div>
            </div>

            <div className="bg-[#F5F7FA] border border-slate-200 rounded-xl p-7">
              <div className="flex items-center gap-2.5 mb-3">
                <Users className="w-5 h-5 text-[#2563EB]" />
                <h3 className="font-display text-xl font-bold text-[#172033]">Client CRM &amp; Portal</h3>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Track total billed, paid, overdue balances, and average collection speed per client. Import/export CSV records, guard against duplicate emails, and share secure invoice &amp; estimate approval links.
              </p>
            </div>

            <div className="bg-[#F5F7FA] border border-slate-200 rounded-xl p-7">
              <div className="flex items-center gap-2.5 mb-3">
                <Receipt className="w-5 h-5 text-[#2563EB]" />
                <h3 className="font-display text-xl font-bold text-[#172033]">Expense &amp; Receipt OCR</h3>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Upload receipt images or PDFs so Gemini extracts vendor, date, total, tax, and category for your verification. Export CSVs and category breakdowns anytime.
              </p>
            </div>

            <div className="bg-[#F5F7FA] border border-slate-200 rounded-xl p-7">
              <div className="flex items-center gap-2.5 mb-3">
                <Bot className="w-5 h-5 text-[#2563EB]" />
                <h3 className="font-display text-xl font-bold text-[#172033]">Pilot AI Assistant</h3>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Query your stored revenue, overdue invoices, and top clients conversationally. Pilot AI never fabricates numbers and always requires confirmation before saving or sending documents.
              </p>
            </div>
          </div>

          {/* Editorial Feature Spotlight */}
          <div className="mt-10 grid lg:grid-cols-12 gap-8 items-stretch bg-[#172B4D] text-white rounded-2xl overflow-hidden">
            <div className="lg:col-span-7 p-8 sm:p-10 flex flex-col justify-center">
              <div className="flex items-center gap-2 text-[#38BDF8] text-xs font-semibold mb-3">
                <BarChart3 className="w-4 h-4" />
                <span>Analytics, Forecasting &amp; One-Click Monthly PDF Reports</span>
              </div>
              <h3 className="font-display text-2xl sm:text-3xl font-bold mb-4" style={{ textWrap: 'balance' }}>
                See actual collected revenue separately from projected cash flow
              </h3>
              <p className="text-slate-300 text-sm sm:text-base leading-relaxed mb-6">
                Filter across Week, Month, 30 Days, 90 Days, or Year. Forecast 7, 30, 60, and 90 days out using open receivables and recurring schedules—with explicit confidence intervals and zero unverified claims.
              </p>
              <div className="flex flex-wrap gap-3">
                <AnimatedButton
                  onClick={() => (isAuthenticated ? onEnterApp() : onStartAuth('register'))}
                  className="bg-[#2563EB] hover:bg-[#3B82F6]"
                >
                  <span>Explore the Live Workspace</span>
                  <ArrowRight className="w-4 h-4" />
                </AnimatedButton>
              </div>
            </div>
            <div className="lg:col-span-5 min-h-[260px] bg-slate-800">
              {!studioImgFailed ? (
                <img
                  src="/src/assets/images/studio_client_meeting_1795032859987.jpg"
                  alt="Consultant reviewing project invoices and financials"
                  referrerPolicy="no-referrer"
                  onError={() => setStudioImgFailed(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center p-8">
                  <FileSpreadsheet className="w-12 h-12 text-[#38BDF8]" />
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="max-w-[1200px] mx-auto px-6 py-20">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-12">
          <div>
            <h2 className="font-display text-3xl font-bold text-[#172B4D] tracking-tight mb-2">
              Transparent plans as your business grows
            </h2>
            <p className="text-slate-600 text-base">
              Start free with real persistence and PDF exports. Upgrade or test plans anytime.
            </p>
          </div>

          <div className="inline-flex items-center gap-1 p-1 bg-white border border-slate-200 rounded-lg self-start">
            <button
              type="button"
              onClick={() => setAnnualBilling(false)}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                !annualBilling ? 'bg-[#172B4D] text-white' : 'text-slate-600 hover:text-[#172033]'
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setAnnualBilling(true)}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                annualBilling ? 'bg-[#172B4D] text-white' : 'text-slate-600 hover:text-[#172033]'
              }`}
            >
              Annual (Save ~17%)
            </button>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {plans.map((plan) => {
            const price = annualBilling ? plan.annualPricePerMonth : plan.monthlyPrice;
            const featured = plan.id === 'pro';
            return (
              <motion.div
                key={plan.id}
                whileHover={reduced ? undefined : { y: -3 }}
                transition={{ duration: 0.18 }}
                className={`bg-white rounded-xl p-6 flex flex-col justify-between border ${
                  featured ? 'border-[#2563EB] shadow-md' : 'border-slate-200'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h3 className="font-display text-lg font-bold text-[#172033]">{plan.name}</h3>
                    {featured && (
                      <span className="text-[11px] font-semibold text-[#2563EB]">Most Popular</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mb-5">{plan.audience}</p>

                  <div className="flex items-baseline gap-1 mb-6">
                    <span className="font-display text-3xl font-bold text-[#172B4D] tabular-nums">
                      ${price}
                    </span>
                    <span className="text-xs text-slate-500">/month{annualBilling && price > 0 ? ' billed annually' : ''}</span>
                  </div>

                  <ul className="space-y-2.5 text-xs text-slate-600 mb-6">
                    {plan.highlights.map((h) => (
                      <li key={h} className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-[#16A34A] shrink-0 mt-0.5" />
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <AnimatedButton
                  variant={featured ? 'primary' : 'secondary'}
                  className="w-full"
                  onClick={() => (isAuthenticated ? onEnterApp() : onStartAuth('register', plan.id))}
                >
                  <span>{plan.monthlyPrice === 0 ? 'Start for Free' : `Choose ${plan.name}`}</span>
                </AnimatedButton>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="bg-white border-t border-slate-200 py-20">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="font-display text-3xl font-bold text-[#172B4D] tracking-tight mb-8 text-center">
            Frequently Asked Questions
          </h2>
          <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl bg-white overflow-hidden">
            {FAQS.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div key={item.q}>
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full px-6 py-4 text-left flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <span className="font-display text-sm sm:text-base font-semibold text-[#172033]">
                      {item.q}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-500 shrink-0 transition-transform duration-200 ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={reduced ? false : { height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={reduced ? undefined : { height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <p className="px-6 pb-5 text-sm text-slate-600 leading-relaxed">{item.a}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Final Conversion CTA */}
      <section className="bg-[#172B4D] text-white py-16">
        <div className="max-w-[1200px] mx-auto px-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div className="max-w-xl">
            <h2 className="font-display text-2xl sm:text-3xl font-bold mb-2">
              Take Control of Your Invoices. Get Paid Faster.
            </h2>
            <p className="text-slate-300 text-sm sm:text-base">
              Smart Invoicing. Faster Payments. Better Business. Set up your workspace in under two minutes.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <AnimatedButton
              size="lg"
              onClick={() => (isAuthenticated ? onEnterApp() : onStartAuth('register'))}
              className="bg-[#2563EB] hover:bg-[#3B82F6]"
            >
              <span>{isAuthenticated ? 'Open Dashboard' : 'Start for Free'}</span>
              <ArrowRight className="w-4 h-4" />
            </AnimatedButton>
            {!isAuthenticated && (
              <button
                type="button"
                onClick={() => onStartAuth('login')}
                className="px-4 py-2.5 min-h-[44px] text-sm font-medium text-white border border-white/25 rounded-lg hover:bg-white/10 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Quiet Footer */}
      <footer className="bg-[#0F1D36] text-slate-400 border-t border-white/10 py-10">
        <div className="max-w-[1200px] mx-auto px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 text-xs">
          <div className="space-y-2">
            <BrandLogo lightText size="sm" />
            <p className="max-w-md text-slate-400">
              InvoicifyPro provides operational billing, invoicing, and cash flow tools for US businesses. Not certified accounting, tax preparation, or legal advice.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-5">
            <span className="inline-flex items-center gap-1.5 text-slate-300">
              <ShieldCheck className="w-3.5 h-3.5 text-[#38BDF8]" />
              <span>Workspace-isolated data</span>
            </span>
            <a href="#pricing" className="hover:text-white transition-colors">
              Pricing
            </a>
            <a href="#faq" className="hover:text-white transition-colors">
              FAQ
            </a>
            <span>&copy; {new Date().getFullYear()} InvoicifyPro</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { Check, CreditCard, Info, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { SponsoredLeaderboardBanner } from '../../components/SponsoredBanner';
import { useToast } from '../../context/ToastContext';
import { apiGet, apiPost } from '../../lib/api';
import { updateUserAccount } from '../../lib/firestoreRepo';
import { AnimatedButton } from '../../lib/motion';
import { BillingCycle, PLAN_CONFIGS, PlanId } from '../../types/models';

export const SubscriptionView: React.FC = () => {
  const { firebaseUser, userAccount } = useAuth();
  const { usageStats } = useData();
  const { notify } = useToast();

  const [cycle, setCycle] = useState<BillingCycle>(userAccount?.billingCycle || 'monthly');
  const [switchingPlan, setSwitchingPlan] = useState<PlanId | null>(null);
  const [stripeConfigured, setStripeConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    apiGet<{ stripeConfigured: boolean }>('/api/integrations/status')
      .then((res) => setStripeConfigured(res.stripeConfigured))
      .catch(() => setStripeConfigured(false));
  }, []);

  const currentPlanId = userAccount?.plan || 'free';
  const currentPlan = PLAN_CONFIGS[currentPlanId];

  const handleSandboxSwitch = async (planId: PlanId) => {
    if (!firebaseUser) return;
    setSwitchingPlan(planId);
    try {
      await updateUserAccount(firebaseUser.uid, { plan: planId, billingCycle: cycle });
      notify('success', `Switched to ${PLAN_CONFIGS[planId].name} (${cycle})`, 'Updated in Sandbox Test Mode.');
    } catch (err: any) {
      notify('error', 'Plan update failed', err?.message);
    } finally {
      setSwitchingPlan(null);
    }
  };

  const handleStripeCheckout = async (planId: PlanId) => {
    const plan = PLAN_CONFIGS[planId];
    const price = cycle === 'annual' ? plan.annualPricePerMonth * 12 : plan.monthlyPrice;
    try {
      const res = await apiPost<{ url: string }>(
        '/api/stripe/create-checkout',
        {
          amountCents: price * 100,
          description: `InvoicifyPro ${plan.name} (${cycle})`,
          customerEmail: userAccount?.email,
          successUrl: `${window.location.origin}/?billing=success`,
          cancelUrl: `${window.location.origin}/?billing=cancelled`,
        },
        false
      );
      if (res.url) window.location.assign(res.url);
    } catch (err: any) {
      notify('info', 'Live Stripe Billing Not Configured', err?.message || 'Use Sandbox Test Switch below to test plan features.');
    }
  };

  const renderMeter = (label: string, used: number, max: number | null) => {
    const pct = max ? Math.min(100, Math.round((used / max) * 100)) : 0;
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-slate-600">{label}</span>
          <span className="font-mono font-semibold text-[#172033] tabular-nums">
            {used} / {max === null ? 'Unlimited' : max}
          </span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            style={{ width: max === null ? '18%' : `${pct}%` }}
            className={`h-full rounded-full transition-all duration-300 ${
              max !== null && pct >= 90 ? 'bg-amber-500' : 'bg-[#2563EB]'
            }`}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#172B4D]">Subscription &amp; Usage</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Current Plan: <strong className="text-[#172033]">{currentPlan.name}</strong> ({userAccount?.billingCycle || 'monthly'})
          </p>
        </div>

        <div className="inline-flex items-center p-1 bg-white border border-slate-200 rounded-lg self-start">
          {(['monthly', 'annual'] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCycle(c)}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md capitalize cursor-pointer transition-colors ${
                cycle === c ? 'bg-[#172B4D] text-white' : 'text-slate-600 hover:text-[#172033]'
              }`}
            >
              {c} {c === 'annual' ? '(Save ~17%)' : ''}
            </button>
          ))}
        </div>
      </div>

      {/* Usage Meters */}
      <div className="grid sm:grid-cols-3 gap-4">
        {renderMeter('Invoices This Month', usageStats.invoicesThisMonth, usageStats.invoiceLimit)}
        {renderMeter('Estimates This Month', usageStats.estimatesThisMonth, usageStats.estimateLimit)}
        {renderMeter('Active Clients', usageStats.activeClientsCount, usageStats.clientLimit)}
      </div>

      {/* Integration Transparency Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <Info className="w-4 h-4 text-[#2563EB] shrink-0 mt-0.5" />
        <div className="text-xs text-slate-700 space-y-1">
          <p className="font-semibold text-[#172B4D]">
            {stripeConfigured
              ? 'Live Stripe Checkout is active on this server.'
              : 'Sandbox Plan Testing Mode (Stripe Secret Key not configured)'}
          </p>
          <p>
            Use <strong>Switch in Sandbox Mode</strong> on any tier to test plan entitlements immediately (AI features, recurring schedules, unlimited invoices) without fabricating real card charges.
          </p>
        </div>
      </div>

      <SponsoredLeaderboardBanner />

      {/* Plan Cards */}
      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-5">
        {(Object.keys(PLAN_CONFIGS) as PlanId[]).map((pid) => {
          const plan = PLAN_CONFIGS[pid];
          const isCurrent = currentPlanId === pid;
          const price = cycle === 'annual' ? plan.annualPricePerMonth : plan.monthlyPrice;

          return (
            <div
              key={pid}
              className={`bg-white rounded-xl p-6 flex flex-col justify-between border transition-colors ${
                isCurrent ? 'border-[#2563EB] ring-1 ring-[#2563EB]' : 'border-slate-200'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h2 className="font-display text-lg font-bold text-[#172033]">{plan.name}</h2>
                  {isCurrent && (
                    <span className="text-[11px] font-semibold text-[#2563EB] bg-blue-50 px-2 py-0.5 rounded">
                      Current
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mb-4">{plan.audience}</p>
                <div className="flex items-baseline gap-1 mb-5">
                  <span className="font-display text-3xl font-bold text-[#172B4D] tabular-nums">${price}</span>
                  <span className="text-xs text-slate-500">/mo</span>
                </div>
                <ul className="space-y-2.5 text-xs text-slate-700 mb-6">
                  {plan.highlights.map((h) => (
                    <li key={h} className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-[#16A34A] shrink-0 mt-0.5" />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-2">
                <AnimatedButton
                  className="w-full"
                  variant={isCurrent ? 'secondary' : 'primary'}
                  disabled={isCurrent}
                  loading={switchingPlan === pid}
                  onClick={() => handleSandboxSwitch(pid)}
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{isCurrent ? 'Active Plan' : `Switch in Sandbox Mode`}</span>
                </AnimatedButton>
                {pid !== 'free' && stripeConfigured && !isCurrent && (
                  <AnimatedButton
                    className="w-full"
                    variant="secondary"
                    size="sm"
                    onClick={() => handleStripeCheckout(pid)}
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Subscribe via Stripe</span>
                  </AnimatedButton>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

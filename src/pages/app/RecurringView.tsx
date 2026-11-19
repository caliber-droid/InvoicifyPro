import React, { useMemo, useState } from 'react';
import {
  CalendarClock,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  Trash2,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { SponsoredLeaderboardBanner } from '../../components/SponsoredBanner';
import { useToast } from '../../context/ToastContext';
import {
  computeNextRunDate,
  createRecurringProfile,
  runRecurringScheduleOnce,
  updateRecurringProfile,
} from '../../lib/firestoreRepo';
import { AnimatedButton, AnimatedModal, StatusBadge } from '../../lib/motion';
import {
  calculateLineItemCents,
  centsToDollarsInput,
  formatUsd,
  generateRandomId,
  parseDollarsToCents,
  todayIso,
} from '../../lib/money';
import { LineItem, PLAN_CONFIGS, RecurringFrequency, RecurringProfile } from '../../types/models';

export const RecurringView: React.FC<{
  onNavigate?: (tab: string) => void;
}> = ({ onNavigate }) => {
  const { firebaseUser, userAccount, businessProfile } = useAuth();
  const { recurringProfiles, clients } = useData();
  const { notify } = useToast();

  const planCfg = PLAN_CONFIGS[userAccount?.plan || 'free'];
  const activeClients = useMemo(() => clients.filter((c) => !c.archived), [clients]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringProfile | null>(null);
  const [title, setTitle] = useState('');
  const [clientId, setClientId] = useState('');
  const [frequency, setFrequency] = useState<RecurringFrequency>('monthly');
  const [customDays, setCustomDays] = useState('30');
  const [startDate, setStartDate] = useState(todayIso());
  const [endDate, setEndDate] = useState('');
  const [paymentTermsDays, setPaymentTermsDays] = useState('15');
  const [taxPct, setTaxPct] = useState('0');
  const [autoNotify, setAutoNotify] = useState(false);
  const [items, setItems] = useState<LineItem[]>([
    { id: generateRandomId('li'), description: '', quantity: 1, unitPriceCents: 0, totalCents: 0 },
  ]);
  const [saving, setSaving] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);

  const openModal = (profile: RecurringProfile | null) => {
    setEditing(profile);
    if (profile) {
      setTitle(profile.title);
      setClientId(profile.clientId);
      setFrequency(profile.frequency);
      setCustomDays(String(profile.customIntervalDays || 30));
      setStartDate(profile.startDate);
      setEndDate(profile.endDate || '');
      setPaymentTermsDays(String(profile.paymentTermsDays));
      setTaxPct(((profile.taxRateBps || 0) / 100).toFixed(2).replace(/\.00$/, ''));
      setAutoNotify(profile.autoNotify);
      setItems(profile.items.map((it) => ({ ...it })));
    } else {
      setTitle('');
      setClientId(activeClients[0]?.id || '');
      setFrequency('monthly');
      setCustomDays('30');
      setStartDate(todayIso());
      setEndDate('');
      setPaymentTermsDays(String(businessProfile?.defaultDueDays ?? 15));
      setTaxPct(((businessProfile?.defaultTaxRateBps ?? 0) / 100).toFixed(2).replace(/\.00$/, ''));
      setAutoNotify(false);
      setItems([
        { id: generateRandomId('li'), description: '', quantity: 1, unitPriceCents: 0, totalCents: 0 },
      ]);
    }
    setModalOpen(true);
  };

  const subtotalCents = useMemo(() => items.reduce((s, i) => s + i.totalCents, 0), [items]);
  const taxRateBps = useMemo(() => Math.max(0, Math.min(5000, Math.round((Number.parseFloat(taxPct) || 0) * 100))), [taxPct]);
  const taxCents = Math.round((subtotalCents * taxRateBps) / 10000);
  const totalCents = subtotalCents + taxCents;

  const updateItem = (idx: number, patch: Partial<LineItem>) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        const next = { ...item, ...patch };
        next.totalCents = calculateLineItemCents(next.quantity, next.unitPriceCents);
        return next;
      })
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    if (!planCfg.recurringEnabled) {
      notify('warning', 'Pro or Business plan required', 'Switch to Pro or Business in Subscription to automate recurring billing.');
      return;
    }
    const client = clients.find((c) => c.id === clientId);
    if (!client) {
      notify('warning', 'Client required', 'Please select or create a client first.');
      return;
    }
    const cleanItems = items
      .filter((i) => i.description.trim())
      .map((i) => ({
        id: i.id,
        description: i.description.trim().slice(0, 300),
        quantity: Number(i.quantity) || 1,
        unitPriceCents: Math.max(0, Math.round(i.unitPriceCents)),
        totalCents: calculateLineItemCents(Number(i.quantity) || 1, Math.max(0, Math.round(i.unitPriceCents))),
      }));

    if (cleanItems.length === 0) {
      notify('warning', 'Line item required', 'Add at least one billable item.');
      return;
    }

    const parsedCustomDays = Math.max(1, Math.min(365, Math.round(Number(customDays) || 30)));
    const parsedTerms = Math.max(0, Math.min(365, Math.round(Number(paymentTermsDays) || 15)));

    setSaving(true);
    try {
      if (editing) {
        const patch: Partial<RecurringProfile> = {
          title: title.trim().slice(0, 160),
          frequency,
          nextRunDate: computeNextRunDate(startDate, frequency, parsedCustomDays),
          paymentTermsDays: parsedTerms,
          items: cleanItems,
          taxRateBps,
          totalCents,
          autoNotify,
          ...(frequency === 'custom' ? { customIntervalDays: parsedCustomDays } : {}),
          ...(endDate.trim() ? { endDate: endDate.trim() } : {}),
        };
        await updateRecurringProfile(editing.id, patch);
        notify('success', 'Recurring schedule updated');
      } else {
        const payload: Omit<RecurringProfile, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'> = {
          clientId: client.id,
          clientName: client.name,
          clientEmail: client.email,
          title: title.trim().slice(0, 160),
          frequency,
          startDate,
          nextRunDate: startDate,
          paymentTermsDays: parsedTerms,
          items: cleanItems,
          taxRateBps,
          totalCents,
          status: 'active',
          autoNotify,
          runCount: 0,
          ...(frequency === 'custom' ? { customIntervalDays: parsedCustomDays } : {}),
          ...(endDate.trim() ? { endDate: endDate.trim() } : {}),
        };
        await createRecurringProfile(firebaseUser.uid, payload);
        notify('success', 'Recurring schedule created');
      }
      setModalOpen(false);
    } catch (err: any) {
      notify('error', 'Failed to save recurring schedule', err?.message);
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (profile: RecurringProfile, nextStatus: RecurringProfile['status']) => {
    try {
      await updateRecurringProfile(profile.id, { status: nextStatus });
      notify('info', `Schedule ${nextStatus}`, `${profile.title} is now ${nextStatus}.`);
    } catch (err: any) {
      notify('error', 'Could not update schedule status', err?.message);
    }
  };

  const handleRunNow = async (profile: RecurringProfile) => {
    if (!firebaseUser || !businessProfile) return;
    setRunningId(profile.id);
    try {
      const res = await runRecurringScheduleOnce(
        firebaseUser.uid,
        profile,
        businessProfile.nextInvoiceNumber || 1,
        businessProfile.invoiceNumberFormat || 'INV-',
        businessProfile.businessName,
        businessProfile.businessEmail,
        businessProfile.defaultTemplate || 'corporate',
        businessProfile.watermarkConfig
      );
      notify('success', `Invoice ${res.invoiceNumber} generated`, `Created from "${profile.title}".`);
    } catch (err: any) {
      notify('warning', 'Schedule not executed', err?.message || 'Unable to run schedule.');
    } finally {
      setRunningId(null);
    }
  };

  const mrrEstimateCents = useMemo(() => {
    return recurringProfiles
      .filter((r) => r.status === 'active')
      .reduce((sum, r) => {
        switch (r.frequency) {
          case 'weekly':
            return sum + Math.round(r.totalCents * 4.33);
          case 'biweekly':
            return sum + Math.round(r.totalCents * 2.16);
          case 'monthly':
            return sum + r.totalCents;
          case 'quarterly':
            return sum + Math.round(r.totalCents / 3);
          case 'annual':
            return sum + Math.round(r.totalCents / 12);
          default:
            return sum + Math.round((r.totalCents * 30) / Math.max(1, r.customIntervalDays || 30));
        }
      }, 0);
  }, [recurringProfiles]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#172B4D]">Recurring Billing</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Automate retainer invoices on weekly, biweekly, monthly, quarterly, annual, or custom cadences.
          </p>
        </div>
        <AnimatedButton onClick={() => openModal(null)} disabled={!planCfg.recurringEnabled && activeClients.length === 0}>
          <Plus className="w-4 h-4" />
          <span>New Recurring Schedule</span>
        </AnimatedButton>
      </div>

      {!planCfg.recurringEnabled && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-amber-900">
              Recurring Billing is included in Pro &amp; Business plans
            </p>
            <p className="text-xs text-amber-800 mt-0.5">
              You are currently on the {planCfg.name} plan. Upgrade or switch plans in Sandbox Test Mode to create automated schedules.
            </p>
          </div>
          {onNavigate && (
            <AnimatedButton size="sm" variant="secondary" onClick={() => onNavigate('subscription')}>
              Manage Plan
            </AnimatedButton>
          )}
        </div>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Active Schedules</p>
          <p className="font-display text-2xl font-bold text-[#172033] mt-1 tabular-nums">
            {recurringProfiles.filter((r) => r.status === 'active').length}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Normalized Monthly Retainer Value</p>
          <p className="font-display text-2xl font-bold text-[#2563EB] mt-1 tabular-nums">
            {formatUsd(mrrEstimateCents)}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Total Invoices Generated</p>
          <p className="font-display text-2xl font-bold text-[#172033] mt-1 tabular-nums">
            {recurringProfiles.reduce((s, r) => s + (r.runCount || 0), 0)}
          </p>
        </div>
      </div>

      <SponsoredLeaderboardBanner />

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {recurringProfiles.length === 0 ? (
          <div className="p-12 text-center">
            <CalendarClock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="font-display text-base font-semibold text-[#172033]">No recurring profiles yet</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
              Set up retainers, maintenance contracts, or monthly subscriptions with idempotent invoice generation.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Schedule</th>
                  <th className="py-3 px-4">Client</th>
                  <th className="py-3 px-4">Frequency</th>
                  <th className="py-3 px-4">Next Run</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {recurringProfiles.map((prof) => (
                  <tr key={prof.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-[#172033]">{prof.title}</p>
                      <p className="text-xs text-slate-500">
                        {prof.runCount} run(s) · {prof.autoNotify ? 'Auto-issue on run' : 'Save as draft'}
                      </p>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">{prof.clientName}</td>
                    <td className="py-3.5 px-4 text-slate-600 capitalize">
                      {prof.frequency === 'custom'
                        ? `Every ${prof.customIntervalDays || 30} days`
                        : prof.frequency}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-600 tabular-nums">
                      {prof.nextRunDate}
                      {prof.lastRunDate && (
                        <span className="block text-[11px] text-slate-400">Last: {prof.lastRunDate}</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-semibold text-[#172033] tabular-nums">
                      {formatUsd(prof.totalCents)}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={prof.status} />
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center justify-end gap-1">
                        {prof.status === 'active' && (
                          <button
                            type="button"
                            onClick={() => handleRunNow(prof)}
                            disabled={runningId === prof.id}
                            title="Generate invoice now"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#2563EB] bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${runningId === prof.id ? 'animate-spin' : ''}`} />
                            <span>Run Now</span>
                          </button>
                        )}
                        {prof.status === 'active' && (
                          <button
                            type="button"
                            onClick={() => handleStatusChange(prof, 'paused')}
                            title="Pause schedule"
                            className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <PauseCircle className="w-4 h-4" />
                          </button>
                        )}
                        {prof.status === 'paused' && (
                          <button
                            type="button"
                            onClick={() => handleStatusChange(prof, 'active')}
                            title="Resume schedule"
                            className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <PlayCircle className="w-4 h-4" />
                          </button>
                        )}
                        {prof.status !== 'cancelled' && (
                          <>
                            <button
                              type="button"
                              onClick={() => openModal(prof)}
                              className="px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStatusChange(prof, 'cancelled')}
                              title="Cancel schedule"
                              className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AnimatedModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Recurring Schedule' : 'Create Recurring Billing Schedule'}
        subtitle="Generates consistent USD invoices with idempotent daily protection."
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Schedule Title</label>
              <input
                type="text"
                required
                placeholder="e.g. Monthly SEO Retainer"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#2563EB]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Client</label>
              <select
                required
                disabled={Boolean(editing)}
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-[#2563EB] disabled:bg-slate-100"
              >
                <option value="">Select client...</option>
                {activeClients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.companyName ? `(${c.companyName})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Frequency</label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as RecurringFrequency)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="weekly">Weekly</option>
                <option value="biweekly">Biweekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annual">Annual</option>
                <option value="custom">Custom Days</option>
              </select>
            </div>
            {frequency === 'custom' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Interval (Days)</label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={customDays}
                  onChange={(e) => setCustomDays(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Start Date</label>
              <input
                type="date"
                required
                disabled={Boolean(editing)}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg disabled:bg-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">End Date (Optional)</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Terms (Days)</label>
              <input
                type="number"
                min={0}
                max={365}
                value={paymentTermsDays}
                onChange={(e) => setPaymentTermsDays(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tax Rate (%)</label>
              <input
                type="number"
                step="0.01"
                min={0}
                max={50}
                value={taxPct}
                onChange={(e) => setTaxPct(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          {/* Line items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700">Recurring Line Items</label>
              <button
                type="button"
                onClick={() =>
                  setItems((prev) => [
                    ...prev,
                    { id: generateRandomId('li'), description: '', quantity: 1, unitPriceCents: 0, totalCents: 0 },
                  ])
                }
                className="text-xs font-medium text-[#2563EB] hover:underline cursor-pointer"
              >
                + Add Line Item
              </button>
            </div>
            {items.map((item, idx) => (
              <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
                <input
                  type="text"
                  placeholder="Service description"
                  value={item.description}
                  onChange={(e) => updateItem(idx, { description: e.target.value })}
                  className="col-span-6 px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
                <input
                  type="number"
                  min={0.01}
                  step="any"
                  value={item.quantity}
                  onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) || 0 })}
                  className="col-span-2 px-2.5 py-2 text-sm border border-slate-300 rounded-lg text-right"
                />
                <input
                  type="text"
                  placeholder="0.00"
                  defaultValue={item.unitPriceCents ? centsToDollarsInput(item.unitPriceCents) : ''}
                  onBlur={(e) => updateItem(idx, { unitPriceCents: parseDollarsToCents(e.target.value) })}
                  className="col-span-3 px-2.5 py-2 text-sm border border-slate-300 rounded-lg text-right font-mono"
                />
                <button
                  type="button"
                  disabled={items.length <= 1}
                  onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                  className="col-span-1 p-2 text-slate-400 hover:text-red-600 disabled:opacity-30 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <label className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={autoNotify}
              onChange={(e) => setAutoNotify(e.target.checked)}
              className="rounded border-slate-300 text-[#2563EB]"
            />
            <span>Mark generated invoices as Sent immediately (otherwise saved as Draft for review)</span>
          </label>

          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <div className="text-sm">
              <span className="text-slate-500">Total per cycle: </span>
              <span className="font-mono font-bold text-[#172033] tabular-nums">{formatUsd(totalCents)}</span>
            </div>
            <div className="flex items-center gap-2">
              <AnimatedButton type="button" variant="secondary" onClick={() => setModalOpen(false)}>
                Cancel
              </AnimatedButton>
              <AnimatedButton type="submit" loading={saving}>
                {editing ? 'Save Changes' : 'Create Schedule'}
              </AnimatedButton>
            </div>
          </div>
        </form>
      </AnimatedModal>
    </div>
  );
};

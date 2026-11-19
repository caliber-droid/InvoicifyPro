import React, { useMemo, useState } from 'react';
import {
  ArrowRightCircle,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { SponsoredLeaderboardBanner } from '../../components/SponsoredBanner';
import { useToast } from '../../context/ToastContext';
import { downloadPdfFromEndpoint } from '../../lib/api';
import { db } from '../../lib/firebase';
import {
  createEstimate,
  createInvoice,
  deleteDraftEstimate,
  fetchPortalShare,
  updateEstimate,
} from '../../lib/firestoreRepo';
import { AnimatedButton, AnimatedModal, StatusBadge } from '../../lib/motion';
import {
  addDaysIso,
  calculateInvoiceTotals,
  calculateLineItemCents,
  centsToDollarsInput,
  formatUsd,
  generateRandomId,
  parseDollarsToCents,
  todayIso,
} from '../../lib/money';
import { Estimate, LineItem } from '../../types/models';

export const EstimatesView: React.FC<{
  openNewTrigger?: number;
  onOpenPortalToken: (token: string) => void;
  onConvertedToInvoice: () => void;
}> = ({ openNewTrigger, onOpenPortalToken, onConvertedToInvoice }) => {
  const { firebaseUser, businessProfile } = useAuth();
  const { estimates, clients, invoices, usageStats } = useData();
  const { notify } = useToast();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Estimate | null>(null);
  const [saving, setSaving] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const [clientId, setClientId] = useState('');
  const [estimateNumber, setEstimateNumber] = useState('');
  const [issueDate, setIssueDate] = useState(todayIso());
  const [expirationDate, setExpirationDate] = useState(addDaysIso(todayIso(), 30));
  const [items, setItems] = useState<LineItem[]>([]);
  const [optionalItems, setOptionalItems] = useState<LineItem[]>([]);
  const [discountDollars, setDiscountDollars] = useState('0.00');
  const [taxPct, setTaxPct] = useState('0');
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');

  React.useEffect(() => {
    if (openNewTrigger && openNewTrigger > 0) {
      openBuilder(null);
    }
  }, [openNewTrigger]);

  const openBuilder = (est: Estimate | null) => {
    if (!est && !usageStats.canCreateEstimate) {
      notify('warning', 'Monthly estimate limit reached', 'Upgrade your plan to create more estimates this month.');
      return;
    }
    if (est) {
      setEditing(est);
      setClientId(est.clientId);
      setEstimateNumber(est.estimateNumber);
      setIssueDate(est.issueDate);
      setExpirationDate(est.expirationDate);
      setItems(est.items);
      setOptionalItems(est.optionalItems || []);
      setDiscountDollars(centsToDollarsInput(est.discountCents));
      setTaxPct((est.taxRateBps / 100).toString());
      setNotes(est.notes || '');
      setTerms(est.terms || '');
    } else {
      setEditing(null);
      setClientId(clients.find((c) => !c.archived)?.id || '');
      setEstimateNumber(`EST-${String(estimates.length + 1001).padStart(4, '0')}`);
      const today = todayIso();
      setIssueDate(today);
      setExpirationDate(addDaysIso(today, 30));
      setItems([
        {
          id: generateRandomId('li'),
          description: 'Project Discovery & Scope',
          quantity: 1,
          unitPriceCents: 0,
          totalCents: 0,
        },
      ]);
      setOptionalItems([]);
      setDiscountDollars('0.00');
      setTaxPct(((businessProfile?.defaultTaxRateBps || 0) / 100).toString());
      setNotes('Valid for 30 days. Let us know if you would like to adjust optional items.');
      setTerms('50% deposit due upon acceptance; balance due on project completion.');
    }
    setModalOpen(true);
  };

  const totals = useMemo(() => {
    return calculateInvoiceTotals(
      items,
      parseDollarsToCents(discountDollars),
      Math.round((Number.parseFloat(taxPct) || 0) * 100)
    );
  }, [items, discountDollars, taxPct]);

  const handleSave = async (targetStatus: 'draft' | 'sent') => {
    if (!firebaseUser) return;
    const client = clients.find((c) => c.id === clientId);
    if (!client) {
      notify('warning', 'Client required', 'Select a client before saving the estimate.');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateEstimate(editing.id, {
          clientId: client.id,
          clientName: client.name,
          clientEmail: client.email,
          estimateNumber,
          issueDate,
          expirationDate,
          items,
          optionalItems,
          ...totals,
          status: targetStatus === 'sent' && editing.status === 'draft' ? 'sent' : editing.status,
          notes,
          terms,
        });
        notify('success', 'Estimate updated', estimateNumber);
      } else {
        await createEstimate(
          firebaseUser.uid,
          {
            clientId: client.id,
            clientName: client.name,
            clientEmail: client.email,
            estimateNumber,
            issueDate,
            expirationDate,
            status: targetStatus,
            items,
            optionalItems,
            ...totals,
            notes,
            terms,
          },
          businessProfile?.businessName || 'InvoicifyPro Business',
          businessProfile?.businessEmail || firebaseUser.email || ''
        );
        notify('success', targetStatus === 'sent' ? 'Estimate issued' : 'Draft saved', estimateNumber);
      }
      setModalOpen(false);
    } catch (err: any) {
      notify('error', 'Save failed', err?.message || 'Unable to save estimate.');
    } finally {
      setSaving(false);
    }
  };

  const handleConvertToInvoice = async (est: Estimate) => {
    if (!firebaseUser) return;
    if (!usageStats.canCreateInvoice) {
      notify('warning', 'Invoice limit reached', 'Upgrade your plan to convert more estimates.');
      return;
    }
    try {
      const nextNum = businessProfile?.nextInvoiceNumber || invoices.length + 1001;
      const prefix = businessProfile?.invoiceNumberFormat || 'INV-';
      const invNumber = `${prefix}${String(nextNum).padStart(4, '0')}`;
      const today = todayIso();
      const { id } = await createInvoice(
        firebaseUser.uid,
        {
          clientId: est.clientId,
          clientName: est.clientName,
          clientEmail: est.clientEmail,
          invoiceNumber: invNumber,
          issueDate: today,
          dueDate: addDaysIso(today, businessProfile?.defaultDueDays ?? 15),
          status: 'draft',
          template: 'corporate',
          items: est.items,
          subtotalCents: est.subtotalCents,
          discountCents: est.discountCents,
          taxRateBps: est.taxRateBps,
          taxCents: est.taxCents,
          totalCents: est.totalCents,
          amountPaidCents: 0,
          balanceDueCents: est.totalCents,
          notes: `Converted from Estimate ${est.estimateNumber}. ${est.notes || ''}`.trim(),
          terms: est.terms,
        },
        businessProfile?.businessName || 'InvoicifyPro Business',
        businessProfile?.businessEmail || firebaseUser.email || ''
      );

      await updateEstimate(est.id, {
        status: 'converted',
        convertedInvoiceId: id,
      });

      await updateDoc(doc(db, 'businessProfiles', firebaseUser.uid), {
        nextInvoiceNumber: nextNum + 1,
        updatedAt: serverTimestamp(),
      }).catch(() => undefined);

      notify('success', 'Converted to Invoice', `Created draft ${invNumber} from ${est.estimateNumber}.`);
      onConvertedToInvoice();
    } catch (err: any) {
      notify('error', 'Conversion failed', err?.message || 'Unable to convert estimate.');
    }
  };

  const handleSyncClientDecision = async (est: Estimate) => {
    if (!est.publicShareToken) return;
    setSyncingId(est.id);
    try {
      const share = await fetchPortalShare(est.publicShareToken);
      if (share && (share.clientDecision === 'accepted' || share.clientDecision === 'rejected')) {
        await updateEstimate(est.id, {
          status: share.clientDecision,
          clientComment: share.clientComment || '',
        });
        notify('success', 'Client decision synced', `${est.estimateNumber} marked ${share.clientDecision}.`);
      } else {
        notify('info', 'No client response yet', 'Customer has not yet approved or declined on the portal.');
      }
    } finally {
      setSyncingId(null);
    }
  };

  const handlePdf = async (est: Estimate) => {
    const client = clients.find((c) => c.id === est.clientId);
    await downloadPdfFromEndpoint(
      '/api/pdf/document',
      {
        kind: 'estimate',
        template: 'corporate',
        docNumber: est.estimateNumber,
        issueDate: est.issueDate,
        dueDate: est.expirationDate,
        status: est.status,
        business: {
          businessName: businessProfile?.businessName || 'InvoicifyPro Business',
          businessEmail: businessProfile?.businessEmail || '',
          phone: businessProfile?.phone,
          address: businessProfile?.address,
        },
        client: {
          name: est.clientName,
          companyName: client?.companyName,
          email: est.clientEmail,
          billingAddress: client?.billingAddress,
        },
        items: est.items,
        subtotalCents: est.subtotalCents,
        discountCents: est.discountCents,
        taxCents: est.taxCents,
        totalCents: est.totalCents,
        amountPaidCents: 0,
        balanceDueCents: est.totalCents,
        notes: est.notes,
        terms: est.terms,
      },
      `Estimate-${est.estimateNumber}.pdf`
    );
    notify('success', 'PDF downloaded', `Estimate-${est.estimateNumber}.pdf`);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return estimates.filter((e) => {
      if (statusFilter !== 'all' && e.status !== statusFilter) return false;
      if (!q) return true;
      return e.estimateNumber.toLowerCase().includes(q) || e.clientName.toLowerCase().includes(q);
    });
  }, [estimates, search, statusFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#172B4D]">Estimates &amp; Quotes</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Send interactive estimates for client approval and convert accepted quotes into invoices in one click.
          </p>
        </div>
        <AnimatedButton size="sm" onClick={() => openBuilder(null)}>
          <FileText className="w-4 h-4" />
          <span>New Estimate</span>
        </AnimatedButton>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search estimate # or client..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg"
          />
        </div>
        <div className="flex flex-wrap gap-1 p-1 bg-slate-100 rounded-lg">
          {(['all', 'draft', 'sent', 'accepted', 'rejected', 'converted'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md capitalize cursor-pointer ${
                statusFilter === s ? 'bg-white text-[#172033] shadow-sm' : 'text-slate-600'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <SponsoredLeaderboardBanner />

      {filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <p className="font-display text-base font-semibold text-[#172033] mb-1">No estimates yet</p>
          <p className="text-sm text-slate-500 mb-5">
            Draft a project quote with optional add-on items and send an approval link.
          </p>
          <AnimatedButton size="sm" onClick={() => openBuilder(null)}>
            <FileText className="w-4 h-4" />
            <span>Create First Estimate</span>
          </AnimatedButton>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
                  <th className="text-left font-medium px-5 py-3">Estimate</th>
                  <th className="text-left font-medium px-4 py-3">Client</th>
                  <th className="text-left font-medium px-4 py-3">Expires</th>
                  <th className="text-left font-medium px-4 py-3">Status</th>
                  <th className="text-right font-medium px-4 py-3">Total</th>
                  <th className="text-right font-medium px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((est) => (
                  <tr key={est.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3.5 font-mono font-semibold text-[#172B4D]">
                      {est.estimateNumber}
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-[#172033]">{est.clientName}</p>
                      {est.clientComment && (
                        <p className="text-xs text-slate-500 truncate max-w-xs">
                          Client note: &ldquo;{est.clientComment}&rdquo;
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-600 tabular-nums">{est.expirationDate}</td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={est.status} />
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono font-semibold tabular-nums text-[#172033]">
                      {formatUsd(est.totalCents)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="inline-flex items-center gap-1.5 flex-wrap justify-end">
                        {est.status !== 'converted' && est.status !== 'rejected' && (
                          <button
                            type="button"
                            onClick={() => openBuilder(est)}
                            className="px-2 py-1 text-xs font-medium text-[#2563EB] hover:bg-blue-50 rounded cursor-pointer"
                          >
                            Edit
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handlePdf(est)}
                          title="Download PDF"
                          className="p-1.5 text-slate-600 hover:bg-slate-100 rounded cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        {est.publicShareToken && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(
                                  `${window.location.origin}/?portal=${est.publicShareToken}`
                                );
                                notify('success', 'Approval link copied', 'Share this link with your client.');
                              }}
                              title="Copy Client Approval Link"
                              className="p-1.5 text-slate-600 hover:bg-slate-100 rounded cursor-pointer"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onOpenPortalToken(est.publicShareToken!)}
                              title="Open Client Approval Portal"
                              className="p-1.5 text-[#2563EB] hover:bg-blue-50 rounded cursor-pointer"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSyncClientDecision(est)}
                              disabled={syncingId === est.id}
                              title="Sync Client Decision"
                              className="p-1.5 text-slate-600 hover:bg-slate-100 rounded cursor-pointer"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${syncingId === est.id ? 'animate-spin' : ''}`} />
                            </button>
                          </>
                        )}
                        {est.status !== 'converted' && est.status !== 'rejected' && (
                          <button
                            type="button"
                            onClick={() => handleConvertToInvoice(est)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#16A34A] bg-emerald-50 hover:bg-emerald-100 rounded cursor-pointer"
                          >
                            <ArrowRightCircle className="w-3.5 h-3.5" />
                            <span>Convert to Invoice</span>
                          </button>
                        )}
                        {est.status === 'draft' && (
                          <button
                            type="button"
                            onClick={async () => {
                              await deleteDraftEstimate(est.id);
                              notify('info', 'Draft deleted', est.estimateNumber);
                            }}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Estimate Builder Modal */}
      <AnimatedModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit Estimate ${editing.estimateNumber}` : 'Create Estimate'}
        maxWidth="max-w-3xl"
      >
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Client *</label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
              >
                <option value="">Select client...</option>
                {clients
                  .filter((c) => !c.archived)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Estimate Number</label>
              <input
                type="text"
                value={estimateNumber}
                onChange={(e) => setEstimateNumber(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Issue Date</label>
              <input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Expiration Date</label>
              <input
                type="date"
                value={expirationDate}
                onChange={(e) => setExpirationDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700">Proposed Line Items</label>
              <button
                type="button"
                onClick={() =>
                  setItems((prev) => [
                    ...prev,
                    { id: generateRandomId('li'), description: '', quantity: 1, unitPriceCents: 0, totalCents: 0 },
                  ])
                }
                className="inline-flex items-center gap-1 text-xs font-medium text-[#2563EB] cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item</span>
              </button>
            </div>
            {items.map((item, idx) => (
              <div key={item.id} className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-2 rounded-lg border border-slate-200">
                <input
                  type="text"
                  value={item.description}
                  onChange={(e) => {
                    const v = e.target.value;
                    setItems((prev) => prev.map((p, i) => (i === idx ? { ...p, description: v } : p)));
                  }}
                  placeholder="Scope item"
                  className="col-span-5 px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded"
                />
                <input
                  type="number"
                  step="0.25"
                  min="0"
                  value={item.quantity}
                  onChange={(e) => {
                    const qty = Number.parseFloat(e.target.value) || 0;
                    setItems((prev) =>
                      prev.map((p, i) =>
                        i === idx
                          ? { ...p, quantity: qty, totalCents: calculateLineItemCents(qty, p.unitPriceCents) }
                          : p
                      )
                    );
                  }}
                  className="col-span-2 px-2 py-1.5 text-xs font-mono bg-white border border-slate-200 rounded text-right"
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={(item.unitPriceCents / 100).toFixed(2)}
                  key={`${item.id}-${item.unitPriceCents}`}
                  onBlur={(e) => {
                    const cents = parseDollarsToCents(e.target.value);
                    setItems((prev) =>
                      prev.map((p, i) =>
                        i === idx
                          ? { ...p, unitPriceCents: cents, totalCents: calculateLineItemCents(p.quantity, cents) }
                          : p
                      )
                    );
                  }}
                  className="col-span-2 px-2 py-1.5 text-xs font-mono bg-white border border-slate-200 rounded text-right"
                />
                <span className="col-span-2 text-right font-mono text-xs font-semibold tabular-nums">
                  {formatUsd(item.totalCents)}
                </span>
                <button
                  type="button"
                  onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                  disabled={items.length <= 1}
                  className="col-span-1 text-slate-400 hover:text-red-600 flex justify-center cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Discount ($ USD)</label>
              <input
                type="number"
                step="0.01"
                value={discountDollars}
                onChange={(e) => setDiscountDollars(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Tax Rate (%)</label>
              <input
                type="number"
                step="0.01"
                value={taxPct}
                onChange={(e) => setTaxPct(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm font-semibold">
            <span>Estimated Total</span>
            <span className="font-mono text-[#172B4D] tabular-nums">{formatUsd(totals.totalCents)}</span>
          </div>

          <div className="flex justify-end gap-2.5 pt-2">
            <AnimatedButton variant="secondary" loading={saving} onClick={() => handleSave('draft')}>
              Save Draft
            </AnimatedButton>
            <AnimatedButton loading={saving} onClick={() => handleSave('sent')}>
              Issue Estimate
            </AnimatedButton>
          </div>
        </div>
      </AnimatedModal>
    </div>
  );
};

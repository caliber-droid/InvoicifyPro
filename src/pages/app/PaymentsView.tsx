import React, { useMemo, useState } from 'react';
import { CreditCard, Download, ExternalLink, Plus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { downloadPdfFromEndpoint } from '../../lib/api';
import { recordInvoicePayment } from '../../lib/firestoreRepo';
import { AnimatedButton, AnimatedModal, StatusBadge } from '../../lib/motion';
import { centsToDollarsInput, formatUsd, parseDollarsToCents, todayIso } from '../../lib/money';
import { Payment, PaymentMethod } from '../../types/models';

export const PaymentsView: React.FC<{
  openNewTrigger?: number;
  onOpenPortalToken: (token: string) => void;
}> = ({ openNewTrigger, onOpenPortalToken }) => {
  const { firebaseUser, businessProfile } = useAuth();
  const { payments, invoices, clients } = useData();
  const { notify } = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [amountDollars, setAmountDollars] = useState('');
  const [paymentDate, setPaymentDate] = useState(todayIso());
  const [method, setMethod] = useState<PaymentMethod>('ach');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const openInvoices = useMemo(
    () => invoices.filter((i) => i.balanceDueCents > 0 && i.status !== 'void' && i.status !== 'refunded'),
    [invoices]
  );

  React.useEffect(() => {
    if (openNewTrigger && openNewTrigger > 0) {
      const first = openInvoices[0];
      setSelectedInvoiceId(first?.id || '');
      setAmountDollars(first ? centsToDollarsInput(first.balanceDueCents) : '');
      setModalOpen(true);
    }
  }, [openNewTrigger]);

  const handleRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    const inv = invoices.find((i) => i.id === selectedInvoiceId);
    if (!inv) {
      notify('warning', 'Select an invoice', 'Choose an open invoice to apply this payment.');
      return;
    }
    const cents = parseDollarsToCents(amountDollars);
    if (cents <= 0) {
      notify('warning', 'Invalid amount', 'Enter an amount greater than $0.00.');
      return;
    }
    setSaving(true);
    try {
      await recordInvoicePayment({
        ownerId: firebaseUser.uid,
        invoice: inv,
        amountCents: cents,
        paymentDate,
        method,
        reference,
        notes,
      });
      notify('success', 'Payment recorded', `${formatUsd(cents)} logged for ${inv.invoiceNumber}.`);
      setModalOpen(false);
    } catch (err: any) {
      notify('error', 'Failed to record payment', err?.message);
    } finally {
      setSaving(false);
    }
  };

  const handleReceiptPdf = async (p: Payment) => {
    const inv = invoices.find((i) => i.id === p.invoiceId);
    const client = clients.find((c) => c.id === p.clientId);
    await downloadPdfFromEndpoint(
      '/api/pdf/document',
      {
        kind: 'receipt',
        template: 'professional',
        docNumber: p.invoiceNumber,
        issueDate: inv?.issueDate || p.paymentDate,
        dueDate: p.paymentDate,
        status: p.status,
        business: {
          businessName: businessProfile?.businessName || 'InvoicifyPro Business',
          businessEmail: businessProfile?.businessEmail || '',
          phone: businessProfile?.phone,
          address: businessProfile?.address,
        },
        client: {
          name: p.clientName,
          companyName: client?.companyName,
          email: client?.email || '',
        },
        items: inv?.items || [
          {
            description: `Payment toward Invoice ${p.invoiceNumber}`,
            quantity: 1,
            unitPriceCents: p.amountCents,
            totalCents: p.amountCents,
          },
        ],
        subtotalCents: inv?.subtotalCents || p.amountCents,
        discountCents: inv?.discountCents || 0,
        taxCents: inv?.taxCents || 0,
        totalCents: inv?.totalCents || p.amountCents,
        amountPaidCents: p.amountCents,
        balanceDueCents: inv?.balanceDueCents ?? 0,
        paymentMeta: {
          method: p.method,
          reference: p.reference,
          paymentDate: p.paymentDate,
        },
      },
      `Receipt-${p.invoiceNumber}.pdf`
    );
    notify('success', 'Receipt downloaded', `Receipt-${p.invoiceNumber}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#172B4D]">Payments &amp; Receipts</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Track partial and full payments, generate PDF receipts, and preview client payment portals.
          </p>
        </div>
        <AnimatedButton
          size="sm"
          onClick={() => {
            const first = openInvoices[0];
            setSelectedInvoiceId(first?.id || '');
            setAmountDollars(first ? centsToDollarsInput(first.balanceDueCents) : '');
            setModalOpen(true);
          }}
        >
          <Plus className="w-4 h-4" />
          <span>Record Payment</span>
        </AnimatedButton>
      </div>

      {payments.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <CreditCard className="w-8 h-8 text-slate-400 mx-auto mb-3" />
          <p className="font-display text-base font-semibold text-[#172033] mb-1">No payments recorded yet</p>
          <p className="text-sm text-slate-500 mb-5">
            Log ACH, credit card, PayPal, check, or cash payments against your open invoices.
          </p>
          <AnimatedButton size="sm" onClick={() => setModalOpen(true)}>
            <Plus className="w-4 h-4" />
            <span>Record First Payment</span>
          </AnimatedButton>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
                  <th className="text-left font-medium px-5 py-3">Date</th>
                  <th className="text-left font-medium px-4 py-3">Invoice</th>
                  <th className="text-left font-medium px-4 py-3">Client</th>
                  <th className="text-left font-medium px-4 py-3">Method</th>
                  <th className="text-left font-medium px-4 py-3">Status</th>
                  <th className="text-right font-medium px-4 py-3">Amount</th>
                  <th className="text-right font-medium px-5 py-3">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p) => {
                  const inv = invoices.find((i) => i.id === p.invoiceId);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-3.5 text-xs text-slate-600 tabular-nums">{p.paymentDate}</td>
                      <td className="px-4 py-3.5 font-mono font-semibold text-[#172B4D]">{p.invoiceNumber}</td>
                      <td className="px-4 py-3.5 text-[#172033]">{p.clientName}</td>
                      <td className="px-4 py-3.5 text-xs uppercase text-slate-600">
                        {p.method.replace('_', ' ')}
                        {p.reference ? ` · ${p.reference}` : ''}
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono font-semibold text-[#16A34A] tabular-nums">
                        {formatUsd(p.amountCents)}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleReceiptPdf(p)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-[#2563EB] hover:underline cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Receipt PDF</span>
                          </button>
                          {inv?.publicShareToken && (
                            <button
                              type="button"
                              onClick={() => onOpenPortalToken(inv.publicShareToken!)}
                              title="Open Client Payment Portal"
                              className="p-1 text-slate-500 hover:text-[#172B4D] cursor-pointer"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AnimatedModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Record Invoice Payment"
        subtitle="Supports partial and full payments."
        maxWidth="max-w-md"
      >
        <form onSubmit={handleRecord} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Open Invoice *</label>
            <select
              value={selectedInvoiceId}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedInvoiceId(id);
                const found = invoices.find((i) => i.id === id);
                if (found) setAmountDollars(centsToDollarsInput(found.balanceDueCents));
              }}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
            >
              <option value="">Select open invoice...</option>
              {openInvoices.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.invoiceNumber} — {i.clientName} ({formatUsd(i.balanceDueCents)} due)
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Amount ($ USD)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amountDollars}
                onChange={(e) => setAmountDollars(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Date</label>
              <input
                type="date"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Method</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
              >
                <option value="ach">ACH Bank Transfer</option>
                <option value="credit_card">Credit Card</option>
                <option value="debit_card">Debit Card</option>
                <option value="paypal">PayPal</option>
                <option value="check">Check</option>
                <option value="cash">Cash</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Reference</label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Transaction / Check #"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2.5 pt-2">
            <AnimatedButton type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </AnimatedButton>
            <AnimatedButton type="submit" loading={saving}>
              Save Payment
            </AnimatedButton>
          </div>
        </form>
      </AnimatedModal>
    </div>
  );
};

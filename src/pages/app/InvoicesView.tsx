import React, { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  CheckCircle2,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  FilePlus2,
  Mail,
  Mic,
  MicOff,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  XCircle,
} from 'lucide-react';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { apiPost, downloadPdfFromEndpoint } from '../../lib/api';
import { db } from '../../lib/firebase';
import {
  createClient,
  createInvoice,
  deleteDraftInvoice,
  recordInvoicePayment,
  updateInvoice,
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
import { Invoice, InvoiceTemplate, LineItem, PaymentMethod } from '../../types/models';

const TEMPLATES: Array<{ id: InvoiceTemplate; label: string; headerBg: string; accent: string }> = [
  { id: 'corporate', label: 'Corporate', headerBg: '#172B4D', accent: '#2563EB' },
  { id: 'minimal', label: 'Minimal', headerBg: '#172033', accent: '#475569' },
  { id: 'modern', label: 'Modern', headerBg: '#0F172A', accent: '#0284C7' },
  { id: 'creative', label: 'Creative', headerBg: '#1E293B', accent: '#2563EB' },
  { id: 'elegant', label: 'Elegant', headerBg: '#172B4D', accent: '#1E3A8A' },
  { id: 'professional', label: 'Professional Services', headerBg: '#172B4D', accent: '#16A34A' },
];

export const InvoicesView: React.FC<{
  openNewTrigger?: number;
  onOpenPortalToken: (token: string) => void;
}> = ({ openNewTrigger, onOpenPortalToken }) => {
  const reduced = useReducedMotion();
  const { firebaseUser, businessProfile } = useAuth();
  const { invoices, clients, usageStats } = useData();
  const { notify } = useToast();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingInv, setEditingInv] = useState<Invoice | null>(null);

  // AI Invoice & Voice-to-Invoice state
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiWarnings, setAiWarnings] = useState<string[]>([]);
  const [listening, setListening] = useState(false);

  // Health check state
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthResult, setHealthResult] = useState<{
    readinessLabel: string;
    summary: string;
    checks: Array<{ severity: string; title: string; detail: string; suggestion: string }>;
  } | null>(null);

  // Builder fields
  const [clientId, setClientId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [issueDate, setIssueDate] = useState(todayIso());
  const [dueDate, setDueDate] = useState(addDaysIso(todayIso(), 15));
  const [template, setTemplate] = useState<InvoiceTemplate>('corporate');
  const [items, setItems] = useState<LineItem[]>([]);
  const [discountDollars, setDiscountDollars] = useState('0.00');
  const [taxPct, setTaxPct] = useState('0');
  const [paymentInstructions, setPaymentInstructions] = useState('');
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');
  const [saving, setSaving] = useState(false);
  const [pdfBusyId, setPdfBusyId] = useState<string | null>(null);

  // Payment recording modal
  const [paymentModalInv, setPaymentModalInv] = useState<Invoice | null>(null);
  const [payAmountDollars, setPayAmountDollars] = useState('');
  const [payDate, setPayDate] = useState(todayIso());
  const [payMethod, setPayMethod] = useState<PaymentMethod>('ach');
  const [payRef, setPayRef] = useState('');
  const [paySaving, setPaySaving] = useState(false);

  // Email delivery modal
  const [sendModalInv, setSendModalInv] = useState<Invoice | null>(null);
  const [emailSending, setEmailSending] = useState(false);

  React.useEffect(() => {
    if (openNewTrigger && openNewTrigger > 0) {
      openBuilder(null);
    }
  }, [openNewTrigger]);

  const openBuilder = (inv: Invoice | null) => {
    if (!inv && !usageStats.canCreateInvoice) {
      notify(
        'warning',
        'Monthly invoice limit reached',
        'Upgrade your subscription plan to create additional invoices this month.'
      );
      return;
    }
    setAiWarnings([]);
    setHealthResult(null);
    if (inv) {
      setEditingInv(inv);
      setClientId(inv.clientId);
      setInvoiceNumber(inv.invoiceNumber);
      setIssueDate(inv.issueDate);
      setDueDate(inv.dueDate);
      setTemplate(inv.template);
      setItems(inv.items);
      setDiscountDollars(centsToDollarsInput(inv.discountCents));
      setTaxPct((inv.taxRateBps / 100).toString());
      setPaymentInstructions(inv.paymentInstructions || '');
      setNotes(inv.notes || '');
      setTerms(inv.terms || '');
    } else {
      setEditingInv(null);
      const firstClient = clients.find((c) => !c.archived);
      setClientId(firstClient?.id || '');
      const nextNum = businessProfile?.nextInvoiceNumber || invoices.length + 1001;
      const prefix = businessProfile?.invoiceNumberFormat || 'INV-';
      setInvoiceNumber(`${prefix}${String(nextNum).padStart(4, '0')}`);
      const today = todayIso();
      setIssueDate(today);
      setDueDate(addDaysIso(today, businessProfile?.defaultDueDays ?? 15));
      setTemplate('corporate');
      setItems([
        {
          id: generateRandomId('li'),
          description: 'Consulting Services',
          quantity: 1,
          unitPriceCents: 0,
          totalCents: 0,
        },
      ]);
      setDiscountDollars('0.00');
      setTaxPct(((businessProfile?.defaultTaxRateBps || 0) / 100).toString());
      setPaymentInstructions('ACH Bank Transfer or online invoice portal accepted.');
      setNotes('Thank you for your business.');
      setTerms(`Payment due per ${businessProfile?.defaultPaymentTerms || 'Net 15'} terms.`);
    }
    setBuilderOpen(true);
  };

  const totals = useMemo(() => {
    const discountCents = parseDollarsToCents(discountDollars);
    const taxRateBps = Math.round((Number.parseFloat(taxPct) || 0) * 100);
    return calculateInvoiceTotals(items, discountCents, taxRateBps, editingInv?.amountPaidCents || 0);
  }, [items, discountDollars, taxPct, editingInv?.amountPaidCents]);

  const selectedClientObj = useMemo(
    () => clients.find((c) => c.id === clientId) || null,
    [clients, clientId]
  );

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim() || !firebaseUser) return;
    setAiGenerating(true);
    setAiWarnings([]);
    try {
      const draft = await apiPost<{
        matchedClientId: string;
        clientName: string;
        clientEmail: string;
        items: Array<{ description: string; quantity: number; unitPriceCents: number }>;
        dueDays: number;
        applyDefaultTax: boolean;
        notes: string;
        warnings: string[];
      }>('/api/ai/generate-invoice', {
        prompt: aiPrompt.trim(),
        clients: clients.map((c) => ({
          id: c.id,
          name: c.name,
          companyName: c.companyName,
          email: c.email,
        })),
        defaultTaxRateBps: businessProfile?.defaultTaxRateBps || 0,
        defaultDueDays: businessProfile?.defaultDueDays ?? 15,
      });

      let targetClientId = draft.matchedClientId;
      if (!targetClientId && draft.clientName) {
        const match = clients.find(
          (c) => c.name.toLowerCase() === draft.clientName.toLowerCase()
        );
        if (match) targetClientId = match.id;
      }

      if (targetClientId) {
        setClientId(targetClientId);
      } else if (draft.clientName) {
        const warnings = [...(draft.warnings || [])];
        warnings.unshift(
          `Client "${draft.clientName}" is not yet in your CRM. Select an existing client or add them before saving.`
        );
        setAiWarnings(warnings);
      }

      if (Array.isArray(draft.items) && draft.items.length > 0) {
        setItems(
          draft.items.map((it) => {
            const q = Number(it.quantity) || 1;
            const p = Math.max(0, Math.round(Number(it.unitPriceCents) || 0));
            return {
              id: generateRandomId('li'),
              description: it.description || 'Service',
              quantity: q,
              unitPriceCents: p,
              totalCents: calculateLineItemCents(q, p),
            };
          })
        );
      }

      if (draft.dueDays >= 0) {
        setDueDate(addDaysIso(issueDate, draft.dueDays));
      }
      if (draft.applyDefaultTax && businessProfile?.defaultTaxRateBps) {
        setTaxPct((businessProfile.defaultTaxRateBps / 100).toString());
      }
      if (draft.notes) setNotes(draft.notes);
      if (draft.warnings?.length && targetClientId) setAiWarnings(draft.warnings);
      notify('success', 'AI draft populated', 'Review every field and client before issuing.');
    } catch (err: any) {
      notify('error', 'AI extraction failed', err?.message || 'Unable to parse invoice request.');
    } finally {
      setAiGenerating(false);
    }
  };

  const handleVoiceDictation = () => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      notify(
        'info',
        'Voice input unavailable',
        'Your browser does not support Web Speech dictation. Type your invoice prompt directly.'
      );
      return;
    }
    const recognition = new SpeechRec();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    setListening(true);
    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript || '';
      setAiPrompt((prev) => (prev ? `${prev} ${transcript}` : transcript));
      setListening(false);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognition.start();
  };

  const handleRunHealthCheck = async () => {
    setHealthLoading(true);
    try {
      const result = await apiPost<{
        readinessLabel: string;
        summary: string;
        checks: Array<{ severity: string; title: string; detail: string; suggestion: string }>;
      }>('/api/ai/health-check', {
        businessName: businessProfile?.businessName || 'Business',
        invoice: {
          invoiceNumber,
          clientSelected: Boolean(selectedClientObj),
          clientEmail: selectedClientObj?.email || '',
          issueDate,
          dueDate,
          items,
          ...totals,
          paymentInstructions,
        },
      });
      setHealthResult(result);
    } catch (err: any) {
      notify('error', 'Health check failed', err?.message || 'Unable to run AI review.');
    } finally {
      setHealthLoading(false);
    }
  };

  const handleSaveInvoice = async (targetStatus: 'draft' | 'sent') => {
    if (!firebaseUser) return;
    if (!selectedClientObj) {
      notify('warning', 'Client required', 'Please select or create a client before saving.');
      return;
    }
    if (items.length === 0 || items.every((i) => !i.description.trim())) {
      notify('warning', 'Line items required', 'Add at least one line item with a description.');
      return;
    }
    setSaving(true);
    try {
      const cleanItems = items.map((it) => ({
        ...it,
        description: it.description.trim() || 'Service',
      }));

      if (editingInv) {
        await updateInvoice(editingInv, {
          clientId: selectedClientObj.id,
          clientName: selectedClientObj.name,
          clientEmail: selectedClientObj.email,
          invoiceNumber,
          issueDate,
          dueDate,
          template,
          items: cleanItems,
          ...totals,
          status: targetStatus === 'sent' && editingInv.status === 'draft' ? 'sent' : editingInv.status,
          ...(targetStatus === 'sent' && !editingInv.sentAt ? { sentAt: new Date().toISOString() } : {}),
          paymentInstructions,
          notes,
          terms,
        });
        notify('success', 'Invoice updated', `Invoice ${invoiceNumber} saved.`);
      } else {
        await createInvoice(
          firebaseUser.uid,
          {
            clientId: selectedClientObj.id,
            clientName: selectedClientObj.name,
            clientEmail: selectedClientObj.email,
            invoiceNumber,
            issueDate,
            dueDate,
            status: targetStatus,
            template,
            items: cleanItems,
            ...totals,
            paymentInstructions,
            notes,
            terms,
            ...(targetStatus === 'sent' ? { sentAt: new Date().toISOString() } : {}),
          },
          businessProfile?.businessName || 'InvoicifyPro Business',
          businessProfile?.businessEmail || firebaseUser.email || ''
        );

        await updateDoc(doc(db, 'businessProfiles', firebaseUser.uid), {
          nextInvoiceNumber: (businessProfile?.nextInvoiceNumber || 1001) + 1,
          updatedAt: serverTimestamp(),
        }).catch(() => undefined);

        notify(
          'success',
          targetStatus === 'sent' ? 'Invoice issued' : 'Draft saved',
          `Invoice ${invoiceNumber} ${targetStatus === 'sent' ? 'is ready to share' : 'saved as draft'}.`
        );
      }
      setBuilderOpen(false);
    } catch (err: any) {
      notify('error', 'Save failed', err?.message || 'Could not save invoice.');
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async (inv: Invoice) => {
    if (!firebaseUser) return;
    if (!usageStats.canCreateInvoice) {
      notify('warning', 'Plan limit reached', 'Upgrade to duplicate additional invoices this month.');
      return;
    }
    const nextNum = businessProfile?.nextInvoiceNumber || invoices.length + 1001;
    const prefix = businessProfile?.invoiceNumberFormat || 'INV-';
    const dupNumber = `${prefix}${String(nextNum).padStart(4, '0')}`;
    const today = todayIso();
    await createInvoice(
      firebaseUser.uid,
      {
        clientId: inv.clientId,
        clientName: inv.clientName,
        clientEmail: inv.clientEmail,
        invoiceNumber: dupNumber,
        issueDate: today,
        dueDate: addDaysIso(today, businessProfile?.defaultDueDays ?? 15),
        status: 'draft',
        template: inv.template,
        items: inv.items,
        subtotalCents: inv.subtotalCents,
        discountCents: inv.discountCents,
        taxRateBps: inv.taxRateBps,
        taxCents: inv.taxCents,
        totalCents: inv.totalCents,
        amountPaidCents: 0,
        balanceDueCents: inv.totalCents,
        paymentInstructions: inv.paymentInstructions,
        notes: inv.notes,
        terms: inv.terms,
      },
      businessProfile?.businessName || 'InvoicifyPro Business',
      businessProfile?.businessEmail || firebaseUser.email || ''
    );
    notify('success', 'Invoice duplicated', `Created draft ${dupNumber}.`);
  };

  const handleDownloadPdf = async (inv: Invoice) => {
    setPdfBusyId(inv.id);
    try {
      const client = clients.find((c) => c.id === inv.clientId);
      await downloadPdfFromEndpoint(
        '/api/pdf/document',
        {
          kind: 'invoice',
          template: inv.template,
          docNumber: inv.invoiceNumber,
          issueDate: inv.issueDate,
          dueDate: inv.dueDate,
          status: inv.status,
          business: {
            businessName: businessProfile?.businessName || 'InvoicifyPro Business',
            ownerName: businessProfile?.ownerName,
            businessEmail: businessProfile?.businessEmail || '',
            phone: businessProfile?.phone,
            address: businessProfile?.address,
            website: businessProfile?.website,
          },
          client: {
            name: inv.clientName,
            companyName: client?.companyName,
            email: inv.clientEmail,
            billingAddress: client?.billingAddress,
          },
          items: inv.items,
          subtotalCents: inv.subtotalCents,
          discountCents: inv.discountCents,
          taxCents: inv.taxCents,
          taxLabel: businessProfile?.taxLabel || 'Sales Tax',
          totalCents: inv.totalCents,
          amountPaidCents: inv.amountPaidCents,
          balanceDueCents: inv.balanceDueCents,
          paymentInstructions: inv.paymentInstructions,
          notes: inv.notes,
          terms: inv.terms,
        },
        `Invoice-${inv.invoiceNumber}.pdf`
      );
      notify('success', 'PDF downloaded', `Invoice-${inv.invoiceNumber}.pdf saved.`);
    } catch (err: any) {
      notify('error', 'PDF failed', err?.message || 'Could not export PDF.');
    } finally {
      setPdfBusyId(null);
    }
  };

  const handleRecordPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !paymentModalInv) return;
    const cents = parseDollarsToCents(payAmountDollars);
    if (cents <= 0) {
      notify('warning', 'Invalid amount', 'Enter a payment amount greater than $0.00.');
      return;
    }
    setPaySaving(true);
    try {
      await recordInvoicePayment({
        ownerId: firebaseUser.uid,
        invoice: paymentModalInv,
        amountCents: cents,
        paymentDate: payDate,
        method: payMethod,
        reference: payRef,
      });
      notify(
        'success',
        'Payment recorded',
        `${formatUsd(cents)} applied to ${paymentModalInv.invoiceNumber}.`
      );
      setPaymentModalInv(null);
    } catch (err: any) {
      notify('error', 'Payment failed', err?.message || 'Could not record payment.');
    } finally {
      setPaySaving(false);
    }
  };

  const handleSendInvoiceEmail = async () => {
    if (!sendModalInv) return;
    setEmailSending(true);
    const portalUrl = `${window.location.origin}/?portal=${sendModalInv.publicShareToken}`;
    try {
      await apiPost('/api/email/send', {
        to: sendModalInv.clientEmail,
        replyTo: businessProfile?.businessEmail,
        subject: `Invoice ${sendModalInv.invoiceNumber} from ${businessProfile?.businessName || 'InvoicifyPro'}`,
        text: `Hi ${sendModalInv.clientName},\n\nPlease find Invoice ${sendModalInv.invoiceNumber} for ${formatUsd(
          sendModalInv.balanceDueCents
        )}, due ${sendModalInv.dueDate}.\n\nView & download PDF: ${portalUrl}\n\nThank you,\n${
          businessProfile?.businessName || ''
        }`,
      });
      if (sendModalInv.status === 'draft') {
        await updateInvoice(sendModalInv, { status: 'sent', sentAt: new Date().toISOString() });
      }
      notify('success', 'Invoice emailed', `Sent to ${sendModalInv.clientEmail}.`);
      setSendModalInv(null);
    } catch (err: any) {
      notify('warning', 'Email service not configured', err?.message || 'Use the share link or mailto below.');
    } finally {
      setEmailSending(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices.filter((inv) => {
      if (statusFilter !== 'all' && inv.status !== statusFilter) return false;
      if (!q) return true;
      return (
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.clientName.toLowerCase().includes(q) ||
        inv.clientEmail.toLowerCase().includes(q)
      );
    });
  }, [invoices, search, statusFilter]);

  const activeTemplate = TEMPLATES.find((t) => t.id === template) || TEMPLATES[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#172B4D]">Invoices</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Create invoices manually or with AI, run pre-send health checks, and export PDFs.
          </p>
        </div>
        <AnimatedButton size="sm" onClick={() => openBuilder(null)}>
          <FilePlus2 className="w-4 h-4" />
          <span>New Invoice</span>
        </AnimatedButton>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoice # or client..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#2563EB]"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
          {(['all', 'draft', 'sent', 'partially_paid', 'overdue', 'paid', 'void'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md capitalize cursor-pointer whitespace-nowrap ${
                statusFilter === s ? 'bg-white text-[#172033] shadow-sm' : 'text-slate-600'
              }`}
            >
              {s === 'partially_paid' ? 'Partial' : s}
            </button>
          ))}
        </div>
      </div>

      {/* Invoices Table */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <p className="font-display text-base font-semibold text-[#172033] mb-1">No matching invoices</p>
          <p className="text-sm text-slate-500 mb-5">
            Generate your first invoice manually or describe the project to our AI draft builder.
          </p>
          <AnimatedButton size="sm" onClick={() => openBuilder(null)}>
            <FilePlus2 className="w-4 h-4" />
            <span>Create Invoice</span>
          </AnimatedButton>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
                  <th className="text-left font-medium px-5 py-3">Invoice</th>
                  <th className="text-left font-medium px-4 py-3">Client</th>
                  <th className="text-left font-medium px-4 py-3">Due Date</th>
                  <th className="text-left font-medium px-4 py-3">Status</th>
                  <th className="text-right font-medium px-4 py-3">Total</th>
                  <th className="text-right font-medium px-4 py-3">Balance</th>
                  <th className="text-right font-medium px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3.5 font-mono font-semibold text-[#172B4D]">
                      {inv.invoiceNumber}
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-[#172033]">{inv.clientName}</p>
                      <p className="text-xs text-slate-500">{inv.clientEmail}</p>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-600 tabular-nums">{inv.dueDate}</td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono tabular-nums text-[#172033]">
                      {formatUsd(inv.totalCents)}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono font-semibold tabular-nums text-[#172033]">
                      {formatUsd(inv.balanceDueCents)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="inline-flex items-center gap-1.5 flex-wrap justify-end">
                        {inv.status !== 'void' && inv.status !== 'refunded' && (
                          <button
                            type="button"
                            onClick={() => openBuilder(inv)}
                            className="px-2 py-1 text-xs font-medium text-[#2563EB] hover:bg-blue-50 rounded cursor-pointer"
                          >
                            Edit
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDownloadPdf(inv)}
                          disabled={pdfBusyId === inv.id}
                          title="Download PDF"
                          className="p-1.5 text-slate-600 hover:text-[#172B4D] hover:bg-slate-100 rounded cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setSendModalInv(inv)}
                          title="Send / Share Portal Link"
                          className="p-1.5 text-slate-600 hover:text-[#2563EB] hover:bg-blue-50 rounded cursor-pointer"
                        >
                          <Mail className="w-3.5 h-3.5" />
                        </button>
                        {inv.balanceDueCents > 0 && inv.status !== 'void' && (
                          <button
                            type="button"
                            onClick={() => {
                              setPaymentModalInv(inv);
                              setPayAmountDollars(centsToDollarsInput(inv.balanceDueCents));
                              setPayDate(todayIso());
                              setPayRef('');
                            }}
                            title="Record Payment"
                            className="p-1.5 text-[#16A34A] hover:bg-emerald-50 rounded cursor-pointer"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDuplicate(inv)}
                          title="Duplicate"
                          className="p-1.5 text-slate-500 hover:text-[#172033] hover:bg-slate-100 rounded cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        {inv.status === 'draft' ? (
                          <button
                            type="button"
                            onClick={async () => {
                              await deleteDraftInvoice(inv.id);
                              notify('info', 'Draft deleted', inv.invoiceNumber);
                            }}
                            title="Delete Draft"
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          inv.status !== 'void' &&
                          inv.status !== 'paid' && (
                            <button
                              type="button"
                              onClick={async () => {
                                await updateInvoice(inv, { status: 'void' });
                                notify('info', 'Invoice voided', inv.invoiceNumber);
                              }}
                              title="Void Invoice"
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          )
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

      {/* Invoice Builder + Live Preview Modal */}
      <AnimatedModal
        open={builderOpen}
        onClose={() => setBuilderOpen(false)}
        title={editingInv ? `Edit Invoice ${editingInv.invoiceNumber}` : 'Create Invoice'}
        subtitle="Use AI natural language or voice dictation, or build line items directly."
        maxWidth="max-w-6xl"
      >
        <div className="space-y-6">
          {/* AI Prompt Bar */}
          <div className="bg-[#F5F7FA] border border-slate-200 rounded-xl p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#172B4D] mb-2">
              <Sparkles className="w-4 h-4 text-[#2563EB]" />
              <span>AI Invoice &amp; Voice-to-Invoice Generator</span>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder='e.g. "Create an invoice for John Smith for 10 hours of web design at $75/hr, plus $100 hosting expenses."'
                className="flex-1 px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#2563EB]"
              />
              <div className="flex items-center gap-2 shrink-0">
                <AnimatedButton
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleVoiceDictation}
                >
                  {listening ? <MicOff className="w-4 h-4 text-red-600" /> : <Mic className="w-4 h-4" />}
                  <span>{listening ? 'Listening...' : 'Dictate'}</span>
                </AnimatedButton>
                <AnimatedButton
                  type="button"
                  size="sm"
                  loading={aiGenerating}
                  onClick={handleAiGenerate}
                >
                  <span>Generate Draft</span>
                </AnimatedButton>
              </div>
            </div>
            {aiWarnings.length > 0 && (
              <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 space-y-1">
                {aiWarnings.map((w, i) => (
                  <p key={i}>• {w}</p>
                ))}
              </div>
            )}
          </div>

          <div className="grid lg:grid-cols-12 gap-6 items-start">
            {/* Left Editor */}
            <div className="lg:col-span-7 space-y-4">
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
                          {c.name} {c.companyName ? `(${c.companyName})` : ''}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Invoice Number</label>
                  <input
                    type="text"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
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
                  <label className="block text-xs font-medium text-slate-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              {/* Template Selector */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">PDF Template</label>
                <div className="flex flex-wrap gap-1.5">
                  {TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => setTemplate(tpl.id)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                        template === tpl.id
                          ? 'bg-[#172B4D] text-white border-[#172B4D]'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {tpl.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Line Items */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700">Line Items</label>
                  <button
                    type="button"
                    onClick={() =>
                      setItems((prev) => [
                        ...prev,
                        {
                          id: generateRandomId('li'),
                          description: '',
                          quantity: 1,
                          unitPriceCents: 0,
                          totalCents: 0,
                        },
                      ])
                    }
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#2563EB] hover:underline cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                {items.map((item, idx) => (
                  <motion.div
                    key={item.id}
                    layout={!reduced}
                    initial={reduced ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-2.5 rounded-lg border border-slate-200"
                  >
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => {
                        const val = e.target.value;
                        setItems((prev) =>
                          prev.map((p, i) => (i === idx ? { ...p, description: val } : p))
                        );
                      }}
                      placeholder="Service or product description"
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
                      placeholder="Qty"
                      className="col-span-2 px-2 py-1.5 text-xs font-mono bg-white border border-slate-200 rounded text-right tabular-nums"
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
                      placeholder="Price $"
                      className="col-span-2 px-2 py-1.5 text-xs font-mono bg-white border border-slate-200 rounded text-right tabular-nums"
                    />
                    <span className="col-span-2 text-right font-mono text-xs font-semibold text-[#172033] tabular-nums">
                      {formatUsd(item.totalCents)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                      disabled={items.length <= 1}
                      className="col-span-1 text-slate-400 hover:text-red-600 flex justify-center disabled:opacity-30 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </motion.div>
                ))}
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Discount ($ USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={discountDollars}
                    onChange={(e) => setDiscountDollars(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {businessProfile?.taxLabel || 'Sales Tax'} Rate (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="25"
                    value={taxPct}
                    onChange={(e) => setTaxPct(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg tabular-nums"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">Payment Instructions</label>
                  <input
                    type="text"
                    value={paymentInstructions}
                    onChange={(e) => setPaymentInstructions(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">Notes</label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                  />
                </div>
              </div>
            </div>

            {/* Right Live Animated Preview & AI Health Check */}
            <div className="lg:col-span-5 space-y-4">
              <motion.div
                key={template}
                initial={reduced ? false : { opacity: 0.7, scale: 0.99 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2 }}
                className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm"
              >
                <div
                  style={{ backgroundColor: activeTemplate.headerBg }}
                  className="px-5 py-4 text-white flex items-center justify-between"
                >
                  <div>
                    <p className="font-display font-bold text-sm">
                      {businessProfile?.businessName || 'Your Business'}
                    </p>
                    <p className="text-[11px] text-slate-300">{businessProfile?.businessEmail}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] tracking-wider uppercase text-slate-300">Invoice</p>
                    <p className="font-mono font-bold text-sm">{invoiceNumber}</p>
                  </div>
                </div>

                <div className="p-5 space-y-4 text-xs">
                  <div className="flex justify-between">
                    <div>
                      <p className="text-slate-400">Bill To</p>
                      <p className="font-semibold text-[#172033]">
                        {selectedClientObj?.name || 'Select a client'}
                      </p>
                      {selectedClientObj?.email && (
                        <p className="text-slate-500">{selectedClientObj.email}</p>
                      )}
                    </div>
                    <div className="text-right tabular-nums">
                      <p className="text-slate-400">Due Date</p>
                      <p className="font-semibold text-[#172033]">{dueDate}</p>
                    </div>
                  </div>

                  <div className="border-t border-b border-slate-100 py-2 space-y-1.5">
                    {items.map((it) => (
                      <div key={it.id} className="flex justify-between gap-3">
                        <span className="text-slate-700 truncate">
                          {it.description || 'Line item'} ({it.quantity})
                        </span>
                        <span className="font-mono font-medium text-[#172033] tabular-nums shrink-0">
                          {formatUsd(it.totalCents)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-1 tabular-nums">
                    <div className="flex justify-between text-slate-500">
                      <span>Subtotal</span>
                      <span className="font-mono">{formatUsd(totals.subtotalCents)}</span>
                    </div>
                    {totals.discountCents > 0 && (
                      <div className="flex justify-between text-slate-500">
                        <span>Discount</span>
                        <span className="font-mono">-{formatUsd(totals.discountCents)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-500">
                      <span>Tax ({taxPct || 0}%)</span>
                      <span className="font-mono">{formatUsd(totals.taxCents)}</span>
                    </div>
                    <div
                      style={{ color: activeTemplate.accent }}
                      className="flex justify-between font-bold text-sm pt-2 border-t border-slate-200"
                    >
                      <span>Total Due</span>
                      <span className="font-mono">{formatUsd(totals.balanceDueCents)}</span>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* AI Health Check */}
              <div className="bg-[#F5F7FA] border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#172B4D]">
                    <ShieldCheck className="w-4 h-4 text-[#16A34A]" />
                    <span>AI Invoice Health Check</span>
                  </div>
                  <AnimatedButton
                    type="button"
                    size="sm"
                    variant="secondary"
                    loading={healthLoading}
                    onClick={handleRunHealthCheck}
                  >
                    Run Check
                  </AnimatedButton>
                </div>

                {healthResult && (
                  <div className="space-y-2 text-xs">
                    <p className="font-semibold text-[#172033]">
                      {healthResult.readinessLabel}: <span className="font-normal text-slate-600">{healthResult.summary}</span>
                    </p>
                    {healthResult.checks.map((c, idx) => (
                      <div
                        key={idx}
                        className={`p-2.5 rounded-lg border ${
                          c.severity === 'critical'
                            ? 'bg-red-50 border-red-200 text-red-800'
                            : c.severity === 'warning'
                              ? 'bg-amber-50 border-amber-200 text-amber-800'
                              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        }`}
                      >
                        <p className="font-semibold">{c.title}</p>
                        <p className="mt-0.5">{c.detail}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap justify-end gap-2.5 pt-2">
                <AnimatedButton
                  type="button"
                  variant="secondary"
                  loading={saving}
                  onClick={() => handleSaveInvoice('draft')}
                >
                  Save Draft
                </AnimatedButton>
                <AnimatedButton
                  type="button"
                  loading={saving}
                  onClick={() => handleSaveInvoice('sent')}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{editingInv ? 'Save Changes' : 'Issue Invoice'}</span>
                </AnimatedButton>
              </div>
            </div>
          </div>
        </div>
      </AnimatedModal>

      {/* Record Payment Modal */}
      <AnimatedModal
        open={Boolean(paymentModalInv)}
        onClose={() => setPaymentModalInv(null)}
        title={`Record Payment · ${paymentModalInv?.invoiceNumber || ''}`}
        subtitle={`Remaining balance: ${formatUsd(paymentModalInv?.balanceDueCents || 0)}`}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleRecordPaymentSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Amount ($ USD) *</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={payAmountDollars}
              onChange={(e) => setPayAmountDollars(e.target.value)}
              className="w-full px-3.5 py-2 text-sm font-mono border border-slate-200 rounded-lg tabular-nums"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Payment Date</label>
              <input
                type="date"
                required
                value={payDate}
                onChange={(e) => setPayDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Method</label>
              <select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
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
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Reference / Check #</label>
            <input
              type="text"
              value={payRef}
              onChange={(e) => setPayRef(e.target.value)}
              placeholder="ACH-98421"
              className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg"
            />
          </div>
          <div className="flex justify-end gap-2.5 pt-2">
            <AnimatedButton type="button" variant="secondary" onClick={() => setPaymentModalInv(null)}>
              Cancel
            </AnimatedButton>
            <AnimatedButton type="submit" loading={paySaving}>
              Save Payment
            </AnimatedButton>
          </div>
        </form>
      </AnimatedModal>

      {/* Send / Share Invoice Modal */}
      <AnimatedModal
        open={Boolean(sendModalInv)}
        onClose={() => setSendModalInv(null)}
        title={`Deliver Invoice ${sendModalInv?.invoiceNumber || ''}`}
        subtitle={`Recipient: ${sendModalInv?.clientEmail || ''}`}
        maxWidth="max-w-lg"
      >
        {sendModalInv && (
          <div className="space-y-4">
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
              <p className="text-xs font-semibold text-[#172033]">Client Payment Portal Link</p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={`${window.location.origin}/?portal=${sendModalInv.publicShareToken}`}
                  className="flex-1 px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-200 rounded"
                />
                <AnimatedButton
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `${window.location.origin}/?portal=${sendModalInv.publicShareToken}`
                    );
                    notify('success', 'Link copied', 'Client payment portal URL copied to clipboard.');
                  }}
                >
                  Copy
                </AnimatedButton>
              </div>
              {sendModalInv.publicShareToken && (
                <button
                  type="button"
                  onClick={() => {
                    setSendModalInv(null);
                    onOpenPortalToken(sendModalInv.publicShareToken!);
                  }}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#2563EB] hover:underline cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Preview Client Payment Portal</span>
                </button>
              )}
            </div>

            <div className="flex flex-wrap justify-between items-center gap-3 pt-2">
              <a
                href={`mailto:${sendModalInv.clientEmail}?subject=${encodeURIComponent(
                  `Invoice ${sendModalInv.invoiceNumber}`
                )}&body=${encodeURIComponent(
                  `Hi ${sendModalInv.clientName},\n\nView your invoice (${formatUsd(
                    sendModalInv.balanceDueCents
                  )} due ${sendModalInv.dueDate}): ${window.location.origin}/?portal=${
                    sendModalInv.publicShareToken
                  }`
                )}`}
                className="text-xs font-medium text-slate-600 hover:text-[#172B4D] underline"
              >
                Open in Email App
              </a>
              <div className="flex gap-2">
                <AnimatedButton variant="secondary" onClick={() => setSendModalInv(null)}>
                  Close
                </AnimatedButton>
                <AnimatedButton loading={emailSending} onClick={handleSendInvoiceEmail}>
                  <Mail className="w-4 h-4" />
                  <span>Send via Email API</span>
                </AnimatedButton>
              </div>
            </div>
          </div>
        )}
      </AnimatedModal>
    </div>
  );
};

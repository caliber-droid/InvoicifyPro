import React, { useMemo, useState } from 'react';
import { Download, Plus, Receipt, Search, Sparkles, Trash2, Upload } from 'lucide-react';
import { BarComparisonChart } from '../../components/Charts';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { apiPost } from '../../lib/api';
import { createExpense, deleteExpense } from '../../lib/firestoreRepo';
import { AnimatedButton, AnimatedModal } from '../../lib/motion';
import { formatUsd, parseDollarsToCents, todayIso } from '../../lib/money';
import { EXPENSE_CATEGORIES } from '../../types/models';

export const ExpensesView: React.FC<{ openNewTrigger?: number }> = ({ openNewTrigger }) => {
  const { firebaseUser } = useAuth();
  const { expenses } = useData();
  const { notify } = useToast();

  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confidenceNote, setConfidenceNote] = useState('');

  const [form, setForm] = useState({
    description: '',
    vendor: '',
    amountDollars: '',
    taxDollars: '0.00',
    date: todayIso(),
    category: 'Software',
    paymentMethod: 'Credit Card',
    notes: '',
    receiptName: '',
    receiptDataUrl: '',
    aiExtracted: false,
  });

  React.useEffect(() => {
    if (openNewTrigger && openNewTrigger > 0) {
      openModal();
    }
  }, [openNewTrigger]);

  const openModal = () => {
    setConfidenceNote('');
    setForm({
      description: '',
      vendor: '',
      amountDollars: '',
      taxDollars: '0.00',
      date: todayIso(),
      category: 'Software',
      paymentMethod: 'Credit Card',
      notes: '',
      receiptName: '',
      receiptDataUrl: '',
      aiExtracted: false,
    });
    setModalOpen(true);
  };

  const handleReceiptUpload = async (file?: File) => {
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      notify('warning', 'File too large', 'Please upload a receipt under 4 MB.');
      return;
    }
    setExtracting(true);
    setConfidenceNote('');
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const extracted = await apiPost<{
        vendor: string;
        date: string;
        amountCents: number;
        taxCents: number;
        category: string;
        description: string;
        paymentMethod: string;
        confidenceNote: string;
      }>('/api/ai/extract-receipt', {
        base64Data: dataUrl,
        mimeType: file.type || 'image/jpeg',
      });

      const validCat = EXPENSE_CATEGORIES.includes(extracted.category as any)
        ? extracted.category
        : 'Other';

      setForm((prev) => ({
        ...prev,
        vendor: extracted.vendor || prev.vendor,
        date: extracted.date || prev.date,
        amountDollars: extracted.amountCents ? (extracted.amountCents / 100).toFixed(2) : prev.amountDollars,
        taxDollars: extracted.taxCents ? (extracted.taxCents / 100).toFixed(2) : '0.00',
        category: validCat,
        description: extracted.description || extracted.vendor || prev.description,
        paymentMethod: extracted.paymentMethod || prev.paymentMethod,
        receiptName: file.name,
        receiptDataUrl: dataUrl.length < 340000 ? dataUrl : '',
        aiExtracted: true,
      }));
      setConfidenceNote(
        extracted.confidenceNote || 'Fields extracted by AI. Please verify amounts and dates before saving.'
      );
      notify('success', 'Receipt extracted', 'Verify extracted values before saving.');
    } catch (err: any) {
      notify('error', 'Receipt OCR failed', err?.message || 'Unable to parse receipt.');
    } finally {
      setExtracting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    const amountCents = parseDollarsToCents(form.amountDollars);
    if (amountCents <= 0) {
      notify('warning', 'Valid amount required', 'Enter an expense amount greater than $0.00.');
      return;
    }
    setSaving(true);
    try {
      await createExpense(firebaseUser.uid, {
        description: form.description.trim() || form.vendor.trim() || 'Business Expense',
        vendor: form.vendor.trim() || 'Vendor',
        amountCents,
        taxCents: parseDollarsToCents(form.taxDollars),
        date: form.date,
        category: form.category,
        paymentMethod: form.paymentMethod,
        notes: form.notes.trim(),
        receiptName: form.receiptName,
        receiptDataUrl: form.receiptDataUrl,
        aiExtracted: form.aiExtracted,
      });
      notify('success', 'Expense saved', form.description || form.vendor);
      setModalOpen(false);
    } catch (err: any) {
      notify('error', 'Save failed', err?.message);
    } finally {
      setSaving(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return expenses.filter((e) => {
      if (catFilter !== 'all' && e.category !== catFilter) return false;
      if (!q) return true;
      return (
        e.description.toLowerCase().includes(q) ||
        e.vendor.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q)
      );
    });
  }, [expenses, search, catFilter]);

  const categoryTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of expenses) {
      map.set(e.category, (map.get(e.category) || 0) + e.amountCents);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([label, valueCents]) => ({ label, valueCents, color: '#2563EB' }));
  }, [expenses]);

  const exportCsv = () => {
    const header = ['Date', 'Vendor', 'Description', 'Category', 'Payment Method', 'Amount USD', 'Tax USD'];
    const rows = expenses.map((e) => [
      e.date,
      e.vendor,
      e.description,
      e.category,
      e.paymentMethod,
      (e.amountCents / 100).toFixed(2),
      (e.taxCents / 100).toFixed(2),
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'invoicifypro-expenses.csv';
    a.click();
    URL.revokeObjectURL(url);
    notify('success', 'Expenses exported', 'CSV download started.');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#172B4D]">Expense Tracker</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Track operating costs, scan receipts with AI OCR, and export categorized expense logs.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AnimatedButton variant="secondary" size="sm" onClick={exportCsv}>
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </AnimatedButton>
          <AnimatedButton size="sm" onClick={openModal}>
            <Plus className="w-4 h-4" />
            <span>Add Expense</span>
          </AnimatedButton>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search vendor or description..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>
            <select
              value={catFilter}
              onChange={(e) => setCatFilter(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
            >
              <option value="all">All Categories</option>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {filtered.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
              <Receipt className="w-8 h-8 text-slate-400 mx-auto mb-3" />
              <p className="font-display text-base font-semibold text-[#172033] mb-1">No expenses recorded</p>
              <p className="text-sm text-slate-500 mb-5">
                Log an expense manually or upload a receipt image/PDF for AI extraction.
              </p>
              <AnimatedButton size="sm" onClick={openModal}>
                <Plus className="w-4 h-4" />
                <span>Add First Expense</span>
              </AnimatedButton>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
                      <th className="text-left font-medium px-5 py-3">Date</th>
                      <th className="text-left font-medium px-4 py-3">Vendor &amp; Description</th>
                      <th className="text-left font-medium px-4 py-3">Category</th>
                      <th className="text-right font-medium px-4 py-3">Amount</th>
                      <th className="text-right font-medium px-5 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtered.map((exp) => (
                      <tr key={exp.id} className="hover:bg-slate-50/70">
                        <td className="px-5 py-3.5 text-xs text-slate-600 tabular-nums">{exp.date}</td>
                        <td className="px-4 py-3.5">
                          <p className="font-medium text-[#172033]">{exp.vendor}</p>
                          <p className="text-xs text-slate-500">{exp.description}</p>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-slate-600">{exp.category}</td>
                        <td className="px-4 py-3.5 text-right font-mono font-semibold text-[#172033] tabular-nums">
                          {formatUsd(exp.amountCents)}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <button
                            type="button"
                            onClick={async () => {
                              await deleteExpense(exp.id);
                              notify('info', 'Expense removed', exp.description);
                            }}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-6 h-fit">
          <h2 className="font-display text-base font-semibold text-[#172033] mb-4">Category Breakdown</h2>
          {categoryTotals.length === 0 ? (
            <p className="text-xs text-slate-500">Expenses will chart here by category.</p>
          ) : (
            <BarComparisonChart items={categoryTotals} />
          )}
        </div>
      </div>

      {/* Add Expense & Receipt OCR Modal */}
      <AnimatedModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add Business Expense"
        subtitle="Upload a receipt for AI extraction or enter expense details manually."
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="p-4 rounded-xl bg-[#F5F7FA] border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-xs">
              <Sparkles className="w-4 h-4 text-[#2563EB] shrink-0" />
              <div>
                <p className="font-semibold text-[#172033]">AI Receipt Extraction</p>
                <p className="text-slate-500">Upload PNG, JPG, or PDF receipt to pre-fill fields for your review.</p>
              </div>
            </div>
            <label className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer shrink-0">
              <Upload className="w-3.5 h-3.5" />
              <span>{extracting ? 'Extracting...' : 'Scan Receipt'}</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,application/pdf"
                disabled={extracting}
                className="hidden"
                onChange={(e) => handleReceiptUpload(e.target.files?.[0])}
              />
            </label>
          </div>

          {confidenceNote && (
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-[#1E3A8A]">
              {confidenceNote}
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Vendor / Merchant *</label>
              <input
                type="text"
                required
                value={form.vendor}
                onChange={(e) => setForm({ ...form, vendor: e.target.value })}
                placeholder="Adobe, Staples, Delta..."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Date *</label>
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">Description *</label>
              <input
                type="text"
                required
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Creative Cloud subscription, office supplies..."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Total Amount ($ USD) *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={form.amountDollars}
                onChange={(e) => setForm({ ...form, amountDollars: e.target.value })}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Included Tax ($ USD)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.taxDollars}
                onChange={(e) => setForm({ ...form, taxDollars: e.target.value })}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Payment Method</label>
              <input
                type="text"
                value={form.paymentMethod}
                onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-2">
            <AnimatedButton type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </AnimatedButton>
            <AnimatedButton type="submit" loading={saving}>
              Save Expense
            </AnimatedButton>
          </div>
        </form>
      </AnimatedModal>
    </div>
  );
};

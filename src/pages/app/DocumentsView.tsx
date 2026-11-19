import React, { useMemo, useState } from 'react';
import { Download, Eye, FileText, FolderOpen, Plus, Search, Trash2, Upload } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { SponsoredLeaderboardBanner } from '../../components/SponsoredBanner';
import { useToast } from '../../context/ToastContext';
import { downloadPdfFromEndpoint } from '../../lib/api';
import { createVaultDocument, deleteVaultDocument } from '../../lib/firestoreRepo';
import { AnimatedButton, AnimatedModal } from '../../lib/motion';
import { resolveWatermarkDisplay } from '../../lib/watermark';
import { VaultDocument } from '../../types/models';

export const DocumentsView: React.FC = () => {
  const { firebaseUser, businessProfile } = useAuth();
  const { documents, clients, invoices, estimates } = useData();
  const { notify } = useToast();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<VaultDocument | null>(null);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<VaultDocument['category']>('agreement');
  const [clientId, setClientId] = useState('');
  const [fileName, setFileName] = useState('');
  const [mimeType, setMimeType] = useState('application/octet-stream');
  const [sizeBytes, setSizeBytes] = useState(0);
  const [fileDataUrl, setFileDataUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [pdfBusyId, setPdfBusyId] = useState<string | null>(null);

  const filteredDocs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return documents.filter((d) => {
      if (categoryFilter !== 'all' && d.category !== categoryFilter) return false;
      if (q && !d.title.toLowerCase().includes(q) && !d.fileName.toLowerCase().includes(q) && !(d.clientName || '').toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [documents, search, categoryFilter]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setMimeType(file.type || 'application/octet-stream');
    setSizeBytes(file.size);
    if (!title) setTitle(file.name.replace(/\.[^.]+$/, ''));

    // Keep stored inline data URL under 340KB to respect Firestore rules limit (350,000 chars)
    if (file.size > 240_000) {
      setFileDataUrl('');
      notify('info', 'Large file stored as metadata record', 'Files over 240 KB store metadata without inline preview.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      if (result.length <= 345_000) {
        setFileDataUrl(result);
      } else {
        setFileDataUrl('');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !fileName) {
      notify('warning', 'Select a file', 'Choose a document to add to your vault.');
      return;
    }
    setSaving(true);
    try {
      const client = clients.find((c) => c.id === clientId);
      const payload: Omit<VaultDocument, 'id' | 'ownerId' | 'createdAt'> = {
        title: title.trim() || fileName,
        category,
        fileName: fileName.slice(0, 200),
        mimeType: mimeType.slice(0, 100),
        sizeBytes,
        ...(client ? { clientId: client.id, clientName: client.name } : {}),
        ...(fileDataUrl ? { fileDataUrl } : {}),
      };
      await createVaultDocument(firebaseUser.uid, payload);
      notify('success', 'Document saved to vault');
      setUploadOpen(false);
      setTitle('');
      setFileName('');
      setFileDataUrl('');
      setSizeBytes(0);
    } catch (err: any) {
      notify('error', 'Failed to upload document', err?.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadGeneratedPdf = async (kind: 'invoice' | 'estimate', docItem: any) => {
    setPdfBusyId(docItem.id);
    try {
      const resolvedWm =
        kind === 'invoice'
          ? resolveWatermarkDisplay(
              docItem.watermarkConfig ?? businessProfile?.watermarkConfig,
              docItem.status
            )
          : null;
      await downloadPdfFromEndpoint(
        '/api/pdf/document',
        {
          kind,
          template: docItem.template || 'corporate',
          docNumber: kind === 'invoice' ? docItem.invoiceNumber : docItem.estimateNumber,
          issueDate: docItem.issueDate,
          dueDate: kind === 'invoice' ? docItem.dueDate : docItem.expirationDate,
          status: docItem.status,
          watermark: resolvedWm
            ? {
                text: resolvedWm.text,
                opacityPct: resolvedWm.opacityPct,
                angle: resolvedWm.angle,
                color: resolvedWm.color,
              }
            : null,
          business: {
            businessName: businessProfile?.businessName || 'InvoicifyPro Business',
            businessEmail: businessProfile?.businessEmail || '',
            phone: businessProfile?.phone,
            address: businessProfile?.address,
            website: businessProfile?.website,
          },
          client: {
            name: docItem.clientName,
            email: docItem.clientEmail,
          },
          items: docItem.items,
          subtotalCents: docItem.subtotalCents,
          discountCents: docItem.discountCents,
          taxCents: docItem.taxCents,
          taxLabel: businessProfile?.taxLabel || 'Tax',
          totalCents: docItem.totalCents,
          amountPaidCents: docItem.amountPaidCents || 0,
          balanceDueCents: docItem.balanceDueCents ?? docItem.totalCents,
          notes: docItem.notes,
          terms: docItem.terms,
        },
        `${kind}-${kind === 'invoice' ? docItem.invoiceNumber : docItem.estimateNumber}.pdf`
      );
      notify('success', 'PDF downloaded');
    } catch (err: any) {
      notify('error', 'PDF export failed', err?.message);
    } finally {
      setPdfBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#172B4D]">Documents Vault</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Store client agreements, supporting files, and download generated invoice &amp; estimate PDFs.
          </p>
        </div>
        <AnimatedButton onClick={() => setUploadOpen(true)}>
          <Plus className="w-4 h-4" />
          <span>Upload Document</span>
        </AnimatedButton>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search uploaded files or clients..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#2563EB]"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg"
        >
          <option value="all">All Categories</option>
          <option value="agreement">Agreements &amp; Contracts</option>
          <option value="supporting">Supporting Documents</option>
          <option value="receipt">Receipts</option>
          <option value="invoice">Invoices</option>
          <option value="estimate">Estimates</option>
        </select>
      </div>

      {/* Uploaded Vault Files */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold text-[#172033]">Uploaded Business Files</h2>
          <span className="text-xs text-slate-500 tabular-nums">{filteredDocs.length} file(s)</span>
        </div>
        {filteredDocs.length === 0 ? (
          <div className="p-10 text-center">
            <FolderOpen className="w-9 h-9 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No uploaded files match your filter.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredDocs.map((d) => (
              <div key={d.id} className="px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/60">
                <div className="min-w-0 flex items-center gap-3">
                  <FileText className="w-5 h-5 text-[#2563EB] shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#172033] truncate">{d.title}</p>
                    <p className="text-xs text-slate-500 truncate">
                      {d.fileName} · {d.category.replace('_', ' ')} · {(d.sizeBytes / 1024).toFixed(1)} KB
                      {d.clientName ? ` · ${d.clientName}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {d.fileDataUrl && (
                    <>
                      <button
                        type="button"
                        onClick={() => setPreviewDoc(d)}
                        className="p-2 text-slate-500 hover:text-[#2563EB] hover:bg-blue-50 rounded-lg cursor-pointer"
                        title="Preview"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <a
                        href={d.fileDataUrl}
                        download={d.fileName}
                        className="p-2 text-slate-500 hover:text-[#172B4D] hover:bg-slate-100 rounded-lg"
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={async () => {
                      await deleteVaultDocument(d.id);
                      notify('info', 'Document removed');
                    }}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <SponsoredLeaderboardBanner />

      {/* Quick Archive of Generated Invoice & Estimate PDFs */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100">
            <h2 className="font-display text-sm font-semibold text-[#172033]">Invoice PDFs ({invoices.length})</h2>
          </div>
          <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
            {invoices.length === 0 ? (
              <p className="p-5 text-xs text-slate-500">No invoices created yet.</p>
            ) : (
              invoices.slice(0, 15).map((inv) => (
                <div key={inv.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#172033] truncate">
                      {inv.invoiceNumber} · {inv.clientName}
                    </p>
                    <p className="text-[11px] text-slate-500">{inv.issueDate}</p>
                  </div>
                  <AnimatedButton
                    size="sm"
                    variant="secondary"
                    loading={pdfBusyId === inv.id}
                    onClick={() => handleDownloadGeneratedPdf('invoice', inv)}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>PDF</span>
                  </AnimatedButton>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100">
            <h2 className="font-display text-sm font-semibold text-[#172033]">Estimate PDFs ({estimates.length})</h2>
          </div>
          <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
            {estimates.length === 0 ? (
              <p className="p-5 text-xs text-slate-500">No estimates created yet.</p>
            ) : (
              estimates.slice(0, 15).map((est) => (
                <div key={est.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#172033] truncate">
                      {est.estimateNumber} · {est.clientName}
                    </p>
                    <p className="text-[11px] text-slate-500">{est.issueDate}</p>
                  </div>
                  <AnimatedButton
                    size="sm"
                    variant="secondary"
                    loading={pdfBusyId === est.id}
                    onClick={() => handleDownloadGeneratedPdf('estimate', est)}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>PDF</span>
                  </AnimatedButton>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <AnimatedModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        title="Upload Document to Vault"
        subtitle="Attach client agreements, W-9s, or supporting project documentation."
      >
        <form onSubmit={handleUpload} className="space-y-4">
          <label className="block border-2 border-dashed border-slate-300 hover:border-[#2563EB] rounded-xl p-6 text-center cursor-pointer transition-colors">
            <Upload className="w-7 h-7 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-[#172033]">
              {fileName ? fileName : 'Choose a PDF, image, or document file'}
            </p>
            <p className="text-xs text-slate-500 mt-1">Inline preview supported for files up to 240 KB</p>
            <input type="file" onChange={handleFileChange} className="hidden" />
          </label>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Document Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Master Services Agreement"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as VaultDocument['category'])}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="agreement">Agreement / Contract</option>
                <option value="supporting">Supporting Document</option>
                <option value="receipt">Receipt</option>
                <option value="payment_confirmation">Payment Confirmation</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Associate Client (Optional)</label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="">None</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <AnimatedButton type="button" variant="secondary" onClick={() => setUploadOpen(false)}>
              Cancel
            </AnimatedButton>
            <AnimatedButton type="submit" loading={saving}>
              Save to Vault
            </AnimatedButton>
          </div>
        </form>
      </AnimatedModal>

      <AnimatedModal
        open={Boolean(previewDoc)}
        onClose={() => setPreviewDoc(null)}
        title={previewDoc?.title || 'Document Preview'}
        subtitle={previewDoc?.fileName}
      >
        {previewDoc?.fileDataUrl && previewDoc.mimeType.startsWith('image/') ? (
          <img src={previewDoc.fileDataUrl} alt={previewDoc.title} className="max-w-full rounded-lg mx-auto" />
        ) : previewDoc?.fileDataUrl && previewDoc.mimeType === 'application/pdf' ? (
          <iframe src={previewDoc.fileDataUrl} title={previewDoc.title} className="w-full h-[65vh] rounded-lg border" />
        ) : (
          <div className="text-center py-8">
            <p className="text-sm text-slate-600 mb-4">Inline preview is not available for this file type.</p>
            {previewDoc?.fileDataUrl && (
              <a
                href={previewDoc.fileDataUrl}
                download={previewDoc.fileName}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#2563EB] rounded-lg"
              >
                <Download className="w-4 h-4" />
                <span>Download File</span>
              </a>
            )}
          </div>
        )}
      </AnimatedModal>
    </div>
  );
};

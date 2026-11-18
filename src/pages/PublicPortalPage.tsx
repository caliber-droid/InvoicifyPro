import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  Download,
  FileText,
  Lock,
  XCircle,
} from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';
import { apiGet, apiPost, downloadPdfFromEndpoint } from '../lib/api';
import { fetchPortalShare, submitEstimatePortalDecision } from '../lib/firestoreRepo';
import { AnimatedButton, StatusBadge } from '../lib/motion';
import { formatUsd } from '../lib/money';
import { PortalShare } from '../types/models';

export const PublicPortalPage: React.FC<{ shareToken: string; onExitPortal: () => void }> = ({
  shareToken,
  onExitPortal,
}) => {
  const reduced = useReducedMotion();
  const [share, setShare] = useState<PortalShare | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [stripeConfigured, setStripeConfigured] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutNotice, setCheckoutNotice] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [docData, statusData] = await Promise.all([
          fetchPortalShare(shareToken),
          apiGet<{ stripeConfigured: boolean }>('/api/integrations/status').catch(() => ({
            stripeConfigured: false,
          })),
        ]);
        if (!active) return;
        setShare(docData);
        setStripeConfigured(Boolean(statusData.stripeConfigured));
      } catch (err: any) {
        if (!active) return;
        setError(err?.message || 'Unable to load shared document.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [shareToken]);

  const handleDownloadPdf = async () => {
    if (!share) return;
    setDownloading(true);
    try {
      await downloadPdfFromEndpoint(
        '/api/pdf/document',
        {
          kind: share.kind,
          template: share.template || 'corporate',
          docNumber: share.docNumber,
          issueDate: share.issueDate,
          dueDate: share.dueDate,
          status: share.status,
          business: {
            businessName: share.businessName,
            businessEmail: share.businessEmail || '',
          },
          client: {
            name: share.clientName,
            email: '',
          },
          items: share.items,
          subtotalCents: share.subtotalCents,
          discountCents: share.discountCents,
          taxCents: share.taxCents,
          totalCents: share.totalCents,
          amountPaidCents: share.amountPaidCents,
          balanceDueCents: share.balanceDueCents,
          notes: share.notes,
          terms: share.terms,
        },
        `${share.kind}-${share.docNumber}.pdf`,
        false
      );
    } finally {
      setDownloading(false);
    }
  };

  const handleEstimateDecision = async (decision: 'accepted' | 'rejected') => {
    if (!share) return;
    setSubmitting(true);
    try {
      await submitEstimatePortalDecision(share.id, decision, comment);
      setShare({
        ...share,
        clientDecision: decision,
        clientComment: comment,
        status: decision,
        decidedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      setError(err?.message || 'Could not record your response.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePayOnline = async () => {
    if (!share) return;
    setCheckoutLoading(true);
    setCheckoutNotice('');
    try {
      const resp = await apiPost<{ url: string }>(
        '/api/stripe/create-checkout',
        {
          amountCents: share.balanceDueCents,
          description: `Invoice ${share.docNumber} from ${share.businessName}`,
          successUrl: window.location.href,
          cancelUrl: window.location.href,
        },
        false
      );
      if (resp.url) {
        window.location.href = resp.url;
      }
    } catch (err: any) {
      setCheckoutNotice(
        err?.message ||
          'Online card checkout is not active on this workspace yet (Stripe merchant credentials not configured).'
      );
    } finally {
      setCheckoutLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center p-6">
        <div className="max-w-2xl w-full bg-white border border-slate-200 rounded-xl p-8 space-y-4">
          <div className="h-6 w-40 rounded skeleton-shimmer" />
          <div className="h-24 w-full rounded skeleton-shimmer" />
          <div className="h-40 w-full rounded skeleton-shimmer" />
        </div>
      </div>
    );
  }

  if (!share || error) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-8 text-center">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <h1 className="font-display text-lg font-bold text-[#172033] mb-2">Document link unavailable</h1>
          <p className="text-sm text-slate-600 mb-6">
            {error || 'This invoice or estimate link may have expired or been removed.'}
          </p>
          <AnimatedButton onClick={onExitPortal}>Return to InvoicifyPro</AnimatedButton>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA] py-8 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-6">
          <BrandLogo />
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
              <Lock className="w-3.5 h-3.5 text-[#16A34A]" />
              <span>Secure Client Portal</span>
            </span>
            <button
              type="button"
              onClick={onExitPortal}
              className="text-xs font-medium text-[#2563EB] hover:underline cursor-pointer"
            >
              Sign in to Workspace
            </button>
          </div>
        </div>

        <motion.div
          initial={reduced ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden"
        >
          <div className="bg-[#172B4D] text-white px-6 sm:px-8 py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-xs text-slate-300 uppercase tracking-wider font-semibold">
                {share.kind === 'estimate' ? 'Estimate' : 'Invoice'} #{share.docNumber}
              </p>
              <h1 className="font-display text-2xl font-bold mt-1">{share.businessName}</h1>
              {share.businessEmail && <p className="text-xs text-slate-300 mt-0.5">{share.businessEmail}</p>}
            </div>
            <div className="flex flex-col sm:items-end gap-2">
              <StatusBadge status={share.status} />
              <p className="font-mono text-2xl font-bold tabular-nums">
                {formatUsd(share.kind === 'estimate' ? share.totalCents : share.balanceDueCents)}
              </p>
              <p className="text-xs text-slate-300">
                {share.kind === 'estimate' ? `Expires ${share.dueDate}` : `Due ${share.dueDate}`}
              </p>
            </div>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-100">
              <div>
                <p className="text-xs text-slate-500">Prepared For</p>
                <p className="text-sm font-semibold text-[#172033]">{share.clientName}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <AnimatedButton variant="secondary" size="sm" loading={downloading} onClick={handleDownloadPdf}>
                  <Download className="w-4 h-4" />
                  <span>Download PDF</span>
                </AnimatedButton>
                {share.kind === 'invoice' && share.balanceDueCents > 0 && share.status !== 'void' && (
                  <AnimatedButton size="sm" loading={checkoutLoading} onClick={handlePayOnline}>
                    <CreditCard className="w-4 h-4" />
                    <span>{stripeConfigured ? `Pay ${formatUsd(share.balanceDueCents)}` : 'Online Payment'}</span>
                  </AnimatedButton>
                )}
              </div>
            </div>

            {checkoutNotice && (
              <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                {checkoutNotice}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs text-slate-500">
                    <th className="text-left font-medium py-2.5">Description</th>
                    <th className="text-right font-medium py-2.5">Qty</th>
                    <th className="text-right font-medium py-2.5">Unit Price</th>
                    <th className="text-right font-medium py-2.5">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {share.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-3 text-[#172033]">{item.description}</td>
                      <td className="py-3 text-right font-mono tabular-nums text-slate-600">{item.quantity}</td>
                      <td className="py-3 text-right font-mono tabular-nums text-slate-600">
                        {formatUsd(item.unitPriceCents)}
                      </td>
                      <td className="py-3 text-right font-mono font-semibold tabular-nums text-[#172033]">
                        {formatUsd(item.totalCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end">
              <div className="w-full max-w-xs space-y-2 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span className="font-mono tabular-nums">{formatUsd(share.subtotalCents)}</span>
                </div>
                {share.discountCents > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Discount</span>
                    <span className="font-mono tabular-nums">-{formatUsd(share.discountCents)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600">
                  <span>Tax</span>
                  <span className="font-mono tabular-nums">{formatUsd(share.taxCents)}</span>
                </div>
                <div className="flex justify-between font-bold text-[#172033] pt-2 border-t border-slate-200">
                  <span>Total</span>
                  <span className="font-mono tabular-nums">{formatUsd(share.totalCents)}</span>
                </div>
                {share.kind === 'invoice' && (
                  <>
                    <div className="flex justify-between text-[#16A34A]">
                      <span>Amount Paid</span>
                      <span className="font-mono tabular-nums">{formatUsd(share.amountPaidCents)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-[#2563EB] pt-1 border-t border-slate-200">
                      <span>Balance Due</span>
                      <span className="font-mono tabular-nums">{formatUsd(share.balanceDueCents)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {share.notes && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-600">
                <p className="font-semibold text-[#172033] mb-1">Notes</p>
                <p className="whitespace-pre-wrap">{share.notes}</p>
              </div>
            )}

            {/* Estimate Client Approval Section */}
            {share.kind === 'estimate' && (
              <div className="border-t border-slate-200 pt-6">
                {share.clientDecision === 'pending' || !share.clientDecision ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#172033]">
                      <FileText className="w-4 h-4 text-[#2563EB]" />
                      <span>Approve or Respond to Estimate</span>
                    </div>
                    <textarea
                      rows={3}
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Optional comments or project notes for the provider..."
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#2563EB]"
                    />
                    <div className="flex flex-wrap gap-3">
                      <AnimatedButton
                        loading={submitting}
                        onClick={() => handleEstimateDecision('accepted')}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Approve Estimate</span>
                      </AnimatedButton>
                      <AnimatedButton
                        variant="secondary"
                        loading={submitting}
                        onClick={() => handleEstimateDecision('rejected')}
                      >
                        <XCircle className="w-4 h-4 text-red-600" />
                        <span>Decline Estimate</span>
                      </AnimatedButton>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <p className="text-sm font-semibold text-[#172033]">
                      Response recorded: <span className="capitalize">{share.clientDecision}</span>
                    </p>
                    {share.clientComment && (
                      <p className="text-xs text-slate-600 mt-1">Comment: &ldquo;{share.clientComment}&rdquo;</p>
                    )}
                    {share.decidedAt && (
                      <p className="text-[11px] text-slate-400 mt-1">
                        Timestamp: {new Date(share.decidedAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

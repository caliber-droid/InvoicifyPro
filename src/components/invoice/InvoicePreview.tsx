import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { formatUsd } from '../../lib/money';
import { resolveWatermarkDisplay } from '../../lib/watermark';
import { InvoiceTemplate, LineItem, WatermarkConfig } from '../../types/models';

export interface InvoicePreviewProps {
  template: InvoiceTemplate;
  watermark?: WatermarkConfig | null;
  businessName: string;
  businessEmail?: string;
  businessAddress?: string;
  businessPhone?: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  status?: string;
  clientName: string;
  clientEmail?: string;
  clientAddress?: string;
  items: LineItem[];
  subtotalCents: number;
  discountCents: number;
  taxRateLabel?: string;
  taxCents: number;
  totalCents: number;
  amountPaidCents: number;
  balanceDueCents: number;
  paymentInstructions?: string;
  notes?: string;
}

export const InvoicePreview: React.FC<InvoicePreviewProps> = ({
  template,
  watermark,
  businessName,
  businessEmail,
  businessAddress,
  businessPhone,
  invoiceNumber,
  issueDate,
  dueDate,
  status = 'draft',
  clientName,
  clientEmail,
  clientAddress,
  items,
  subtotalCents,
  discountCents,
  taxRateLabel = 'Tax',
  taxCents,
  totalCents,
  amountPaidCents,
  balanceDueCents,
  paymentInstructions,
  notes,
}) => {
  const reduced = useReducedMotion();
  const resolvedWatermark = resolveWatermarkDisplay(watermark, status);

  const renderHeader = () => {
    if (template === 'minimal') {
      return (
        <div className="px-6 py-5 bg-white border-b border-slate-200 flex items-start justify-between gap-4">
          <div>
            <p className="font-display font-bold text-base tracking-tight text-[#172033]">
              {businessName || 'Your Business'}
            </p>
            {businessEmail && <p className="text-[11px] text-slate-500 mt-0.5">{businessEmail}</p>}
            {businessAddress && <p className="text-[11px] text-slate-400">{businessAddress}</p>}
          </div>
          <div className="text-right">
            <p className="text-[10px] tracking-[0.18em] uppercase text-slate-400 font-semibold">Invoice</p>
            <p className="font-mono font-semibold text-sm text-[#172033] mt-0.5">#{invoiceNumber}</p>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 mt-1">{status.replace('_', ' ')}</p>
          </div>
        </div>
      );
    }

    if (template === 'modern') {
      return (
        <div>
          <div className="h-2 bg-[#0284C7]" />
          <div className="px-6 py-5 bg-[#0F172A] text-white flex items-start justify-between gap-4">
            <div>
              <span className="inline-block text-[10px] font-mono uppercase tracking-widest text-[#38BDF8] mb-1">
                USD Billing Statement
              </span>
              <p className="font-display font-bold text-base">{businessName || 'Your Business'}</p>
              {businessEmail && <p className="text-[11px] text-slate-300 mt-0.5">{businessEmail}</p>}
              {businessPhone && <p className="text-[11px] text-slate-400">{businessPhone}</p>}
            </div>
            <div className="text-right bg-white/10 rounded-lg px-3 py-2 border border-white/10">
              <p className="text-[10px] tracking-wider uppercase text-sky-300">Invoice</p>
              <p className="font-mono font-bold text-sm text-white">#{invoiceNumber}</p>
              <p className="text-[10px] text-slate-300 mt-0.5 uppercase">{status.replace('_', ' ')}</p>
            </div>
          </div>
        </div>
      );
    }

    if (template === 'creative') {
      return (
        <div className="px-6 py-5 bg-[#EFF6FF] border-b border-blue-100 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-1.5 self-stretch rounded-full bg-[#2563EB]" />
            <div>
              <p className="font-display font-extrabold text-base text-[#172B4D]">
                {businessName || 'Your Business'}
              </p>
              {businessEmail && <p className="text-[11px] text-slate-600 mt-0.5">{businessEmail}</p>}
              {businessAddress && <p className="text-[11px] text-slate-500">{businessAddress}</p>}
            </div>
          </div>
          <div className="text-right">
            <span className="inline-block px-2.5 py-1 rounded-md bg-[#1E293B] text-white font-mono text-xs font-bold">
              #{invoiceNumber}
            </span>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#2563EB] mt-1.5">
              {status.replace('_', ' ')}
            </p>
          </div>
        </div>
      );
    }

    // Corporate (plus fallback for elegant/professional)
    const bgMap: Record<string, string> = {
      corporate: '#172B4D',
      elegant: '#172B4D',
      professional: '#172B4D',
    };
    return (
      <div
        style={{ backgroundColor: bgMap[template] || '#172B4D' }}
        className="px-6 py-5 text-white flex items-start justify-between gap-4"
      >
        <div>
          <p className="font-display font-bold text-base">{businessName || 'Your Business'}</p>
          {businessEmail && <p className="text-[11px] text-slate-300 mt-0.5">{businessEmail}</p>}
          {businessAddress && <p className="text-[11px] text-slate-400">{businessAddress}</p>}
        </div>
        <div className="text-right">
          <p className="text-[10px] tracking-wider uppercase text-sky-300">Invoice</p>
          <p className="font-mono font-bold text-sm">#{invoiceNumber}</p>
          <p className="text-[10px] uppercase tracking-wider text-slate-300 mt-0.5">{status.replace('_', ' ')}</p>
        </div>
      </div>
    );
  };

  const accentColor =
    template === 'minimal'
      ? '#172033'
      : template === 'modern'
        ? '#0284C7'
        : template === 'professional'
          ? '#16A34A'
          : '#2563EB';

  const containerClasses =
    template === 'creative'
      ? 'border border-blue-200 rounded-xl overflow-hidden bg-white shadow-sm'
      : template === 'minimal'
        ? 'border border-slate-200 rounded-lg overflow-hidden bg-white'
        : 'border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm';

  const tableHeaderClass =
    template === 'minimal'
      ? 'border-b border-slate-300 text-slate-500'
      : template === 'modern'
        ? 'bg-[#F0F9FF] text-[#0F172A] rounded-md'
        : template === 'creative'
          ? 'bg-[#EFF6FF] text-[#172B4D] rounded-md'
          : 'bg-slate-100 text-slate-600 rounded-md';

  const summaryCardClass =
    template === 'modern'
      ? 'bg-[#F0F9FF] border border-sky-100 rounded-lg p-3'
      : template === 'creative'
        ? 'bg-[#EFF6FF]/60 border border-blue-100 rounded-lg p-3'
        : template === 'minimal'
          ? 'pt-2'
          : 'bg-slate-50 border border-slate-100 rounded-lg p-3';

  return (
    <motion.div
      key={template}
      initial={reduced ? false : { opacity: 0.72, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      data-template={template}
      className={`${containerClasses} relative`}
    >
      {resolvedWatermark && (
        <div
          aria-hidden="true"
          data-watermark-text={resolvedWatermark.text}
          className="pointer-events-none select-none absolute inset-0 z-20 flex items-center justify-center overflow-hidden"
        >
          <span
            style={{
              color: resolvedWatermark.color,
              opacity: resolvedWatermark.opacity,
              transform: `rotate(${resolvedWatermark.angle}deg)`,
            }}
            className={`font-display font-extrabold tracking-[0.14em] uppercase whitespace-nowrap text-center px-4 ${
              resolvedWatermark.text.length <= 6
                ? 'text-5xl sm:text-6xl'
                : resolvedWatermark.text.length <= 12
                  ? 'text-3xl sm:text-4xl'
                  : resolvedWatermark.text.length <= 20
                    ? 'text-2xl sm:text-3xl'
                    : 'text-lg sm:text-xl'
            }`}
          >
            {resolvedWatermark.text}
          </span>
        </div>
      )}
      {renderHeader()}

      <div className="p-5 space-y-4 text-xs">
        {/* Bill To & Dates */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Bill To</p>
            <p className="font-semibold text-[#172033] mt-0.5">{clientName || 'Select a client'}</p>
            {clientEmail && <p className="text-slate-500">{clientEmail}</p>}
            {clientAddress && <p className="text-slate-400 mt-0.5">{clientAddress}</p>}
          </div>
          <div className="text-right tabular-nums space-y-1">
            <div>
              <span className="text-slate-400">Issue Date: </span>
              <span className="font-medium text-[#172033]">{issueDate}</span>
            </div>
            <div>
              <span className="text-slate-400">Due Date: </span>
              <span className="font-semibold text-[#172033]">{dueDate}</span>
            </div>
            <div>
              <span className="text-slate-400">Currency: </span>
              <span className="font-medium text-[#172033]">USD ($)</span>
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="space-y-1.5">
          <div className={`grid grid-cols-12 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider ${tableHeaderClass}`}>
            <span className="col-span-6">Description</span>
            <span className="col-span-2 text-right">Qty</span>
            <span className="col-span-2 text-right">Rate</span>
            <span className="col-span-2 text-right">Amount</span>
          </div>
          <div className="divide-y divide-slate-100">
            {items.map((it) => (
              <div key={it.id} className="grid grid-cols-12 px-2.5 py-2 gap-1 items-center">
                <span className="col-span-6 text-slate-700 truncate">{it.description || 'Line item'}</span>
                <span className="col-span-2 text-right font-mono text-slate-600 tabular-nums">{it.quantity}</span>
                <span className="col-span-2 text-right font-mono text-slate-600 tabular-nums">
                  {formatUsd(it.unitPriceCents)}
                </span>
                <span className="col-span-2 text-right font-mono font-semibold text-[#172033] tabular-nums">
                  {formatUsd(it.totalCents)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div className={`space-y-1.5 tabular-nums ${summaryCardClass}`}>
          <div className="flex justify-between text-slate-600">
            <span>Subtotal</span>
            <span className="font-mono">{formatUsd(subtotalCents)}</span>
          </div>
          {discountCents > 0 && (
            <div className="flex justify-between text-slate-600">
              <span>Discount</span>
              <span className="font-mono">-{formatUsd(discountCents)}</span>
            </div>
          )}
          <div className="flex justify-between text-slate-600">
            <span>{taxRateLabel}</span>
            <span className="font-mono">{formatUsd(taxCents)}</span>
          </div>
          {amountPaidCents > 0 && (
            <>
              <div className="flex justify-between text-slate-600">
                <span>Total</span>
                <span className="font-mono">{formatUsd(totalCents)}</span>
              </div>
              <div className="flex justify-between text-[#16A34A]">
                <span>Amount Paid</span>
                <span className="font-mono">-{formatUsd(amountPaidCents)}</span>
              </div>
            </>
          )}
          <div
            style={{ color: accentColor }}
            className="flex justify-between font-bold text-sm pt-2 border-t border-slate-200"
          >
            <span>Balance Due</span>
            <span className="font-mono">{formatUsd(balanceDueCents)}</span>
          </div>
        </div>

        {/* Payment Instructions & Notes */}
        {(paymentInstructions || notes) && (
          <div className="pt-2 border-t border-slate-100 space-y-2 text-[11px] text-slate-500">
            {paymentInstructions && (
              <div>
                <span className="font-semibold text-slate-700">Payment Instructions: </span>
                <span>{paymentInstructions}</span>
              </div>
            )}
            {notes && (
              <div>
                <span className="font-semibold text-slate-700">Notes: </span>
                <span>{notes}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};

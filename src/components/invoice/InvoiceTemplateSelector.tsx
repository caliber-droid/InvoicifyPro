import React, { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check, ChevronDown, Stamp } from 'lucide-react';
import {
  DEFAULT_WATERMARK_CONFIG,
  resolveWatermarkDisplay,
  WATERMARK_COLOR_OPTIONS,
  WATERMARK_PRESETS,
} from '../../lib/watermark';
import { InvoiceTemplate, WatermarkConfig } from '../../types/models';

export type SelectableInvoiceTemplate = 'minimal' | 'corporate' | 'modern' | 'creative';

export interface InvoiceTemplateStyleMeta {
  id: SelectableInvoiceTemplate;
  label: string;
  description: string;
  headerBg: string;
  accent: string;
  surfaceBg: string;
}

export const INVOICE_TEMPLATE_OPTIONS: InvoiceTemplateStyleMeta[] = [
  {
    id: 'minimal',
    label: 'Minimal',
    description: 'Clean white header, hairline rules',
    headerBg: '#FFFFFF',
    accent: '#172033',
    surfaceBg: '#F8FAFC',
  },
  {
    id: 'corporate',
    label: 'Corporate',
    description: 'Deep navy header, structured grid',
    headerBg: '#172B4D',
    accent: '#2563EB',
    surfaceBg: '#F1F5F9',
  },
  {
    id: 'modern',
    label: 'Modern',
    description: 'Split slate band, cyan accents',
    headerBg: '#0F172A',
    accent: '#0284C7',
    surfaceBg: '#F0F9FF',
  },
  {
    id: 'creative',
    label: 'Creative',
    description: 'Bold left rail, soft blue cards',
    headerBg: '#1E293B',
    accent: '#2563EB',
    surfaceBg: '#EFF6FF',
  },
];

interface InvoiceTemplateSelectorProps {
  value: InvoiceTemplate;
  onChange: (template: SelectableInvoiceTemplate) => void;
  watermark?: WatermarkConfig;
  onWatermarkChange?: (watermark: WatermarkConfig) => void;
  invoiceStatus?: string;
  watermarkExpandedByDefault?: boolean;
  disabled?: boolean;
  label?: string;
  instanceId?: string;
}

const MiniLayoutThumb: React.FC<{ id: SelectableInvoiceTemplate }> = ({ id }) => {
  if (id === 'minimal') {
    return (
      <div className="w-full h-11 rounded border border-slate-200 bg-white p-1.5 flex flex-col justify-between">
        <div className="flex items-center justify-between border-b border-slate-200 pb-1">
          <div className="h-1.5 w-7 bg-[#172033] rounded-xs" />
          <div className="h-1.5 w-4 bg-slate-300 rounded-xs" />
        </div>
        <div className="space-y-1">
          <div className="h-1 w-full bg-slate-100 rounded-xs" />
          <div className="h-1 w-4/5 bg-slate-200 rounded-xs" />
        </div>
      </div>
    );
  }
  if (id === 'corporate') {
    return (
      <div className="w-full h-11 rounded border border-slate-200 bg-white overflow-hidden flex flex-col justify-between">
        <div className="h-4 bg-[#172B4D] px-1.5 flex items-center justify-between">
          <div className="h-1.5 w-7 bg-white/90 rounded-xs" />
          <div className="h-1.5 w-4 bg-[#38BDF8] rounded-xs" />
        </div>
        <div className="p-1.5 space-y-1">
          <div className="h-1 w-full bg-slate-100 rounded-xs" />
          <div className="h-1.5 w-6 bg-[#2563EB] rounded-xs ml-auto" />
        </div>
      </div>
    );
  }
  if (id === 'modern') {
    return (
      <div className="w-full h-11 rounded border border-slate-200 bg-white overflow-hidden flex flex-col justify-between">
        <div className="h-1.5 bg-[#0284C7]" />
        <div className="px-1.5 pt-1 flex items-center justify-between">
          <div className="h-1.5 w-8 bg-[#0F172A] rounded-xs" />
          <div className="h-2 w-5 bg-[#F0F9FF] border border-sky-200 rounded-xs" />
        </div>
        <div className="px-1.5 pb-1.5 space-y-1">
          <div className="h-1 w-full bg-slate-100 rounded-xs" />
          <div className="h-1 w-2/3 bg-[#0284C7]/40 rounded-xs" />
        </div>
      </div>
    );
  }
  return (
    <div className="w-full h-11 rounded border border-slate-200 bg-white overflow-hidden flex">
      <div className="w-2 bg-[#2563EB] shrink-0" />
      <div className="flex-1 p-1.5 flex flex-col justify-between bg-[#EFF6FF]/40">
        <div className="flex items-center justify-between">
          <div className="h-1.5 w-7 bg-[#1E293B] rounded-xs" />
          <div className="h-1.5 w-4 bg-[#38BDF8] rounded-xs" />
        </div>
        <div className="space-y-1">
          <div className="h-1 w-full bg-white rounded-xs" />
          <div className="h-1 w-3/4 bg-blue-200 rounded-xs" />
        </div>
      </div>
    </div>
  );
};

export const InvoiceTemplateSelector: React.FC<InvoiceTemplateSelectorProps> = ({
  value,
  onChange,
  watermark,
  onWatermarkChange,
  invoiceStatus = 'draft',
  watermarkExpandedByDefault = false,
  disabled = false,
  label = 'Invoice Layout Template',
  instanceId = 'default',
}) => {
  const reduced = useReducedMotion();
  const wm = watermark ?? DEFAULT_WATERMARK_CONFIG;
  const [wmExpanded, setWmExpanded] = useState(watermarkExpandedByDefault || wm.enabled);
  const resolved = resolveWatermarkDisplay(wm, invoiceStatus);

  const patchWatermark = (patch: Partial<WatermarkConfig>) => {
    if (!onWatermarkChange) return;
    onWatermarkChange({ ...wm, ...patch });
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="block text-xs font-semibold text-slate-700">{label}</span>
          <span className="text-[11px] text-slate-500">Applies immediately to preview</span>
        </div>
        <div
          role="radiogroup"
          aria-label={label}
          className="grid grid-cols-2 sm:grid-cols-4 gap-2"
        >
          {INVOICE_TEMPLATE_OPTIONS.map((tpl) => {
            const active = value === tpl.id;
            return (
              <button
                key={tpl.id}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={disabled}
                onClick={() => onChange(tpl.id)}
                className={`relative text-left p-2 rounded-xl border transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                  active
                    ? 'border-[#2563EB] bg-blue-50/50'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId={`invoiceTemplateActiveRing-${instanceId}`}
                    transition={{ duration: reduced ? 0 : 0.18, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute inset-0 rounded-xl ring-2 ring-[#2563EB] pointer-events-none"
                  />
                )}
                <MiniLayoutThumb id={tpl.id} />
                <div className="mt-1.5 flex items-center justify-between gap-1">
                  <span className="text-xs font-semibold text-[#172033] truncate">{tpl.label}</span>
                  {active && (
                    <span className="w-4 h-4 rounded-full bg-[#2563EB] text-white flex items-center justify-center shrink-0">
                      <Check className="w-2.5 h-2.5" />
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-500 truncate mt-0.5">{tpl.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Integrated PDF Watermark Template Configuration */}
      {onWatermarkChange && (
        <div className="border border-slate-200 rounded-xl bg-slate-50/70 overflow-hidden">
          <div className="px-3.5 py-2.5 flex items-center justify-between gap-3">
            <button
              type="button"
              disabled={disabled}
              onClick={() => setWmExpanded((prev) => !prev)}
              className="flex items-center gap-2 text-left min-w-0 cursor-pointer disabled:cursor-not-allowed"
            >
              <span className="w-6 h-6 rounded-md bg-white border border-slate-200 flex items-center justify-center text-[#172B4D] shrink-0">
                <Stamp className="w-3.5 h-3.5" />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-[#172033]">PDF Watermark</span>
                  <span
                    className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${
                      resolved
                        ? 'bg-blue-50 text-[#2563EB] border border-blue-200'
                        : 'bg-slate-200/70 text-slate-500'
                    }`}
                  >
                    {resolved ? resolved.text : 'OFF'}
                  </span>
                </div>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 transition-transform shrink-0 ${
                  wmExpanded ? 'rotate-180' : ''
                }`}
              />
            </button>

            <button
              type="button"
              role="switch"
              aria-checked={wm.enabled}
              aria-label="Enable PDF watermark"
              disabled={disabled}
              onClick={() => {
                const nextEnabled = !wm.enabled;
                patchWatermark({ enabled: nextEnabled });
                if (nextEnabled) setWmExpanded(true);
              }}
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer disabled:opacity-50 ${
                wm.enabled ? 'bg-[#2563EB]' : 'bg-slate-300'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs transition-transform ${
                  wm.enabled ? 'translate-x-4.5' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <AnimatePresence initial={false}>
            {wmExpanded && (
              <motion.div
                initial={reduced ? false : { opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={reduced ? undefined : { opacity: 0, height: 0 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden"
              >
                <div className="px-3.5 pb-3.5 pt-2 border-t border-slate-200/80 space-y-3 bg-white">
                  {/* Source Mode + Quick Presets */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="inline-flex p-0.5 bg-slate-100 rounded-lg self-start">
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => patchWatermark({ enabled: true, mode: 'status' })}
                        className={`px-2.5 py-1 text-[11px] font-medium rounded-md cursor-pointer transition-colors ${
                          wm.mode === 'status'
                            ? 'bg-white text-[#172033] shadow-xs'
                            : 'text-slate-600 hover:text-[#172033]'
                        }`}
                      >
                        Auto (Match Status)
                      </button>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => patchWatermark({ enabled: true, mode: 'custom' })}
                        className={`px-2.5 py-1 text-[11px] font-medium rounded-md cursor-pointer transition-colors ${
                          wm.mode === 'custom'
                            ? 'bg-white text-[#172033] shadow-xs'
                            : 'text-slate-600 hover:text-[#172033]'
                        }`}
                      >
                        Custom Text
                      </button>
                    </div>
                    <span className="text-[11px] text-slate-500">
                      {wm.mode === 'status'
                        ? `Stamps "${invoiceStatus.replace('_', ' ').toUpperCase()}" automatically`
                        : 'Applies custom stamp text to PDFs'}
                    </span>
                  </div>

                  {/* Quick Stamp Presets */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-slate-500 mr-1">Presets:</span>
                    {WATERMARK_PRESETS.map((preset) => {
                      const isCurrentPreset =
                        wm.enabled && wm.mode === 'custom' && wm.customText.toUpperCase() === preset;
                      return (
                        <button
                          key={preset}
                          type="button"
                          disabled={disabled}
                          onClick={() =>
                            patchWatermark({
                              enabled: true,
                              mode: 'custom',
                              customText: preset,
                            })
                          }
                          className={`px-2 py-0.5 text-[11px] font-mono font-medium rounded border transition-colors cursor-pointer ${
                            isCurrentPreset
                              ? 'bg-[#172B4D] text-white border-[#172B4D]'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300 hover:text-[#172033]'
                          }`}
                        >
                          {preset}
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom Watermark Text Input */}
                  {wm.mode === 'custom' && (
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Custom Watermark Text
                      </label>
                      <input
                        type="text"
                        maxLength={40}
                        disabled={disabled}
                        value={wm.customText}
                        onChange={(e) =>
                          patchWatermark({
                            enabled: true,
                            customText: e.target.value.slice(0, 40),
                          })
                        }
                        placeholder="e.g. DRAFT, PAID, OVERDUE, CONFIDENTIAL"
                        className="w-full px-3 py-1.5 text-xs font-mono uppercase bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#2563EB]"
                      />
                    </div>
                  )}

                  {/* Opacity, Angle & Color Controls */}
                  <div className="grid sm:grid-cols-3 gap-3 pt-1">
                    <div>
                      <div className="flex items-center justify-between text-[11px] text-slate-600 mb-1">
                        <span className="font-medium">Opacity</span>
                        <span className="font-mono tabular-nums">{wm.opacityPct}%</span>
                      </div>
                      <input
                        type="range"
                        min={5}
                        max={45}
                        step={1}
                        disabled={disabled || !wm.enabled}
                        value={wm.opacityPct}
                        onChange={(e) => patchWatermark({ opacityPct: Number(e.target.value) })}
                        className="w-full accent-[#2563EB] cursor-pointer disabled:opacity-40"
                      />
                    </div>

                    <div>
                      <span className="block text-[11px] font-medium text-slate-600 mb-1">Angle</span>
                      <div className="flex items-center gap-1">
                        {[-45, -32, 0, 32].map((deg) => (
                          <button
                            key={deg}
                            type="button"
                            disabled={disabled || !wm.enabled}
                            onClick={() => patchWatermark({ angle: deg })}
                            className={`flex-1 py-1 text-[10px] font-mono rounded border cursor-pointer disabled:opacity-40 ${
                              wm.angle === deg
                                ? 'bg-blue-50 border-[#2563EB] text-[#2563EB] font-semibold'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            {deg}&deg;
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="block text-[11px] font-medium text-slate-600 mb-1">Ink Color</span>
                      <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
                        {WATERMARK_COLOR_OPTIONS.map((opt) => {
                          const selected = wm.color === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              title={opt.label}
                              aria-label={`Watermark color ${opt.label}`}
                              disabled={disabled || !wm.enabled}
                              onClick={() => patchWatermark({ color: opt.id })}
                              className={`w-5 h-5 rounded-full border flex items-center justify-center transition-transform cursor-pointer disabled:opacity-40 ${
                                selected ? 'ring-2 ring-offset-1 ring-[#2563EB] scale-110' : 'border-slate-300'
                              }`}
                              style={{
                                background:
                                  opt.id === 'auto'
                                    ? 'linear-gradient(135deg, #16A34A 0%, #2563EB 50%, #DC2626 100%)'
                                    : opt.swatch,
                              }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default InvoiceTemplateSelector;

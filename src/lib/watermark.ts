import { WatermarkConfig } from '../types/models';

export const DEFAULT_WATERMARK_CONFIG: WatermarkConfig = {
  enabled: false,
  mode: 'status',
  customText: 'DRAFT',
  opacityPct: 14,
  angle: -32,
  color: 'auto',
};

export const WATERMARK_PRESETS = [
  'DRAFT',
  'PAID',
  'OVERDUE',
  'CONFIDENTIAL',
  'COPY',
] as const;

export const WATERMARK_COLOR_OPTIONS = [
  { id: 'auto', label: 'Auto (By Status)', swatch: '#64748B' },
  { id: '#64748B', label: 'Slate', swatch: '#64748B' },
  { id: '#172B4D', label: 'Navy', swatch: '#172B4D' },
  { id: '#2563EB', label: 'Blue', swatch: '#2563EB' },
  { id: '#16A34A', label: 'Green', swatch: '#16A34A' },
  { id: '#D97706', label: 'Amber', swatch: '#D97706' },
  { id: '#DC2626', label: 'Red', swatch: '#DC2626' },
] as const;

const STATUS_WATERMARK_LABELS: Record<string, string> = {
  draft: 'DRAFT',
  sent: 'SENT',
  viewed: 'VIEWED',
  partially_paid: 'PARTIAL',
  paid: 'PAID',
  overdue: 'OVERDUE',
  void: 'VOID',
  refunded: 'REFUNDED',
  accepted: 'APPROVED',
  rejected: 'DECLINED',
  expired: 'EXPIRED',
  converted: 'CONVERTED',
};

export interface ResolvedWatermark {
  text: string;
  color: string;
  opacityPct: number;
  opacity: number;
  angle: number;
}

export function sanitizeWatermarkConfig(input?: Partial<WatermarkConfig> | null): WatermarkConfig {
  const mode = input?.mode === 'custom' ? 'custom' : 'status';
  const rawText = typeof input?.customText === 'string' ? input.customText : DEFAULT_WATERMARK_CONFIG.customText;
  const opacityPct = Math.max(5, Math.min(50, Math.round(Number(input?.opacityPct ?? DEFAULT_WATERMARK_CONFIG.opacityPct))));
  const angle = Math.max(-60, Math.min(60, Math.round(Number(input?.angle ?? DEFAULT_WATERMARK_CONFIG.angle))));
  const rawColor = typeof input?.color === 'string' ? input.color.trim() : 'auto';
  const color = rawColor.length >= 4 && rawColor.length <= 16 ? rawColor : 'auto';

  return {
    enabled: Boolean(input?.enabled),
    mode,
    customText: rawText.slice(0, 40),
    opacityPct,
    angle,
    color,
  };
}

export function inferWatermarkColor(text: string, status?: string): string {
  const s = (status || '').toLowerCase();
  const t = text.toUpperCase();

  if (s === 'paid' || s === 'accepted' || t.includes('PAID') || t.includes('APPROVED')) {
    return '#16A34A';
  }
  if (
    s === 'overdue' ||
    s === 'void' ||
    s === 'rejected' ||
    t.includes('OVERDUE') ||
    t.includes('VOID') ||
    t.includes('FINAL') ||
    t.includes('PAST DUE')
  ) {
    return '#DC2626';
  }
  if (s === 'partially_paid' || t.includes('PARTIAL')) {
    return '#D97706';
  }
  if (s === 'draft' || t.includes('DRAFT') || t.includes('COPY')) {
    return '#64748B';
  }
  return '#172B4D';
}

export function resolveWatermarkDisplay(
  config?: WatermarkConfig | null,
  status?: string
): ResolvedWatermark | null {
  if (!config || !config.enabled) return null;

  const normalizedStatus = (status || 'draft').toLowerCase();
  const text =
    config.mode === 'status'
      ? STATUS_WATERMARK_LABELS[normalizedStatus] || normalizedStatus.toUpperCase().replace(/_/g, ' ')
      : config.customText.trim().slice(0, 40).toUpperCase();

  if (!text) return null;

  const opacityPct = Math.max(5, Math.min(50, Math.round(Number(config.opacityPct ?? 14))));
  const angle = Math.max(-60, Math.min(60, Math.round(Number(config.angle ?? -32))));
  const color =
    config.color && config.color !== 'auto'
      ? config.color
      : inferWatermarkColor(text, config.mode === 'status' ? normalizedStatus : undefined);

  return {
    text,
    color,
    opacityPct,
    opacity: opacityPct / 100,
    angle,
  };
}

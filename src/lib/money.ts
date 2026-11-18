import { Invoice, LineItem } from '../types/models';

export function formatUsd(cents: number): string {
  const safe = Number.isFinite(cents) ? Math.round(cents) : 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe / 100);
}

export function formatCompactUsd(cents: number): string {
  const dollars = (Number.isFinite(cents) ? cents : 0) / 100;
  if (Math.abs(dollars) >= 1000) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(dollars);
  }
  return formatUsd(cents);
}

export function parseDollarsToCents(input: string | number): number {
  const cleaned = String(input).replace(/[^0-9.-]/g, '');
  const parsed = Number.parseFloat(cleaned);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed * 100);
}

export function centsToDollarsInput(cents: number): string {
  return (Math.round(cents) / 100).toFixed(2);
}

export function calculateLineItemCents(quantity: number, unitPriceCents: number): number {
  const safeQty = Number.isFinite(quantity) && quantity >= 0 ? quantity : 0;
  const safePrice = Number.isFinite(unitPriceCents) && unitPriceCents >= 0 ? Math.round(unitPriceCents) : 0;
  return Math.round(safeQty * safePrice);
}

export function calculateInvoiceTotals(
  items: LineItem[],
  discountCents: number,
  taxRateBps: number,
  amountPaidCents = 0
) {
  const subtotalCents = items.reduce((sum, item) => sum + Math.max(0, Math.round(item.totalCents)), 0);
  const safeDiscount = Math.min(subtotalCents, Math.max(0, Math.round(discountCents || 0)));
  const taxableBase = Math.max(0, subtotalCents - safeDiscount);
  const safeTaxBps = Math.max(0, Math.min(5000, Math.round(taxRateBps || 0)));
  const taxCents = Math.round((taxableBase * safeTaxBps) / 10000);
  const totalCents = taxableBase + taxCents;
  const safePaid = Math.min(totalCents, Math.max(0, Math.round(amountPaidCents || 0)));
  const balanceDueCents = Math.max(0, totalCents - safePaid);
  return {
    subtotalCents,
    discountCents: safeDiscount,
    taxRateBps: safeTaxBps,
    taxCents,
    totalCents,
    amountPaidCents: safePaid,
    balanceDueCents,
  };
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysIso(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return todayIso();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(startIso: string, endIso: string): number {
  const a = new Date(`${startIso}T12:00:00Z`).getTime();
  const b = new Date(`${endIso}T12:00:00Z`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86400000);
}

export function getEffectiveInvoiceStatus(inv: Invoice, referenceIso = todayIso()): Invoice['status'] {
  if (inv.status === 'void' || inv.status === 'refunded' || inv.status === 'paid' || inv.status === 'draft') {
    return inv.status;
  }
  if (inv.balanceDueCents <= 0) return 'paid';
  if (inv.dueDate < referenceIso) return 'overdue';
  if (inv.amountPaidCents > 0 && inv.balanceDueCents > 0) return 'partially_paid';
  return inv.status;
}

export function computeInvoiceIntelligence(invoices: Invoice[]) {
  const active = invoices.filter((i) => i.status !== 'void' && i.status !== 'refunded' && i.status !== 'draft');
  if (active.length === 0) {
    return {
      score: null as number | null,
      label: 'No Issued Invoices Yet',
      overdueRatePct: 0,
      avgCollectionDays: 0,
      onTimeRatePct: 0,
      factors: ['Issue your first invoice to generate live billing health insights.'],
    };
  }

  const today = todayIso();
  const overdueInvoices = active.filter((i) => getEffectiveInvoiceStatus(i, today) === 'overdue');
  const paidInvoices = active.filter((i) => i.status === 'paid' && i.paidAt);

  const overdueRatePct = Math.round((overdueInvoices.length / active.length) * 100);

  let avgCollectionDays = 0;
  let onTimeCount = 0;
  if (paidInvoices.length > 0) {
    const totalDays = paidInvoices.reduce((sum, inv) => {
      const paidIso = String(inv.paidAt).slice(0, 10);
      const diff = Math.max(0, daysBetween(inv.issueDate, paidIso));
      if (paidIso <= inv.dueDate) onTimeCount += 1;
      return sum + diff;
    }, 0);
    avgCollectionDays = Math.round(totalDays / paidInvoices.length);
  }

  const onTimeRatePct = paidInvoices.length > 0 ? Math.round((onTimeCount / paidInvoices.length) * 100) : 100;

  let score = 100;
  score -= Math.min(40, Math.round(overdueRatePct * 0.8));
  if (avgCollectionDays > 30) score -= Math.min(20, Math.round((avgCollectionDays - 30) * 0.5));
  if (paidInvoices.length > 0 && onTimeRatePct < 80) {
    score -= Math.min(20, Math.round((80 - onTimeRatePct) * 0.4));
  }
  score = Math.max(15, Math.min(100, score));

  const factors: string[] = [];
  if (overdueInvoices.length === 0) {
    factors.push('Zero overdue invoices across active receivables.');
  } else {
    factors.push(`${overdueInvoices.length} overdue invoice(s) (${overdueRatePct}% of issued invoices).`);
  }
  if (paidInvoices.length > 0) {
    factors.push(`Average collection time is ${avgCollectionDays} day(s); ${onTimeRatePct}% paid by due date.`);
  } else {
    factors.push('No settled invoices yet to compute historical collection speed.');
  }

  const label = score >= 85 ? 'Healthy Receivables' : score >= 65 ? 'Moderate Follow-Up Needed' : 'High Overdue Exposure';
  return {
    score,
    label,
    overdueRatePct,
    avgCollectionDays,
    onTimeRatePct,
    factors,
  };
}

export function generateRandomId(prefix = 'id'): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${prefix}_${hex}`;
}

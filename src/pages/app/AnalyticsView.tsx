import React, { useMemo, useState } from 'react';
import { Download, Info, TrendingUp } from 'lucide-react';
import { BarComparisonChart, ForecastChart, MonthlyTrendPoint, RevenueTrendChart } from '../../components/Charts';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { downloadPdfFromEndpoint } from '../../lib/api';
import { AnimatedButton, StaggerGrid, StaggerItem } from '../../lib/motion';
import { addDaysIso, daysBetween, formatUsd, todayIso } from '../../lib/money';

export const AnalyticsView: React.FC = () => {
  const { businessProfile } = useAuth();
  const { invoices, payments, expenses, recurringProfiles } = useData();
  const { notify } = useToast();

  const [horizonDays, setHorizonDays] = useState<7 | 30 | 60 | 90>(30);
  const [pdfBusy, setPdfBusy] = useState(false);

  const today = todayIso();
  const currentMonth = today.slice(0, 7);
  const prevMonthDate = new Date();
  prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
  const prevMonth = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;

  const summary = useMemo(() => {
    const activeInvoices = invoices.filter((i) => i.status !== 'void' && i.status !== 'refunded');
    const totalInvoicedCents = activeInvoices.reduce((s, i) => s + i.totalCents, 0);
    const collectedCents = payments
      .filter((p) => p.status === 'completed')
      .reduce((s, p) => s + p.amountCents, 0);
    const prevMonthCollectedCents = payments
      .filter((p) => p.status === 'completed' && p.paymentDate.startsWith(prevMonth))
      .reduce((s, p) => s + p.amountCents, 0);
    const thisMonthCollectedCents = payments
      .filter((p) => p.status === 'completed' && p.paymentDate.startsWith(currentMonth))
      .reduce((s, p) => s + p.amountCents, 0);
    const outstandingCents = activeInvoices.reduce((s, i) => s + i.balanceDueCents, 0);
    const overdueCents = activeInvoices
      .filter((i) => i.status === 'overdue')
      .reduce((s, i) => s + i.balanceDueCents, 0);
    const expensesCents = expenses.reduce((s, e) => s + e.amountCents, 0);

    const paidWithTime = activeInvoices.filter((i) => i.status === 'paid' && i.paidAt);
    const avgCollectionDays =
      paidWithTime.length > 0
        ? Math.round(
            paidWithTime.reduce(
              (sum, i) => sum + Math.max(0, daysBetween(i.issueDate, String(i.paidAt).slice(0, 10))),
              0
            ) / paidWithTime.length
          )
        : 0;

    return {
      totalInvoicedCents,
      collectedCents,
      prevMonthCollectedCents,
      thisMonthCollectedCents,
      outstandingCents,
      overdueCents,
      expensesCents,
      netCashFlowCents: collectedCents - expensesCents,
      avgCollectionDays,
    };
  }, [invoices, payments, expenses, currentMonth, prevMonth]);

  const sixMonthTrend: MonthlyTrendPoint[] = useMemo(() => {
    const pts: MonthlyTrendPoint[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      pts.push({
        label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        revenueCents: invoices
          .filter((inv) => inv.status !== 'void' && inv.issueDate.startsWith(ym))
          .reduce((s, inv) => s + inv.totalCents, 0),
        collectedCents: payments
          .filter((p) => p.status === 'completed' && p.paymentDate.startsWith(ym))
          .reduce((s, p) => s + p.amountCents, 0),
        expensesCents: expenses
          .filter((e) => e.date.startsWith(ym))
          .reduce((s, e) => s + e.amountCents, 0),
      });
    }
    return pts;
  }, [invoices, payments, expenses]);

  // Forecast built strictly from open receivables due within horizon + active recurring schedules
  const forecast = useMemo(() => {
    const buckets = horizonDays === 7 ? 4 : horizonDays === 30 ? 4 : horizonDays === 60 ? 4 : 6;
    const stepDays = Math.max(1, Math.round(horizonDays / buckets));
    const points: Array<{
      label: string;
      actualCents: number;
      projectedCents: number;
      lowCents: number;
      highCents: number;
    }> = [];

    const openInvoices = invoices.filter(
      (i) => i.balanceDueCents > 0 && i.status !== 'void' && i.status !== 'refunded' && i.status !== 'draft'
    );
    const activeRecurring = recurringProfiles.filter((r) => r.status === 'active');

    let cumulativeProjected = 0;
    let cumulativeLow = 0;
    let cumulativeHigh = 0;

    for (let b = 0; b < buckets; b++) {
      const startIso = b === 0 ? today : addDaysIso(today, b * stepDays + 1);
      const endIso = addDaysIso(today, (b + 1) * stepDays);

      // Receivables expected in this window
      const dueInWindow = openInvoices
        .filter((inv) => {
          if (b === 0 && inv.dueDate <= endIso) return true;
          return inv.dueDate >= startIso && inv.dueDate <= endIso;
        })
        .reduce((s, inv) => {
          // Weight overdue slightly more conservatively for expected timing
          const weight = inv.dueDate < today ? 0.65 : 0.88;
          return s + Math.round(inv.balanceDueCents * weight);
        }, 0);

      const maxReceivableWindow = openInvoices
        .filter((inv) => (b === 0 ? inv.dueDate <= endIso : inv.dueDate >= startIso && inv.dueDate <= endIso))
        .reduce((s, inv) => s + inv.balanceDueCents, 0);

      // Recurring runs falling inside window
      const recurringExpected = activeRecurring.reduce((s, r) => {
        if (r.nextRunDate >= startIso && r.nextRunDate <= endIso) {
          return s + r.totalCents;
        }
        return s;
      }, 0);

      const expectedStep = dueInWindow + recurringExpected;
      const lowStep = Math.round(dueInWindow * 0.7) + Math.round(recurringExpected * 0.85);
      const highStep = maxReceivableWindow + recurringExpected;

      cumulativeProjected += expectedStep;
      cumulativeLow += lowStep;
      cumulativeHigh += highStep;

      points.push({
        label: `Day ${(b + 1) * stepDays}`,
        actualCents: 0,
        projectedCents: cumulativeProjected,
        lowCents: cumulativeLow,
        highCents: cumulativeHigh,
      });
    }

    return {
      points,
      totalProjectedCents: cumulativeProjected,
      lowCents: cumulativeLow,
      highCents: cumulativeHigh,
    };
  }, [invoices, recurringProfiles, horizonDays, today]);

  const topClients = useMemo(() => {
    const agg = new Map<string, { name: string; billedCents: number; paidCents: number }>();
    for (const inv of invoices) {
      if (inv.status === 'void' || inv.status === 'refunded') continue;
      const cur = agg.get(inv.clientName) || { name: inv.clientName, billedCents: 0, paidCents: 0 };
      cur.billedCents += inv.totalCents;
      cur.paidCents += inv.amountPaidCents;
      agg.set(inv.clientName, cur);
    }
    return Array.from(agg.values()).sort((a, b) => b.billedCents - a.billedCents);
  }, [invoices]);

  const expenseBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const exp of expenses) {
      map.set(exp.category, (map.get(exp.category) || 0) + exp.amountCents);
    }
    return Array.from(map.entries())
      .map(([category, amountCents]) => ({ category, amountCents }))
      .sort((a, b) => b.amountCents - a.amountCents);
  }, [expenses]);

  const handleDownloadMonthlyReport = async () => {
    setPdfBusy(true);
    try {
      const monthLabel = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      await downloadPdfFromEndpoint(
        '/api/pdf/monthly-report',
        {
          businessName: businessProfile?.businessName || 'InvoicifyPro Business',
          monthLabel,
          generatedAt: today,
          metrics: {
            totalInvoicedCents: summary.totalInvoicedCents,
            collectedCents: summary.collectedCents,
            outstandingCents: summary.outstandingCents,
            overdueCents: summary.overdueCents,
            expensesCents: summary.expensesCents,
            netCashFlowCents: summary.netCashFlowCents,
            prevMonthCollectedCents: summary.prevMonthCollectedCents,
            avgCollectionDays: summary.avgCollectionDays,
          },
          topClients,
          expenseBreakdown,
        },
        `InvoicifyPro-Monthly-Report-${today.slice(0, 7)}.pdf`,
        true
      );
      notify('success', 'Monthly Business Report downloaded');
    } catch (err: any) {
      notify('error', 'Failed to generate report', err?.message);
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#172B4D]">Reports &amp; Cash Flow Analytics</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Track revenue, collection speed, expense categories, and estimated receivables inflow.
          </p>
        </div>
        <AnimatedButton onClick={handleDownloadMonthlyReport} loading={pdfBusy}>
          <Download className="w-4 h-4" />
          <span>One-Click Monthly Report PDF</span>
        </AnimatedButton>
      </div>

      {/* KPI Summary */}
      <StaggerGrid className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StaggerItem className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">All-Time Collected</p>
          <p className="font-display text-2xl font-bold text-[#16A34A] mt-1 tabular-nums">
            {formatUsd(summary.collectedCents)}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            This month: {formatUsd(summary.thisMonthCollectedCents)}
          </p>
        </StaggerItem>
        <StaggerItem className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Operating Cash Flow</p>
          <p className="font-display text-2xl font-bold text-[#172033] mt-1 tabular-nums">
            {formatUsd(summary.netCashFlowCents)}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Collected minus {formatUsd(summary.expensesCents)} expenses
          </p>
        </StaggerItem>
        <StaggerItem className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Open Receivables</p>
          <p className="font-display text-2xl font-bold text-[#2563EB] mt-1 tabular-nums">
            {formatUsd(summary.outstandingCents)}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Overdue: {formatUsd(summary.overdueCents)}
          </p>
        </StaggerItem>
        <StaggerItem className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Avg. Collection Speed</p>
          <p className="font-display text-2xl font-bold text-[#172033] mt-1 tabular-nums">
            {summary.avgCollectionDays} days
          </p>
          <p className="text-xs text-slate-500 mt-1">From issue date to paid</p>
        </StaggerItem>
      </StaggerGrid>

      {/* Cash Flow Forecast + Historical Trend */}
      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="font-display text-base font-semibold text-[#172033] flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#0284C7]" />
                <span>Estimated Cash Inflow Forecast</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Projected from open invoice due dates and active recurring schedules.
              </p>
            </div>
            <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {([7, 30, 60, 90] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setHorizonDays(d)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md cursor-pointer transition-colors ${
                    horizonDays === d ? 'bg-white text-[#172B4D] shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>

          <ForecastChart points={forecast.points} />

          <div className="mt-4 grid grid-cols-3 gap-3 pt-4 border-t border-slate-100 text-xs">
            <div>
              <span className="text-slate-500 block">Conservative</span>
              <span className="font-mono font-semibold text-[#172033] tabular-nums">{formatUsd(forecast.lowCents)}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Expected ({horizonDays}d)</span>
              <span className="font-mono font-bold text-[#0284C7] tabular-nums">
                {formatUsd(forecast.totalProjectedCents)}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Upper Bound</span>
              <span className="font-mono font-semibold text-[#172033] tabular-nums">{formatUsd(forecast.highCents)}</span>
            </div>
          </div>

          <p className="mt-3 text-[11px] text-slate-500 flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
            <span>
              Forecast values are directional estimates based on scheduled due dates and active retainers—not guaranteed receipts.
            </span>
          </p>
        </div>

        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="font-display text-base font-semibold text-[#172033] mb-1">
            6-Month Billed vs. Collected Revenue
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Actual recorded payments (blue) compared against billed invoice totals (dashed).
          </p>
          <RevenueTrendChart data={sixMonthTrend} height={220} />
        </div>
      </div>

      {/* Client & Expense Breakdown */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="font-display text-base font-semibold text-[#172033] mb-4">Revenue by Client</h2>
          {topClients.length === 0 ? (
            <p className="text-sm text-slate-500">No client billing history yet.</p>
          ) : (
            <BarComparisonChart
              items={topClients.slice(0, 7).map((c) => ({
                label: c.name,
                valueCents: c.billedCents,
                color: '#2563EB',
              }))}
            />
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="font-display text-base font-semibold text-[#172033] mb-4">Expenses by Category</h2>
          {expenseBreakdown.length === 0 ? (
            <p className="text-sm text-slate-500">No expense records logged yet.</p>
          ) : (
            <BarComparisonChart
              items={expenseBreakdown.slice(0, 7).map((e) => ({
                label: e.category,
                valueCents: e.amountCents,
                color: '#F59E0B',
              }))}
            />
          )}
        </div>
      </div>
    </div>
  );
};

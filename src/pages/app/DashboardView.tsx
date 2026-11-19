import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Clock,
  CreditCard,
  DollarSign,
  FilePlus2,
  FileText,
  Receipt,
  ShieldCheck,
  TrendingUp,
  UserPlus,
} from 'lucide-react';
import { BarComparisonChart, MonthlyTrendPoint, RevenueTrendChart } from '../../components/Charts';
import { SponsoredLeaderboardBanner } from '../../components/SponsoredBanner';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import {
  AnimatedButton,
  AnimatedCounter,
  SkeletonCard,
  StaggerGrid,
  StaggerItem,
  StatusBadge,
} from '../../lib/motion';
import {
  addDaysIso,
  computeInvoiceIntelligence,
  daysBetween,
  formatUsd,
  todayIso,
} from '../../lib/money';

type DateRangeKey = 'week' | 'month' | '30d' | '90d' | 'year' | 'all';

interface DashboardViewProps {
  onNavigate: (tab: string) => void;
  onQuickCreateInvoice: () => void;
  onQuickCreateEstimate: () => void;
  onQuickAddClient: () => void;
  onQuickRecordPayment: () => void;
  onQuickAddExpense: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onQuickCreateInvoice,
  onQuickCreateEstimate,
  onQuickAddClient,
  onQuickRecordPayment,
  onQuickAddExpense,
}) => {
  const { businessProfile } = useAuth();
  const { invoices, payments, expenses, clients, auditLogs, dataLoading } = useData();
  const [range, setRange] = useState<DateRangeKey>('year');

  const today = todayIso();
  const cutoffIso = useMemo(() => {
    switch (range) {
      case 'week':
        return addDaysIso(today, -7);
      case 'month':
        return `${today.slice(0, 7)}-01`;
      case '30d':
        return addDaysIso(today, -30);
      case '90d':
        return addDaysIso(today, -90);
      case 'year':
        return `${today.slice(0, 4)}-01-01`;
      default:
        return '1970-01-01';
    }
  }, [range, today]);

  const metrics = useMemo(() => {
    const nonVoidInvoices = invoices.filter((i) => i.status !== 'void' && i.status !== 'refunded');
    const rangedInvoices = nonVoidInvoices.filter((i) => i.issueDate >= cutoffIso);
    const rangedPayments = payments.filter((p) => p.status === 'completed' && p.paymentDate >= cutoffIso);
    const rangedExpenses = expenses.filter((e) => e.date >= cutoffIso);

    const totalRevenueCents = rangedInvoices.reduce((s, i) => s + i.totalCents, 0);
    const paymentsReceivedCents = rangedPayments.reduce((s, p) => s + p.amountCents, 0);
    const outstandingCents = nonVoidInvoices.reduce((s, i) => s + i.balanceDueCents, 0);
    const overdueInvoices = nonVoidInvoices.filter((i) => i.status === 'overdue');
    const overdueCents = overdueInvoices.reduce((s, i) => s + i.balanceDueCents, 0);

    const monthPrefix = today.slice(0, 7);
    const monthlyRevenueCents = payments
      .filter((p) => p.status === 'completed' && p.paymentDate.startsWith(monthPrefix))
      .reduce((s, p) => s + p.amountCents, 0);

    const totalExpensesCents = rangedExpenses.reduce((s, e) => s + e.amountCents, 0);
    const netCashFlowCents = paymentsReceivedCents - totalExpensesCents;

    const paidWithTime = nonVoidInvoices.filter((i) => i.status === 'paid' && i.paidAt);
    const avgPaymentDays =
      paidWithTime.length > 0
        ? Math.round(
            paidWithTime.reduce(
              (sum, i) => sum + Math.max(0, daysBetween(i.issueDate, String(i.paidAt).slice(0, 10))),
              0
            ) / paidWithTime.length
          )
        : 0;

    return {
      totalRevenueCents,
      outstandingCents,
      outstandingCount: nonVoidInvoices.filter((i) => i.balanceDueCents > 0).length,
      overdueCents,
      overdueCount: overdueInvoices.length,
      paymentsReceivedCents,
      monthlyRevenueCents,
      totalExpensesCents,
      netCashFlowCents,
      avgPaymentDays,
    };
  }, [invoices, payments, expenses, cutoffIso, today]);

  const trendData: MonthlyTrendPoint[] = useMemo(() => {
    const months: MonthlyTrendPoint[] = [];
    const now = new Date();
    const count = range === 'week' || range === 'month' || range === '30d' ? 4 : 6;
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      const revenueCents = invoices
        .filter((inv) => inv.status !== 'void' && inv.issueDate.startsWith(ym))
        .reduce((s, inv) => s + inv.totalCents, 0);
      const collectedCents = payments
        .filter((p) => p.status === 'completed' && p.paymentDate.startsWith(ym))
        .reduce((s, p) => s + p.amountCents, 0);
      const expensesCents = expenses
        .filter((e) => e.date.startsWith(ym))
        .reduce((s, e) => s + e.amountCents, 0);
      months.push({ label, revenueCents, collectedCents, expensesCents });
    }
    return months;
  }, [invoices, payments, expenses, range]);

  const topClientsData = useMemo(() => {
    const map = new Map<string, number>();
    for (const inv of invoices) {
      if (inv.status === 'void' || inv.issueDate < cutoffIso) continue;
      map.set(inv.clientName, (map.get(inv.clientName) || 0) + inv.totalCents);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([label, valueCents]) => ({ label, valueCents, color: '#2563EB' }));
  }, [invoices, cutoffIso]);

  const expenseBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const exp of expenses) {
      if (exp.date < cutoffIso) continue;
      map.set(exp.category, (map.get(exp.category) || 0) + exp.amountCents);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([label, valueCents]) => ({ label, valueCents, color: '#F59E0B' }));
  }, [expenses, cutoffIso]);

  const intelligence = useMemo(() => computeInvoiceIntelligence(invoices), [invoices]);

  const attentionInvoices = useMemo(
    () =>
      invoices
        .filter((i) => i.status === 'overdue' || (i.balanceDueCents > 0 && i.status !== 'draft' && i.status !== 'void'))
        .slice(0, 5),
    [invoices]
  );

  if (dataLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Quick Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#172B4D]">
            {businessProfile?.businessName || 'Business'} Overview
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Real-time billing, collections, and cash flow from your stored records.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <AnimatedButton size="sm" onClick={onQuickCreateInvoice}>
            <FilePlus2 className="w-4 h-4" />
            <span>Create Invoice</span>
          </AnimatedButton>
          <AnimatedButton size="sm" variant="secondary" onClick={onQuickCreateEstimate}>
            <FileText className="w-4 h-4" />
            <span>Create Estimate</span>
          </AnimatedButton>
          <AnimatedButton size="sm" variant="secondary" onClick={onQuickAddClient}>
            <UserPlus className="w-4 h-4" />
            <span>Add Client</span>
          </AnimatedButton>
          <AnimatedButton size="sm" variant="secondary" onClick={onQuickRecordPayment}>
            <CreditCard className="w-4 h-4" />
            <span>Record Payment</span>
          </AnimatedButton>
          <AnimatedButton size="sm" variant="secondary" onClick={onQuickAddExpense}>
            <Receipt className="w-4 h-4" />
            <span>Add Expense</span>
          </AnimatedButton>
        </div>
      </div>

      {/* Date Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-white border border-slate-200 rounded-lg">
          {(
            [
              ['week', 'This Week'],
              ['month', 'This Month'],
              ['30d', 'Last 30 Days'],
              ['90d', 'Last 90 Days'],
              ['year', 'This Year'],
              ['all', 'All Time'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setRange(key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                range === key ? 'bg-[#172B4D] text-white' : 'text-slate-600 hover:text-[#172033]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-500 tabular-nums">
          {clients.filter((c) => !c.archived).length} active clients · {invoices.length} invoices
        </span>
      </div>

      {/* 8 KPI Widgets */}
      <StaggerGrid className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Invoiced Revenue',
            value: metrics.totalRevenueCents,
            format: formatUsd,
            sub: 'Selected date range',
            icon: <DollarSign className="w-4 h-4 text-[#2563EB]" />,
          },
          {
            label: 'Payments Received',
            value: metrics.paymentsReceivedCents,
            format: formatUsd,
            sub: 'Settled payments in range',
            icon: <TrendingUp className="w-4 h-4 text-[#16A34A]" />,
          },
          {
            label: 'Outstanding Invoices',
            value: metrics.outstandingCents,
            format: formatUsd,
            sub: `${metrics.outstandingCount} open invoice(s)`,
            icon: <Clock className="w-4 h-4 text-[#F59E0B]" />,
          },
          {
            label: 'Overdue Invoices',
            value: metrics.overdueCents,
            format: formatUsd,
            sub: `${metrics.overdueCount} past due date`,
            icon: <AlertTriangle className="w-4 h-4 text-red-600" />,
          },
          {
            label: 'Monthly Collected',
            value: metrics.monthlyRevenueCents,
            format: formatUsd,
            sub: 'Current calendar month',
            icon: <DollarSign className="w-4 h-4 text-[#2563EB]" />,
          },
          {
            label: 'Total Expenses',
            value: metrics.totalExpensesCents,
            format: formatUsd,
            sub: 'Selected date range',
            icon: <Receipt className="w-4 h-4 text-slate-600" />,
          },
          {
            label: 'Net Operating Cash Flow',
            value: metrics.netCashFlowCents,
            format: formatUsd,
            sub: 'Collected minus expenses',
            icon: <TrendingUp className="w-4 h-4 text-[#16A34A]" />,
          },
          {
            label: 'Average Payment Time',
            value: metrics.avgPaymentDays,
            format: (v: number) => `${v} days`,
            sub: 'Across paid invoices',
            icon: <Clock className="w-4 h-4 text-[#2563EB]" />,
          },
        ].map((kpi) => (
          <StaggerItem
            key={kpi.label}
            className="bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300 transition-colors"
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-medium text-slate-500">{kpi.label}</span>
              {kpi.icon}
            </div>
            <div className="font-display text-2xl font-bold text-[#172033]">
              <AnimatedCounter value={kpi.value} formatter={kpi.format} />
            </div>
            <p className="text-xs text-slate-500 mt-1">{kpi.sub}</p>
          </StaggerItem>
        ))}
      </StaggerGrid>

      <SponsoredLeaderboardBanner />

      {/* Main Chart & Invoice Intelligence Score */}
      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
            <div>
              <h2 className="font-display text-base font-semibold text-[#172033]">
                Monthly Revenue &amp; Collections Trend
              </h2>
              <p className="text-xs text-slate-500">
                Solid blue shows collected cash; dashed line shows billed invoice totals.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('analytics')}
              className="inline-flex items-center gap-1 text-xs font-medium text-[#2563EB] hover:underline cursor-pointer"
            >
              <span>Full Forecast</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <RevenueTrendChart data={trendData} />
        </div>

        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 className="font-display text-base font-semibold text-[#172033]">
                Invoice Intelligence Score
              </h2>
              <ShieldCheck className="w-4 h-4 text-[#2563EB]" />
            </div>
            <div className="flex items-baseline gap-3 mb-2">
              <span className="font-display text-4xl font-bold text-[#172B4D] tabular-nums">
                {intelligence.score === null ? '—' : `${intelligence.score}/100`}
              </span>
              <span className="text-xs font-semibold text-[#2563EB]">{intelligence.label}</span>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Operational billing metric calculated from your overdue ratio and collection time. Not a credit score or payment guarantee.
            </p>
            <div className="space-y-2 border-t border-slate-100 pt-4 text-xs text-slate-600">
              {intelligence.factors.map((f) => (
                <p key={f}>{f}</p>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('reminders')}
            className="mt-5 w-full py-2 px-3 text-xs font-medium text-[#172B4D] bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            Review Payment Reminders
          </button>
        </div>
      </div>

      {/* Secondary Breakdowns & Recent Activity */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="font-display text-base font-semibold text-[#172033] mb-4">Top Revenue by Client</h2>
          {topClientsData.length === 0 ? (
            <p className="text-xs text-slate-500">Create your first invoice to see client revenue distribution.</p>
          ) : (
            <BarComparisonChart items={topClientsData} />
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="font-display text-base font-semibold text-[#172033] mb-4">Expense Breakdown</h2>
          {expenseBreakdown.length === 0 ? (
            <p className="text-xs text-slate-500">Log expenses or scan a receipt to view category totals.</p>
          ) : (
            <BarComparisonChart items={expenseBreakdown} />
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-base font-semibold text-[#172033]">Invoices Requiring Action</h2>
            <button
              type="button"
              onClick={() => onNavigate('invoices')}
              className="text-xs font-medium text-[#2563EB] hover:underline cursor-pointer"
            >
              View All
            </button>
          </div>
          {attentionInvoices.length === 0 ? (
            <p className="text-xs text-slate-500">
              No unpaid or overdue issued invoices right now.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {attentionInvoices.map((inv) => (
                <div key={inv.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#172033] truncate">
                      {inv.invoiceNumber} · {inv.clientName}
                    </p>
                    <p className="text-[11px] text-slate-500">Due {inv.dueDate}</p>
                  </div>
                  <div className="text-right shrink-0 flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-[#172033] tabular-nums">
                      {formatUsd(inv.balanceDueCents)}
                    </span>
                    <StatusBadge status={inv.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Audit / Activity */}
      {auditLogs.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="font-display text-base font-semibold text-[#172033] mb-3">Recent Activity</h2>
          <div className="divide-y divide-slate-100">
            {auditLogs.slice(0, 6).map((log) => (
              <div key={log.id} className="py-2.5 flex items-center justify-between gap-4 text-xs">
                <span className="text-slate-700">{log.summary}</span>
                <span className="font-mono text-slate-400 shrink-0">{log.action}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

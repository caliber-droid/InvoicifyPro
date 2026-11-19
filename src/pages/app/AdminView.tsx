import React, { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDocs, limit, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { Activity, Shield, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { SponsoredLeaderboardBanner } from '../../components/SponsoredBanner';
import { useToast } from '../../context/ToastContext';
import { apiGet } from '../../lib/api';
import { db } from '../../lib/firebase';
import { formatUsd } from '../../lib/money';
import { AuditLog, Invoice, Payment, PLAN_CONFIGS, PlanId, UserAccount } from '../../types/models';

export const AdminView: React.FC = () => {
  const { isAdmin } = useAuth();
  const { notify } = useToast();

  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [integrations, setIntegrations] = useState<{
    geminiConfigured: boolean;
    stripeConfigured: boolean;
    resendConfigured: boolean;
  } | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    const load = async () => {
      setLoading(true);
      try {
        const [uSnap, iSnap, pSnap, lSnap, statusRes] = await Promise.all([
          getDocs(query(collection(db, 'users'), limit(100))),
          getDocs(query(collection(db, 'invoices'), limit(200))),
          getDocs(query(collection(db, 'payments'), limit(200))),
          getDocs(query(collection(db, 'auditLogs'), orderBy('createdAt', 'desc'), limit(40))).catch(() =>
            getDocs(query(collection(db, 'auditLogs'), limit(40)))
          ),
          apiGet<{ geminiConfigured: boolean; stripeConfigured: boolean; resendConfigured: boolean }>(
            '/api/integrations/status'
          ).catch(() => null),
        ]);

        setUsers(uSnap.docs.map((d) => d.data() as UserAccount));
        setInvoices(iSnap.docs.map((d) => ({ ...(d.data() as Omit<Invoice, 'id'>), id: d.id })));
        setPayments(pSnap.docs.map((d) => ({ ...(d.data() as Omit<Payment, 'id'>), id: d.id })));
        setLogs(lSnap.docs.map((d) => ({ ...(d.data() as Omit<AuditLog, 'id'>), id: d.id })));
        setIntegrations(statusRes);
      } catch (err: any) {
        notify('error', 'Failed to load admin telemetry', err?.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isAdmin, notify]);

  const metrics = useMemo(() => {
    const totalPaymentsCents = payments.filter((p) => p.status === 'completed').reduce((s, p) => s + p.amountCents, 0);
    const totalBilledCents = invoices.filter((i) => i.status !== 'void').reduce((s, i) => s + i.totalCents, 0);
    const mrrCents = users.reduce((s, u) => {
      const cfg = PLAN_CONFIGS[u.plan || 'free'];
      const price = u.billingCycle === 'annual' ? cfg.annualPricePerMonth : cfg.monthlyPrice;
      return s + price * 100;
    }, 0);
    return {
      userCount: users.length,
      invoiceCount: invoices.length,
      totalPaymentsCents,
      totalBilledCents,
      mrrCents,
    };
  }, [users, invoices, payments]);

  const handlePlanChange = async (uid: string, plan: PlanId) => {
    try {
      await updateDoc(doc(db, 'users', uid), {
        plan,
        updatedAt: serverTimestamp(),
      });
      setUsers((prev) => prev.map((u) => (u.uid === uid ? { ...u, plan } : u)));
      notify('success', 'User plan updated');
    } catch (err: any) {
      notify('error', 'Failed to update user plan', err?.message);
    }
  };

  if (!isAdmin) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
        <Shield className="w-8 h-8 text-slate-400 mx-auto mb-2" />
        <p className="text-sm font-semibold text-[#172033]">Administrator Access Required</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#172B4D]">Platform Admin Console</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Live platform users, subscription mix, stored invoice volume, and server integration readiness.
        </p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Registered Accounts</p>
          <p className="font-display text-2xl font-bold text-[#172033] mt-1 tabular-nums">{metrics.userCount}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Plan Tier MRR Equivalent</p>
          <p className="font-display text-2xl font-bold text-[#2563EB] mt-1 tabular-nums">
            {formatUsd(metrics.mrrCents)}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Platform Invoices Billed</p>
          <p className="font-display text-2xl font-bold text-[#172033] mt-1 tabular-nums">
            {formatUsd(metrics.totalBilledCents)}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">{metrics.invoiceCount} invoice(s)</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Platform Payments Recorded</p>
          <p className="font-display text-2xl font-bold text-[#16A34A] mt-1 tabular-nums">
            {formatUsd(metrics.totalPaymentsCents)}
          </p>
        </div>
      </div>

      {/* Server Integration Status */}
      {integrations && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-center gap-6 text-xs">
          <span className="font-semibold text-[#172033]">Server Integrations:</span>
          <span>
            Gemini AI:{' '}
            <strong className={integrations.geminiConfigured ? 'text-[#16A34A]' : 'text-amber-600'}>
              {integrations.geminiConfigured ? 'Configured' : 'Missing Key'}
            </strong>
          </span>
          <span>
            Stripe Checkout:{' '}
            <strong className={integrations.stripeConfigured ? 'text-[#16A34A]' : 'text-slate-500'}>
              {integrations.stripeConfigured ? 'Configured' : 'Sandbox Only (Not Configured)'}
            </strong>
          </span>
          <span>
            Resend Email:{' '}
            <strong className={integrations.resendConfigured ? 'text-[#16A34A]' : 'text-slate-500'}>
              {integrations.resendConfigured ? 'Configured' : 'Manual Mailto / Share Only'}
            </strong>
          </span>
        </div>
      )}

      <SponsoredLeaderboardBanner />

      {/* Users Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
          <Users className="w-4 h-4 text-[#2563EB]" />
          <h2 className="font-display text-sm font-semibold text-[#172033]">Workspace Accounts</h2>
        </div>
        {loading ? (
          <p className="p-6 text-sm text-slate-500">Loading platform accounts...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                  <th className="py-2.5 px-4">User</th>
                  <th className="py-2.5 px-4">Role</th>
                  <th className="py-2.5 px-4">Onboarded</th>
                  <th className="py-2.5 px-4">Cycle</th>
                  <th className="py-2.5 px-4">Plan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.uid}>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-[#172033]">{u.displayName}</p>
                      <p className="text-xs text-slate-500">{u.email}</p>
                    </td>
                    <td className="py-3 px-4 capitalize text-slate-600">{u.role}</td>
                    <td className="py-3 px-4 text-slate-600">{u.onboarded ? 'Yes' : 'Pending'}</td>
                    <td className="py-3 px-4 capitalize text-slate-600">{u.billingCycle}</td>
                    <td className="py-3 px-4">
                      <select
                        value={u.plan}
                        onChange={(e) => handlePlanChange(u.uid, e.target.value as PlanId)}
                        className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white"
                      >
                        <option value="free">Free</option>
                        <option value="starter">Starter</option>
                        <option value="pro">Pro</option>
                        <option value="business">Business</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Audit Logs */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#2563EB]" />
          <h2 className="font-display text-sm font-semibold text-[#172033]">Recent Audit Trail</h2>
        </div>
        <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
          {logs.length === 0 ? (
            <p className="p-5 text-xs text-slate-500">No audit events recorded yet.</p>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="px-5 py-2.5 flex items-center justify-between gap-4 text-xs">
                <span className="text-slate-700">{log.summary}</span>
                <span className="font-mono text-slate-400 shrink-0">{log.action}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

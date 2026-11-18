import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  Download,
  Mail,
  Phone,
  Search,
  Upload,
  UserPlus,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { createClient, updateClient } from '../../lib/firestoreRepo';
import { AnimatedButton, AnimatedDrawer, AnimatedModal, StatusBadge } from '../../lib/motion';
import { daysBetween, formatUsd } from '../../lib/money';
import { Client } from '../../types/models';

export const ClientsView: React.FC<{ openNewTrigger?: number }> = ({ openNewTrigger }) => {
  const { firebaseUser } = useAuth();
  const { clients, invoices, estimates, payments, usageStats } = useData();
  const { notify } = useToast();

  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    companyName: '',
    email: '',
    phone: '',
    billingAddress: '',
    website: '',
    category: 'Retainer',
    notes: '',
  });

  React.useEffect(() => {
    if (openNewTrigger && openNewTrigger > 0) {
      openAddModal();
    }
  }, [openNewTrigger]);

  const openAddModal = () => {
    if (!usageStats.canCreateClient) {
      notify(
        'warning',
        'Client limit reached',
        'Your current plan limit has been reached. Upgrade in Subscription to add more clients.'
      );
      return;
    }
    setEditingClient(null);
    setForm({
      name: '',
      companyName: '',
      email: '',
      phone: '',
      billingAddress: '',
      website: '',
      category: 'Retainer',
      notes: '',
    });
    setModalOpen(true);
  };

  const openEditModal = (c: Client) => {
    setEditingClient(c);
    setForm({
      name: c.name,
      companyName: c.companyName || '',
      email: c.email,
      phone: c.phone || '',
      billingAddress: c.billingAddress || '',
      website: c.website || '',
      category: c.category || 'General',
      notes: c.notes || '',
    });
    setModalOpen(true);
  };

  const duplicateEmailMatch = useMemo(() => {
    const clean = form.email.trim().toLowerCase();
    if (!clean) return null;
    return clients.find(
      (c) => c.email.trim().toLowerCase() === clean && c.id !== editingClient?.id
    );
  }, [clients, form.email, editingClient?.id]);

  const categories = useMemo(() => {
    const set = new Set<string>(['all']);
    clients.forEach((c) => {
      if (c.category) set.add(c.category);
    });
    return Array.from(set);
  }, [clients]);

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients.filter((c) => {
      if (c.archived !== showArchived) return false;
      if (categoryFilter !== 'all' && c.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.companyName || '').toLowerCase().includes(q)
      );
    });
  }, [clients, search, showArchived, categoryFilter]);

  const getClientMetrics = (clientId: string) => {
    const clientInvoices = invoices.filter((i) => i.clientId === clientId && i.status !== 'void');
    const billedCents = clientInvoices.reduce((s, i) => s + i.totalCents, 0);
    const paidCents = clientInvoices.reduce((s, i) => s + i.amountPaidCents, 0);
    const outstandingCents = clientInvoices.reduce((s, i) => s + i.balanceDueCents, 0);
    const overdueCents = clientInvoices
      .filter((i) => i.status === 'overdue')
      .reduce((s, i) => s + i.balanceDueCents, 0);
    const paidInvs = clientInvoices.filter((i) => i.status === 'paid' && i.paidAt);
    const avgCollectionDays =
      paidInvs.length > 0
        ? Math.round(
            paidInvs.reduce(
              (sum, i) => sum + Math.max(0, daysBetween(i.issueDate, String(i.paidAt).slice(0, 10))),
              0
            ) / paidInvs.length
          )
        : null;

    return {
      billedCents,
      paidCents,
      outstandingCents,
      overdueCents,
      invoiceCount: clientInvoices.length,
      avgCollectionDays,
      clientInvoices,
      clientEstimates: estimates.filter((e) => e.clientId === clientId),
      clientPayments: payments.filter((p) => p.clientId === clientId),
    };
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    setSaving(true);
    try {
      if (editingClient) {
        await updateClient(editingClient.id, {
          ...form,
        });
        notify('success', 'Client updated', `${form.name} saved.`);
      } else {
        await createClient(firebaseUser.uid, {
          ...form,
          archived: false,
        });
        notify('success', 'Client added', `${form.name} added to your CRM.`);
      }
      setModalOpen(false);
    } catch (err: any) {
      notify('error', 'Save failed', err?.message || 'Could not save client.');
    } finally {
      setSaving(false);
    }
  };

  const handleExportCsv = () => {
    const header = ['Name', 'Company', 'Email', 'Phone', 'Category', 'Billing Address', 'Website'];
    const rows = clients.map((c) => [
      c.name,
      c.companyName || '',
      c.email,
      c.phone || '',
      c.category || '',
      (c.billingAddress || '').replace(/\n/g, ' '),
      c.website || '',
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'invoicifypro-clients.csv';
    a.click();
    URL.revokeObjectURL(url);
    notify('success', 'Clients exported', 'CSV download started.');
  };

  const handleImportCsv = async (file?: File) => {
    if (!file || !firebaseUser) return;
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      notify('warning', 'Empty CSV', 'Expected header row plus at least one client row.');
      return;
    }
    let imported = 0;
    const existingEmails = new Set(clients.map((c) => c.email.toLowerCase()));
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((s) => s.replace(/^"|"$/g, '').trim());
      const [name, companyName, email, phone, category, billingAddress, website] = cols;
      if (!name || !email || existingEmails.has(email.toLowerCase())) continue;
      existingEmails.add(email.toLowerCase());
      await createClient(firebaseUser.uid, {
        name,
        companyName,
        email,
        phone,
        category: category || 'Imported',
        billingAddress,
        website,
        notes: 'Imported via CSV',
        archived: false,
      });
      imported += 1;
    }
    notify('success', 'CSV Import Complete', `Added ${imported} new client(s).`);
  };

  const selectedMetrics = selectedClient ? getClientMetrics(selectedClient.id) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#172B4D]">Client CRM</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Track billing totals, collection velocity, and payment history per customer.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            <span>Import CSV</span>
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => handleImportCsv(e.target.files?.[0])} />
          </label>
          <AnimatedButton variant="secondary" size="sm" onClick={handleExportCsv}>
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </AnimatedButton>
          <AnimatedButton size="sm" onClick={openAddModal}>
            <UserPlus className="w-4 h-4" />
            <span>Add Client</span>
          </AnimatedButton>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, company, or email..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#2563EB]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat === 'all' ? 'All Categories' : cat}
              </option>
            ))}
          </select>
          <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setShowArchived(false)}
              className={`px-3 py-1 text-xs font-medium rounded-md cursor-pointer ${
                !showArchived ? 'bg-white text-[#172033] shadow-sm' : 'text-slate-600'
              }`}
            >
              Active
            </button>
            <button
              type="button"
              onClick={() => setShowArchived(true)}
              className={`px-3 py-1 text-xs font-medium rounded-md cursor-pointer ${
                showArchived ? 'bg-white text-[#172033] shadow-sm' : 'text-slate-600'
              }`}
            >
              Archived
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      {filteredClients.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <p className="font-display text-base font-semibold text-[#172033] mb-1">No clients found</p>
          <p className="text-sm text-slate-500 mb-5">
            Add your first client to start issuing invoices and tracking payments.
          </p>
          <AnimatedButton size="sm" onClick={openAddModal}>
            <UserPlus className="w-4 h-4" />
            <span>Add First Client</span>
          </AnimatedButton>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
                  <th className="text-left font-medium px-5 py-3">Client</th>
                  <th className="text-left font-medium px-4 py-3">Category</th>
                  <th className="text-right font-medium px-4 py-3">Invoices</th>
                  <th className="text-right font-medium px-4 py-3">Total Billed</th>
                  <th className="text-right font-medium px-4 py-3">Outstanding</th>
                  <th className="text-right font-medium px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredClients.map((client) => {
                  const m = getClientMetrics(client.id);
                  return (
                    <tr
                      key={client.id}
                      onClick={() => setSelectedClient(client)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                    >
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-[#172033]">{client.name}</p>
                        <p className="text-xs text-slate-500">
                          {client.companyName ? `${client.companyName} · ` : ''}
                          {client.email}
                        </p>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-600">{client.category || 'General'}</td>
                      <td className="px-4 py-3.5 text-right font-mono tabular-nums text-slate-700">
                        {m.invoiceCount}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono tabular-nums text-[#172033] font-medium">
                        {formatUsd(m.billedCents)}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono tabular-nums">
                        <span className={m.overdueCents > 0 ? 'text-red-600 font-semibold' : 'text-slate-700'}>
                          {formatUsd(m.outstandingCents)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(client)}
                            className="text-xs font-medium text-[#2563EB] hover:underline cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await updateClient(client.id, { archived: !client.archived });
                              notify(
                                'info',
                                client.archived ? 'Client restored' : 'Client archived',
                                client.name
                              );
                            }}
                            className="text-xs text-slate-500 hover:text-[#172033] cursor-pointer"
                            title={client.archived ? 'Restore client' : 'Archive client'}
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Client Modal */}
      <AnimatedModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingClient ? 'Edit Client Profile' : 'Add New Client'}
        subtitle="Store contact, billing address, and internal relationship notes."
      >
        <form onSubmit={handleSave} className="space-y-4">
          {duplicateEmailMatch && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                A client named <strong>{duplicateEmailMatch.name}</strong> already uses{' '}
                <strong>{duplicateEmailMatch.email}</strong>. Verify before saving a duplicate.
              </span>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Full Name *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="John Smith"
                className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Company Name</label>
              <input
                type="text"
                value={form.companyName}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                placeholder="Acme Media LLC"
                className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Email Address *</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="billing@acmemedia.com"
                className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Phone</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="(555) 123-4567"
                className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Category</label>
              <input
                type="text"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="Retainer, Project, Agency..."
                className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Website</label>
              <input
                type="url"
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
                placeholder="https://acmemedia.com"
                className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Billing Address</label>
              <input
                type="text"
                value={form.billingAddress}
                onChange={(e) => setForm({ ...form, billingAddress: e.target.value })}
                placeholder="450 Lexington Ave, New York, NY 10017"
                className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Internal Notes</label>
              <textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Preferred billing contact, PO requirements..."
                className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <AnimatedButton type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </AnimatedButton>
            <AnimatedButton type="submit" loading={saving}>
              <span>{editingClient ? 'Save Changes' : 'Add Client'}</span>
            </AnimatedButton>
          </div>
        </form>
      </AnimatedModal>

      {/* Client Detail Drawer */}
      <AnimatedDrawer
        open={Boolean(selectedClient)}
        onClose={() => setSelectedClient(null)}
        title={selectedClient?.name || ''}
        subtitle={selectedClient?.companyName || selectedClient?.email}
      >
        {selectedClient && selectedMetrics && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5">
                <p className="text-xs text-slate-500">Total Billed</p>
                <p className="font-mono text-lg font-bold text-[#172033] tabular-nums">
                  {formatUsd(selectedMetrics.billedCents)}
                </p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5">
                <p className="text-xs text-slate-500">Total Paid</p>
                <p className="font-mono text-lg font-bold text-[#16A34A] tabular-nums">
                  {formatUsd(selectedMetrics.paidCents)}
                </p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5">
                <p className="text-xs text-slate-500">Outstanding</p>
                <p className="font-mono text-lg font-bold text-[#2563EB] tabular-nums">
                  {formatUsd(selectedMetrics.outstandingCents)}
                </p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5">
                <p className="text-xs text-slate-500">Avg. Collection Speed</p>
                <p className="font-mono text-lg font-bold text-[#172033] tabular-nums">
                  {selectedMetrics.avgCollectionDays === null
                    ? '—'
                    : `${selectedMetrics.avgCollectionDays} days`}
                </p>
              </div>
            </div>

            <div className="space-y-2 text-xs text-slate-600 border-t border-slate-100 pt-4">
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span>{selectedClient.email}</span>
              </div>
              {selectedClient.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>{selectedClient.phone}</span>
                </div>
              )}
              {selectedClient.billingAddress && (
                <p className="text-slate-500">{selectedClient.billingAddress}</p>
              )}
              {selectedClient.notes && (
                <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="font-semibold text-[#172033] mb-1">Internal Notes</p>
                  <p>{selectedClient.notes}</p>
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 pt-4">
              <h3 className="font-display text-sm font-semibold text-[#172033] mb-3">
                Invoices ({selectedMetrics.clientInvoices.length})
              </h3>
              {selectedMetrics.clientInvoices.length === 0 ? (
                <p className="text-xs text-slate-500">No invoices yet for this client.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {selectedMetrics.clientInvoices.map((inv) => (
                    <div key={inv.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-semibold text-[#172033]">{inv.invoiceNumber}</p>
                        <p className="text-slate-500">Due {inv.dueDate}</p>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono font-semibold tabular-nums">{formatUsd(inv.totalCents)}</span>
                        <StatusBadge status={inv.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </AnimatedDrawer>
    </div>
  );
};

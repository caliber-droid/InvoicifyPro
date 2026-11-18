import React, { useEffect, useState } from 'react';
import { deleteUser } from 'firebase/auth';
import { Download, Save, ShieldAlert, Trash2, Upload } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  deleteAllUserAccountData,
  exportAllUserData,
  saveBusinessProfile,
  updateUserAccount,
} from '../../lib/firestoreRepo';
import { AnimatedButton, AnimatedModal } from '../../lib/motion';
import { BUSINESS_TYPES } from '../../types/models';

export const SettingsView: React.FC = () => {
  const { firebaseUser, userAccount, businessProfile, logout } = useAuth();
  const { notify } = useToast();

  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [businessEmail, setBusinessEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [address, setAddress] = useState('');
  const [businessType, setBusinessType] = useState<string>('LLC');
  const [industry, setIndustry] = useState('');
  const [taxIdLast4, setTaxIdLast4] = useState('');
  const [logoDataUrl, setLogoDataUrl] = useState('');
  const [defaultPaymentTerms, setDefaultPaymentTerms] = useState('Net 15');
  const [invoiceNumberFormat, setInvoiceNumberFormat] = useState('INV-');
  const [nextInvoiceNumber, setNextInvoiceNumber] = useState('1001');
  const [defaultTaxRatePct, setDefaultTaxRatePct] = useState('0');
  const [taxLabel, setTaxLabel] = useState('Sales Tax');
  const [defaultDueDays, setDefaultDueDays] = useState('15');
  const [timezone, setTimezone] = useState('America/New_York');
  const [paymentMethods, setPaymentMethods] = useState<string[]>(['ACH Bank Transfer', 'Credit Card']);

  const [remBefore3, setRemBefore3] = useState(true);
  const [remOnDue, setRemOnDue] = useState(true);
  const [remOverdue3, setRemOverdue3] = useState(true);
  const [remOverdue7, setRemOverdue7] = useState(true);
  const [remOverdue14, setRemOverdue14] = useState(true);

  const [notifPaid, setNotifPaid] = useState(true);
  const [notifOverdue, setNotifOverdue] = useState(true);
  const [notifEstimate, setNotifEstimate] = useState(true);
  const [notifRecurring, setNotifRecurring] = useState(true);

  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!businessProfile) return;
    setBusinessName(businessProfile.businessName || '');
    setOwnerName(businessProfile.ownerName || '');
    setBusinessEmail(businessProfile.businessEmail || '');
    setPhone(businessProfile.phone || '');
    setWebsite(businessProfile.website || '');
    setAddress(businessProfile.address || '');
    setBusinessType(businessProfile.businessType || 'LLC');
    setIndustry(businessProfile.industry || '');
    setTaxIdLast4(businessProfile.taxIdLast4 || '');
    setLogoDataUrl(businessProfile.logoDataUrl || '');
    setDefaultPaymentTerms(businessProfile.defaultPaymentTerms || 'Net 15');
    setInvoiceNumberFormat(businessProfile.invoiceNumberFormat || 'INV-');
    setNextInvoiceNumber(String(businessProfile.nextInvoiceNumber || 1001));
    setDefaultTaxRatePct(((businessProfile.defaultTaxRateBps || 0) / 100).toFixed(2).replace(/\.00$/, ''));
    setTaxLabel(businessProfile.taxLabel || 'Sales Tax');
    setDefaultDueDays(String(businessProfile.defaultDueDays ?? 15));
    setTimezone(businessProfile.timezone || 'America/New_York');
    setPaymentMethods(businessProfile.preferredPaymentMethods || ['ACH Bank Transfer', 'Credit Card']);

    const rs = businessProfile.reminderSchedule;
    if (rs) {
      setRemBefore3(rs.beforeDue3Days);
      setRemOnDue(rs.onDueDate);
      setRemOverdue3(rs.overdue3Days);
      setRemOverdue7(rs.overdue7Days);
      setRemOverdue14(rs.overdue14Days);
    }
    const np = businessProfile.notificationPrefs;
    if (np) {
      setNotifPaid(np.invoicePaid);
      setNotifOverdue(np.invoiceOverdue);
      setNotifEstimate(np.estimateDecision);
      setNotifRecurring(np.recurringGenerated);
    }
  }, [businessProfile]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 170_000) {
      notify('warning', 'Logo file too large', 'Please upload a PNG or JPG logo under 170 KB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      if (dataUrl.length <= 245_000) {
        setLogoDataUrl(dataUrl);
      } else {
        notify('warning', 'Logo exceeds encoded size limit', 'Choose a smaller image.');
      }
    };
    reader.readAsDataURL(file);
  };

  const toggleMethod = (method: string) => {
    setPaymentMethods((prev) =>
      prev.includes(method) ? prev.filter((m) => m !== method) : [...prev, method]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    setSaving(true);
    try {
      const bps = Math.max(0, Math.min(5000, Math.round((Number.parseFloat(defaultTaxRatePct) || 0) * 100)));
      const nextNum = Math.max(1, Math.round(Number(nextInvoiceNumber) || 1001));
      const dueDays = Math.max(0, Math.min(365, Math.round(Number(defaultDueDays) || 15)));

      await saveBusinessProfile(
        firebaseUser.uid,
        {
          businessName: businessName.trim().slice(0, 160),
          ownerName: ownerName.trim().slice(0, 120),
          businessEmail: businessEmail.trim().slice(0, 254),
          phone: phone.trim().slice(0, 40),
          website: website.trim().slice(0, 240),
          address: address.trim().slice(0, 400),
          logoDataUrl,
          businessType: businessType.slice(0, 60),
          industry: industry.trim().slice(0, 100),
          taxIdLast4: taxIdLast4.trim().slice(0, 16),
          defaultCurrency: 'USD',
          defaultPaymentTerms: defaultPaymentTerms.slice(0, 40),
          invoiceNumberFormat: invoiceNumberFormat.trim().slice(0, 40) || 'INV-',
          nextInvoiceNumber: nextNum,
          defaultTaxRateBps: bps,
          taxLabel: taxLabel.trim().slice(0, 40) || 'Sales Tax',
          preferredPaymentMethods: paymentMethods.length > 0 ? paymentMethods : ['ACH Bank Transfer'],
          timezone,
          defaultDueDays: dueDays,
          reminderSchedule: {
            beforeDue3Days: remBefore3,
            onDueDate: remOnDue,
            overdue3Days: remOverdue3,
            overdue7Days: remOverdue7,
            overdue14Days: remOverdue14,
          },
          notificationPrefs: {
            invoicePaid: notifPaid,
            invoiceOverdue: notifOverdue,
            estimateDecision: notifEstimate,
            recurringGenerated: notifRecurring,
          },
        },
        !businessProfile
      );

      if (userAccount && ownerName.trim() && ownerName.trim() !== userAccount.displayName) {
        await updateUserAccount(firebaseUser.uid, { displayName: ownerName.trim().slice(0, 120) });
      }
      notify('success', 'Business settings saved');
    } catch (err: any) {
      notify('error', 'Failed to save settings', err?.message);
    } finally {
      setSaving(false);
    }
  };

  const handleExportJson = async () => {
    if (!firebaseUser) return;
    setExporting(true);
    try {
      const data = await exportAllUserData(firebaseUser.uid);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoicifypro-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      notify('success', 'Full JSON data export downloaded');
    } catch (err: any) {
      notify('error', 'Export failed', err?.message);
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!firebaseUser || deleteConfirmText !== 'DELETE') return;
    setDeleting(true);
    try {
      await deleteAllUserAccountData(firebaseUser.uid);
      try {
        await deleteUser(firebaseUser);
      } catch {
        // If Firebase requires recent sign-in for auth deletion, user data is deleted and we sign out
        await logout();
      }
      notify('info', 'Account data removed');
    } catch (err: any) {
      notify('error', 'Could not complete deletion', err?.message);
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#172B4D]">Business &amp; Account Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Configure company identity, US sales tax defaults, invoice numbering, reminder cadences, and data privacy.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Company Profile */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <h2 className="font-display text-base font-semibold text-[#172033]">Company Profile &amp; Branding</h2>
          <div className="flex items-center gap-4">
            <img
              src={logoDataUrl || '/src/assets/images/avatar_consultant_profile_1795032859936.jpg'}
              alt="Business logo"
              className="w-16 h-16 rounded-xl object-cover border border-slate-200 bg-slate-50"
            />
            <div className="space-y-1.5">
              <label className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-[#172033] bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer transition-colors">
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Company Logo</span>
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleLogoUpload} className="hidden" />
              </label>
              <p className="text-xs text-slate-500">PNG or JPG under 170 KB. Appears on your account profile.</p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Business Name</label>
              <input
                type="text"
                required
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Owner / Contact Name</label>
              <input
                type="text"
                required
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Billing Email</label>
              <input
                type="email"
                required
                value={businessEmail}
                onChange={(e) => setBusinessEmail(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 123-4567"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Business Entity Type</label>
              <select
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                {BUSINESS_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Industry</label>
              <input
                type="text"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder="Design, Software, Consulting..."
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Website</label>
              <input
                type="text"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://yourcompany.com"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tax ID / EIN Last 4 (Optional)</label>
              <input
                type="text"
                maxLength={10}
                value={taxIdLast4}
                onChange={(e) => setTaxIdLast4(e.target.value)}
                placeholder="1234"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Business Address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street, City, State, ZIP"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
        </div>

        {/* Invoice & Tax Defaults */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <h2 className="font-display text-base font-semibold text-[#172033]">USD Invoicing &amp; Tax Defaults</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Invoice Prefix</label>
              <input
                type="text"
                value={invoiceNumberFormat}
                onChange={(e) => setInvoiceNumberFormat(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Next Invoice #</label>
              <input
                type="number"
                min={1}
                value={nextInvoiceNumber}
                onChange={(e) => setNextInvoiceNumber(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Default Payment Terms</label>
              <select
                value={defaultPaymentTerms}
                onChange={(e) => {
                  const val = e.target.value;
                  setDefaultPaymentTerms(val);
                  if (val === 'Due on Receipt') setDefaultDueDays('0');
                  if (val === 'Net 15') setDefaultDueDays('15');
                  if (val === 'Net 30') setDefaultDueDays('30');
                  if (val === 'Net 60') setDefaultDueDays('60');
                }}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="Due on Receipt">Due on Receipt</option>
                <option value="Net 15">Net 15</option>
                <option value="Net 30">Net 30</option>
                <option value="Net 60">Net 60</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Default Due Days</label>
              <input
                type="number"
                min={0}
                max={365}
                value={defaultDueDays}
                onChange={(e) => setDefaultDueDays(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Default Tax Rate (%)</label>
              <input
                type="number"
                step="0.01"
                min={0}
                max={50}
                value={defaultTaxRatePct}
                onChange={(e) => setDefaultTaxRatePct(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tax Label</label>
              <input
                type="text"
                value={taxLabel}
                onChange={(e) => setTaxLabel(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">Accepted Payment Methods</label>
            <div className="flex flex-wrap gap-2">
              {['ACH Bank Transfer', 'Credit Card', 'Debit Card', 'Check', 'PayPal', 'Zelle'].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => toggleMethod(m)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                    paymentMethods.includes(m)
                      ? 'bg-[#172B4D] text-white border-[#172B4D]'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Reminder & Notification Preferences */}
        <div className="grid sm:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
            <h2 className="font-display text-base font-semibold text-[#172033]">Reminder Cadence Defaults</h2>
            {[
              ['3 days before due date', remBefore3, setRemBefore3],
              ['On invoice due date', remOnDue, setRemOnDue],
              ['3 days overdue', remOverdue3, setRemOverdue3],
              ['7 days overdue', remOverdue7, setRemOverdue7],
              ['14 days overdue', remOverdue14, setRemOverdue14],
            ].map(([label, val, setter]: any) => (
              <label key={label} className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={val}
                  onChange={(e) => setter(e.target.checked)}
                  className="rounded border-slate-300 text-[#2563EB]"
                />
                <span>{label}</span>
              </label>
            ))}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
            <h2 className="font-display text-base font-semibold text-[#172033]">In-App Notifications</h2>
            {[
              ['Invoice payment recorded', notifPaid, setNotifPaid],
              ['Overdue invoice alerts', notifOverdue, setNotifOverdue],
              ['Client estimate approvals/rejections', notifEstimate, setNotifEstimate],
              ['Recurring invoice generation', notifRecurring, setNotifRecurring],
            ].map(([label, val, setter]: any) => (
              <label key={label} className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={val}
                  onChange={(e) => setter(e.target.checked)}
                  className="rounded border-slate-300 text-[#2563EB]"
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <AnimatedButton type="submit" loading={saving}>
            <Save className="w-4 h-4" />
            <span>Save Business Settings</span>
          </AnimatedButton>
        </div>
      </form>

      {/* Privacy & Data Management */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <h2 className="font-display text-base font-semibold text-[#172033]">Data Export &amp; Account Privacy</h2>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <p className="text-sm font-medium text-[#172033]">Export Business Data (JSON)</p>
            <p className="text-xs text-slate-500">
              Download a full copy of your clients, invoices, estimates, payments, expenses, and settings.
            </p>
          </div>
          <AnimatedButton variant="secondary" onClick={handleExportJson} loading={exporting}>
            <Download className="w-4 h-4" />
            <span>Export JSON</span>
          </AnimatedButton>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-red-700 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4" />
              <span>Delete Account &amp; Business Records</span>
            </p>
            <p className="text-xs text-slate-500">
              Permanently deletes your workspace data from Firestore. This cannot be undone.
            </p>
          </div>
          <AnimatedButton variant="danger" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="w-4 h-4" />
            <span>Delete Account</span>
          </AnimatedButton>
        </div>
      </div>

      <AnimatedModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Confirm Account Deletion"
        subtitle="All clients, invoices, estimates, expenses, and documents will be permanently deleted."
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Type <strong className="text-[#172033] font-mono">DELETE</strong> below to confirm permanent account removal.
          </p>
          <input
            type="text"
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder="Type DELETE"
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
          />
          <div className="flex justify-end gap-2">
            <AnimatedButton variant="secondary" onClick={() => setDeleteOpen(false)}>
              Cancel
            </AnimatedButton>
            <AnimatedButton
              variant="danger"
              disabled={deleteConfirmText !== 'DELETE'}
              loading={deleting}
              onClick={handleDeleteAccount}
            >
              Permanently Delete
            </AnimatedButton>
          </div>
        </div>
      </AnimatedModal>
    </div>
  );
};

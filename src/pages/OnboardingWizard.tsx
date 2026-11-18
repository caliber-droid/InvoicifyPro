import React, { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowLeft, ArrowRight, Building2, Check, SlidersHorizontal, Upload } from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { saveBusinessProfile, updateUserAccount } from '../lib/firestoreRepo';
import { AnimatedButton } from '../lib/motion';
import { BUSINESS_TYPES } from '../types/models';

export const OnboardingWizard: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const reduced = useReducedMotion();
  const { firebaseUser } = useAuth();
  const { notify } = useToast();

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState(firebaseUser?.displayName || '');
  const [businessEmail, setBusinessEmail] = useState(firebaseUser?.email || '');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [address, setAddress] = useState('');
  const [logoDataUrl, setLogoDataUrl] = useState('');
  const [businessType, setBusinessType] = useState<string>('LLC');
  const [industry, setIndustry] = useState('Consulting & Professional Services');
  const [taxIdLast4, setTaxIdLast4] = useState('');

  const [defaultPaymentTerms, setDefaultPaymentTerms] = useState('Net 15');
  const [defaultDueDays, setDefaultDueDays] = useState(15);
  const [invoiceNumberFormat, setInvoiceNumberFormat] = useState('INV-');
  const [nextInvoiceNumber, setNextInvoiceNumber] = useState(1001);
  const [taxRatePct, setTaxRatePct] = useState('0');
  const [taxLabel, setTaxLabel] = useState('Sales Tax');
  const [timezone, setTimezone] = useState('America/New_York');
  const [preferredPaymentMethods, setPreferredPaymentMethods] = useState<string[]>([
    'ACH Bank Transfer',
    'Credit Card',
  ]);

  const handleLogoUpload = (file?: File) => {
    if (!file) return;
    if (file.size > 160 * 1024) {
      notify('warning', 'Logo file too large', 'Please upload an image under 160 KB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setLogoDataUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const toggleMethod = (m: string) => {
    setPreferredPaymentMethods((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
    );
  };

  const handleFinish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    setSaving(true);
    try {
      const bps = Math.round((Number.parseFloat(taxRatePct) || 0) * 100);
      await saveBusinessProfile(
        firebaseUser.uid,
        {
          businessName: businessName.trim() || `${ownerName || 'My'} Studio`,
          ownerName: ownerName.trim() || 'Business Owner',
          businessEmail: businessEmail.trim() || firebaseUser.email || '',
          phone: phone.trim(),
          website: website.trim(),
          address: address.trim(),
          logoDataUrl,
          businessType,
          industry: industry.trim(),
          taxIdLast4: taxIdLast4.trim(),
          defaultCurrency: 'USD',
          defaultPaymentTerms,
          invoiceNumberFormat: invoiceNumberFormat.trim() || 'INV-',
          nextInvoiceNumber: Math.max(1, Number(nextInvoiceNumber) || 1001),
          defaultTaxRateBps: Math.max(0, Math.min(5000, bps)),
          taxLabel: taxLabel.trim() || 'Sales Tax',
          preferredPaymentMethods,
          timezone,
          defaultDueDays: Math.max(0, Math.min(365, Number(defaultDueDays) || 15)),
          reminderSchedule: {
            beforeDue3Days: true,
            onDueDate: true,
            overdue3Days: true,
            overdue7Days: true,
            overdue14Days: true,
          },
          notificationPrefs: {
            invoicePaid: true,
            invoiceOverdue: true,
            estimateDecision: true,
            recurringGenerated: true,
          },
        },
        true
      );
      await updateUserAccount(firebaseUser.uid, {
        displayName: ownerName.trim() || firebaseUser.displayName || 'Business Owner',
        onboarded: true,
      });
      notify('success', 'Workspace ready', 'Your business profile and billing defaults are saved.');
      onComplete();
    } catch (err: any) {
      notify('error', 'Setup failed', err?.message || 'Could not save business profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA] py-10 px-4 sm:px-6 flex flex-col justify-center">
      <div className="max-w-2xl w-full mx-auto">
        <div className="flex items-center justify-between mb-6">
          <BrandLogo />
          <span className="text-xs font-medium text-slate-500">Step {step} of 3</span>
        </div>

        {/* Progress Bar */}
        <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden mb-6">
          <motion.div
            className="h-full bg-[#2563EB]"
            initial={false}
            animate={{ width: `${(step / 3) * 100}%` }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>

        <form onSubmit={handleFinish} className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={reduced ? false : { opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduced ? undefined : { opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                <div className="flex items-center gap-2.5 text-[#172B4D]">
                  <Building2 className="w-5 h-5 text-[#2563EB]" />
                  <h1 className="font-display text-xl font-bold">Tell us about your business</h1>
                </div>
                <p className="text-sm text-slate-500">
                  These details appear on your invoices, estimates, and client payment portals.
                </p>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">Business Name *</label>
                    <input
                      type="text"
                      required
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder="Northstar Design LLC"
                      className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#2563EB]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">Owner Name *</label>
                    <input
                      type="text"
                      required
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      placeholder="Jordan Taylor"
                      className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#2563EB]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">Business Email *</label>
                    <input
                      type="email"
                      required
                      value={businessEmail}
                      onChange={(e) => setBusinessEmail(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#2563EB]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">Business Type</label>
                    <select
                      value={businessType}
                      onChange={(e) => setBusinessType(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#2563EB]"
                    >
                      {BUSINESS_TYPES.map((bt) => (
                        <option key={bt} value={bt}>
                          {bt}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">Industry</label>
                    <input
                      type="text"
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
                      placeholder="Software Development, Photography, Marketing..."
                      className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#2563EB]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">Phone (Optional)</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(555) 234-5678"
                      className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#2563EB]"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <AnimatedButton
                    type="button"
                    onClick={() => {
                      if (!businessName.trim() || !ownerName.trim() || !businessEmail.trim()) {
                        notify('warning', 'Required details', 'Please enter your business name, owner name, and email.');
                        return;
                      }
                      setStep(2);
                    }}
                  >
                    <span>Continue</span>
                    <ArrowRight className="w-4 h-4" />
                  </AnimatedButton>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={reduced ? false : { opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduced ? undefined : { opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                <h2 className="font-display text-xl font-bold text-[#172B4D]">Address, branding &amp; tax ID</h2>
                <p className="text-sm text-slate-500">
                  Optional details you can update anytime in Settings.
                </p>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">Business Address</label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="1200 Market St, Suite 400, San Francisco, CA 94102"
                      className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#2563EB]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">Website (Optional)</label>
                    <input
                      type="url"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="https://yourbusiness.com"
                      className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#2563EB]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Tax ID Last 4 (Optional)
                    </label>
                    <input
                      type="text"
                      maxLength={8}
                      value={taxIdLast4}
                      onChange={(e) => setTaxIdLast4(e.target.value)}
                      placeholder="e.g. 4821"
                      className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#2563EB]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-2">Business Logo (Optional)</label>
                  <div className="flex items-center gap-4">
                    {logoDataUrl ? (
                      <img
                        src={logoDataUrl}
                        alt="Uploaded business logo"
                        className="w-14 h-14 object-contain rounded-lg border border-slate-200 bg-slate-50 p-1"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-lg border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center text-slate-400">
                        <Upload className="w-5 h-5" />
                      </div>
                    )}
                    <label className="px-3.5 py-2 text-xs font-medium bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
                      <span>Upload PNG or JPG</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg"
                        className="hidden"
                        onChange={(e) => handleLogoUpload(e.target.files?.[0])}
                      />
                    </label>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <AnimatedButton type="button" variant="secondary" onClick={() => setStep(1)}>
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back</span>
                  </AnimatedButton>
                  <AnimatedButton type="button" onClick={() => setStep(3)}>
                    <span>Continue</span>
                    <ArrowRight className="w-4 h-4" />
                  </AnimatedButton>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={reduced ? false : { opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduced ? undefined : { opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                <div className="flex items-center gap-2.5 text-[#172B4D]">
                  <SlidersHorizontal className="w-5 h-5 text-[#2563EB]" />
                  <h2 className="font-display text-xl font-bold">Financial &amp; invoicing preferences</h2>
                </div>
                <p className="text-sm text-slate-500">
                  Default currency is USD ($). Configure your US sales tax, due terms, and numbering.
                </p>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">Default Payment Terms</label>
                    <select
                      value={defaultPaymentTerms}
                      onChange={(e) => {
                        const v = e.target.value;
                        setDefaultPaymentTerms(v);
                        if (v === 'Due on Receipt') setDefaultDueDays(0);
                        if (v === 'Net 15') setDefaultDueDays(15);
                        if (v === 'Net 30') setDefaultDueDays(30);
                        if (v === 'Net 45') setDefaultDueDays(45);
                      }}
                      className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                    >
                      <option value="Due on Receipt">Due on Receipt</option>
                      <option value="Net 15">Net 15 (15 days)</option>
                      <option value="Net 30">Net 30 (30 days)</option>
                      <option value="Net 45">Net 45 (45 days)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">Business Timezone</label>
                    <select
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                    >
                      <option value="America/New_York">Eastern (America/New_York)</option>
                      <option value="America/Chicago">Central (America/Chicago)</option>
                      <option value="America/Denver">Mountain (America/Denver)</option>
                      <option value="America/Los_Angeles">Pacific (America/Los_Angeles)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">Invoice Prefix</label>
                    <input
                      type="text"
                      value={invoiceNumberFormat}
                      onChange={(e) => setInvoiceNumberFormat(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm font-mono border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">Starting Number</label>
                    <input
                      type="number"
                      min={1}
                      value={nextInvoiceNumber}
                      onChange={(e) => setNextInvoiceNumber(Number(e.target.value))}
                      className="w-full px-3.5 py-2 text-sm font-mono border border-slate-200 rounded-lg tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Default Sales Tax Rate (%)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      max={25}
                      value={taxRatePct}
                      onChange={(e) => setTaxRatePct(e.target.value)}
                      className="w-full px-3.5 py-2 text-sm font-mono border border-slate-200 rounded-lg tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">Tax Label</label>
                    <input
                      type="text"
                      value={taxLabel}
                      onChange={(e) => setTaxLabel(e.target.value)}
                      placeholder="Sales Tax"
                      className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-2">Accepted Payment Methods</label>
                  <div className="flex flex-wrap gap-2">
                    {['ACH Bank Transfer', 'Credit Card', 'Debit Card', 'PayPal', 'Check'].map((m) => {
                      const active = preferredPaymentMethods.includes(m);
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => toggleMethod(m)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                            active
                              ? 'bg-[#172B4D] text-white border-[#172B4D]'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {m}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <AnimatedButton type="button" variant="secondary" onClick={() => setStep(2)}>
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back</span>
                  </AnimatedButton>
                  <AnimatedButton type="submit" loading={saving}>
                    <Check className="w-4 h-4" />
                    <span>Finish &amp; Enter Dashboard</span>
                  </AnimatedButton>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </form>
      </div>
    </div>
  );
};

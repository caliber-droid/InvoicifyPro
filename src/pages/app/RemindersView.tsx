import React, { useMemo, useState } from 'react';
import { BellRing, Calendar, CheckCircle2, Mail, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { SponsoredLeaderboardBanner } from '../../components/SponsoredBanner';
import { useToast } from '../../context/ToastContext';
import { apiPost } from '../../lib/api';
import { createReminder, updateReminder } from '../../lib/firestoreRepo';
import { AnimatedButton, AnimatedModal, StatusBadge } from '../../lib/motion';
import { daysBetween, formatUsd, todayIso } from '../../lib/money';
import { Invoice, ReminderTone } from '../../types/models';

export const RemindersView: React.FC = () => {
  const { firebaseUser, businessProfile } = useAuth();
  const { invoices, reminders } = useData();
  const { notify } = useToast();

  const [selectedInv, setSelectedInv] = useState<Invoice | null>(null);
  const [tone, setTone] = useState<ReminderTone>('friendly');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [scheduledFor, setScheduledFor] = useState(todayIso());
  const [recommendedNote, setRecommendedNote] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const today = todayIso();

  const buckets = useMemo(() => {
    const unpaid = invoices.filter(
      (i) => i.balanceDueCents > 0 && i.status !== 'draft' && i.status !== 'void' && i.status !== 'refunded'
    );
    return unpaid.map((inv) => {
      const delta = daysBetween(inv.dueDate, today); // positive => overdue
      let bucket = 'Approaching Due Date';
      let suggestedTone: ReminderTone = 'friendly';
      if (delta === 0) {
        bucket = 'Due Today';
        suggestedTone = 'professional';
      } else if (delta >= 1 && delta <= 7) {
        bucket = '1–7 Days Overdue';
        suggestedTone = 'polite';
      } else if (delta >= 8 && delta <= 15) {
        bucket = '8–15 Days Overdue';
        suggestedTone = 'firm';
      } else if (delta > 15) {
        bucket = '15+ Days Overdue';
        suggestedTone = 'final_notice';
      }
      return { invoice: inv, delta, bucket, suggestedTone };
    });
  }, [invoices, today]);

  const openWriter = async (inv: Invoice, defaultTone: ReminderTone) => {
    setSelectedInv(inv);
    setTone(defaultTone);
    setScheduledFor(todayIso());
    setSubject(`Payment Reminder: Invoice ${inv.invoiceNumber}`);
    setBody(
      `Hi ${inv.clientName},\n\nThis is a reminder regarding Invoice ${inv.invoiceNumber} for ${formatUsd(
        inv.balanceDueCents
      )}, due on ${inv.dueDate}.\n\nPlease let us know if you have any questions.\n\nBest regards,\n${
        businessProfile?.ownerName || businessProfile?.businessName || ''
      }`
    );
    setRecommendedNote('');
  };

  const handleAiDraft = async () => {
    if (!selectedInv) return;
    setAiLoading(true);
    try {
      const prevCount = reminders.filter((r) => r.invoiceId === selectedInv.id && r.status === 'sent').length;
      const res = await apiPost<{ subject: string; body: string; recommendedTimingNote: string }>(
        '/api/ai/generate-reminder',
        {
          clientName: selectedInv.clientName,
          invoiceNumber: selectedInv.invoiceNumber,
          balanceDueFormatted: formatUsd(selectedInv.balanceDueCents),
          dueDate: selectedInv.dueDate,
          daysDelta: daysBetween(selectedInv.dueDate, today),
          tone,
          previousRemindersCount: prevCount,
          businessName: businessProfile?.businessName || 'Your Business',
          ownerName: businessProfile?.ownerName || 'Owner',
        }
      );
      setSubject(res.subject);
      setBody(res.body);
      setRecommendedNote(res.recommendedTimingNote);
      notify('success', 'AI reminder drafted', 'Review and edit before scheduling or sending.');
    } catch (err: any) {
      notify('error', 'AI draft failed', err?.message || 'Unable to generate reminder.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleScheduleOrSend = async (sendNow: boolean) => {
    if (!firebaseUser || !selectedInv) return;
    setSaving(true);
    try {
      let deliveryStatus: 'scheduled' | 'sent' = sendNow ? 'sent' : 'scheduled';
      let deliveryMethod = sendNow ? 'manual_email_api' : 'scheduled_queue';

      if (sendNow) {
        try {
          await apiPost('/api/email/send', {
            to: selectedInv.clientEmail,
            replyTo: businessProfile?.businessEmail,
            subject,
            text: body,
          });
        } catch (err: any) {
          // If Resend isn't configured, fall back cleanly to mailto and record user-approved reminder
          notify(
            'info',
            'Email API not configured',
            err?.message || 'Opening your email app or saving reminder schedule.'
          );
          deliveryStatus = 'scheduled';
          deliveryMethod = 'mailto_pending';
        }
      }

      await createReminder(firebaseUser.uid, {
        invoiceId: selectedInv.id,
        invoiceNumber: selectedInv.invoiceNumber,
        clientId: selectedInv.clientId,
        clientName: selectedInv.clientName,
        clientEmail: selectedInv.clientEmail,
        tone,
        subject,
        body,
        scheduledFor,
        status: deliveryStatus,
        deliveryMethod,
        ...(deliveryStatus === 'sent' ? { sentAt: new Date().toISOString() } : {}),
      });

      notify(
        'success',
        deliveryStatus === 'sent' ? 'Reminder sent' : 'Reminder scheduled',
        `${selectedInv.invoiceNumber} · ${selectedInv.clientName}`
      );
      setSelectedInv(null);
    } catch (err: any) {
      notify('error', 'Reminder failed', err?.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#172B4D]">AI Payment Reminders</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Smart follow-up timing and AI-tailored reminder drafts. Every message requires your review and approval before sending.
        </p>
      </div>

      {/* Attention Queue */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-[#172033]">
            Invoices Eligible for Follow-Up ({buckets.length})
          </h2>
        </div>
        {buckets.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            No unpaid issued invoices currently require follow-up.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {buckets.map(({ invoice, delta, bucket, suggestedTone }) => (
              <div key={invoice.id} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono font-semibold text-sm text-[#172B4D]">
                      {invoice.invoiceNumber}
                    </span>
                    <span className="text-sm font-medium text-[#172033]">{invoice.clientName}</span>
                    <StatusBadge status={invoice.status} />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {bucket} · Due {invoice.dueDate} ({delta > 0 ? `${delta} days overdue` : delta === 0 ? 'due today' : `in ${Math.abs(delta)} days`}) · Recommended tone:{' '}
                    <span className="font-medium capitalize text-[#2563EB]">
                      {suggestedTone.replace('_', ' ')}
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono font-bold text-sm text-[#172033] tabular-nums">
                    {formatUsd(invoice.balanceDueCents)}
                  </span>
                  <AnimatedButton size="sm" onClick={() => openWriter(invoice, suggestedTone)}>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Draft Reminder</span>
                  </AnimatedButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <SponsoredLeaderboardBanner />

      {/* Reminder History */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="font-display text-base font-semibold text-[#172033]">
            Scheduled &amp; Sent Reminder History ({reminders.length})
          </h2>
        </div>
        {reminders.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">No reminders scheduled or sent yet.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {reminders.map((r) => (
              <div key={r.id} className="px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <p className="font-semibold text-[#172033]">
                    {r.invoiceNumber} · {r.clientName} — {r.subject}
                  </p>
                  <p className="text-slate-500 mt-0.5">
                    Tone: <span className="capitalize">{r.tone.replace('_', ' ')}</span> · Target Date: {r.scheduledFor}
                  </p>
                </div>
                <div className="flex items-center gap-2.5">
                  <StatusBadge status={r.status} />
                  {r.status === 'scheduled' && (
                    <button
                      type="button"
                      onClick={async () => {
                        await updateReminder(r.id, { status: 'sent', sentAt: new Date().toISOString() });
                        notify('success', 'Marked as sent', r.invoiceNumber);
                      }}
                      className="text-xs font-medium text-[#16A34A] hover:underline cursor-pointer"
                    >
                      Mark Sent
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AI Reminder Writer Modal */}
      <AnimatedModal
        open={Boolean(selectedInv)}
        onClose={() => setSelectedInv(null)}
        title={`Draft Payment Reminder · ${selectedInv?.invoiceNumber || ''}`}
        subtitle={`Recipient: ${selectedInv?.clientName} (${selectedInv?.clientEmail})`}
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {(['friendly', 'professional', 'polite', 'firm', 'final_notice'] as ReminderTone[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTone(t)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border capitalize cursor-pointer ${
                    tone === t
                      ? 'bg-[#172B4D] text-white border-[#172B4D]'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {t.replace('_', ' ')}
                </button>
              ))}
            </div>
            <AnimatedButton size="sm" variant="secondary" loading={aiLoading} onClick={handleAiDraft}>
              <Sparkles className="w-3.5 h-3.5 text-[#2563EB]" />
              <span>Write with AI</span>
            </AnimatedButton>
          </div>

          {recommendedNote && (
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-[#1E3A8A]">
              <strong>Smart Timing Insight:</strong> {recommendedNote}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Message Body</label>
            <textarea
              rows={7}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Schedule Date</label>
            <input
              type="date"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg"
            />
          </div>

          <div className="flex flex-wrap justify-between items-center gap-3 pt-2">
            {selectedInv && (
              <a
                href={`mailto:${selectedInv.clientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}
                className="text-xs font-medium text-slate-600 hover:text-[#172B4D] underline"
              >
                Open in Email Client
              </a>
            )}
            <div className="flex gap-2">
              <AnimatedButton
                variant="secondary"
                loading={saving}
                onClick={() => handleScheduleOrSend(false)}
              >
                <Calendar className="w-4 h-4" />
                <span>Schedule Reminder</span>
              </AnimatedButton>
              <AnimatedButton loading={saving} onClick={() => handleScheduleOrSend(true)}>
                <Mail className="w-4 h-4" />
                <span>Approve &amp; Send Now</span>
              </AnimatedButton>
            </div>
          </div>
        </div>
      </AnimatedModal>
    </div>
  );
};

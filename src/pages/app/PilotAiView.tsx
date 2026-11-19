import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  CheckCircle2,
  Mic,
  MicOff,
  PlusCircle,
  Send,
  Sparkles,
} from 'lucide-react';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { SponsoredLeaderboardBanner } from '../../components/SponsoredBanner';
import { useToast } from '../../context/ToastContext';
import { apiPost } from '../../lib/api';
import { db } from '../../lib/firebase';
import {
  createClient,
  createEstimate,
  createInvoice,
  createReminder,
  saveAiConversation,
} from '../../lib/firestoreRepo';
import { AnimatedButton } from '../../lib/motion';
import {
  addDaysIso,
  calculateInvoiceTotals,
  formatUsd,
  generateRandomId,
  todayIso,
} from '../../lib/money';
import { AiChatMessage, PLAN_CONFIGS } from '../../types/models';

const SUGGESTIONS = [
  'Show me all overdue invoices and who owes the most.',
  'How much revenue did I collect this month compared to expenses?',
  'Which clients owe me the most money right now?',
  'Draft a $1,200 invoice for advisory consulting due in 14 days.',
];

export const PilotAiView: React.FC<{
  onNavigate?: (tab: string) => void;
}> = ({ onNavigate }) => {
  const reduced = useReducedMotion();
  const { firebaseUser, userAccount, businessProfile } = useAuth();
  const { clients, invoices, estimates, expenses, payments, aiConversations } = useData();
  const { notify } = useToast();

  const planCfg = PLAN_CONFIGS[userAccount?.plan || 'free'];
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [listening, setListening] = useState(false);
  const [executingProposalId, setExecutingProposalId] = useState<string | null>(null);
  const [executedIds, setExecutedIds] = useState<Record<string, boolean>>({});
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!activeConvId && aiConversations.length > 0 && messages.length === 0) {
      setActiveConvId(aiConversations[0].id);
      setMessages(aiConversations[0].messages || []);
    }
  }, [aiConversations, activeConvId, messages.length]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  const contextPayload = useMemo(
    () => ({
      businessName: businessProfile?.businessName || 'My Business',
      todayIso: todayIso(),
      clients: clients.map((c) => ({
        id: c.id,
        name: c.name,
        companyName: c.companyName,
        email: c.email,
      })),
      invoices: invoices.map((i) => ({
        id: i.id,
        invoiceNumber: i.invoiceNumber,
        clientId: i.clientId,
        clientName: i.clientName,
        status: i.status,
        issueDate: i.issueDate,
        dueDate: i.dueDate,
        totalCents: i.totalCents,
        amountPaidCents: i.amountPaidCents,
        balanceDueCents: i.balanceDueCents,
      })),
      estimates: estimates.map((e) => ({
        id: e.id,
        estimateNumber: e.estimateNumber,
        clientName: e.clientName,
        status: e.status,
        totalCents: e.totalCents,
        expirationDate: e.expirationDate,
      })),
      expenses: expenses.map((e) => ({
        id: e.id,
        description: e.description,
        vendor: e.vendor,
        category: e.category,
        date: e.date,
        amountCents: e.amountCents,
      })),
      payments: payments.map((p) => ({
        id: p.id,
        invoiceNumber: p.invoiceNumber,
        clientName: p.clientName,
        amountCents: p.amountCents,
        paymentDate: p.paymentDate,
        method: p.method,
        status: p.status,
      })),
    }),
    [businessProfile, clients, invoices, estimates, expenses, payments]
  );

  const handleSend = async (promptOverride?: string) => {
    const text = (promptOverride ?? input).trim();
    if (!text || !firebaseUser) return;
    if (!planCfg.aiEnabled) {
      notify('warning', 'AI Assistant requires Starter, Pro, or Business', 'Upgrade or switch plans in Subscription.');
      return;
    }

    const userMsg: AiChatMessage = {
      id: generateRandomId('msg'),
      role: 'user',
      text,
      timestamp: new Date().toISOString(),
    };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    if (!promptOverride) setInput('');
    setSending(true);

    try {
      const res = await apiPost<{ reply: string; proposedAction?: Record<string, unknown> | null }>(
        '/api/ai/pilot-chat',
        {
          message: text,
          history: messages.slice(-10).map((m) => ({ role: m.role, text: m.text })),
          context: contextPayload,
        }
      );

      const botMsg: AiChatMessage = {
        id: generateRandomId('msg'),
        role: 'model',
        text: res.reply,
        timestamp: new Date().toISOString(),
        proposedAction: res.proposedAction || null,
      };
      const updatedMsgs = [...nextHistory, botMsg];
      setMessages(updatedMsgs);

      const convTitle = nextHistory[0]?.text.slice(0, 60) || 'Pilot AI Session';
      const savedId = await saveAiConversation(firebaseUser.uid, activeConvId, convTitle, updatedMsgs);
      if (!activeConvId) setActiveConvId(savedId);
    } catch (err: any) {
      notify('error', 'Pilot AI could not respond', err?.message || 'Check server Gemini configuration.');
    } finally {
      setSending(false);
    }
  };

  const toggleVoice = () => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      notify('info', 'Voice dictation unavailable', 'Your browser does not support Web Speech Recognition.');
      return;
    }
    if (listening) {
      setListening(false);
      return;
    }
    const rec = new SpeechRec();
    rec.lang = 'en-US';
    rec.interimResults = false;
    setListening(true);
    rec.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript || '';
      if (transcript) setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
      setListening(false);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    rec.start();
  };

  const executeProposal = async (msgId: string, proposal: Record<string, unknown>) => {
    if (!firebaseUser || !businessProfile) return;
    setExecutingProposalId(msgId);
    try {
      const actionType = String(proposal.actionType || '');
      const rawClientName = String(proposal.clientName || 'Client').trim();
      const amountDollars = Number(proposal.amountDollars || 0);
      const amountCents = Math.max(0, Math.round(amountDollars * 100));
      const description = String(proposal.description || 'Consulting Services').trim();
      const dueDays = Number(proposal.dueDays || businessProfile.defaultDueDays || 15);

      let matchedClient = clients.find(
        (c) =>
          c.name.toLowerCase().includes(rawClientName.toLowerCase()) ||
          (c.companyName && c.companyName.toLowerCase().includes(rawClientName.toLowerCase()))
      );

      if (actionType === 'draft_payment_reminder') {
        const invNum = String(proposal.invoiceNumber || '');
        const inv =
          invoices.find((i) => invNum && i.invoiceNumber.toLowerCase() === invNum.toLowerCase()) ||
          invoices.find((i) => i.clientName.toLowerCase().includes(rawClientName.toLowerCase()) && i.balanceDueCents > 0);
        if (!inv) {
          notify('warning', 'Matching unpaid invoice not found', 'Create the invoice or choose one in Reminders.');
          return;
        }
        await createReminder(firebaseUser.uid, {
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          clientId: inv.clientId,
          clientName: inv.clientName,
          clientEmail: inv.clientEmail,
          tone: (String(proposal.tone || 'polite') as any),
          subject: `Payment Reminder: Invoice ${inv.invoiceNumber}`,
          body: `Hi ${inv.clientName},\n\nThis is a quick reminder regarding invoice ${inv.invoiceNumber} for ${formatUsd(inv.balanceDueCents)} due on ${inv.dueDate}.\n\nThank you,\n${businessProfile.businessName}`,
          scheduledFor: todayIso(),
          status: 'scheduled',
        });
        setExecutedIds((p) => ({ ...p, [msgId]: true }));
        notify('success', 'Reminder draft saved', 'Review and approve it in Payment Reminders.');
        return;
      }

      if (!matchedClient) {
        // Require a valid client email or fallback placeholder only if creating a draft client
        const fallbackEmail = `${rawClientName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'client'}@example.com`;
        const newClientId = await createClient(firebaseUser.uid, {
          name: rawClientName,
          email: fallbackEmail,
          archived: false,
          notes: 'Created from Pilot AI draft confirmation — please verify client email before sending.',
        });
        matchedClient = {
          id: newClientId,
          ownerId: firebaseUser.uid,
          name: rawClientName,
          email: fallbackEmail,
          archived: false,
        };
      }

      const lineItems = [
        {
          id: generateRandomId('li'),
          description,
          quantity: 1,
          unitPriceCents: amountCents,
          totalCents: amountCents,
        },
      ];
      const totals = calculateInvoiceTotals(lineItems, 0, businessProfile.defaultTaxRateBps || 0, 0);

      if (actionType === 'create_estimate_draft') {
        const estNum = `EST-${String(estimates.length + 101).padStart(4, '0')}`;
        await createEstimate(
          firebaseUser.uid,
          {
            clientId: matchedClient.id,
            clientName: matchedClient.name,
            clientEmail: matchedClient.email,
            estimateNumber: estNum,
            issueDate: todayIso(),
            expirationDate: addDaysIso(todayIso(), dueDays),
            status: 'draft',
            items: lineItems,
            subtotalCents: totals.subtotalCents,
            discountCents: 0,
            taxRateBps: totals.taxRateBps,
            taxCents: totals.taxCents,
            totalCents: totals.totalCents,
            notes: 'Drafted by Pilot AI after user confirmation.',
          },
          businessProfile.businessName,
          businessProfile.businessEmail
        );
        setExecutedIds((p) => ({ ...p, [msgId]: true }));
        notify('success', `Estimate ${estNum} draft created`);
      } else {
        const nextNum = businessProfile.nextInvoiceNumber || 1;
        const invNum = `${businessProfile.invoiceNumberFormat || 'INV-'}${String(nextNum).padStart(4, '0')}`;
        await createInvoice(
          firebaseUser.uid,
          {
            clientId: matchedClient.id,
            clientName: matchedClient.name,
            clientEmail: matchedClient.email,
            invoiceNumber: invNum,
            issueDate: todayIso(),
            dueDate: addDaysIso(todayIso(), dueDays),
            status: 'draft',
            template: 'corporate',
            items: lineItems,
            subtotalCents: totals.subtotalCents,
            discountCents: 0,
            taxRateBps: totals.taxRateBps,
            taxCents: totals.taxCents,
            totalCents: totals.totalCents,
            amountPaidCents: 0,
            balanceDueCents: totals.totalCents,
            notes: 'Drafted by Pilot AI after user confirmation.',
          },
          businessProfile.businessName,
          businessProfile.businessEmail
        );
        await updateDoc(doc(db, 'businessProfiles', firebaseUser.uid), {
          nextInvoiceNumber: nextNum + 1,
          updatedAt: serverTimestamp(),
        });
        setExecutedIds((p) => ({ ...p, [msgId]: true }));
        notify('success', `Invoice ${invNum} draft created`, 'Review details in Invoices before sending.');
      }
    } catch (err: any) {
      notify('error', 'Failed to execute proposed action', err?.message);
    } finally {
      setExecutingProposalId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#172B4D] flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-[#2563EB]" />
            <span>Pilot AI Financial Assistant</span>
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Queries your real stored invoices, payments, clients, and expenses using server-side tool calling.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AnimatedButton
            variant="secondary"
            size="sm"
            onClick={() => {
              setActiveConvId(null);
              setMessages([]);
            }}
          >
            <PlusCircle className="w-4 h-4" />
            <span>New Conversation</span>
          </AnimatedButton>
        </div>
      </div>

      {!planCfg.aiEnabled && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between gap-3">
          <p className="text-xs text-amber-900">
            Pilot AI is available on Starter, Pro, and Business plans. Switch your plan in Subscription to start chatting.
          </p>
          {onNavigate && (
            <AnimatedButton size="sm" variant="secondary" onClick={() => onNavigate('subscription')}>
              View Plans
            </AnimatedButton>
          )}
        </div>
      )}

      <SponsoredLeaderboardBanner />

      <div className="grid lg:grid-cols-12 gap-5">
        {/* Saved Conversations */}
        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-xl p-4 space-y-2 max-h-[600px] overflow-y-auto">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-2">History</p>
          {aiConversations.length === 0 ? (
            <p className="text-xs text-slate-400 px-2 py-4">No past conversations yet.</p>
          ) : (
            aiConversations.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setActiveConvId(c.id);
                  setMessages(c.messages || []);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors cursor-pointer ${
                  activeConvId === c.id
                    ? 'bg-blue-50 text-[#172B4D] font-semibold'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <p className="truncate">{c.title}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{c.messages?.length || 0} messages</p>
              </button>
            ))
          )}
        </div>

        {/* Chat Workspace */}
        <div className="lg:col-span-9 bg-white border border-slate-200 rounded-xl flex flex-col h-[600px] overflow-hidden">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4">
            {messages.length === 0 && (
              <div className="py-8 max-w-xl mx-auto text-center space-y-5">
                <div className="w-12 h-12 rounded-2xl bg-[#172B4D] text-white flex items-center justify-center mx-auto">
                  <Sparkles className="w-6 h-6 text-[#38BDF8]" />
                </div>
                <div>
                  <h2 className="font-display text-lg font-semibold text-[#172033]">
                    Ask Pilot AI about your business finances
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Every answer is grounded in your live Firestore records. Draft actions always wait for your confirmation.
                  </p>
                </div>
                <div className="grid sm:grid-cols-2 gap-2 text-left">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => handleSend(s)}
                      className="p-3 text-xs text-slate-700 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-200 rounded-xl transition-colors cursor-pointer"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-[#172B4D] text-white'
                      : 'bg-slate-100 text-[#172033]'
                  }`}
                >
                  {m.text}
                </div>

                {m.proposedAction && (
                  <div className="mt-2 max-w-[85%] bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
                    <p className="text-xs font-semibold text-[#172B4D]">
                      Proposed Action — Confirmation Required
                    </p>
                    <p className="text-xs text-slate-700">
                      Action: <strong>{String(m.proposedAction.actionType || '').replace(/_/g, ' ')}</strong> · Client:{' '}
                      <strong>{String(m.proposedAction.clientName || '')}</strong>
                      {m.proposedAction.amountDollars
                        ? ` · Amount: $${Number(m.proposedAction.amountDollars).toFixed(2)}`
                        : ''}
                    </p>
                    <p className="text-xs text-slate-600">{String(m.proposedAction.description || '')}</p>
                    {executedIds[m.id] ? (
                      <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#16A34A]">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Draft created</span>
                      </div>
                    ) : (
                      <AnimatedButton
                        size="sm"
                        loading={executingProposalId === m.id}
                        onClick={() => executeProposal(m.id, m.proposedAction!)}
                      >
                        Confirm &amp; Create Draft
                      </AnimatedButton>
                    )}
                  </div>
                )}
              </div>
            ))}

            {sending && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <div className="flex gap-1 px-3 py-2 bg-slate-100 rounded-xl">
                  {[0, 1, 2].map((dot) => (
                    <motion.span
                      key={dot}
                      animate={reduced ? undefined : { opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1, repeat: Infinity, delay: dot * 0.18 }}
                      className="w-1.5 h-1.5 rounded-full bg-slate-500"
                    />
                  ))}
                </div>
                <span>Analyzing stored business records...</span>
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="p-3 border-t border-slate-200 bg-slate-50 flex items-center gap-2"
          >
            <button
              type="button"
              onClick={toggleVoice}
              title={listening ? 'Stop dictation' : 'Voice prompt'}
              className={`p-2.5 rounded-lg border transition-colors cursor-pointer ${
                listening
                  ? 'bg-red-50 border-red-200 text-red-600'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about overdue invoices, revenue, top clients, or request a draft..."
              className="flex-1 px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#2563EB]"
            />
            <AnimatedButton type="submit" loading={sending} disabled={!input.trim()}>
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">Send</span>
            </AnimatedButton>
          </form>
        </div>
      </div>
    </div>
  );
};

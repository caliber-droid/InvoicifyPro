import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { subscribeOwnerCollection } from '../lib/firestoreRepo';
import { getEffectiveInvoiceStatus, todayIso } from '../lib/money';
import {
  AiConversation,
  AppNotification,
  AuditLog,
  Client,
  Estimate,
  Expense,
  Invoice,
  Payment,
  PLAN_CONFIGS,
  RecurringProfile,
  Reminder,
  VaultDocument,
} from '../types/models';
import { useAuth } from './AuthContext';

interface DataContextValue {
  clients: Client[];
  invoices: Invoice[];
  estimates: Estimate[];
  payments: Payment[];
  expenses: Expense[];
  recurringProfiles: RecurringProfile[];
  reminders: Reminder[];
  notifications: AppNotification[];
  documents: VaultDocument[];
  aiConversations: AiConversation[];
  auditLogs: AuditLog[];
  dataLoading: boolean;
  unreadNotificationsCount: number;
  usageStats: {
    invoicesThisMonth: number;
    estimatesThisMonth: number;
    activeClientsCount: number;
    invoiceLimit: number | null;
    estimateLimit: number | null;
    clientLimit: number | null;
    canCreateInvoice: boolean;
    canCreateEstimate: boolean;
    canCreateClient: boolean;
  };
}

const DataContext = createContext<DataContextValue | null>(null);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { firebaseUser, userAccount } = useAuth();
  const uid = firebaseUser?.emailVerified ? firebaseUser.uid : null;

  const [clients, setClients] = useState<Client[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [recurringProfiles, setRecurringProfiles] = useState<RecurringProfile[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [documents, setDocuments] = useState<VaultDocument[]>([]);
  const [aiConversations, setAiConversations] = useState<AiConversation[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setClients([]);
      setInvoices([]);
      setEstimates([]);
      setPayments([]);
      setExpenses([]);
      setRecurringProfiles([]);
      setReminders([]);
      setNotifications([]);
      setDocuments([]);
      setAiConversations([]);
      setAuditLogs([]);
      setDataLoading(false);
      return;
    }

    setDataLoading(true);
    let initialLoaded = 0;
    const markLoaded = () => {
      initialLoaded += 1;
      if (initialLoaded >= 4) setDataLoading(false);
    };

    const unsubs = [
      subscribeOwnerCollection<Client>('clients', uid, (rows) => {
        setClients(rows);
        markLoaded();
      }),
      subscribeOwnerCollection<Invoice>('invoices', uid, (rows) => {
        const today = todayIso();
        setInvoices(rows.map((inv) => ({ ...inv, status: getEffectiveInvoiceStatus(inv, today) })));
        markLoaded();
      }),
      subscribeOwnerCollection<Estimate>('estimates', uid, (rows) => {
        setEstimates(rows);
        markLoaded();
      }),
      subscribeOwnerCollection<Payment>('payments', uid, (rows) => {
        setPayments(rows);
        markLoaded();
      }),
      subscribeOwnerCollection<Expense>('expenses', uid, setExpenses),
      subscribeOwnerCollection<RecurringProfile>('recurringProfiles', uid, setRecurringProfiles),
      subscribeOwnerCollection<Reminder>('reminders', uid, setReminders),
      subscribeOwnerCollection<AppNotification>('notifications', uid, setNotifications, 'createdAt', 50),
      subscribeOwnerCollection<VaultDocument>('documents', uid, setDocuments),
      subscribeOwnerCollection<AiConversation>('aiConversations', uid, setAiConversations, 'updatedAt', 30),
      subscribeOwnerCollection<AuditLog>('auditLogs', uid, setAuditLogs, 'createdAt', 100),
    ];

    const fallbackTimer = window.setTimeout(() => setDataLoading(false), 1800);

    return () => {
      window.clearTimeout(fallbackTimer);
      unsubs.forEach((u) => u());
    };
  }, [uid]);

  const unreadNotificationsCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const usageStats = useMemo(() => {
    const plan = PLAN_CONFIGS[userAccount?.plan || 'free'];
    const monthPrefix = todayIso().slice(0, 7);
    const invoicesThisMonth = invoices.filter((i) => i.issueDate.startsWith(monthPrefix)).length;
    const estimatesThisMonth = estimates.filter((e) => e.issueDate.startsWith(monthPrefix)).length;
    const activeClientsCount = clients.filter((c) => !c.archived).length;

    return {
      invoicesThisMonth,
      estimatesThisMonth,
      activeClientsCount,
      invoiceLimit: plan.invoicesPerMonth,
      estimateLimit: plan.estimatesPerMonth,
      clientLimit: plan.maxClients,
      canCreateInvoice: plan.invoicesPerMonth === null || invoicesThisMonth < plan.invoicesPerMonth,
      canCreateEstimate: plan.estimatesPerMonth === null || estimatesThisMonth < plan.estimatesPerMonth,
      canCreateClient: plan.maxClients === null || activeClientsCount < plan.maxClients,
    };
  }, [userAccount?.plan, invoices, estimates, clients]);

  return (
    <DataContext.Provider
      value={{
        clients,
        invoices,
        estimates,
        payments,
        expenses,
        recurringProfiles,
        reminders,
        notifications,
        documents,
        aiConversations,
        auditLogs,
        dataLoading,
        unreadNotificationsCount,
        usageStats,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}

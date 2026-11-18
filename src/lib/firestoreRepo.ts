import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  AiConversation,
  AppNotification,
  AuditLog,
  BusinessProfile,
  Client,
  Estimate,
  Expense,
  Invoice,
  Payment,
  PortalShare,
  RecurringProfile,
  Reminder,
  UserAccount,
  VaultDocument,
} from '../types/models';
import { addDaysIso, generateRandomId, todayIso } from './money';

export function subscribeOwnerCollection<T extends { id: string }>(
  collectionName: string,
  ownerId: string,
  onData: (rows: T[]) => void,
  orderField: string | null = 'createdAt',
  maxRows = 250
) {
  const colRef = collection(db, collectionName);
  const q = orderField
    ? query(colRef, where('ownerId', '==', ownerId), orderBy(orderField, 'desc'), limit(maxRows))
    : query(colRef, where('ownerId', '==', ownerId), limit(maxRows));

  return onSnapshot(
    q,
    (snapshot) => {
      const rows = snapshot.docs.map((d) => ({ ...(d.data() as Omit<T, 'id'>), id: d.id } as T));
      onData(rows);
    },
    (error) => {
      // Fallback if composite index is still building or missing on orderBy
      if (orderField && error.message?.toLowerCase().includes('index')) {
        const fallbackQ = query(colRef, where('ownerId', '==', ownerId), limit(maxRows));
        onSnapshot(
          fallbackQ,
          (snap) => {
            const rows = snap.docs.map((d) => ({ ...(d.data() as Omit<T, 'id'>), id: d.id } as T));
            onData(rows);
          },
          (err2) => handleFirestoreError(err2, OperationType.LIST, collectionName)
        );
        return;
      }
      handleFirestoreError(error, OperationType.LIST, collectionName);
    }
  );
}

export async function logAuditAndNotify(params: {
  ownerId: string;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  notification?: {
    type: string;
    title: string;
    message: string;
  };
}) {
  const batch = writeBatch(db);
  const logId = generateRandomId('log');
  batch.set(doc(db, 'auditLogs', logId), {
    ownerId: params.ownerId,
    action: params.action.slice(0, 80),
    entityType: params.entityType.slice(0, 40),
    entityId: params.entityId.slice(0, 128),
    summary: params.summary.slice(0, 500),
    createdAt: serverTimestamp(),
  });

  if (params.notification) {
    const notifId = generateRandomId('ntf');
    batch.set(doc(db, 'notifications', notifId), {
      ownerId: params.ownerId,
      type: params.notification.type.slice(0, 60),
      title: params.notification.title.slice(0, 160),
      message: params.notification.message.slice(0, 500),
      read: false,
      entityType: params.entityType.slice(0, 40),
      entityId: params.entityId.slice(0, 128),
      createdAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'auditLogs');
  }
}

export async function ensureUserAccount(uid: string, email: string, displayName: string): Promise<UserAccount> {
  const ref = doc(db, 'users', uid);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return snap.data() as UserAccount;
    }
    const payload: UserAccount = {
      uid,
      email: email.slice(0, 254),
      displayName: (displayName || email.split('@')[0] || 'Business Owner').slice(0, 120),
      role: 'owner',
      onboarded: false,
      plan: 'free',
      billingCycle: 'monthly',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(ref, payload);
    return payload;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${uid}`);
  }
}

export async function updateUserAccount(
  uid: string,
  patch: Partial<Pick<UserAccount, 'displayName' | 'onboarded' | 'plan' | 'billingCycle'>>
) {
  try {
    await updateDoc(doc(db, 'users', uid), {
      ...patch,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
  }
}

export async function saveBusinessProfile(
  uid: string,
  profile: Omit<BusinessProfile, 'ownerId' | 'createdAt' | 'updatedAt'>,
  isNew: boolean
) {
  const ref = doc(db, 'businessProfiles', uid);
  try {
    if (isNew) {
      await setDoc(ref, {
        ...profile,
        ownerId: uid,
        defaultCurrency: 'USD',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        businessName: profile.businessName,
        ownerName: profile.ownerName,
        businessEmail: profile.businessEmail,
        phone: profile.phone || '',
        website: profile.website || '',
        address: profile.address || '',
        logoDataUrl: profile.logoDataUrl || '',
        businessType: profile.businessType,
        industry: profile.industry || '',
        taxIdLast4: profile.taxIdLast4 || '',
        defaultPaymentTerms: profile.defaultPaymentTerms,
        invoiceNumberFormat: profile.invoiceNumberFormat,
        nextInvoiceNumber: profile.nextInvoiceNumber,
        defaultTaxRateBps: profile.defaultTaxRateBps,
        taxLabel: profile.taxLabel || 'Sales Tax',
        preferredPaymentMethods: profile.preferredPaymentMethods || ['ACH Bank Transfer', 'Credit Card'],
        timezone: profile.timezone || 'America/New_York',
        defaultDueDays: profile.defaultDueDays,
        reminderSchedule: profile.reminderSchedule || {
          beforeDue3Days: true,
          onDueDate: true,
          overdue3Days: true,
          overdue7Days: true,
          overdue14Days: true,
        },
        notificationPrefs: profile.notificationPrefs || {
          invoicePaid: true,
          invoiceOverdue: true,
          estimateDecision: true,
          recurringGenerated: true,
        },
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, isNew ? OperationType.CREATE : OperationType.UPDATE, `businessProfiles/${uid}`);
  }
}

export async function createClient(ownerId: string, data: Omit<Client, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>) {
  const id = generateRandomId('cli');
  try {
    await setDoc(doc(db, 'clients', id), {
      ownerId,
      name: data.name.slice(0, 140),
      companyName: (data.companyName || '').slice(0, 160),
      email: data.email.slice(0, 254),
      phone: (data.phone || '').slice(0, 40),
      billingAddress: (data.billingAddress || '').slice(0, 400),
      website: (data.website || '').slice(0, 240),
      category: (data.category || 'General').slice(0, 60),
      notes: (data.notes || '').slice(0, 2000),
      archived: Boolean(data.archived),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await logAuditAndNotify({
      ownerId,
      action: 'client.created',
      entityType: 'client',
      entityId: id,
      summary: `Added client ${data.name} (${data.email}).`,
    });
    return id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `clients/${id}`);
  }
}

export async function updateClient(
  clientId: string,
  patch: Partial<Omit<Client, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>>
) {
  try {
    await updateDoc(doc(db, 'clients', clientId), {
      ...patch,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `clients/${clientId}`);
  }
}

export async function createInvoice(
  ownerId: string,
  data: Omit<Invoice, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>,
  businessName: string,
  businessEmail: string
) {
  const id = generateRandomId('inv');
  const shareToken = data.publicShareToken || generateRandomId('shr_inv');
  try {
    await setDoc(doc(db, 'invoices', id), {
      ...data,
      ownerId,
      publicShareToken: shareToken,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Create portal share snapshot for client payment portal
    await setDoc(doc(db, 'portalShares', shareToken), {
      ownerId,
      kind: 'invoice',
      targetId: id,
      businessName: businessName.slice(0, 160),
      businessEmail: businessEmail.slice(0, 254),
      clientName: data.clientName.slice(0, 140),
      docNumber: data.invoiceNumber.slice(0, 40),
      issueDate: data.issueDate,
      dueDate: data.dueDate,
      template: data.template,
      items: data.items.slice(0, 50),
      subtotalCents: data.subtotalCents,
      discountCents: data.discountCents,
      taxCents: data.taxCents,
      totalCents: data.totalCents,
      amountPaidCents: data.amountPaidCents,
      balanceDueCents: data.balanceDueCents,
      status: data.status,
      notes: (data.notes || '').slice(0, 2000),
      terms: (data.terms || '').slice(0, 2000),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await logAuditAndNotify({
      ownerId,
      action: 'invoice.created',
      entityType: 'invoice',
      entityId: id,
      summary: `Created invoice ${data.invoiceNumber} for ${data.clientName}.`,
      notification: {
        type: 'invoice_created',
        title: `Invoice ${data.invoiceNumber} created`,
        message: `Drafted for ${data.clientName}.`,
      },
    });
    return { id, shareToken };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `invoices/${id}`);
  }
}

export async function updateInvoice(
  invoice: Invoice,
  patch: Partial<Invoice>,
  syncPortal = true
) {
  try {
    await updateDoc(doc(db, 'invoices', invoice.id), {
      ...patch,
      updatedAt: serverTimestamp(),
    });
    if (syncPortal && invoice.publicShareToken) {
      const portalRef = doc(db, 'portalShares', invoice.publicShareToken);
      const portalSnap = await getDoc(portalRef).catch(() => null);
      if (portalSnap?.exists()) {
        await updateDoc(portalRef, {
          status: patch.status ?? invoice.status,
          amountPaidCents: patch.amountPaidCents ?? invoice.amountPaidCents,
          balanceDueCents: patch.balanceDueCents ?? invoice.balanceDueCents,
          items: (patch.items ?? invoice.items).slice(0, 50),
          subtotalCents: patch.subtotalCents ?? invoice.subtotalCents,
          discountCents: patch.discountCents ?? invoice.discountCents,
          taxCents: patch.taxCents ?? invoice.taxCents,
          totalCents: patch.totalCents ?? invoice.totalCents,
          dueDate: patch.dueDate ?? invoice.dueDate,
          notes: (patch.notes ?? invoice.notes ?? '').slice(0, 2000),
          terms: (patch.terms ?? invoice.terms ?? '').slice(0, 2000),
          updatedAt: serverTimestamp(),
        });
      }
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `invoices/${invoice.id}`);
  }
}

export async function deleteDraftInvoice(invoiceId: string) {
  try {
    await deleteDoc(doc(db, 'invoices', invoiceId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `invoices/${invoiceId}`);
  }
}

export async function recordInvoicePayment(params: {
  ownerId: string;
  invoice: Invoice;
  amountCents: number;
  paymentDate: string;
  method: Payment['method'];
  reference?: string;
  notes?: string;
}) {
  const { ownerId, invoice, amountCents, paymentDate, method, reference, notes } = params;
  const paymentId = generateRandomId('pay');
  const nextPaid = Math.min(invoice.totalCents, invoice.amountPaidCents + amountCents);
  const nextBalance = Math.max(0, invoice.totalCents - nextPaid);
  const nextStatus: Invoice['status'] = nextBalance <= 0 ? 'paid' : 'partially_paid';

  try {
    await setDoc(doc(db, 'payments', paymentId), {
      ownerId,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      clientId: invoice.clientId,
      clientName: invoice.clientName,
      amountCents,
      paymentDate,
      method,
      reference: (reference || '').slice(0, 120),
      notes: (notes || '').slice(0, 1000),
      status: 'completed',
      createdAt: serverTimestamp(),
    });

    await updateInvoice(invoice, {
      amountPaidCents: nextPaid,
      balanceDueCents: nextBalance,
      status: nextStatus,
      ...(nextStatus === 'paid' ? { paidAt: new Date().toISOString() } : {}),
    });

    await logAuditAndNotify({
      ownerId,
      action: nextStatus === 'paid' ? 'invoice.paid' : 'invoice.partial_payment',
      entityType: 'payment',
      entityId: paymentId,
      summary: `Recorded payment of $${(amountCents / 100).toFixed(2)} for invoice ${invoice.invoiceNumber}.`,
      notification: {
        type: nextStatus === 'paid' ? 'invoice_paid' : 'partial_payment',
        title: nextStatus === 'paid' ? `Invoice ${invoice.invoiceNumber} paid` : `Partial payment received`,
        message: `$${(amountCents / 100).toFixed(2)} received from ${invoice.clientName}.`,
      },
    });
    return paymentId;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `payments/${paymentId}`);
  }
}

export async function createEstimate(
  ownerId: string,
  data: Omit<Estimate, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>,
  businessName: string,
  businessEmail: string
) {
  const id = generateRandomId('est');
  const shareToken = data.publicShareToken || generateRandomId('shr_est');
  try {
    await setDoc(doc(db, 'estimates', id), {
      ...data,
      ownerId,
      publicShareToken: shareToken,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await setDoc(doc(db, 'portalShares', shareToken), {
      ownerId,
      kind: 'estimate',
      targetId: id,
      businessName: businessName.slice(0, 160),
      businessEmail: businessEmail.slice(0, 254),
      clientName: data.clientName.slice(0, 140),
      docNumber: data.estimateNumber.slice(0, 40),
      issueDate: data.issueDate,
      dueDate: data.expirationDate,
      template: 'corporate',
      items: data.items.slice(0, 50),
      subtotalCents: data.subtotalCents,
      discountCents: data.discountCents,
      taxCents: data.taxCents,
      totalCents: data.totalCents,
      amountPaidCents: 0,
      balanceDueCents: data.totalCents,
      status: data.status,
      notes: (data.notes || '').slice(0, 2000),
      terms: (data.terms || '').slice(0, 2000),
      clientDecision: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await logAuditAndNotify({
      ownerId,
      action: 'estimate.created',
      entityType: 'estimate',
      entityId: id,
      summary: `Created estimate ${data.estimateNumber} for ${data.clientName}.`,
    });
    return { id, shareToken };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `estimates/${id}`);
  }
}

export async function updateEstimate(estimateId: string, patch: Partial<Estimate>) {
  try {
    await updateDoc(doc(db, 'estimates', estimateId), {
      ...patch,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `estimates/${estimateId}`);
  }
}

export async function deleteDraftEstimate(estimateId: string) {
  try {
    await deleteDoc(doc(db, 'estimates', estimateId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `estimates/${estimateId}`);
  }
}

export async function createExpense(
  ownerId: string,
  data: Omit<Expense, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>
) {
  const id = generateRandomId('exp');
  try {
    await setDoc(doc(db, 'expenses', id), {
      ...data,
      ownerId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await logAuditAndNotify({
      ownerId,
      action: 'expense.created',
      entityType: 'expense',
      entityId: id,
      summary: `Logged expense "${data.description}" ($${(data.amountCents / 100).toFixed(2)}).`,
    });
    return id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `expenses/${id}`);
  }
}

export async function deleteExpense(expenseId: string) {
  try {
    await deleteDoc(doc(db, 'expenses', expenseId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `expenses/${expenseId}`);
  }
}

export async function createRecurringProfile(
  ownerId: string,
  data: Omit<RecurringProfile, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>
) {
  const id = generateRandomId('rec');
  try {
    await setDoc(doc(db, 'recurringProfiles', id), {
      ...data,
      ownerId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await logAuditAndNotify({
      ownerId,
      action: 'recurring.created',
      entityType: 'recurring',
      entityId: id,
      summary: `Created ${data.frequency} recurring schedule "${data.title}" for ${data.clientName}.`,
    });
    return id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `recurringProfiles/${id}`);
  }
}

export async function updateRecurringProfile(profileId: string, patch: Partial<RecurringProfile>) {
  try {
    await updateDoc(doc(db, 'recurringProfiles', profileId), {
      ...patch,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `recurringProfiles/${profileId}`);
  }
}

export async function createReminder(
  ownerId: string,
  data: Omit<Reminder, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>
) {
  const id = generateRandomId('rem');
  try {
    await setDoc(doc(db, 'reminders', id), {
      ...data,
      ownerId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `reminders/${id}`);
  }
}

export async function updateReminder(reminderId: string, patch: Partial<Reminder>) {
  try {
    await updateDoc(doc(db, 'reminders', reminderId), {
      ...patch,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `reminders/${reminderId}`);
  }
}

export async function createVaultDocument(
  ownerId: string,
  data: Omit<VaultDocument, 'id' | 'ownerId' | 'createdAt'>
) {
  const id = generateRandomId('doc');
  try {
    await setDoc(doc(db, 'documents', id), {
      ...data,
      ownerId,
      createdAt: serverTimestamp(),
    });
    return id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `documents/${id}`);
  }
}

export async function deleteVaultDocument(docId: string) {
  try {
    await deleteDoc(doc(db, 'documents', docId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `documents/${docId}`);
  }
}

export async function markNotificationRead(notificationId: string) {
  try {
    await updateDoc(doc(db, 'notifications', notificationId), { read: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `notifications/${notificationId}`);
  }
}

export async function saveAiConversation(
  ownerId: string,
  convId: string | null,
  title: string,
  messages: AiConversation['messages']
): Promise<string> {
  const id = convId || generateRandomId('aic');
  const trimmed = messages.slice(-100);
  try {
    if (!convId) {
      await setDoc(doc(db, 'aiConversations', id), {
        ownerId,
        title: title.slice(0, 160),
        messages: trimmed,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(doc(db, 'aiConversations', id), {
        title: title.slice(0, 160),
        messages: trimmed,
        updatedAt: serverTimestamp(),
      });
    }
    return id;
  } catch (err) {
    handleFirestoreError(err, convId ? OperationType.UPDATE : OperationType.CREATE, `aiConversations/${id}`);
  }
}

export async function fetchPortalShare(shareId: string): Promise<PortalShare | null> {
  try {
    const snap = await getDoc(doc(db, 'portalShares', shareId));
    if (!snap.exists()) return null;
    return { ...(snap.data() as Omit<PortalShare, 'id'>), id: snap.id };
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `portalShares/${shareId}`);
  }
}

export async function submitEstimatePortalDecision(
  shareId: string,
  decision: 'accepted' | 'rejected',
  comment: string
) {
  try {
    await updateDoc(doc(db, 'portalShares', shareId), {
      clientDecision: decision,
      clientComment: comment.slice(0, 1000),
      decidedAt: new Date().toISOString(),
      status: decision,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `portalShares/${shareId}`);
  }
}

export async function exportAllUserData(ownerId: string) {
  const collections = [
    'clients',
    'invoices',
    'estimates',
    'payments',
    'expenses',
    'recurringProfiles',
    'reminders',
    'documents',
    'auditLogs',
  ];
  const result: Record<string, unknown[]> = {};
  for (const colName of collections) {
    const snap = await getDocs(query(collection(db, colName), where('ownerId', '==', ownerId)));
    result[colName] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
  const profileSnap = await getDoc(doc(db, 'businessProfiles', ownerId));
  result.businessProfile = profileSnap.exists() ? [profileSnap.data()] : [];
  return result;
}

export async function deleteAllUserAccountData(ownerId: string) {
  const collections = [
    'clients',
    'invoices',
    'estimates',
    'payments',
    'expenses',
    'recurringProfiles',
    'reminders',
    'notifications',
    'documents',
    'aiConversations',
    'portalShares',
  ];
  for (const colName of collections) {
    const snap = await getDocs(query(collection(db, colName), where('ownerId', '==', ownerId)));
    for (const d of snap.docs) {
      await deleteDoc(doc(db, colName, d.id)).catch(() => undefined);
    }
  }
  await deleteDoc(doc(db, 'businessProfiles', ownerId)).catch(() => undefined);
  await deleteDoc(doc(db, 'users', ownerId)).catch(() => undefined);
}

export function computeNextRunDate(currentIso: string, frequency: RecurringProfile['frequency'], customDays = 30): string {
  switch (frequency) {
    case 'weekly':
      return addDaysIso(currentIso, 7);
    case 'biweekly':
      return addDaysIso(currentIso, 14);
    case 'monthly':
      return addDaysIso(currentIso, 30);
    case 'quarterly':
      return addDaysIso(currentIso, 90);
    case 'annual':
      return addDaysIso(currentIso, 365);
    default:
      return addDaysIso(currentIso, Math.max(1, customDays));
  }
}

export async function runRecurringScheduleOnce(
  ownerId: string,
  profile: RecurringProfile,
  nextInvoiceNumber: number,
  invoiceFormat: string,
  businessName: string,
  businessEmail: string
) {
  const today = todayIso();
  // Idempotency guard: do not re-run if already executed today
  if (profile.lastRunDate === today) {
    throw new Error(`Schedule "${profile.title}" already generated an invoice today (${today}).`);
  }
  const invoiceNumber = `${invoiceFormat}${String(nextInvoiceNumber).padStart(4, '0')}`;
  const dueDate = addDaysIso(today, profile.paymentTermsDays || 15);
  const subtotalCents = profile.items.reduce((s, item) => s + item.totalCents, 0);
  const taxCents = Math.round((subtotalCents * (profile.taxRateBps || 0)) / 10000);
  const totalCents = subtotalCents + taxCents;

  const { id } = await createInvoice(
    ownerId,
    {
      clientId: profile.clientId,
      clientName: profile.clientName,
      clientEmail: profile.clientEmail,
      invoiceNumber,
      issueDate: today,
      dueDate,
      status: profile.autoNotify ? 'sent' : 'draft',
      template: 'corporate',
      items: profile.items,
      subtotalCents,
      discountCents: 0,
      taxRateBps: profile.taxRateBps || 0,
      taxCents,
      totalCents,
      amountPaidCents: 0,
      balanceDueCents: totalCents,
      notes: `Generated from recurring schedule: ${profile.title}`,
      ...(profile.autoNotify ? { sentAt: new Date().toISOString() } : {}),
    },
    businessName,
    businessEmail
  );

  const nextRun = computeNextRunDate(today, profile.frequency, profile.customIntervalDays);
  await updateRecurringProfile(profile.id, {
    lastRunDate: today,
    nextRunDate: nextRun,
    runCount: (profile.runCount || 0) + 1,
  });

  await updateDoc(doc(db, 'businessProfiles', ownerId), {
    nextInvoiceNumber: nextInvoiceNumber + 1,
    updatedAt: serverTimestamp(),
  });

  return { invoiceId: id, invoiceNumber };
}

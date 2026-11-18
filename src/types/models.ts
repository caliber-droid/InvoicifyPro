export type PlanId = 'free' | 'starter' | 'pro' | 'business';
export type BillingCycle = 'monthly' | 'annual';
export type InvoiceStatus =
  | 'draft'
  | 'sent'
  | 'viewed'
  | 'partially_paid'
  | 'paid'
  | 'overdue'
  | 'void'
  | 'refunded';
export type InvoiceTemplate =
  | 'minimal'
  | 'corporate'
  | 'modern'
  | 'creative'
  | 'elegant'
  | 'professional';
export type EstimateStatus =
  | 'draft'
  | 'sent'
  | 'viewed'
  | 'accepted'
  | 'rejected'
  | 'expired'
  | 'converted';
export type PaymentMethod =
  | 'credit_card'
  | 'debit_card'
  | 'ach'
  | 'paypal'
  | 'cash'
  | 'check'
  | 'other';
export type ReminderTone = 'friendly' | 'professional' | 'polite' | 'firm' | 'final_notice';
export type RecurringFrequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annual' | 'custom';

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
}

export interface UserAccount {
  uid: string;
  email: string;
  displayName: string;
  role: 'owner' | 'admin';
  onboarded: boolean;
  plan: PlanId;
  billingCycle: BillingCycle;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface BusinessProfile {
  ownerId: string;
  businessName: string;
  ownerName: string;
  businessEmail: string;
  phone?: string;
  website?: string;
  address?: string;
  logoDataUrl?: string;
  businessType: string;
  industry?: string;
  taxIdLast4?: string;
  defaultCurrency: 'USD';
  defaultPaymentTerms: string;
  invoiceNumberFormat: string;
  nextInvoiceNumber: number;
  defaultTaxRateBps: number;
  taxLabel?: string;
  preferredPaymentMethods?: string[];
  timezone?: string;
  defaultDueDays: number;
  reminderSchedule?: {
    beforeDue3Days: boolean;
    onDueDate: boolean;
    overdue3Days: boolean;
    overdue7Days: boolean;
    overdue14Days: boolean;
  };
  notificationPrefs?: {
    invoicePaid: boolean;
    invoiceOverdue: boolean;
    estimateDecision: boolean;
    recurringGenerated: boolean;
  };
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Client {
  id: string;
  ownerId: string;
  name: string;
  companyName?: string;
  email: string;
  phone?: string;
  billingAddress?: string;
  website?: string;
  category?: string;
  notes?: string;
  archived: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Invoice {
  id: string;
  ownerId: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  template: InvoiceTemplate;
  items: LineItem[];
  subtotalCents: number;
  discountCents: number;
  taxRateBps: number;
  taxCents: number;
  totalCents: number;
  amountPaidCents: number;
  balanceDueCents: number;
  paymentInstructions?: string;
  notes?: string;
  terms?: string;
  publicShareToken?: string;
  sentAt?: string;
  paidAt?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Estimate {
  id: string;
  ownerId: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  estimateNumber: string;
  issueDate: string;
  expirationDate: string;
  status: EstimateStatus;
  items: LineItem[];
  optionalItems?: LineItem[];
  subtotalCents: number;
  discountCents: number;
  taxRateBps: number;
  taxCents: number;
  totalCents: number;
  notes?: string;
  terms?: string;
  clientComment?: string;
  convertedInvoiceId?: string;
  publicShareToken?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Payment {
  id: string;
  ownerId: string;
  invoiceId: string;
  invoiceNumber: string;
  clientId: string;
  clientName: string;
  amountCents: number;
  paymentDate: string;
  method: PaymentMethod;
  reference?: string;
  notes?: string;
  status: 'completed' | 'refunded';
  createdAt?: unknown;
}

export interface Expense {
  id: string;
  ownerId: string;
  description: string;
  amountCents: number;
  taxCents: number;
  date: string;
  category: string;
  vendor: string;
  paymentMethod: string;
  notes?: string;
  receiptName?: string;
  receiptDataUrl?: string;
  aiExtracted: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface RecurringProfile {
  id: string;
  ownerId: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  title: string;
  frequency: RecurringFrequency;
  customIntervalDays?: number;
  startDate: string;
  endDate?: string;
  nextRunDate: string;
  lastRunDate?: string;
  paymentTermsDays: number;
  items: LineItem[];
  taxRateBps: number;
  totalCents: number;
  status: 'active' | 'paused' | 'cancelled';
  autoNotify: boolean;
  runCount: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Reminder {
  id: string;
  ownerId: string;
  invoiceId: string;
  invoiceNumber: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  tone: ReminderTone;
  subject: string;
  body: string;
  scheduledFor: string;
  status: 'scheduled' | 'sent' | 'cancelled';
  deliveryMethod?: string;
  sentAt?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AppNotification {
  id: string;
  ownerId: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  entityType?: string;
  entityId?: string;
  createdAt?: unknown;
}

export interface VaultDocument {
  id: string;
  ownerId: string;
  title: string;
  category: 'invoice' | 'estimate' | 'receipt' | 'payment_confirmation' | 'agreement' | 'supporting';
  clientId?: string;
  clientName?: string;
  relatedId?: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  fileDataUrl?: string;
  createdAt?: unknown;
}

export interface AiChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  proposedAction?: Record<string, unknown> | null;
}

export interface AiConversation {
  id: string;
  ownerId: string;
  title: string;
  messages: AiChatMessage[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AuditLog {
  id: string;
  ownerId: string;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  createdAt?: unknown;
}

export interface PortalShare {
  id: string;
  ownerId: string;
  kind: 'invoice' | 'estimate';
  targetId: string;
  businessName: string;
  businessEmail?: string;
  clientName: string;
  docNumber: string;
  issueDate: string;
  dueDate: string;
  template?: string;
  items: LineItem[];
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  amountPaidCents: number;
  balanceDueCents: number;
  status: string;
  notes?: string;
  terms?: string;
  clientDecision?: 'pending' | 'accepted' | 'rejected';
  clientComment?: string;
  decidedAt?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PlanConfig {
  id: PlanId;
  name: string;
  audience: string;
  monthlyPrice: number;
  annualPricePerMonth: number;
  invoicesPerMonth: number | null;
  estimatesPerMonth: number | null;
  maxClients: number | null;
  aiEnabled: boolean;
  recurringEnabled: boolean;
  teamEnabled: boolean;
  highlights: string[];
}

export const PLAN_CONFIGS: Record<PlanId, PlanConfig> = {
  free: {
    id: 'free',
    name: 'Free',
    audience: 'For solo freelancers starting out',
    monthlyPrice: 0,
    annualPricePerMonth: 0,
    invoicesPerMonth: 3,
    estimatesPerMonth: 2,
    maxClients: 5,
    aiEnabled: false,
    recurringEnabled: false,
    teamEnabled: false,
    highlights: [
      '3 invoices per month',
      '2 estimates per month',
      'Up to 5 active clients',
      'Standard invoice templates',
      'Manual payment tracking',
    ],
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    audience: 'For active independent contractors',
    monthlyPrice: 12,
    annualPricePerMonth: 10,
    invoicesPerMonth: 30,
    estimatesPerMonth: null,
    maxClients: 50,
    aiEnabled: true,
    recurringEnabled: false,
    teamEnabled: false,
    highlights: [
      '30 invoices per month',
      'Unlimited estimates',
      'Up to 50 clients',
      'AI invoice & reminder writer',
      'PDF downloads & expense tracking',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    audience: 'For growing service businesses',
    monthlyPrice: 29,
    annualPricePerMonth: 24,
    invoicesPerMonth: null,
    estimatesPerMonth: null,
    maxClients: null,
    aiEnabled: true,
    recurringEnabled: true,
    teamEnabled: false,
    highlights: [
      'Unlimited invoices (fair use)',
      'Unlimited estimates & clients',
      'Recurring billing & automated schedules',
      'Pilot AI financial assistant & receipt OCR',
      'Custom branding & cash flow forecasting',
    ],
  },
  business: {
    id: 'business',
    name: 'Business',
    audience: 'For agencies & multi-person teams',
    monthlyPrice: 59,
    annualPricePerMonth: 49,
    invoicesPerMonth: null,
    estimatesPerMonth: null,
    maxClients: null,
    aiEnabled: true,
    recurringEnabled: true,
    teamEnabled: true,
    highlights: [
      'Everything in Pro',
      'Multi-member team access',
      'Role-based permissions & audit history',
      'Advanced financial & monthly PDF reports',
      'Priority onboarding & custom templates',
    ],
  },
};

export const EXPENSE_CATEGORIES = [
  'Advertising',
  'Software',
  'Equipment',
  'Office Supplies',
  'Travel',
  'Meals',
  'Transportation',
  'Contractors',
  'Utilities',
  'Other',
] as const;

export const BUSINESS_TYPES = [
  'Sole Proprietorship',
  'LLC',
  'Corporation',
  'Partnership',
  'Independent Contractor',
  'Freelancer',
  'Other',
] as const;

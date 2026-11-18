import { FunctionDeclaration, GoogleGenAI, Type } from '@google/genai';

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in server environment.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export interface ClientSummary {
  id: string;
  name: string;
  companyName?: string;
  email: string;
}

export async function generateInvoiceDraft(params: {
  prompt: string;
  clients: ClientSummary[];
  defaultTaxRateBps: number;
  defaultDueDays: number;
}) {
  const ai = getClient();
  const clientsJson = JSON.stringify(params.clients.slice(0, 50));

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Extract structured invoice line items and metadata from this request:
"${params.prompt}"

Known existing clients (match by name/company ONLY if explicitly referenced; NEVER invent an email address):
${clientsJson}

Business defaults:
- Default due days if not specified in request: ${params.defaultDueDays}
- Default tax rate (basis points, e.g. 825 = 8.25%): ${params.defaultTaxRateBps}`,
    config: {
      systemInstruction:
        'You are a precise US billing extraction engine. Extract invoice line items, quantities, unit prices in integer cents, client match, due days, and notes from the user prompt. Rules: 1) Never invent client emails, addresses, or prices not mentioned in the prompt. 2) Convert dollar prices to exact integer cents (e.g. $75.00 -> 7500). 3) Include additional expenses or fees as line items if requested. 4) If tax is not mentioned, set applyDefaultTax to false unless clearly implied, or leave taxRateBps null so the user can review.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          matchedClientId: {
            type: Type.STRING,
            description: 'ID of matching client from known clients list, or empty string if none matches.',
          },
          clientName: {
            type: Type.STRING,
            description: 'Client name extracted from prompt.',
          },
          clientEmail: {
            type: Type.STRING,
            description: 'Client email from known clients list or prompt, empty string if unknown.',
          },
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                description: { type: Type.STRING },
                quantity: { type: Type.NUMBER },
                unitPriceCents: { type: Type.INTEGER },
              },
              required: ['description', 'quantity', 'unitPriceCents'],
            },
          },
          dueDays: {
            type: Type.INTEGER,
            description: 'Number of days until due date.',
          },
          applyDefaultTax: {
            type: Type.BOOLEAN,
          },
          notes: {
            type: Type.STRING,
          },
          warnings: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Any missing details the user should verify before issuing.',
          },
        },
        required: ['matchedClientId', 'clientName', 'clientEmail', 'items', 'dueDays', 'applyDefaultTax', 'notes', 'warnings'],
      },
    },
  });

  const text = (response.text ?? '{}').trim();
  return JSON.parse(text);
}

export async function runInvoiceHealthCheck(params: {
  invoice: Record<string, unknown>;
  businessName: string;
}) {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Audit this US business invoice draft before sending for completeness, clarity, math accuracy, and payment readiness.
Business: ${params.businessName}
Invoice Data:
${JSON.stringify(params.invoice)}`,
    config: {
      systemInstruction:
        'You are an invoice quality reviewer. Identify missing client info, missing due dates, ambiguous line item descriptions, unusual discounts, missing payment instructions, or potential math discrepancies. Return concise, actionable findings.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          readinessLabel: {
            type: Type.STRING,
            description: 'One of: Ready to Send, Needs Review, Action Required',
          },
          summary: { type: Type.STRING },
          checks: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                severity: {
                  type: Type.STRING,
                  description: 'One of: pass, warning, critical',
                },
                title: { type: Type.STRING },
                detail: { type: Type.STRING },
                suggestion: { type: Type.STRING },
              },
              required: ['severity', 'title', 'detail', 'suggestion'],
            },
          },
        },
        required: ['readinessLabel', 'summary', 'checks'],
      },
    },
  });

  const text = (response.text ?? '{}').trim();
  return JSON.parse(text);
}

export async function generateReminderDraft(params: {
  clientName: string;
  invoiceNumber: string;
  balanceDueFormatted: string;
  dueDate: string;
  daysDelta: number;
  tone: string;
  previousRemindersCount: number;
  businessName: string;
  ownerName: string;
}) {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Draft a personalized payment reminder email.
Business: ${params.businessName} (Sender: ${params.ownerName})
Client: ${params.clientName}
Invoice Number: ${params.invoiceNumber}
Outstanding Balance: ${params.balanceDueFormatted}
Due Date: ${params.dueDate}
Days relative to due date (positive = days overdue, negative = days until due): ${params.daysDelta}
Requested Tone: ${params.tone}
Previous Reminders Sent: ${params.previousRemindersCount}`,
    config: {
      systemInstruction:
        'Write a clear, courteous, effective American English payment reminder email appropriate to the requested tone. Never fabricate legal threats, credit reporting claims, or collection agency actions. Keep it crisp and respectful.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          subject: { type: Type.STRING },
          body: { type: Type.STRING },
          recommendedTimingNote: { type: Type.STRING },
        },
        required: ['subject', 'body', 'recommendedTimingNote'],
      },
    },
  });

  const text = (response.text ?? '{}').trim();
  return JSON.parse(text);
}

export async function extractReceiptData(params: {
  base64Data: string;
  mimeType: string;
}) {
  const ai = getClient();
  const imagePart = {
    inlineData: {
      mimeType: params.mimeType,
      data: params.base64Data,
    },
  };
  const textPart = {
    text: 'Extract the merchant/vendor name, purchase date (YYYY-MM-DD), total amount in integer cents, tax amount in integer cents, suggested US business expense category, and a short description from this receipt.',
  };

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: { parts: [imagePart, textPart] },
    config: {
      systemInstruction:
        'Extract receipt fields accurately for user review. Valid categories: Advertising, Software, Equipment, Office Supplies, Travel, Meals, Transportation, Contractors, Utilities, Other. Return integer cents for amounts. If a field is illegible, set it to empty string or 0 and note it in confidenceNote.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          vendor: { type: Type.STRING },
          date: { type: Type.STRING },
          amountCents: { type: Type.INTEGER },
          taxCents: { type: Type.INTEGER },
          category: { type: Type.STRING },
          description: { type: Type.STRING },
          paymentMethod: { type: Type.STRING },
          confidenceNote: { type: Type.STRING },
        },
        required: ['vendor', 'date', 'amountCents', 'taxCents', 'category', 'description', 'paymentMethod', 'confidenceNote'],
      },
    },
  });

  const text = (response.text ?? '{}').trim();
  return JSON.parse(text);
}

const getPortfolioSummaryTool: FunctionDeclaration = {
  name: 'getPortfolioSummary',
  description: 'Retrieve exact revenue, collected payments, outstanding balances, overdue amounts, and expense totals from the user stored records.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      period: {
        type: Type.STRING,
        description: 'Time filter: all_time, this_month, overdue_only',
      },
    },
    required: ['period'],
  },
};

const listMatchingInvoicesTool: FunctionDeclaration = {
  name: 'listMatchingInvoices',
  description: 'Find invoices matching a status filter (e.g. overdue, unpaid, due_this_week, paid) or client name.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      statusFilter: { type: Type.STRING },
      clientQuery: { type: Type.STRING },
    },
    required: ['statusFilter'],
  },
};

const getTopClientsTool: FunctionDeclaration = {
  name: 'getTopClients',
  description: 'Return top clients ranked by total billed or outstanding balance.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      sortBy: {
        type: Type.STRING,
        description: 'billed or outstanding',
      },
      limit: { type: Type.INTEGER },
    },
    required: ['sortBy', 'limit'],
  },
};

const proposeDocumentActionTool: FunctionDeclaration = {
  name: 'proposeDocumentAction',
  description: 'Propose creating an invoice draft, estimate draft, or payment reminder draft that requires explicit user confirmation before saving or sending.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      actionType: {
        type: Type.STRING,
        description: 'create_invoice_draft | create_estimate_draft | draft_payment_reminder',
      },
      clientName: { type: Type.STRING },
      invoiceNumber: { type: Type.STRING },
      amountDollars: { type: Type.NUMBER },
      description: { type: Type.STRING },
      dueDays: { type: Type.INTEGER },
      tone: { type: Type.STRING },
    },
    required: ['actionType', 'clientName', 'description'],
  },
};

export interface PilotBusinessContext {
  businessName: string;
  todayIso: string;
  clients: Array<{ id: string; name: string; companyName?: string; email: string }>;
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    clientId: string;
    clientName: string;
    status: string;
    issueDate: string;
    dueDate: string;
    totalCents: number;
    amountPaidCents: number;
    balanceDueCents: number;
  }>;
  estimates: Array<{
    id: string;
    estimateNumber: string;
    clientName: string;
    status: string;
    totalCents: number;
    expirationDate: string;
  }>;
  expenses: Array<{
    id: string;
    description: string;
    vendor: string;
    category: string;
    date: string;
    amountCents: number;
  }>;
  payments: Array<{
    id: string;
    invoiceNumber: string;
    clientName: string;
    amountCents: number;
    paymentDate: string;
    method: string;
    status: string;
  }>;
}

function executePilotTool(name: string, args: Record<string, unknown>, ctx: PilotBusinessContext) {
  const fmt = (cents: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

  if (name === 'getPortfolioSummary') {
    const period = String(args.period || 'all_time');
    const monthPrefix = ctx.todayIso.slice(0, 7);
    const activeInvoices = ctx.invoices.filter((i) => i.status !== 'void' && i.status !== 'refunded');
    const filteredInvoices =
      period === 'this_month'
        ? activeInvoices.filter((i) => i.issueDate.startsWith(monthPrefix))
        : period === 'overdue_only'
          ? activeInvoices.filter((i) => i.status === 'overdue' || (i.balanceDueCents > 0 && i.dueDate < ctx.todayIso))
          : activeInvoices;

    const totalInvoicedCents = filteredInvoices.reduce((s, i) => s + i.totalCents, 0);
    const outstandingCents = filteredInvoices.reduce((s, i) => s + i.balanceDueCents, 0);
    const collectedCents = ctx.payments
      .filter((p) => p.status === 'completed' && (period !== 'this_month' || p.paymentDate.startsWith(monthPrefix)))
      .reduce((s, p) => s + p.amountCents, 0);
    const expensesCents = ctx.expenses
      .filter((e) => period !== 'this_month' || e.date.startsWith(monthPrefix))
      .reduce((s, e) => s + e.amountCents, 0);

    return {
      period,
      invoiceCount: filteredInvoices.length,
      totalInvoiced: fmt(totalInvoicedCents),
      collectedRevenue: fmt(collectedCents),
      outstandingBalance: fmt(outstandingCents),
      totalExpenses: fmt(expensesCents),
      operatingCashFlow: fmt(collectedCents - expensesCents),
    };
  }

  if (name === 'listMatchingInvoices') {
    const statusFilter = String(args.statusFilter || 'all').toLowerCase();
    const clientQuery = String(args.clientQuery || '').toLowerCase();
    const weekAhead = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

    const matches = ctx.invoices.filter((inv) => {
      if (clientQuery && !inv.clientName.toLowerCase().includes(clientQuery) && !inv.invoiceNumber.toLowerCase().includes(clientQuery)) {
        return false;
      }
      if (statusFilter === 'overdue') {
        return inv.status === 'overdue' || (inv.balanceDueCents > 0 && inv.dueDate < ctx.todayIso && inv.status !== 'void' && inv.status !== 'draft');
      }
      if (statusFilter === 'unpaid') {
        return inv.balanceDueCents > 0 && inv.status !== 'void';
      }
      if (statusFilter === 'due_this_week') {
        return inv.balanceDueCents > 0 && inv.dueDate >= ctx.todayIso && inv.dueDate <= weekAhead && inv.status !== 'void';
      }
      if (statusFilter === 'paid') {
        return inv.status === 'paid';
      }
      return true;
    });

    return {
      count: matches.length,
      invoices: matches.slice(0, 20).map((i) => ({
        invoiceNumber: i.invoiceNumber,
        clientName: i.clientName,
        status: i.status,
        dueDate: i.dueDate,
        total: fmt(i.totalCents),
        balanceDue: fmt(i.balanceDueCents),
      })),
    };
  }

  if (name === 'getTopClients') {
    const sortBy = String(args.sortBy || 'billed');
    const limit = Math.min(Number(args.limit || 5), 10);
    const agg = new Map<string, { name: string; billedCents: number; paidCents: number; outstandingCents: number; invoiceCount: number }>();

    for (const c of ctx.clients) {
      agg.set(c.id, { name: c.name, billedCents: 0, paidCents: 0, outstandingCents: 0, invoiceCount: 0 });
    }
    for (const inv of ctx.invoices) {
      if (inv.status === 'void') continue;
      const entry = agg.get(inv.clientId) || { name: inv.clientName, billedCents: 0, paidCents: 0, outstandingCents: 0, invoiceCount: 0 };
      entry.billedCents += inv.totalCents;
      entry.paidCents += inv.amountPaidCents;
      entry.outstandingCents += inv.balanceDueCents;
      entry.invoiceCount += 1;
      agg.set(inv.clientId, entry);
    }

    const sorted = Array.from(agg.values())
      .sort((a, b) => (sortBy === 'outstanding' ? b.outstandingCents - a.outstandingCents : b.billedCents - a.billedCents))
      .slice(0, limit);

    return {
      clients: sorted.map((c) => ({
        name: c.name,
        totalBilled: fmt(c.billedCents),
        totalPaid: fmt(c.paidCents),
        outstandingBalance: fmt(c.outstandingCents),
        invoiceCount: c.invoiceCount,
      })),
    };
  }

  if (name === 'proposeDocumentAction') {
    return {
      queuedForUserConfirmation: true,
      proposal: args,
    };
  }

  return { error: 'Unknown tool' };
}

export async function runPilotAssistant(params: {
  message: string;
  history: Array<{ role: 'user' | 'model'; text: string }>;
  context: PilotBusinessContext;
}) {
  const ai = getClient();
  const tools = [
    {
      functionDeclarations: [
        getPortfolioSummaryTool,
        listMatchingInvoicesTool,
        getTopClientsTool,
        proposeDocumentActionTool,
      ],
    },
  ];

  const systemInstruction = `You are Pilot AI, the financial operations assistant inside InvoicifyPro for "${params.context.businessName}". Today's date is ${params.context.todayIso}.
Rules:
1. NEVER fabricate or guess financial figures, invoices, clients, or payment dates. ALWAYS call the provided tools to inspect the authenticated user's actual stored records.
2. When the user asks to create an invoice, estimate, or payment reminder, call proposeDocumentAction so the user can review and confirm before anything is saved or sent.
3. Keep responses concise, structured, and grounded in USD ($).`;

  const contents: Array<Record<string, unknown>> = [
    ...params.history.slice(-12).map((m) => ({
      role: m.role,
      parts: [{ text: m.text }],
    })),
    { role: 'user', parts: [{ text: params.message }] },
  ];

  let proposedAction: Record<string, unknown> | null = null;
  let currentResponse = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: contents as any,
    config: { systemInstruction, tools },
  });

  // Up to 3 tool-calling turns
  for (let step = 0; step < 3; step++) {
    const calls = currentResponse.functionCalls;
    if (!calls || calls.length === 0) break;

    const prevContent = currentResponse.candidates?.[0]?.content;
    if (!prevContent) break;

    const functionResponseParts = calls.map((call) => {
      const result = executePilotTool(call.name || '', (call.args || {}) as Record<string, unknown>, params.context);
      if (call.name === 'proposeDocumentAction') {
        proposedAction = (call.args || {}) as Record<string, unknown>;
      }
      return {
        functionResponse: {
          id: call.id,
          name: call.name,
          response: result,
        },
      };
    });

    contents.push(prevContent as any);
    contents.push({ role: 'user', parts: functionResponseParts });

    currentResponse = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: contents as any,
      config: { systemInstruction, tools },
    });
  }

  return {
    reply: currentResponse.text || 'I reviewed your business records. Let me know how you would like to proceed.',
    proposedAction,
  };
}

import PDFDocument from 'pdfkit';

export interface PdfLineItem {
  description: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
}

export interface PdfDocumentPayload {
  kind: 'invoice' | 'estimate' | 'receipt';
  template?: 'minimal' | 'corporate' | 'modern' | 'creative' | 'elegant' | 'professional';
  docNumber: string;
  issueDate: string;
  dueDate: string;
  status: string;
  business: {
    businessName: string;
    ownerName?: string;
    businessEmail: string;
    phone?: string;
    address?: string;
    website?: string;
  };
  client: {
    name: string;
    companyName?: string;
    email: string;
    billingAddress?: string;
  };
  items: PdfLineItem[];
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  taxLabel?: string;
  totalCents: number;
  amountPaidCents: number;
  balanceDueCents: number;
  paymentInstructions?: string;
  notes?: string;
  terms?: string;
  paymentMeta?: {
    method: string;
    reference?: string;
    paymentDate: string;
  };
  watermark?: {
    text: string;
    opacityPct?: number;
    angle?: number;
    color?: string;
  } | null;
}

export interface MonthlyReportPayload {
  businessName: string;
  monthLabel: string;
  generatedAt: string;
  metrics: {
    totalInvoicedCents: number;
    collectedCents: number;
    outstandingCents: number;
    overdueCents: number;
    expensesCents: number;
    netCashFlowCents: number;
    prevMonthCollectedCents: number;
    avgCollectionDays: number;
  };
  topClients: Array<{ name: string; billedCents: number; paidCents: number }>;
  expenseBreakdown: Array<{ category: string; amountCents: number }>;
}

const fmtUsd = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

const TEMPLATE_COLORS: Record<string, { primary: string; accent: string; surface: string }> = {
  minimal: { primary: '#172033', accent: '#475569', surface: '#F8FAFC' },
  corporate: { primary: '#172B4D', accent: '#2563EB', surface: '#F1F5F9' },
  modern: { primary: '#0F172A', accent: '#0284C7', surface: '#F0F9FF' },
  creative: { primary: '#1E293B', accent: '#2563EB', surface: '#EFF6FF' },
  elegant: { primary: '#172B4D', accent: '#1E3A8A', surface: '#F8FAFC' },
  professional: { primary: '#172B4D', accent: '#16A34A', surface: '#F0FDF4' },
};

function inferPdfWatermarkColor(text: string, status: string): string {
  const s = status.toLowerCase();
  const t = text.toUpperCase();
  if (s === 'paid' || s === 'accepted' || t.includes('PAID') || t.includes('APPROVED')) {
    return '#16A34A';
  }
  if (
    s === 'overdue' ||
    s === 'void' ||
    s === 'rejected' ||
    t.includes('OVERDUE') ||
    t.includes('VOID') ||
    t.includes('FINAL') ||
    t.includes('PAST DUE')
  ) {
    return '#DC2626';
  }
  if (s === 'partially_paid' || t.includes('PARTIAL')) {
    return '#D97706';
  }
  if (s === 'draft' || t.includes('DRAFT') || t.includes('COPY')) {
    return '#64748B';
  }
  return '#172B4D';
}

function drawWatermarkOnPage(
  doc: PDFKit.PDFDocument,
  watermark: NonNullable<PdfDocumentPayload['watermark']>,
  status: string
) {
  const cleanText = String(watermark.text || '').trim().slice(0, 40).toUpperCase();
  if (!cleanText) return;

  const opacity = Math.max(0.05, Math.min(0.5, Number(watermark.opacityPct ?? 14) / 100));
  const angle = Math.max(-60, Math.min(60, Math.round(Number(watermark.angle ?? -32))));
  const rawColor = typeof watermark.color === 'string' ? watermark.color.trim() : 'auto';
  const color =
    rawColor && rawColor !== 'auto' && /^#[0-9a-fA-F]{3,8}$/.test(rawColor)
      ? rawColor
      : inferPdfWatermarkColor(cleanText, status);

  doc.save();
  const cx = doc.page.width / 2;
  const cy = doc.page.height / 2;
  doc.translate(cx, cy);
  doc.rotate(angle, { origin: [0, 0] });

  const len = cleanText.length;
  const fontSize = len <= 6 ? 86 : len <= 12 ? 64 : len <= 20 ? 46 : 32;
  doc.font('Helvetica-Bold').fontSize(fontSize);
  doc.fillColor(color).fillOpacity(opacity);
  const textWidth = doc.widthOfString(cleanText);
  const textHeight = doc.currentLineHeight();
  doc.text(cleanText, -textWidth / 2, -textHeight / 2, {
    lineBreak: false,
  });
  doc.restore();
}

export function generateDocumentPdf(payload: PdfDocumentPayload): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const docHeading =
      payload.kind === 'estimate' ? 'ESTIMATE' : payload.kind === 'receipt' ? 'PAYMENT RECEIPT' : 'INVOICE';
    const doc = new PDFDocument({
      size: 'LETTER',
      margin: 48,
      bufferPages: true,
      info: {
        Title: `${docHeading} #${payload.docNumber}`,
        Author: payload.business.businessName || 'InvoicifyPro',
        Subject: `${docHeading} for ${payload.client.name}`,
      },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const tpl = payload.template || 'corporate';
    const palette = TEMPLATE_COLORS[tpl] || TEMPLATE_COLORS.corporate;

    const bizLines = [
      payload.business.businessEmail,
      payload.business.phone,
      payload.business.address,
      payload.business.website,
    ].filter(Boolean);

    if (tpl === 'minimal') {
      doc.rect(0, 0, doc.page.width, 108).fill('#FFFFFF');
      doc.moveTo(48, 104).lineTo(564, 104).strokeColor('#CBD5E1').lineWidth(1).stroke();
      doc.fillColor('#172033').font('Helvetica-Bold').fontSize(20).text(payload.business.businessName || 'InvoicifyPro Business', 48, 34);
      doc.font('Helvetica').fontSize(9.5).fillColor('#64748B').text(bizLines.join('  •  '), 48, 62, { width: 340 });
      doc.fillColor('#94A3B8').font('Helvetica-Bold').fontSize(9).text(docHeading, 400, 30, { align: 'right', width: 164 });
      doc.fillColor('#172033').font('Helvetica-Bold').fontSize(18).text(`#${payload.docNumber}`, 400, 44, { align: 'right', width: 164 });
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#64748B').text(payload.status.toUpperCase().replace('_', ' '), 400, 68, {
        align: 'right',
        width: 164,
      });
    } else if (tpl === 'creative') {
      doc.rect(0, 0, doc.page.width, 110).fill('#EFF6FF');
      doc.moveTo(0, 110).lineTo(doc.page.width, 110).strokeColor('#BFDBFE').lineWidth(1).stroke();
      doc.rect(48, 30, 5, 56).fill('#2563EB');
      doc.fillColor('#172B4D').font('Helvetica-Bold').fontSize(20).text(payload.business.businessName || 'InvoicifyPro Business', 64, 34);
      doc.font('Helvetica').fontSize(9.5).fillColor('#475569').text(bizLines.join('  •  '), 64, 62, { width: 320 });
      doc.roundedRect(434, 30, 130, 26, 6).fill('#1E293B');
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(11).text(`${docHeading} #${payload.docNumber}`, 438, 38, {
        align: 'center',
        width: 122,
      });
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#2563EB').text(payload.status.toUpperCase().replace('_', ' '), 400, 66, {
        align: 'right',
        width: 164,
      });
    } else if (tpl === 'modern') {
      doc.rect(0, 0, doc.page.width, 112).fill('#0F172A');
      doc.rect(0, 0, doc.page.width, 6).fill('#0284C7');
      doc.fillColor('#38BDF8').font('Helvetica-Bold').fontSize(8).text('USD BILLING STATEMENT', 48, 26);
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(19).text(payload.business.businessName || 'InvoicifyPro Business', 48, 40);
      doc.font('Helvetica').fontSize(9.5).fillColor('#CBD5E1').text(bizLines.join('  •  '), 48, 66, { width: 332 });
      doc.roundedRect(410, 26, 154, 64, 6).fillAndStroke('#1E293B', '#334155');
      doc.fillColor('#7DD3FC').font('Helvetica-Bold').fontSize(8.5).text(docHeading, 420, 35, { align: 'right', width: 134 });
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(14).text(`#${payload.docNumber}`, 420, 49, { align: 'right', width: 134 });
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#CBD5E1').text(payload.status.toUpperCase().replace('_', ' '), 420, 70, {
        align: 'right',
        width: 134,
      });
    } else {
      // Corporate / Fallback header band
      doc.rect(0, 0, doc.page.width, 108).fill(palette.primary);
      doc.rect(0, 105, doc.page.width, 3).fill(palette.accent);
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(20).text(payload.business.businessName || 'InvoicifyPro Business', 48, 34);
      doc.font('Helvetica').fontSize(9.5).fillColor('#CBD5E1').text(bizLines.join('  •  '), 48, 62, { width: 340 });
      doc.fillColor('#93C5FD').font('Helvetica-Bold').fontSize(9).text(docHeading, 400, 30, { align: 'right', width: 164 });
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(18).text(`#${payload.docNumber}`, 400, 44, { align: 'right', width: 164 });
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#E2E8F0').text(payload.status.toUpperCase().replace('_', ' '), 400, 68, {
        align: 'right',
        width: 164,
      });
    }

    // Bill To & Dates
    let y = 136;
    doc.fillColor('#64748B').font('Helvetica-Bold').fontSize(8.5).text(payload.kind === 'receipt' ? 'RECEIVED FROM' : 'BILL TO', 48, y);
    doc.fillColor('#172033').font('Helvetica-Bold').fontSize(11).text(payload.client.name, 48, y + 14);
    doc.font('Helvetica').fontSize(9.5).fillColor('#475569');
    let clientY = y + 29;
    if (payload.client.companyName) {
      doc.text(payload.client.companyName, 48, clientY);
      clientY += 13;
    }
    if (payload.client.email) {
      doc.text(payload.client.email, 48, clientY);
      clientY += 13;
    }
    if (payload.client.billingAddress) {
      doc.text(payload.client.billingAddress, 48, clientY, { width: 250 });
      clientY += doc.heightOfString(payload.client.billingAddress, { width: 250 }) + 4;
    }

    // Metadata box on right
    if (tpl === 'minimal') {
      doc.roundedRect(360, y - 4, 204, 72, 4).strokeColor('#E2E8F0').lineWidth(0.75).stroke();
    } else if (tpl === 'modern') {
      doc.roundedRect(360, y - 4, 204, 72, 6).fillAndStroke('#F0F9FF', '#BAE6FD');
    } else if (tpl === 'creative') {
      doc.roundedRect(360, y - 4, 204, 72, 6).fillAndStroke('#EFF6FF', '#BFDBFE');
    } else {
      doc.roundedRect(360, y - 4, 204, 72, 6).fill(palette.surface);
    }
    doc.fillColor('#64748B').font('Helvetica').fontSize(8.5);
    doc.text('Issue Date', 374, y + 8);
    doc.text(payload.kind === 'estimate' ? 'Expires' : payload.kind === 'receipt' ? 'Payment Date' : 'Due Date', 374, y + 26);
    doc.text('Currency', 374, y + 44);

    doc.fillColor('#172033').font('Helvetica-Bold').fontSize(9);
    doc.text(payload.issueDate, 450, y + 8, { align: 'right', width: 100 });
    doc.text(payload.paymentMeta?.paymentDate || payload.dueDate, 450, y + 26, { align: 'right', width: 100 });
    doc.text('USD ($)', 450, y + 44, { align: 'right', width: 100 });

    y = Math.max(clientY + 24, 228);

    // Table header
    if (tpl === 'minimal') {
      doc.moveTo(48, y + 24).lineTo(564, y + 24).strokeColor('#CBD5E1').lineWidth(1).stroke();
    } else {
      doc.roundedRect(48, y, 516, 26, 4).fill(palette.surface);
    }
    doc.fillColor(tpl === 'modern' ? '#0F172A' : tpl === 'creative' ? '#172B4D' : '#475569').font('Helvetica-Bold').fontSize(8.5);
    doc.text('DESCRIPTION', 58, y + 8);
    doc.text('QTY', 330, y + 8, { width: 50, align: 'right' });
    doc.text('UNIT PRICE', 392, y + 8, { width: 76, align: 'right' });
    doc.text('AMOUNT', 476, y + 8, { width: 78, align: 'right' });
    y += 32;

    // Table rows
    for (const item of payload.items) {
      if (y > 650) {
        doc.addPage();
        y = 48;
      }
      doc.fillColor('#172033').font('Helvetica').fontSize(9.5).text(item.description, 58, y, { width: 264 });
      const rowHeight = Math.max(20, doc.heightOfString(item.description, { width: 264 }) + 8);
      doc.text(String(item.quantity), 330, y, { width: 50, align: 'right' });
      doc.text(fmtUsd(item.unitPriceCents), 392, y, { width: 76, align: 'right' });
      doc.font('Helvetica-Bold').text(fmtUsd(item.totalCents), 476, y, { width: 78, align: 'right' });
      y += rowHeight;
      doc.moveTo(48, y).lineTo(564, y).strokeColor('#E2E8F0').lineWidth(0.75).stroke();
      y += 8;
    }

    // Totals block
    y += 10;
    if (y > 600) {
      doc.addPage();
      y = 48;
    }

    const summaryRowsCount =
      3 + (payload.discountCents > 0 ? 1 : 0) + (payload.kind !== 'estimate' ? 2 : 0);
    const summaryBoxHeight = summaryRowsCount * 18 + 20;
    if (tpl === 'modern') {
      doc.roundedRect(344, y - 8, 220, summaryBoxHeight, 6).fillAndStroke('#F0F9FF', '#BAE6FD');
    } else if (tpl === 'creative') {
      doc.roundedRect(344, y - 8, 220, summaryBoxHeight, 6).fillAndStroke('#EFF6FF', '#BFDBFE');
    } else if (tpl !== 'minimal') {
      doc.roundedRect(344, y - 8, 220, summaryBoxHeight, 6).fill(palette.surface);
    }

    const drawSummaryRow = (label: string, val: string, bold = false, color = '#172033') => {
      doc.fillColor(bold ? color : '#475569').font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 11 : 9.5);
      doc.text(label, 355, y, { width: 110, align: 'left' });
      doc.text(val, 470, y, { width: 84, align: 'right' });
      y += bold ? 20 : 16;
    };

    drawSummaryRow('Subtotal', fmtUsd(payload.subtotalCents));
    if (payload.discountCents > 0) {
      drawSummaryRow('Discount', `-${fmtUsd(payload.discountCents)}`);
    }
    drawSummaryRow(payload.taxLabel || 'Tax', fmtUsd(payload.taxCents));
    doc.moveTo(355, y).lineTo(554, y).strokeColor('#CBD5E1').lineWidth(1).stroke();
    y += 8;
    drawSummaryRow('Total', fmtUsd(payload.totalCents), true, palette.primary);

    if (payload.kind !== 'estimate') {
      drawSummaryRow('Amount Paid', fmtUsd(payload.amountPaidCents), false, '#16A34A');
      drawSummaryRow('Balance Due', fmtUsd(payload.balanceDueCents), true, palette.accent);
    }

    if (payload.paymentMeta) {
      y += 8;
      doc.fillColor('#16A34A').font('Helvetica-Bold').fontSize(9).text(
        `Payment Method: ${payload.paymentMeta.method.replace('_', ' ').toUpperCase()}${payload.paymentMeta.reference ? `  |  Ref: ${payload.paymentMeta.reference}` : ''}`,
        48,
        y
      );
      y += 18;
    }

    // Notes & Payment Instructions
    y += 14;
    const ensureSpace = (needed: number) => {
      if (y + needed > 710) {
        doc.addPage();
        y = 48;
      }
    };
    if (payload.paymentInstructions) {
      const h = doc.heightOfString(payload.paymentInstructions, { width: 516 });
      ensureSpace(h + 24);
      doc.fillColor('#172B4D').font('Helvetica-Bold').fontSize(9).text('Payment Instructions', 48, y);
      y += 13;
      doc.fillColor('#475569').font('Helvetica').fontSize(9).text(payload.paymentInstructions, 48, y, { width: 516 });
      y += h + 12;
    }
    if (payload.notes) {
      const h = doc.heightOfString(payload.notes, { width: 516 });
      ensureSpace(h + 24);
      doc.fillColor('#172B4D').font('Helvetica-Bold').fontSize(9).text('Notes', 48, y);
      y += 13;
      doc.fillColor('#475569').font('Helvetica').fontSize(9).text(payload.notes, 48, y, { width: 516 });
      y += h + 12;
    }
    if (payload.terms) {
      const h = doc.heightOfString(payload.terms, { width: 516 });
      ensureSpace(h + 24);
      doc.fillColor('#172B4D').font('Helvetica-Bold').fontSize(9).text('Terms & Conditions', 48, y);
      y += 13;
      doc.fillColor('#64748B').font('Helvetica').fontSize(8.5).text(payload.terms, 48, y, { width: 516 });
    }

    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      // Crisp document footer
      doc.save();
      doc.moveTo(48, 732).lineTo(564, 732).strokeColor('#E2E8F0').lineWidth(0.5).stroke();
      doc.fillColor('#94A3B8').font('Helvetica').fontSize(8);
      doc.text(`${payload.business.businessName || 'InvoicifyPro'}  •  ${docHeading} #${payload.docNumber}`, 48, 740, {
        lineBreak: false,
      });
      doc.text(`Page ${i - range.start + 1} of ${range.count}`, 464, 740, {
        width: 100,
        align: 'right',
        lineBreak: false,
      });
      doc.restore();

      if (payload.watermark && payload.watermark.text && payload.watermark.text.trim()) {
        drawWatermarkOnPage(doc, payload.watermark, payload.status);
      }
    }

    doc.end();
  });
}

export function generateMonthlyReportPdf(payload: MonthlyReportPayload): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 48 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.rect(0, 0, doc.page.width, 96).fill('#172B4D');
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(20).text('Monthly Business Financial Report', 48, 28);
    doc.fillColor('#93C5FD').font('Helvetica').fontSize(10.5).text(`${payload.businessName}  •  ${payload.monthLabel}`, 48, 56);
    doc.fillColor('#CBD5E1').fontSize(8.5).text(`Generated ${payload.generatedAt}`, 400, 56, { align: 'right', width: 164 });

    let y = 124;
    doc.fillColor('#172B4D').font('Helvetica-Bold').fontSize(12).text('Executive Summary (USD)', 48, y);
    y += 20;

    const kpis = [
      ['Total Invoiced', fmtUsd(payload.metrics.totalInvoicedCents)],
      ['Payments Collected', fmtUsd(payload.metrics.collectedCents)],
      ['Outstanding Balance', fmtUsd(payload.metrics.outstandingCents)],
      ['Overdue Balance', fmtUsd(payload.metrics.overdueCents)],
      ['Total Expenses', fmtUsd(payload.metrics.expensesCents)],
      ['Estimated Operating Cash Flow', fmtUsd(payload.metrics.netCashFlowCents)],
      ['Previous Month Collected', fmtUsd(payload.metrics.prevMonthCollectedCents)],
      ['Average Collection Time', `${payload.metrics.avgCollectionDays} days`],
    ];

    for (let i = 0; i < kpis.length; i += 2) {
      const [l1, v1] = kpis[i];
      const pair = kpis[i + 1];
      doc.roundedRect(48, y, 248, 48, 6).fill('#F5F7FA');
      doc.fillColor('#64748B').font('Helvetica').fontSize(8.5).text(l1, 60, y + 10);
      doc.fillColor('#172033').font('Helvetica-Bold').fontSize(13).text(v1, 60, y + 24);

      if (pair) {
        doc.roundedRect(312, y, 252, 48, 6).fill('#F5F7FA');
        doc.fillColor('#64748B').font('Helvetica').fontSize(8.5).text(pair[0], 324, y + 10);
        doc.fillColor('#172033').font('Helvetica-Bold').fontSize(13).text(pair[1], 324, y + 24);
      }
      y += 58;
    }

    y += 14;
    doc.fillColor('#172B4D').font('Helvetica-Bold').fontSize(12).text('Top Clients by Revenue', 48, y);
    y += 18;
    if (payload.topClients.length === 0) {
      doc.fillColor('#64748B').font('Helvetica').fontSize(9.5).text('No client billing records for this period.', 48, y);
      y += 20;
    } else {
      for (const client of payload.topClients.slice(0, 8)) {
        doc.fillColor('#172033').font('Helvetica').fontSize(9.5).text(client.name, 48, y, { width: 250 });
        doc.text(`Billed: ${fmtUsd(client.billedCents)}`, 310, y, { width: 120, align: 'right' });
        doc.font('Helvetica-Bold').text(`Paid: ${fmtUsd(client.paidCents)}`, 440, y, { width: 124, align: 'right' });
        y += 18;
      }
    }

    y += 16;
    doc.fillColor('#172B4D').font('Helvetica-Bold').fontSize(12).text('Expense Breakdown by Category', 48, y);
    y += 18;
    if (payload.expenseBreakdown.length === 0) {
      doc.fillColor('#64748B').font('Helvetica').fontSize(9.5).text('No recorded expenses for this period.', 48, y);
    } else {
      for (const exp of payload.expenseBreakdown) {
        doc.fillColor('#172033').font('Helvetica').fontSize(9.5).text(exp.category, 48, y, { width: 320 });
        doc.font('Helvetica-Bold').text(fmtUsd(exp.amountCents), 440, y, { width: 124, align: 'right' });
        y += 18;
      }
    }

    doc.font('Helvetica').fontSize(8).fillColor('#94A3B8').text(
      'Generated by InvoicifyPro. Operational summary only; not certified tax or accounting advice.',
      48,
      732,
      { align: 'center', width: 516 }
    );

    doc.end();
  });
}

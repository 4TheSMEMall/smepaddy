/**
 * Receipt generator — builds a real PDF using jsPDF.
 * Both Download and Share use the same PDF blob.
 */

import { jsPDF } from "jspdf";

export type SaleReceiptData = {
  receiptNo: string;
  businessName: string;
  date: string;
  customerName?: string | null;
  items: { name: string }[];
  subtotal: number;
  amountPaid: number;
  balance: number;
  paymentMethod?: string | null;
  paymentStatus: string;
};

export type InvoiceReceiptData = {
  invoiceNo: string;
  businessName: string;
  customerName: string;
  customerPhone?: string | null;
  issueDate: string;
  dueDate: string;
  items: { description: string; quantity: number; unitPrice: number; total: number }[];
  subtotal: number;
  amountPaid: number;
  balance: number;
  status: string;
};

// ─── Public API ───────────────────────────────────────────────────────────────

export function downloadSaleReceipt(data: SaleReceiptData) {
  const blob = buildSaleReceiptPDF(data);
  triggerDownload(blob, `Receipt-${data.receiptNo}.pdf`);
}

export async function shareSaleReceipt(data: SaleReceiptData) {
  const blob = buildSaleReceiptPDF(data);
  await shareFile(blob, `Receipt-${data.receiptNo}.pdf`, data.businessName);
}

export function downloadInvoiceReceipt(data: InvoiceReceiptData) {
  const blob = buildInvoiceReceiptPDF(data);
  triggerDownload(blob, `Invoice-INV-${data.invoiceNo}.pdf`);
}

export async function shareInvoiceReceipt(data: InvoiceReceiptData) {
  const blob = buildInvoiceReceiptPDF(data);
  await shareFile(blob, `Invoice-INV-${data.invoiceNo}.pdf`, data.businessName);
}

// ─── Core mechanics ───────────────────────────────────────────────────────────

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function shareFile(blob: Blob, filename: string, businessName: string) {
  const file = new File([blob], filename, { type: "application/pdf" });

  if (
    typeof navigator !== "undefined" &&
    navigator.share &&
    navigator.canShare?.({ files: [file] })
  ) {
    try {
      await navigator.share({
        title: `${businessName} — ${filename}`,
        files: [file],
      });
      return;
    } catch {
      // User cancelled or share failed — fall through to download
    }
  }

  // Fallback: just download the PDF
  triggerDownload(blob, filename);
}

// ─── PDF constants ────────────────────────────────────────────────────────────

const PAGE_W = 80;   // mm — standard 80mm receipt width
const MARGIN  = 6;   // mm
const LINE_H  = 5.5; // mm per line
const TEXT_W  = PAGE_W - MARGIN * 2;

function fmt(v: number) {
  // jsPDF built-in fonts don't support the ₦ glyph — use "NGN" prefix instead
  const n = new Intl.NumberFormat("en-NG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v);
  return `NGN ${n}`;
}

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

// ─── Sale Receipt PDF ─────────────────────────────────────────────────────────

function buildSaleReceiptPDF(d: SaleReceiptData): Blob {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: [PAGE_W, 220] });
  let y = MARGIN;

  function text(str: string, x: number, align: "left" | "center" | "right" = "left") {
    doc.text(str, x, y, { align });
  }

  function row(left: string, right: string, bold = false) {
    if (bold) doc.setFont("helvetica", "bold");
    else doc.setFont("helvetica", "normal");
    doc.text(left, MARGIN, y);
    doc.text(right, PAGE_W - MARGIN, y, { align: "right" });
    y += LINE_H;
  }

  function dash() {
    doc.setLineWidth(0.3);
    doc.setDrawColor(210, 210, 210);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    y += 3;
  }

  // ── Header
  doc.setFillColor(21, 87, 223); // blue
  doc.roundedRect(MARGIN, y, 10, 10, 1.5, 1.5, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("SP", MARGIN + 5, y + 6.5, { align: "center" });

  doc.setTextColor(7, 17, 34);
  doc.setFontSize(11);
  doc.text(d.businessName, MARGIN + 13, y + 4);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text("SALES RECEIPT", MARGIN + 13, y + 8.5);
  y += 16;

  dash();

  // ── Meta
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.setFont("helvetica", "normal");
  row("Receipt No:", `#${d.receiptNo}`);
  row("Date:", fmtDate(d.date));
  if (d.customerName) row("Customer:", d.customerName);
  y += 1;
  dash();

  // ── Items
  doc.setFontSize(7.5);
  doc.setTextColor(50, 50, 50);
  doc.setFont("helvetica", "bold");
  text("ITEMS", MARGIN);
  y += LINE_H;
  doc.setFont("helvetica", "normal");

  for (const item of d.items) {
    const lines = doc.splitTextToSize(`• ${item.name}`, TEXT_W);
    for (const line of lines as string[]) {
      text(line, MARGIN);
      y += LINE_H - 0.5;
    }
  }
  y += 1;
  dash();

  // ── Totals
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  row("Subtotal:", fmt(d.subtotal));
  row("Amount Paid:", fmt(d.amountPaid));
  if (d.balance > 0) {
    doc.setTextColor(239, 59, 66);
    row("Balance Due:", fmt(d.balance));
    doc.setTextColor(100, 100, 100);
  }
  y += 1;
  doc.setTextColor(7, 17, 34);
  doc.setFontSize(8);
  row("TOTAL:", fmt(d.subtotal), true);
  y += 1;
  dash();

  // ── Payment info + status badge
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.setFont("helvetica", "normal");
  if (d.paymentMethod) {
    row("Payment:", `${d.paymentMethod[0]}${d.paymentMethod.slice(1).toLowerCase()}`);
  }

  const statusLabel =
    d.paymentStatus === "PAID" ? "PAID" :
    d.paymentStatus === "PART_PAYMENT" ? "PART PAYMENT" : "CREDIT";
  const [sr, sg, sb] =
    d.paymentStatus === "PAID" ? [15, 159, 104] :
    d.paymentStatus === "PART_PAYMENT" ? [217, 137, 0] : [239, 59, 66];

  doc.setFillColor(sr, sg, sb);
  const badgeW = doc.getTextWidth(statusLabel) + 6;
  doc.roundedRect(MARGIN, y, badgeW, 5.5, 1, 1, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text(statusLabel, MARGIN + badgeW / 2, y + 3.8, { align: "center" });
  y += 10;

  // ── Footer
  dash();
  doc.setTextColor(150, 150, 150);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("Thank you for your business!", PAGE_W / 2, y, { align: "center" });
  y += 4.5;
  doc.text("Powered by SME Paddy", PAGE_W / 2, y, { align: "center" });

  return doc.output("blob");
}

// ─── Invoice Receipt PDF ──────────────────────────────────────────────────────

function buildInvoiceReceiptPDF(d: InvoiceReceiptData): Blob {
  const estimatedHeight = 120 + d.items.length * 18 + 60;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: [PAGE_W, estimatedHeight] });
  let y = MARGIN;

  function row(left: string, right: string, color?: [number, number, number]) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(left, MARGIN, y);
    if (color) doc.setTextColor(...color);
    else doc.setTextColor(7, 17, 34);
    doc.text(right, PAGE_W - MARGIN, y, { align: "right" });
    y += LINE_H;
  }

  function dash() {
    doc.setLineWidth(0.3);
    doc.setDrawColor(210, 210, 210);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    y += 3;
  }

  // ── Header
  doc.setFillColor(21, 87, 223);
  doc.roundedRect(MARGIN, y, 10, 10, 1.5, 1.5, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("SP", MARGIN + 5, y + 6.5, { align: "center" });

  doc.setTextColor(7, 17, 34);
  doc.setFontSize(11);
  doc.text(d.businessName, MARGIN + 13, y + 4);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(21, 87, 223);
  doc.text("INVOICE", MARGIN + 13, y + 9);
  y += 16;

  dash();

  // ── Meta
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  row("Invoice No:", `INV-${d.invoiceNo}`);
  row("Issued:", fmtDate(d.issueDate));
  row("Due Date:", fmtDate(d.dueDate));
  row("Bill To:", d.customerName);
  if (d.customerPhone) row("Phone:", d.customerPhone);
  y += 1;
  dash();

  // ── Items header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 100, 100);
  doc.text("DESCRIPTION", MARGIN, y);
  doc.text("TOTAL", PAGE_W - MARGIN, y, { align: "right" });
  y += LINE_H;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(50, 50, 50);

  for (const item of d.items) {
    const lines = doc.splitTextToSize(item.description, TEXT_W - 18) as string[];
    doc.text(lines[0] ?? "", MARGIN, y);
    doc.text(fmt(item.total), PAGE_W - MARGIN, y, { align: "right" });
    y += 4;
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(7);
    doc.text(`${item.quantity} × ${fmt(item.unitPrice)}`, MARGIN + 2, y);
    doc.setFontSize(7.5);
    doc.setTextColor(50, 50, 50);
    y += LINE_H;
  }
  y += 1;
  dash();

  // ── Totals
  doc.setFontSize(8);
  row("Subtotal:", fmt(d.subtotal));
  if (d.amountPaid > 0) row("Amount Paid:", fmt(d.amountPaid), [15, 159, 104]);

  y += 1;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(7, 17, 34);
  const balLabel = d.balance <= 0 ? "TOTAL (PAID):" : "BALANCE DUE:";
  const balColor: [number, number, number] = d.balance <= 0 ? [15, 159, 104] : [239, 59, 66];
  doc.text(balLabel, MARGIN, y);
  doc.setTextColor(...balColor);
  doc.text(fmt(d.balance <= 0 ? d.subtotal : d.balance), PAGE_W - MARGIN, y, { align: "right" });
  y += LINE_H + 2;
  dash();

  // ── Footer
  doc.setTextColor(150, 150, 150);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("Please pay before the due date.", PAGE_W / 2, y, { align: "center" });
  y += 4.5;
  doc.text("Powered by SME Paddy", PAGE_W / 2, y, { align: "center" });

  return doc.output("blob");
}

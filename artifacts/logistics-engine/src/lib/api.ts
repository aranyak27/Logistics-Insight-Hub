const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

export interface InvoiceHeader {
  invoice_id: string;
  supplier_name: string;
  invoice_date: string | null;
  grand_total: number;
  currency: string;
}

export interface LineItem {
  item_id: number;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface ExtractedInvoice {
  invoice_id: string;
  supplier_name: string;
  invoice_date: string | null;
  grand_total: number;
  currency: string;
  line_items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    total_price: number;
  }>;
}

export interface ChartPoint {
  name: string;
  value: number;
}

export interface AnalyticsResult {
  summary: string;
  code: string;
  explanation: string;
  result_rows: Record<string, string | number>[];
  result_cols: string[];
  chart_type: "bar" | "pie" | "line" | "none";
  chart_data: ChartPoint[];
  chart_title: string;
}

export interface FreightData {
  headers: InvoiceHeader[];
  line_items: LineItem[];
}

export async function fetchFreight(): Promise<FreightData> {
  const r = await fetch(`${API}/freight`);
  return r.json();
}

export async function saveInvoice(
  invoice: ExtractedInvoice
): Promise<{ success?: boolean; duplicate?: boolean; existing?: InvoiceHeader }> {
  const resp = await fetch(`${API}/freight`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(invoice),
  });
  return resp.json();
}

export async function overwriteInvoice(
  invoice: ExtractedInvoice
): Promise<{ success: boolean }> {
  const resp = await fetch(`${API}/freight/${encodeURIComponent(invoice.invoice_id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(invoice),
  });
  return resp.json();
}

export async function extractInvoice(file: File): Promise<ExtractedInvoice> {
  const fd = new FormData();
  fd.append("file", file);
  const r = await fetch(`${API}/extract`, { method: "POST", body: fd });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export interface HistoryItem {
  question: string;
  summary: string;
}

export async function queryAnalytics(question: string, history: HistoryItem[]): Promise<AnalyticsResult> {
  const r = await fetch(`${API}/analytics`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, history }),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

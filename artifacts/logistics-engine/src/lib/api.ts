const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api`;

export interface FreightRow {
  invoice_id: string;
  vendor: string;
  date: string;
  amount: string;
  category: string;
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

export interface ExtractedRow {
  invoice_id: string;
  vendor: string;
  date: string;
  amount: number;
  category: string;
}

export async function fetchFreight(): Promise<{ rows: FreightRow[]; columns: string[] }> {
  const r = await fetch(`${API}/freight`);
  return r.json();
}

export async function saveFreightRows(rows: ExtractedRow[]): Promise<{ success: boolean; total: number }> {
  const stringified = rows.map((r) => ({
    invoice_id: r.invoice_id,
    vendor: r.vendor,
    date: r.date,
    amount: String(r.amount),
    category: r.category,
  }));
  const resp = await fetch(`${API}/freight`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rows: stringified }),
  });
  return resp.json();
}

export async function extractInvoice(file: File): Promise<{ rows: ExtractedRow[] }> {
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

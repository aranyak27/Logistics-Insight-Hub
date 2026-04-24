import { Router } from "express";
import { GoogleGenAI } from "@google/genai";
import db from "../db";

const router = Router();

const genai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY ?? process.env.GEMINI_API_KEY ?? "",
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL ?? "https://generativelanguage.googleapis.com",
  },
});

const getHeaders = db.prepare("SELECT * FROM invoice_headers");
const getLineItems = db.prepare("SELECT * FROM invoice_line_items");

interface HistoryItem {
  question: string;
  summary: string;
}

interface AnalyticsRequest {
  question: string;
  history?: HistoryItem[];
}

interface ChartDataPoint {
  name: string;
  value: number;
}

interface AnalyticsResult {
  summary: string;
  code: string;
  explanation: string;
  result_rows: Record<string, string | number>[];
  result_cols: string[];
  chart_type: "bar" | "pie" | "line" | "none";
  chart_data: ChartDataPoint[];
  chart_title: string;
}

router.post("/analytics", async (req, res) => {
  try {
    const { question, history = [] } = req.body as AnalyticsRequest;
    if (!question) return res.status(400).json({ error: "question required" });

    const headers = getHeaders.all() as Record<string, unknown>[];
    const lineItems = getLineItems.all() as Record<string, unknown>[];

    if (headers.length === 0) {
      return res.json({
        summary: "I don't have any data yet. Please upload some freight invoices first.",
        code: "",
        explanation: "",
        result_rows: [],
        result_cols: [],
        chart_type: "none",
        chart_data: [],
        chart_title: "",
      } as AnalyticsResult);
    }

    const historyText =
      history.length > 0
        ? `\n\nConversation history for context:\n${history
            .map((h) => `Q: ${h.question}\nA: ${h.summary}`)
            .join("\n\n")}`
        : "";

    const prompt = `You are a logistics data analyst. You have access to a SQLite database with two tables:

TABLE: invoice_headers
Schema: invoice_id TEXT PK, supplier_name TEXT, invoice_date TEXT (YYYY-MM-DD or NULL), grand_total REAL, currency TEXT
Data:
${JSON.stringify(headers, null, 2)}

TABLE: invoice_line_items
Schema: item_id INTEGER PK, invoice_id TEXT FK, description TEXT, quantity REAL, unit_price REAL, total_price REAL
Data:
${JSON.stringify(lineItems, null, 2)}

Example SQL JOIN pattern:
  SELECT h.supplier_name, SUM(li.total_price) AS total
  FROM invoice_line_items li
  JOIN invoice_headers h ON li.invoice_id = h.invoice_id
  GROUP BY h.supplier_name;
${historyText}

User question: "${question}"

Analyze the data and answer the question. Return ONLY valid JSON (no markdown fences) with this exact shape:
{
  "summary": "<clear natural-language answer to the question, 1-3 sentences. If invoice_date is NULL for any relevant rows, mention that those were excluded from date-based calculations.>",
  "explanation": "<one sentence explaining the analytical approach, e.g. 'JOINed invoice_headers and invoice_line_items, grouped by supplier_name and summed total_price'>",
  "code": "<the SQL query that would produce this result, using proper JOIN syntax between invoice_headers and invoice_line_items>",
  "result_rows": [<array of result objects matching the analysis>],
  "result_cols": [<array of column names in result_rows>],
  "chart_type": "<one of: bar, pie, line, none — choose whichever best fits this analysis>",
  "chart_data": [{"name": "<label>", "value": <number>}],
  "chart_title": "<short descriptive chart title>"
}

If the question cannot be answered with the available data, say so honestly in summary and set chart_type to "none", result_rows to [], result_cols to [].
Do NOT return any text outside the JSON object.`;

    const response = await genai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const text = response.text ?? "";
    const cleaned = text.replace(/```json|```/g, "").trim();
    const parsed: AnalyticsResult = JSON.parse(cleaned);
    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;

import { Router } from "express";
import fs from "fs";
import path from "path";
import { GoogleGenAI } from "@google/genai";

const router = Router();

const DATA_FILE = path.resolve(process.cwd(), "../../freight_data.csv");

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? "" });

function parseCsv(content: string): Record<string, string>[] {
  const lines = content.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const vals = line.split(",").map((v) => v.trim());
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? ""]));
  });
}

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

    let rawData: Record<string, string>[] = [];
    if (fs.existsSync(DATA_FILE)) {
      rawData = parseCsv(fs.readFileSync(DATA_FILE, "utf8"));
    }

    if (rawData.length === 0) {
      return res.json({
        summary:
          "I don't have any data yet. Please upload some freight invoices first.",
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

    const dataJson = JSON.stringify(rawData, null, 2);

    const prompt = `You are a logistics data analyst. You have access to this freight data:

${dataJson}

${historyText}

User question: "${question}"

Analyze the data and answer the question. Return ONLY valid JSON (no markdown fences) with this exact shape:
{
  "summary": "<clear natural-language answer to the question, 1-3 sentences>",
  "explanation": "<one sentence explaining the analytical approach, e.g. 'Grouped by vendor and summed the amount column'>",
  "code": "<equivalent Python pandas code that would produce this result, e.g. df.groupby('vendor')['amount'].sum().reset_index()>",
  "result_rows": [<array of result objects matching the analysis, e.g. [{\"vendor\":\"Maersk\",\"amount\":27300}]>],
  "result_cols": [<array of column names in result_rows>],
  "chart_type": "<one of: bar, pie, line, none — choose whichever best fits this analysis>",
  "chart_data": [{"name": "<label>", "value": <number>}],
  "chart_title": "<short descriptive chart title>"
}

If the question cannot be answered with the available data, say so honestly in summary and set chart_type to "none", result_rows to [], result_cols to [].
If the question is general (e.g. total spend), aggregate appropriately.
Do NOT return any text outside the JSON object.`;

    const response = await genai.models.generateContent({
      model: "gemini-2.0-flash",
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

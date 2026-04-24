import { Router } from "express";
import multer from "multer";
import { GoogleGenAI } from "@google/genai";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

const genai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY ?? process.env.GEMINI_API_KEY ?? "",
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL ?? "https://generativelanguage.googleapis.com",
  },
});

const EXTRACT_PROMPT = `You are an expert logistics invoice parser.
Extract the invoice data from this document/image and return a SINGLE nested JSON object.
Return ONLY valid JSON (no markdown fences) with this exact shape:
{
  "invoice_id": "<the invoice number or ID found in the document, e.g. INV-2024-001>",
  "supplier_name": "<the vendor or carrier company name>",
  "invoice_date": "<YYYY-MM-DD format, or null if not found>",
  "grand_total": <the final total amount as a number>,
  "currency": "<3-letter currency code, e.g. USD, INR — default to USD if not found>",
  "line_items": [
    {
      "description": "<what was charged, e.g. Ocean Freight, Fuel Surcharge, Customs Duty>",
      "quantity": <number, default 1 if not specified>,
      "unit_price": <price per unit as a number>,
      "total_price": <quantity × unit_price as a number>
    }
  ]
}
Rules:
- If there are multiple line items on the invoice, include ALL of them in line_items.
- If there are no explicit line items, synthesize one line item using the grand_total as total_price with quantity=1 and unit_price=grand_total.
- If invoice_date is not found, use null (do NOT guess).
- If invoice_id is not found, generate a plausible one like "INV-UNKNOWN-001".
- Do NOT return any text outside the JSON object.`;

router.post("/extract", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const { buffer, mimetype } = req.file;
    const b64 = buffer.toString("base64");

    const parts = [
      { text: EXTRACT_PROMPT },
      { inlineData: { mimeType: mimetype, data: b64 } },
    ];

    const response = await genai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: parts as never[] }],
    });

    const text = response.text ?? "";
    const cleaned = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;

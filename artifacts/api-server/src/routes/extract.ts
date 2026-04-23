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
Extract all freight invoice line items from this document/image.
Return ONLY valid JSON (no markdown fences) with this exact shape:
{
  "rows": [
    {
      "invoice_id": "<string, e.g. INV-2024-001>",
      "vendor": "<carrier or logistics company name>",
      "date": "<YYYY-MM-DD>",
      "amount": <number>,
      "category": "<one of: Ocean Freight, Air Freight, Ground Freight, Customs & Duties, Warehousing, Other>"
    }
  ]
}
If multiple line items exist, include all of them.
If a field is not found, use sensible defaults.
Do NOT return any text outside the JSON object.`;

router.post("/extract", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const { buffer, mimetype } = req.file;
    const b64 = buffer.toString("base64");

    let parts: unknown[];
    if (mimetype === "application/pdf") {
      parts = [
        { text: EXTRACT_PROMPT },
        { inlineData: { mimeType: "application/pdf", data: b64 } },
      ];
    } else {
      parts = [
        { text: EXTRACT_PROMPT },
        { inlineData: { mimeType: mimetype, data: b64 } },
      ];
    }

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

import { Router } from "express";
import fs from "fs";
import path from "path";

const router = Router();
const DATA_FILE = path.resolve(process.cwd(), "../../freight_data.csv");

const CSV_COLS = ["invoice_id", "vendor", "date", "amount", "category"];

function parseCsv(content: string): Record<string, string>[] {
  const lines = content.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const vals = line.split(",").map((v) => v.trim());
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? ""]));
  });
}

function toCsvLine(row: Record<string, string>): string {
  return CSV_COLS.map((c) => row[c] ?? "").join(",");
}

router.get("/freight", (_req, res) => {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return res.json({ rows: [], columns: CSV_COLS });
    }
    const rows = parseCsv(fs.readFileSync(DATA_FILE, "utf8"));
    res.json({ rows, columns: CSV_COLS });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post("/freight", (req, res) => {
  try {
    const { rows } = req.body as { rows: Record<string, string>[] };
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: "rows array required" });
    }
    let existing: Record<string, string>[] = [];
    if (fs.existsSync(DATA_FILE)) {
      existing = parseCsv(fs.readFileSync(DATA_FILE, "utf8"));
    }
    const combined = [...existing, ...rows];
    const csvContent =
      CSV_COLS.join(",") + "\n" + combined.map(toCsvLine).join("\n");
    fs.writeFileSync(DATA_FILE, csvContent, "utf8");
    res.json({ success: true, total: combined.length });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;

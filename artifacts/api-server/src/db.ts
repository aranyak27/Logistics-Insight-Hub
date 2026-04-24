import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const DB_PATH = path.resolve(process.cwd(), "../../logistics.db");
const CSV_PATH = path.resolve(process.cwd(), "../../freight_data.csv");

const db = new Database(DB_PATH);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS invoice_headers (
    invoice_id   TEXT PRIMARY KEY,
    supplier_name TEXT NOT NULL,
    invoice_date  TEXT,
    grand_total   REAL NOT NULL DEFAULT 0,
    currency      TEXT NOT NULL DEFAULT 'USD'
  );

  CREATE TABLE IF NOT EXISTS invoice_line_items (
    item_id      INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id   TEXT NOT NULL REFERENCES invoice_headers(invoice_id) ON DELETE CASCADE,
    description  TEXT NOT NULL DEFAULT '',
    quantity     REAL NOT NULL DEFAULT 1,
    unit_price   REAL NOT NULL DEFAULT 0,
    total_price  REAL NOT NULL DEFAULT 0
  );
`);

function parseCsv(content: string): Record<string, string>[] {
  const lines = content.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const vals = line.split(",").map((v) => v.trim());
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? ""]));
  });
}

const seedCount = (db.prepare("SELECT COUNT(*) as c FROM invoice_headers").get() as { c: number }).c;
if (seedCount === 0 && fs.existsSync(CSV_PATH)) {
  const rows = parseCsv(fs.readFileSync(CSV_PATH, "utf8"));
  const insertHeader = db.prepare(
    `INSERT OR IGNORE INTO invoice_headers (invoice_id, supplier_name, invoice_date, grand_total, currency)
     VALUES (@invoice_id, @supplier_name, @invoice_date, @grand_total, @currency)`
  );
  const insertLine = db.prepare(
    `INSERT INTO invoice_line_items (invoice_id, description, quantity, unit_price, total_price)
     VALUES (@invoice_id, @description, @quantity, @unit_price, @total_price)`
  );

  const CATEGORY_MAP: Record<string, string> = {
    "Ocean Freight": "Ocean Freight Charges",
    "Air Freight": "Air Freight Charges",
    "Ground Freight": "Ground Freight Charges",
    "Customs & Duties": "Customs & Duties",
    Warehousing: "Warehousing Services",
    Other: "Miscellaneous Freight",
  };

  const seedAll = db.transaction(() => {
    for (const row of rows) {
      const amount = parseFloat(row.amount || "0");
      insertHeader.run({
        invoice_id: row.invoice_id,
        supplier_name: row.vendor,
        invoice_date: row.date || null,
        grand_total: amount,
        currency: "USD",
      });
      insertLine.run({
        invoice_id: row.invoice_id,
        description: CATEGORY_MAP[row.category] ?? row.category ?? "Freight Charges",
        quantity: 1,
        unit_price: amount,
        total_price: amount,
      });
    }
  });
  seedAll();
  console.log(`[db] Seeded ${rows.length} rows from freight_data.csv`);
}

export default db;

import db from "./db";

const sampleHeaders = [
  {
    invoice_id: "SAMP-1001",
    supplier_name: "Maersk Logistics",
    invoice_date: "2026-04-01",
    grand_total: 4820,
    currency: "USD",
  },
  {
    invoice_id: "SAMP-1002",
    supplier_name: "DHL Global Forwarding",
    invoice_date: "2026-04-03",
    grand_total: 6150,
    currency: "EUR",
  },
  {
    invoice_id: "SAMP-1003",
    supplier_name: "Kuehne+Nagel",
    invoice_date: "2026-04-05",
    grand_total: 89500,
    currency: "INR",
  },
];

const sampleLines = [
  { invoice_id: "SAMP-1001", description: "Ocean freight", quantity: 1, unit_price: 4200, total_price: 4200 },
  { invoice_id: "SAMP-1001", description: "Fuel surcharge", quantity: 1, unit_price: 620, total_price: 620 },
  { invoice_id: "SAMP-1002", description: "Air freight", quantity: 1, unit_price: 5400, total_price: 5400 },
  { invoice_id: "SAMP-1002", description: "Customs handling", quantity: 1, unit_price: 750, total_price: 750 },
  { invoice_id: "SAMP-1003", description: "Ground freight", quantity: 1, unit_price: 82000, total_price: 82000 },
  { invoice_id: "SAMP-1003", description: "Warehouse fees", quantity: 1, unit_price: 7500, total_price: 7500 },
];

const existing = db.prepare("SELECT COUNT(*) as c FROM invoice_headers WHERE invoice_id LIKE 'SAMP-%'").get() as { c: number };
if (existing.c === 0) {
  const insertHeader = db.prepare(
    `INSERT INTO invoice_headers (invoice_id, supplier_name, invoice_date, grand_total, currency)
     VALUES (@invoice_id, @supplier_name, @invoice_date, @grand_total, @currency)`
  );
  const insertLine = db.prepare(
    `INSERT INTO invoice_line_items (invoice_id, description, quantity, unit_price, total_price)
     VALUES (@invoice_id, @description, @quantity, @unit_price, @total_price)`
  );
  const seed = db.transaction(() => {
    for (const h of sampleHeaders) insertHeader.run(h);
    for (const li of sampleLines) insertLine.run(li);
  });
  seed();
  console.log(`[seed-samples] inserted ${sampleHeaders.length} sample invoices`);
}

process.exit(0);

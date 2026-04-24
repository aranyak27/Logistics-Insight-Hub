import { Router } from "express";
import db from "../db";
import { getRates, toUSD } from "../rates";

const router = Router();

interface InvoiceHeader {
  invoice_id: string;
  supplier_name: string;
  invoice_date: string | null;
  grand_total: number;
  currency: string;
}

interface LineItem {
  item_id: number;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface InvoicePayload {
  invoice_id: string;
  supplier_name: string;
  invoice_date: string | null;
  grand_total: number;
  currency?: string;
  line_items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    total_price: number;
  }>;
}

const getHeaders = db.prepare<[], InvoiceHeader>(
  "SELECT invoice_id, supplier_name, invoice_date, grand_total, currency FROM invoice_headers ORDER BY invoice_date DESC"
);
const getLineItems = db.prepare<[], LineItem>(
  "SELECT item_id, invoice_id, description, quantity, unit_price, total_price FROM invoice_line_items ORDER BY invoice_id, item_id"
);
const findHeader = db.prepare<[string], InvoiceHeader>(
  "SELECT * FROM invoice_headers WHERE invoice_id = ?"
);
const insertHeader = db.prepare(
  `INSERT INTO invoice_headers (invoice_id, supplier_name, invoice_date, grand_total, currency)
   VALUES (@invoice_id, @supplier_name, @invoice_date, @grand_total, @currency)`
);
const insertLine = db.prepare(
  `INSERT INTO invoice_line_items (invoice_id, description, quantity, unit_price, total_price)
   VALUES (@invoice_id, @description, @quantity, @unit_price, @total_price)`
);
const deleteHeader = db.prepare("DELETE FROM invoice_headers WHERE invoice_id = ?");

router.get("/freight", async (_req, res) => {
  try {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    const headers = getHeaders.all();
    const line_items = getLineItems.all();

    const rates = await getRates();

    const currencyByInvoice: Record<string, string> = {};
    const headersWithUSD = headers.map((h) => {
      currencyByInvoice[h.invoice_id] = h.currency;
      return { ...h, usd_total: toUSD(h.grand_total, h.currency, rates) };
    });

    const lineItemsWithUSD = line_items.map((li) => {
      const cur = currencyByInvoice[li.invoice_id] ?? "USD";
      return {
        ...li,
        usd_unit_price: toUSD(li.unit_price, cur, rates),
        usd_total_price: toUSD(li.total_price, cur, rates),
      };
    });

    res.json({ headers: headersWithUSD, line_items: lineItemsWithUSD, rates_source: "open.er-api.com" });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post("/freight", (req, res): void => {
  try {
    const invoice = req.body as InvoicePayload;
    if (!invoice?.invoice_id) { res.status(400).json({ error: "invoice_id required" }); return; }

    const existing = findHeader.get(invoice.invoice_id);
    if (existing) {
      res.json({ duplicate: true, existing });
      return;
    }

    const doInsert = db.transaction(() => {
      insertHeader.run({
        invoice_id: invoice.invoice_id,
        supplier_name: invoice.supplier_name,
        invoice_date: invoice.invoice_date?.trim() || null,
        grand_total: invoice.grand_total,
        currency: invoice.currency ?? "USD",
      });
      for (const li of invoice.line_items ?? []) {
        insertLine.run({
          invoice_id: invoice.invoice_id,
          description: li.description,
          quantity: li.quantity,
          unit_price: li.unit_price,
          total_price: li.total_price,
        });
      }
    });
    doInsert();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.put("/freight/:invoiceId", (req, res): void => {
  try {
    const { invoiceId } = req.params;
    const invoice = req.body as InvoicePayload;
    if (!invoice?.invoice_id) { res.status(400).json({ error: "invoice_id required" }); return; }

    const doOverwrite = db.transaction(() => {
      deleteHeader.run(invoiceId);
      insertHeader.run({
        invoice_id: invoice.invoice_id,
        supplier_name: invoice.supplier_name,
        invoice_date: invoice.invoice_date?.trim() || null,
        grand_total: invoice.grand_total,
        currency: invoice.currency ?? "USD",
      });
      for (const li of invoice.line_items ?? []) {
        insertLine.run({
          invoice_id: invoice.invoice_id,
          description: li.description,
          quantity: li.quantity,
          unit_price: li.unit_price,
          total_price: li.total_price,
        });
      }
    });
    doOverwrite();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;

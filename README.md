# Logistics Intelligence Engine

A full-stack freight analytics platform that turns raw invoices into actionable insights. Upload a PDF or image invoice, let Gemini Vision extract the data, review and correct it, then save it to a live SQLite data lake. Ask plain-English questions about your freight spend and get back SQL, a results table, and a chart — all in one go.

---

## Features

- **Gemini Vision extraction** — Drop a PDF or image invoice; the AI extracts supplier name, invoice ID, date, grand total, currency, and every line item.
- **Manual entry** — No file? Use "Enter Manually" to type in invoice details directly.
- **Editable review editor** — Correct any extraction error before saving. Duplicate detection prevents accidental overwrites.
- **Live data lake** — Two-table SQLite schema (`invoice_headers` + `invoice_line_items`) with WAL mode and foreign-key cascade.
- **USD conversion** — Every amount is converted to USD in real time using live exchange rates from [open.er-api.com](https://open.er-api.com).
- **Agentic analytics chat** — Type a natural-language question; the AI writes the SQL, runs the analysis, and returns a summary, a results table, and a chart. Follow-up questions maintain conversation context.
- **GoComet Blue** themed UI (`#1B5CBA`).

---

## Architecture

```
workspace/
├── artifacts/
│   ├── api-server/          # Express 5 + SQLite backend  (port 8080)
│   └── logistics-engine/    # React + Vite frontend        (port $PORT)
├── logistics.db             # SQLite database (auto-created on first boot)
├── freight_data.csv         # CSV used for initial seed data
└── README.md
```

| Layer | Tech |
|---|---|
| Frontend | React 18, Vite 7, Tailwind CSS, TanStack Query, Recharts |
| Backend | Express 5, better-sqlite3, Pino logging |
| AI | Google Gemini 2.5 Flash (Vision + text) via Replit AI Integration |
| Database | SQLite with WAL mode, foreign keys, ON DELETE CASCADE |

### Database schema

```sql
invoice_headers (
  invoice_id    TEXT PRIMARY KEY,
  supplier_name TEXT NOT NULL,
  invoice_date  TEXT,              -- YYYY-MM-DD or NULL
  grand_total   REAL,
  currency      TEXT               -- USD, EUR, INR, GBP, SGD, AED, CNY
)

invoice_line_items (
  item_id      INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id   TEXT REFERENCES invoice_headers(invoice_id) ON DELETE CASCADE,
  description  TEXT,
  quantity     REAL,
  unit_price   REAL,
  total_price  REAL
)
```

---

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [pnpm](https://pnpm.io/) 8+
- A **Gemini API key** (set as `GEMINI_API_KEY`, or use the built-in Replit AI integration which sets it automatically)

---

## Installation

```bash
# Install all workspace dependencies
pnpm install
```

---

## Running in Development

Start both services. Each must run in its own terminal.

**Terminal 1 — API server (port 8080):**
```bash
pnpm --filter @workspace/api-server run dev
```

**Terminal 2 — React frontend:**
```bash
pnpm --filter @workspace/logistics-engine run dev
```

The frontend proxies `/api/*` requests to the API server automatically.

On Replit, both workflows start automatically and are visible in the preview pane.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | Yes | Google Gemini API key for vision extraction and analytics |
| `SESSION_SECRET` | Yes | Secret used to sign server sessions |
| `PORT` | Yes (auto-set by Replit) | Port the frontend Vite server listens on |
| `BASE_PATH` | Yes (auto-set by Replit) | URL base path for the Vite app |
| `NODE_ENV` | No | `development` or `production` |
| `AI_INTEGRATIONS_GEMINI_BASE_URL` | No | Override Gemini base URL (set automatically by Replit AI integration) |
| `AI_INTEGRATIONS_GEMINI_API_KEY` | No | Override Gemini API key (set automatically by Replit AI integration) |

---

## Sample Data

On every fresh boot, the server auto-seeds three demo invoices if none exist:

| Invoice ID | Supplier | Currency | Grand Total |
|---|---|---|---|
| `SAMP-1001` | Maersk Logistics | USD | $4,820 |
| `SAMP-1002` | DHL Global Forwarding | EUR | €6,150 |
| `SAMP-1003` | Kuehne+Nagel | INR | ₹89,500 |

Each invoice has two line items (e.g. ocean freight + fuel surcharge). All amounts are displayed in USD after live currency conversion.

---

## Sample Questions for Testing

Paste these into the **Analytics Chat** tab to verify the system is working end-to-end.

### Basic spend
1. `What is my total freight spend?`
2. `Which supplier has the highest total spend?`
3. `Show me a breakdown of spend by supplier.`

### Line item analysis
4. `What are the most expensive line item types across all invoices?`
5. `Break down spend by freight description category.`
6. `How much did we spend on fuel surcharges in total?`

### Filtering & lookup
7. `List all invoices from Maersk Logistics.`
8. `Show me all ocean freight line items.`
9. `What is the grand total on invoice SAMP-1002?`

### Multi-currency & date
10. `Which invoices are not in USD?`
11. `Show all invoices placed in April 2026.`
12. `What is the average invoice value across all suppliers?`

### Follow-up (context-aware)
> After asking question 3 above, try:

13. `Now filter that to only DHL Global Forwarding.`
14. `What percentage of total spend does Kuehne+Nagel represent?`

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/freight` | Return all headers and line items (with live USD conversion) |
| `POST` | `/api/freight` | Save a new invoice (returns `{ duplicate: true }` if ID exists) |
| `PUT` | `/api/freight/:invoiceId` | Overwrite an existing invoice |
| `POST` | `/api/extract` | Extract invoice data from an uploaded PDF/image using Gemini Vision |
| `POST` | `/api/analytics` | Answer a natural-language question about the freight data |

---

## Project Structure

```
artifacts/api-server/src/
├── app.ts            # Express app setup (CORS, JSON body parsing)
├── index.ts          # Server entry point (binds to $PORT)
├── db.ts             # SQLite init, schema creation, CSV + sample seeding
├── rates.ts          # Live exchange rate fetching + 1-hour cache
└── routes/
    ├── freight.ts    # GET / POST / PUT invoice routes
    ├── extract.ts    # Gemini Vision extraction route
    └── analytics.ts  # Agentic NL analytics route

artifacts/logistics-engine/src/
├── App.tsx                     # Root component, tab routing, TanStack Query
├── lib/api.ts                  # API client functions + TypeScript types
└── components/
    ├── Sidebar.tsx              # Invoice uploader, manual entry, editor, save flow
    ├── ChatTab.tsx              # Analytics chat UI with context history
    └── DataLakeTab.tsx          # Data lake table + charts (USD-converted)
```

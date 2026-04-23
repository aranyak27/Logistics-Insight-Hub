# Workspace

## Overview

pnpm workspace monorepo using TypeScript, plus a Python Streamlit application (Logistics Intelligence Engine) at the workspace root.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Logistics Intelligence Engine (Python / Streamlit)

A single-page Streamlit app for logistics freight intelligence.

### Files
- `app.py` — Main Streamlit application
- `freight_data.csv` — Local CSV data lake (invoice_id, vendor, date, amount, category)
- `.streamlit/config.toml` — Streamlit server config + GoComet Blue theme

### Features
1. **Vision Document Agent** — Sidebar PDF/image uploader using Gemini Vision to extract invoice fields (Vendor, Date, Invoice ID, Line Items). Displays in editable `data_editor` before saving.
2. **Agentic Analytics Chat** — Natural language queries that generate + execute Python/pandas code against the CSV, showing: text summary, expandable code logic, result table, and Plotly chart.
3. **Live Data Lake Linkage** — CSV is read fresh on every query, so newly saved invoices are immediately queryable.
4. **Trust & UI** — Returns "I don't have data for that" when data is missing. GoComet Blue theme via Streamlit config.

### AI Model
- Uses `google-genai` Python SDK with `gemini-2.0-flash` model
- Requires `GEMINI_API_KEY` secret

### Workflow
- Name: `Logistics Intelligence Engine`
- Command: `streamlit run app.py --server.port 5000`
- Port: 5000

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

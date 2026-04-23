import { useRef, useState } from "react";
import { extractInvoice, saveFreightRows, type ExtractedRow } from "../lib/api";

interface Props {
  recordCount: number;
  vendorCount: number;
  onSaved: () => void;
}

const CATEGORIES = [
  "Ocean Freight", "Air Freight", "Ground Freight",
  "Customs & Duties", "Warehousing", "Other",
];

export function Sidebar({ recordCount, vendorCount, onSaved }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ExtractedRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setLoading(true);
    setError(null);
    setRows(null);
    setSaveMsg(null);
    try {
      const data = await extractInvoice(file);
      setRows(data.rows);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  function updateRow(idx: number, field: keyof ExtractedRow, value: string) {
    if (!rows) return;
    const updated = [...rows];
    if (field === "amount") {
      updated[idx] = { ...updated[idx], amount: parseFloat(value) || 0 };
    } else {
      updated[idx] = { ...updated[idx], [field]: value };
    }
    setRows(updated);
  }

  async function handleSave() {
    if (!rows) return;
    setLoading(true);
    try {
      await saveFreightRows(rows);
      setSaveMsg(`${rows.length} record(s) saved to data lake!`);
      setRows(null);
      setFileName(null);
      if (fileRef.current) fileRef.current.value = "";
      onSaved();
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    setRows(null);
    setFileName(null);
    setError(null);
    setSaveMsg(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <aside className="w-72 shrink-0 bg-white border-r border-border flex flex-col h-screen overflow-y-auto scrollbar-thin">
      {/* Brand */}
      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🚢</span>
          <div>
            <p className="font-bold text-primary leading-tight">LogiQ Engine</p>
            <p className="text-xs text-muted-foreground">Powered by Gemini AI</p>
          </div>
        </div>
      </div>

      {/* Invoice uploader */}
      <div className="px-5 py-4 border-b border-border">
        <p className="font-semibold text-sm mb-1">📄 Invoice Uploader</p>
        <p className="text-xs text-muted-foreground mb-3">
          Upload a PDF or image invoice to extract and review data.
        </p>
        <label className="flex flex-col items-center gap-2 border-2 border-dashed border-border rounded-lg p-4 cursor-pointer hover:border-primary transition-colors">
          <span className="text-2xl">⬆️</span>
          <span className="text-xs text-muted-foreground text-center">
            {fileName ? fileName : "Choose a PDF or image\n(PNG, JPG, PDF)"}
          </span>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp"
            className="hidden"
            onChange={handleFile}
          />
        </label>

        {loading && (
          <div className="mt-3 flex items-center gap-2 text-sm text-primary">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span>{rows ? "Saving…" : "Extracting with Gemini Vision…"}</span>
          </div>
        )}

        {error && (
          <div className="mt-3 p-2 bg-destructive/10 border border-destructive/30 rounded text-xs text-destructive">
            {error}
          </div>
        )}

        {saveMsg && (
          <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded text-xs text-green-700">
            ✅ {saveMsg}
          </div>
        )}
      </div>

      {/* Editable extracted rows */}
      {rows && rows.length > 0 && (
        <div className="px-5 py-4 border-b border-border flex flex-col gap-3">
          <p className="font-semibold text-sm">✏️ Review &amp; Edit</p>
          <p className="text-xs text-muted-foreground">
            Correct any extraction errors below, then save.
          </p>
          {rows.map((row, i) => (
            <div key={i} className="border border-border rounded-lg p-3 bg-secondary/30 flex flex-col gap-2 text-xs">
              <label className="flex flex-col gap-0.5">
                <span className="text-muted-foreground font-medium">Invoice ID</span>
                <input
                  className="border border-border rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                  value={row.invoice_id}
                  onChange={(e) => updateRow(i, "invoice_id", e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-0.5">
                <span className="text-muted-foreground font-medium">Vendor</span>
                <input
                  className="border border-border rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                  value={row.vendor}
                  onChange={(e) => updateRow(i, "vendor", e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-0.5">
                <span className="text-muted-foreground font-medium">Date (YYYY-MM-DD)</span>
                <input
                  className="border border-border rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                  value={row.date}
                  onChange={(e) => updateRow(i, "date", e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-0.5">
                <span className="text-muted-foreground font-medium">Amount ($)</span>
                <input
                  type="number"
                  className="border border-border rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                  value={row.amount}
                  onChange={(e) => updateRow(i, "amount", e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-0.5">
                <span className="text-muted-foreground font-medium">Category</span>
                <select
                  className="border border-border rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                  value={row.category}
                  onChange={(e) => updateRow(i, "category", e.target.value)}
                >
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </label>
            </div>
          ))}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex-1 bg-primary text-primary-foreground text-xs font-semibold py-2 px-3 rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              💾 Save to Data Lake
            </button>
            <button
              onClick={handleClear}
              className="flex-1 border border-border text-xs font-semibold py-2 px-3 rounded-lg hover:bg-muted transition-colors"
            >
              🗑️ Clear
            </button>
          </div>
        </div>
      )}

      {/* Data lake status */}
      <div className="px-5 py-4 mt-auto">
        <p className="font-semibold text-sm mb-3">📊 Data Lake Status</p>
        {recordCount === 0 ? (
          <div className="p-3 bg-secondary rounded-lg text-xs text-muted-foreground">
            Data lake is empty. Upload invoices to begin.
          </div>
        ) : (
          <div className="flex gap-3">
            <div className="flex-1 bg-secondary rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-primary">{recordCount}</p>
              <p className="text-xs text-muted-foreground">Records</p>
            </div>
            <div className="flex-1 bg-secondary rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-primary">{vendorCount}</p>
              <p className="text-xs text-muted-foreground">Vendors</p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

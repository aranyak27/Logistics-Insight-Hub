import { useRef, useState } from "react";
import {
  extractInvoice,
  saveInvoice,
  overwriteInvoice,
  type ExtractedInvoice,
  type InvoiceHeader,
} from "../lib/api";

interface Props {
  invoiceCount: number;
  supplierCount: number;
  onSaved: () => void;
}

const CURRENCIES = ["USD", "INR", "EUR", "GBP", "SGD", "AED", "CNY"];

const BLANK_INVOICE: ExtractedInvoice = {
  invoice_id: "",
  supplier_name: "",
  invoice_date: null,
  grand_total: 0,
  currency: "USD",
  line_items: [{ description: "", quantity: 1, unit_price: 0, total_price: 0 }],
};

export function Sidebar({ invoiceCount, supplierCount, onSaved }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<ExtractedInvoice | null>(null);
  const [isManual, setIsManual] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<InvoiceHeader | null>(null);

  function handleManualEntry() {
    setInvoice({ ...BLANK_INVOICE, line_items: [{ description: "", quantity: 1, unit_price: 0, total_price: 0 }] });
    setIsManual(true);
    setFileName(null);
    setError(null);
    setSaveMsg(null);
    setDuplicate(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setIsManual(false);
    setLoading(true);
    setError(null);
    setInvoice(null);
    setSaveMsg(null);
    setDuplicate(null);
    try {
      const data = await extractInvoice(file);
      setInvoice(data);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  function updateHeader(field: keyof Omit<ExtractedInvoice, "line_items">, value: string) {
    if (!invoice) return;
    if (field === "grand_total") {
      setInvoice({ ...invoice, grand_total: parseFloat(value) || 0 });
    } else {
      setInvoice({ ...invoice, [field]: value });
    }
  }

  function updateLineItem(idx: number, field: string, value: string) {
    if (!invoice) return;
    const items = [...invoice.line_items];
    const num = parseFloat(value) || 0;
    items[idx] = { ...items[idx], [field]: ["quantity", "unit_price", "total_price"].includes(field) ? num : value };
    if (field === "quantity" || field === "unit_price") {
      items[idx].total_price = parseFloat((items[idx].quantity * items[idx].unit_price).toFixed(2));
    }
    setInvoice({ ...invoice, line_items: items });
  }

  function addLineItem() {
    if (!invoice) return;
    setInvoice({
      ...invoice,
      line_items: [...invoice.line_items, { description: "", quantity: 1, unit_price: 0, total_price: 0 }],
    });
  }

  function removeLineItem(idx: number) {
    if (!invoice) return;
    const items = invoice.line_items.filter((_, i) => i !== idx);
    setInvoice({ ...invoice, line_items: items });
  }

  async function handleSave() {
    if (!invoice) return;
    setLoading(true);
    setDuplicate(null);
    try {
      const result = await saveInvoice(invoice);
      if (result.duplicate) {
        setDuplicate(result.existing!);
      } else {
        setSaveMsg(`Invoice ${invoice.invoice_id} saved with ${invoice.line_items.length} line item(s).`);
        resetForm();
        onSaved();
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleOverwrite() {
    if (!invoice) return;
    setLoading(true);
    setDuplicate(null);
    try {
      await overwriteInvoice(invoice);
      setSaveMsg(`Invoice ${invoice.invoice_id} overwritten successfully.`);
      resetForm();
      onSaved();
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  function handleSkip() {
    setDuplicate(null);
    setSaveMsg(`Skipped — invoice ${invoice?.invoice_id} already exists in the data lake.`);
    resetForm();
  }

  function resetForm() {
    setInvoice(null);
    setFileName(null);
    setIsManual(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleClear() {
    resetForm();
    setError(null);
    setSaveMsg(null);
    setDuplicate(null);
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

        <button
          onClick={handleManualEntry}
          className="mt-2 w-full text-xs text-primary border border-primary/30 rounded-lg py-2 hover:bg-primary/5 transition-colors font-medium"
        >
          ✏️ Enter Manually
        </button>

        {loading && (
          <div className="mt-3 flex items-center gap-2 text-sm text-primary">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span>{invoice ? "Saving…" : "Extracting with Gemini Vision…"}</span>
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

      {/* Editable invoice */}
      {invoice && (
        <div className="px-5 py-4 border-b border-border flex flex-col gap-3">
          <p className="font-semibold text-sm">
            {isManual ? "✏️ New Invoice" : "✏️ Review & Edit"}
          </p>
          <p className="text-xs text-muted-foreground">
            {isManual ? "Fill in the invoice details, then save." : "Correct any extraction errors, then save."}
          </p>

          {/* Header fields */}
          <div className="border border-primary/20 rounded-lg p-3 bg-primary/5 flex flex-col gap-2 text-xs">
            <p className="font-semibold text-primary text-xs uppercase tracking-wide">Invoice Header</p>
            <label className="flex flex-col gap-0.5">
              <span className="text-muted-foreground font-medium">Invoice ID</span>
              <input
                className="border border-border rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                value={invoice.invoice_id}
                onChange={(e) => updateHeader("invoice_id", e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-muted-foreground font-medium">Supplier Name</span>
              <input
                className="border border-border rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                value={invoice.supplier_name}
                onChange={(e) => updateHeader("supplier_name", e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-muted-foreground font-medium">Date (YYYY-MM-DD)</span>
              <input
                className="border border-border rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                value={invoice.invoice_date ?? ""}
                placeholder="null if unknown"
                onChange={(e) => updateHeader("invoice_date", e.target.value || "")}
              />
            </label>
            <div className="flex gap-2">
              <label className="flex flex-col gap-0.5 flex-1">
                <span className="text-muted-foreground font-medium">Grand Total</span>
                <input
                  type="number"
                  className="border border-border rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                  value={invoice.grand_total}
                  onChange={(e) => updateHeader("grand_total", e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-0.5 w-20">
                <span className="text-muted-foreground font-medium">Currency</span>
                <select
                  className="border border-border rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                  value={invoice.currency}
                  onChange={(e) => updateHeader("currency", e.target.value)}
                >
                  {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </label>
            </div>
          </div>

          {/* Line items */}
          <div className="flex flex-col gap-2">
            <p className="font-semibold text-primary text-xs uppercase tracking-wide">Line Items</p>
            {invoice.line_items.map((li, i) => (
              <div key={i} className="border border-border rounded-lg p-3 bg-secondary/30 flex flex-col gap-2 text-xs relative">
                <button
                  onClick={() => removeLineItem(i)}
                  className="absolute top-2 right-2 text-muted-foreground hover:text-destructive text-xs"
                  title="Remove line item"
                >✕</button>
                <label className="flex flex-col gap-0.5">
                  <span className="text-muted-foreground font-medium">Description</span>
                  <input
                    className="border border-border rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                    value={li.description}
                    onChange={(e) => updateLineItem(i, "description", e.target.value)}
                  />
                </label>
                <div className="flex gap-2">
                  <label className="flex flex-col gap-0.5 flex-1">
                    <span className="text-muted-foreground font-medium">Qty</span>
                    <input
                      type="number"
                      className="border border-border rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                      value={li.quantity}
                      onChange={(e) => updateLineItem(i, "quantity", e.target.value)}
                    />
                  </label>
                  <label className="flex flex-col gap-0.5 flex-1">
                    <span className="text-muted-foreground font-medium">Unit Price</span>
                    <input
                      type="number"
                      className="border border-border rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                      value={li.unit_price}
                      onChange={(e) => updateLineItem(i, "unit_price", e.target.value)}
                    />
                  </label>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-border mt-1">
                  <span className="text-muted-foreground">Line Total</span>
                  <span className="font-semibold text-primary">
                    {invoice.currency} {li.total_price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            ))}
            <button
              onClick={addLineItem}
              className="text-xs text-primary border border-dashed border-primary/40 rounded-lg py-2 hover:bg-primary/5 transition-colors"
            >
              + Add Line Item
            </button>
          </div>

          {/* Duplicate warning */}
          {duplicate && (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-800 flex flex-col gap-2">
              <p className="font-semibold">⚠️ Duplicate Invoice Detected</p>
              <p>Invoice <span className="font-mono">{duplicate.invoice_id}</span> already exists for <strong>{duplicate.supplier_name}</strong>.</p>
              <div className="flex gap-2 mt-1">
                <button
                  onClick={handleOverwrite}
                  disabled={loading}
                  className="flex-1 bg-amber-600 text-white text-xs font-semibold py-1.5 px-2 rounded hover:bg-amber-700 disabled:opacity-50 transition-colors"
                >
                  Overwrite
                </button>
                <button
                  onClick={handleSkip}
                  className="flex-1 border border-amber-400 text-amber-700 text-xs font-semibold py-1.5 px-2 rounded hover:bg-amber-100 transition-colors"
                >
                  Skip
                </button>
              </div>
            </div>
          )}

          {!duplicate && (
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
          )}
        </div>
      )}

      {/* Data lake status */}
      <div className="px-5 py-4 mt-auto">
        <p className="font-semibold text-sm mb-3">📊 Data Lake Status</p>
        {invoiceCount === 0 ? (
          <div className="p-3 bg-secondary rounded-lg text-xs text-muted-foreground">
            Data lake is empty. Upload invoices to begin.
          </div>
        ) : (
          <div className="flex gap-3">
            <div className="flex-1 bg-secondary rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-primary">{invoiceCount}</p>
              <p className="text-xs text-muted-foreground">Invoices</p>
            </div>
            <div className="flex-1 bg-secondary rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-primary">{supplierCount}</p>
              <p className="text-xs text-muted-foreground">Suppliers</p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

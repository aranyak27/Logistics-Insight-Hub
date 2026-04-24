import { useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { type FreightData } from "../lib/api";

const COLORS = ["#1B5CBA", "#22C55E", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4"];

type TableView = "headers" | "items";

interface Props {
  data: FreightData;
}

export function DataLakeTab({ data }: Props) {
  const { headers, line_items } = data;
  const [tableView, setTableView] = useState<TableView>("headers");

  const totalSpend = useMemo(
    () => headers.reduce((s, h) => s + (h.grand_total ?? 0), 0),
    [headers]
  );
  const avgInvoice = headers.length > 0 ? totalSpend / headers.length : 0;
  const supplierCount = useMemo(() => new Set(headers.map((h) => h.supplier_name)).size, [headers]);

  const supplierSpend = useMemo(() => {
    const m: Record<string, number> = {};
    headers.forEach((h) => {
      m[h.supplier_name] = (m[h.supplier_name] ?? 0) + (h.grand_total ?? 0);
    });
    return Object.entries(m)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [headers]);

  const descriptionSpend = useMemo(() => {
    const m: Record<string, number> = {};
    line_items.forEach((li) => {
      const key = li.description.length > 20 ? li.description.slice(0, 20) + "…" : li.description;
      m[key] = (m[key] ?? 0) + (li.total_price ?? 0);
    });
    return Object.entries(m)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [line_items]);

  if (headers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <span className="text-5xl mb-4">🗄️</span>
        <p className="font-semibold">Data lake is empty</p>
        <p className="text-sm mt-1">Upload an invoice from the sidebar to get started.</p>
      </div>
    );
  }

  const fmt = (v: number) =>
    `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="flex flex-col gap-6">
      {/* Metrics */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Invoices", value: headers.length },
          { label: "Unique Suppliers", value: supplierCount },
          { label: "Total Spend", value: fmt(totalSpend) },
          { label: "Avg Invoice", value: fmt(avgInvoice) },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-bold text-primary mt-1">{value}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-border rounded-xl p-4">
          <p className="font-semibold text-sm text-primary mb-4">Total Spend by Supplier</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={supplierSpend} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EEF4FF" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}`, "Spend"]} />
              <Bar dataKey="value" fill="#1B5CBA" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white border border-border rounded-xl p-4">
          <p className="font-semibold text-sm text-primary mb-4">Spend by Line Item Type</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={descriptionSpend}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={({ name, percent }) =>
                  `${name.length > 10 ? name.slice(0, 10) + "…" : name} ${(percent * 100).toFixed(0)}%`
                }
                labelLine={false}
              >
                {descriptionSpend.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}`, "Spend"]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tables with toggle */}
      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <p className="font-semibold text-sm text-primary">
            {tableView === "headers" ? "Invoice Headers" : "Line Items"}
          </p>
          <div className="flex rounded-lg border border-border overflow-hidden text-xs font-semibold">
            <button
              onClick={() => setTableView("headers")}
              className={`px-3 py-1.5 transition-colors ${tableView === "headers" ? "bg-primary text-white" : "hover:bg-muted text-muted-foreground"}`}
            >
              Headers ({headers.length})
            </button>
            <button
              onClick={() => setTableView("items")}
              className={`px-3 py-1.5 transition-colors border-l border-border ${tableView === "items" ? "bg-primary text-white" : "hover:bg-muted text-muted-foreground"}`}
            >
              Line Items ({line_items.length})
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          {tableView === "headers" ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-secondary text-left">
                  {["Invoice ID", "Supplier", "Date", "Grand Total", "Currency"].map((h) => (
                    <th key={h} className="px-4 py-2 text-xs font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {headers.map((h) => (
                  <tr key={h.invoice_id} className="border-t border-border hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-2 font-mono text-xs">{h.invoice_id}</td>
                    <td className="px-4 py-2">{h.supplier_name}</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {h.invoice_date ?? <span className="italic text-amber-500">missing</span>}
                    </td>
                    <td className="px-4 py-2 font-semibold text-primary">{fmt(h.grand_total)}</td>
                    <td className="px-4 py-2">
                      <span className="inline-block bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full">
                        {h.currency}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-secondary text-left">
                  {["#", "Invoice ID", "Description", "Qty", "Unit Price", "Total"].map((h) => (
                    <th key={h} className="px-4 py-2 text-xs font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {line_items.map((li) => (
                  <tr key={li.item_id} className="border-t border-border hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-2 text-muted-foreground text-xs">{li.item_id}</td>
                    <td className="px-4 py-2 font-mono text-xs">{li.invoice_id}</td>
                    <td className="px-4 py-2">{li.description}</td>
                    <td className="px-4 py-2 text-muted-foreground">{li.quantity}</td>
                    <td className="px-4 py-2 text-muted-foreground">{fmt(li.unit_price)}</td>
                    <td className="px-4 py-2 font-semibold text-primary">{fmt(li.total_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

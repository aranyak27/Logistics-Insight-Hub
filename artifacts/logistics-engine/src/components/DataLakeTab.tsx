import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { type FreightRow } from "../lib/api";

const COLORS = ["#1B5CBA", "#22C55E", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4"];

interface Props {
  rows: FreightRow[];
}

export function DataLakeTab({ rows }: Props) {
  const totalSpend = useMemo(
    () => rows.reduce((s, r) => s + parseFloat(r.amount || "0"), 0),
    [rows]
  );
  const avgInvoice = rows.length > 0 ? totalSpend / rows.length : 0;
  const vendors = useMemo(() => new Set(rows.map((r) => r.vendor)).size, [rows]);

  const vendorSpend = useMemo(() => {
    const m: Record<string, number> = {};
    rows.forEach((r) => {
      m[r.vendor] = (m[r.vendor] ?? 0) + parseFloat(r.amount || "0");
    });
    return Object.entries(m)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [rows]);

  const categorySpend = useMemo(() => {
    const m: Record<string, number> = {};
    rows.forEach((r) => {
      m[r.category] = (m[r.category] ?? 0) + parseFloat(r.amount || "0");
    });
    return Object.entries(m)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [rows]);

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <span className="text-5xl mb-4">🗄️</span>
        <p className="font-semibold">Data lake is empty</p>
        <p className="text-sm mt-1">Upload an invoice from the sidebar to get started.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Metrics */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Records", value: rows.length },
          { label: "Unique Vendors", value: vendors },
          { label: "Total Spend", value: `$${totalSpend.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
          { label: "Avg Invoice", value: `$${avgInvoice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
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
          <p className="font-semibold text-sm text-primary mb-4">Total Spend by Vendor</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={vendorSpend} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EEF4FF" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}`, "Spend"]} />
              <Bar dataKey="value" fill="#1B5CBA" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white border border-border rounded-xl p-4">
          <p className="font-semibold text-sm text-primary mb-4">Spend by Category</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={categorySpend}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={({ name, percent }) =>
                  `${name.length > 12 ? name.slice(0, 12) + "…" : name} ${(percent * 100).toFixed(0)}%`
                }
                labelLine={false}
              >
                {categorySpend.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}`, "Spend"]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Full table */}
      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <p className="font-semibold text-sm text-primary">Full Dataset</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary text-left">
                {["Invoice ID", "Vendor", "Date", "Amount", "Category"].map((h) => (
                  <th key={h} className="px-4 py-2 text-xs font-semibold text-muted-foreground">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-border hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-2 font-mono text-xs">{r.invoice_id}</td>
                  <td className="px-4 py-2">{r.vendor}</td>
                  <td className="px-4 py-2 text-muted-foreground">{r.date}</td>
                  <td className="px-4 py-2 font-semibold text-primary">
                    ${parseFloat(r.amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-2">
                    <span className="inline-block bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full">
                      {r.category}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchFreight, deleteInvoice } from "./lib/api";
import { Sidebar } from "./components/Sidebar";
import { ChatTab } from "./components/ChatTab";
import { DataLakeTab } from "./components/DataLakeTab";

type Tab = "chat" | "lake";

export default function App() {
  const [tab, setTab] = useState<Tab>("chat");
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["freight"],
    queryFn: fetchFreight,
    refetchInterval: false,
  });

  const headers = data?.headers ?? [];
  const lineItems = data?.line_items ?? [];
  const supplierCount = new Set(headers.map((h) => h.supplier_name)).size;

  const onSaved = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["freight"] });
  }, [queryClient]);

  const onDelete = useCallback(async (invoiceId: string) => {
    await deleteInvoice(invoiceId);
    queryClient.invalidateQueries({ queryKey: ["freight"] });
  }, [queryClient]);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar
        invoiceCount={headers.length}
        supplierCount={supplierCount}
        onSaved={onSaved}
      />

      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-border px-6 py-3 flex items-center gap-3 shrink-0">
          <span className="text-2xl">🚢</span>
          <div>
            <h1 className="text-lg font-bold text-primary leading-tight">
              Logistics Intelligence Engine
            </h1>
            <p className="text-xs text-muted-foreground">
              <strong>Gemini Vision</strong> extracts invoices ·{" "}
              <strong>Agentic Analytics</strong> answers data questions ·{" "}
              <strong>Live Data Lake</strong> keeps everything in sync
            </p>
          </div>
        </header>

        {/* Tabs */}
        <div className="bg-white border-b border-border px-6 shrink-0">
          <div className="flex gap-0">
            {(["chat", "lake"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
                  tab === t
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t === "chat" ? "💬 Analytics Chat" : "🗄️ Data Lake"}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-auto p-6">
          {tab === "chat" ? (
            <div className="h-full flex flex-col max-w-4xl mx-auto">
              <ChatTab hasData={headers.length > 0} />
            </div>
          ) : (
            <DataLakeTab data={{ headers, line_items: lineItems }} onDelete={onDelete} />
          )}
        </div>
      </main>
    </div>
  );
}

import { useState, useRef, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line,
} from "recharts";
import { queryAnalytics, type AnalyticsResult, type HistoryItem } from "../lib/api";

const COLORS = ["#1B5CBA", "#22C55E", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4"];

interface Message {
  role: "user" | "assistant";
  text: string;
  result?: AnalyticsResult;
  error?: string;
}

function ResultChart({ result }: { result: AnalyticsResult }) {
  if (result.chart_type === "none" || result.chart_data.length === 0) return null;
  return (
    <div className="mt-3">
      <p className="text-xs font-semibold text-muted-foreground mb-2">{result.chart_title}</p>
      <ResponsiveContainer width="100%" height={220}>
        {result.chart_type === "pie" ? (
          <PieChart>
            <Pie data={result.chart_data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
              {result.chart_data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}`, "Value"]} />
          </PieChart>
        ) : result.chart_type === "line" ? (
          <LineChart data={result.chart_data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EEF4FF" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Line type="monotone" dataKey="value" stroke="#1B5CBA" strokeWidth={2} dot={{ r: 4 }} />
          </LineChart>
        ) : (
          <BarChart data={result.chart_data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EEF4FF" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="value" fill="#1B5CBA" radius={[4, 4, 0, 0]} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

function AssistantMessage({ msg }: { msg: Message }) {
  const [codeOpen, setCodeOpen] = useState(false);
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-sm shrink-0">
        🚢
      </div>
      <div className="flex-1 min-w-0">
        {msg.error ? (
          <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive">
            {msg.error}
          </div>
        ) : (
          <div className="bg-white border border-border rounded-xl p-4 flex flex-col gap-3">
            <p className="text-sm leading-relaxed">{msg.text}</p>

            {msg.result?.code && (
              <div>
                <button
                  onClick={() => setCodeOpen((o) => !o)}
                  className="flex items-center gap-1 text-xs text-primary font-semibold hover:underline"
                >
                  🔍 {codeOpen ? "Hide" : "View"} Logic — Python code equivalent
                </button>
                {codeOpen && (
                  <div className="mt-2 flex flex-col gap-1">
                    {msg.result.explanation && (
                      <p className="text-xs text-muted-foreground italic">{msg.result.explanation}</p>
                    )}
                    <pre className="bg-gray-900 text-green-300 text-xs p-3 rounded-lg overflow-x-auto">
                      <code>{msg.result.code}</code>
                    </pre>
                  </div>
                )}
              </div>
            )}

            {msg.result && msg.result.result_rows.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">Result Table:</p>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-secondary">
                        {msg.result.result_cols.map((c) => (
                          <th key={c} className="px-3 py-2 text-left text-muted-foreground font-semibold">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {msg.result.result_rows.map((row, i) => (
                        <tr key={i} className="border-t border-border">
                          {msg.result!.result_cols.map((c) => (
                            <td key={c} className="px-3 py-2">{String(row[c] ?? "")}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {msg.result && <ResultChart result={msg.result} />}
          </div>
        )}
      </div>
    </div>
  );
}

export function ChatTab({ hasData }: { hasData: boolean }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = input.trim();
    if (!q || loading) return;
    setInput("");

    const userMsg: Message = { role: "user", text: q };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    const history: HistoryItem[] = messages
      .filter((m) => m.role === "assistant" && !m.error)
      .map((m) => ({ question: messages[messages.indexOf(m) - 1]?.text ?? "", summary: m.text }))
      .filter((h) => h.question);

    try {
      const result = await queryAnalytics(q, history);
      setMessages((prev) => [...prev, { role: "assistant", text: result.summary, result }]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: "assistant", text: "", error: String(err) }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="mb-3">
        <h2 className="text-lg font-bold text-primary">💬 Analytics Chat</h2>
        <p className="text-sm text-muted-foreground">
          Ask natural language questions about your freight data. Follow-up questions maintain context —
          try: <em>"Now filter that by Maersk"</em>.
        </p>
      </div>

      {/* Message history */}
      <div className="flex-1 overflow-y-auto scrollbar-thin flex flex-col gap-4 pb-4 min-h-0">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <span className="text-5xl mb-4">💬</span>
            <p className="font-semibold">{hasData ? "Ask a question about your freight data" : "No data yet"}</p>
            <p className="text-sm mt-1">
              {hasData
                ? 'Try: "What is my total spend?" or "Which vendor is most expensive?"'
                : "Upload an invoice from the sidebar to begin."}
            </p>
            {hasData && (
              <div className="mt-6 grid grid-cols-2 gap-2">
                {[
                  "What is my total spend?",
                  "Which vendor has the highest cost?",
                  "Show spend by category",
                  "List all ocean freight invoices",
                ].map((s) => (
                  <button
                    key={s}
                    onClick={() => setInput(s)}
                    className="text-left text-xs border border-border rounded-lg px-3 py-2 hover:bg-secondary hover:border-primary transition-colors text-muted-foreground hover:text-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {messages.map((msg, i) =>
          msg.role === "user" ? (
            <div key={i} className="flex gap-3 justify-end">
              <div className="max-w-[75%] bg-primary text-primary-foreground rounded-xl px-4 py-2 text-sm">
                {msg.text}
              </div>
            </div>
          ) : (
            <AssistantMessage key={i} msg={msg} />
          )
        )}

        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-sm shrink-0">
              🚢
            </div>
            <div className="bg-white border border-border rounded-xl px-4 py-3 flex items-center gap-2">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full bg-primary animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
              <span className="text-xs text-muted-foreground">Analyzing with Gemini…</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2 mt-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question about your freight data…"
          className="flex-1 border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="bg-primary text-primary-foreground px-5 py-3 rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  );
}

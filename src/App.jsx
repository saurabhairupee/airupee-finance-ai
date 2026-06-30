import { useState } from "react";

const C = {
  bg: "#060d1f",
  surface: "#0d1729",
  card: "#111f35",
  cardHover: "#162540",
  border: "#1e3a5f",
  accent: "#3b82f6",
  accentLight: "#60a5fa",
  green: "#10b981",
  greenLight: "#34d399",
  amber: "#f59e0b",
  red: "#ef4444",
  purple: "#8b5cf6",
  pink: "#ec4899",
  text: "#f1f5f9",
  muted: "#94a3b8",
  dim: "#475569",
};

// ── PLANS ──────────────────────────────────────────────────────
const PLANS = {
  free: { id: "free", name: "FREE", color: C.muted, model: "Gemini Flash", queriesPerDay: 2 },
  payonce: { id: "payonce", name: "PAY-ONCE", color: C.pink, model: "Gemini Flash", queriesPerDay: "1 task" },
  starter: { id: "starter", name: "STARTER", color: C.accent, model: "Gemini Flash", queriesPerDay: 30 },
  pro: { id: "pro", name: "PRO", color: C.green, model: "Claude Sonnet", queriesPerDay: "Unlimited" },
  firm: { id: "firm", name: "CA FIRM", color: C.purple, model: "Claude Sonnet", queriesPerDay: "Unlimited" },
};

const planCards = [
  { ...PLANS.free, price: "₹0", period: "forever", icon: "🆓", desc: "Try it out", tools: 3, badge: null },
  { ...PLANS.payonce, price: "₹49", period: "/task", icon: "🎫", desc: "No commitment", tools: 10, badge: null },
  { ...PLANS.starter, price: "₹99", period: "/month", icon: "⚡", desc: "Individuals", tools: 5, badge: null },
  { ...PLANS.pro, price: "₹199", period: "/month", icon: "🚀", desc: "Finance professionals", tools: 10, badge: "MOST POPULAR" },
  { ...PLANS.firm, price: "₹2,999", period: "/month", icon: "🏢", desc: "CA firms & teams", tools: 10, badge: "10 USERS" },
];

// ── TOOLS — outcome-based naming ─────────────────────────────────
const TOOLS = [
  {
    id: "chat", icon: "💬", name: "Get Instant Finance Answers", category: "Core",
    desc: "Ask anything — IFRS, GST, tax, investing, journal entries",
    minPlan: "free", modelTier: "light",
  },
  {
    id: "tax", icon: "🧾", name: "Get Tax & GST Guidance", category: "Compliance",
    desc: "India GST, Income Tax, TDS rates with real examples",
    minPlan: "free", modelTier: "light",
  },
  {
    id: "email", icon: "📧", name: "Get Your Finance Email Drafted", category: "Communication",
    desc: "Professional emails — vendor reminders, audit responses, approvals",
    minPlan: "free", modelTier: "light",
  },
  {
    id: "invoice", icon: "📄", name: "Get Your Invoice GL-Coded", category: "Operations",
    desc: "Extract data, suggest GL codes, flag issues automatically",
    minPlan: "free", modelTier: "light",
  },
  {
    id: "ratio", icon: "📐", name: "Get Your Financial Ratios Calculated", category: "Reporting",
    desc: "15+ liquidity, profitability, efficiency & leverage ratios with commentary",
    minPlan: "starter", modelTier: "heavy",
  },
  {
    id: "variance", icon: "📊", name: "Get Your Variance Report Written", category: "Reporting",
    desc: "CFO-level budget vs actual commentary, ready to send",
    minPlan: "starter", modelTier: "heavy",
  },
  {
    id: "commentary", icon: "✍️", name: "Get Your Board Report Drafted", category: "Reporting",
    desc: "Board reports, MD&A, investor updates — formal & polished",
    minPlan: "starter", modelTier: "heavy",
  },
  {
    id: "cashflow", icon: "💰", name: "Get Your Cash Flow Forecasted", category: "Planning",
    desc: "3-12 month cash position prediction with liquidity risk flags",
    minPlan: "pro", modelTier: "heavy",
  },
  {
    id: "fraud", icon: "🔍", name: "Get Your Transactions Fraud-Checked", category: "Audit",
    desc: "Spot duplicates, anomalies, suspicious patterns automatically",
    minPlan: "pro", modelTier: "heavy",
  },
  {
    id: "contract", icon: "📑", name: "Get Your Contract Risk-Analyzed", category: "Operations",
    desc: "Extract financial terms, flag risky clauses, plain-English summary",
    minPlan: "pro", modelTier: "heavy",
  },
];

const planRank = { free: 0, payonce: 1, starter: 1, pro: 2, firm: 2 };

const hasAccess = (userPlan, toolMinPlan) => planRank[userPlan] >= planRank[toolMinPlan];

// ── MODEL ROUTING ─────────────────────────────────────────────
// Free & Starter (light usage) → Gemini Flash (cheap, fast)
// Pro & Firm (paying for quality) → Claude Sonnet (best reasoning)
const callAI = async (prompt, systemPrompt, userPlan) => {
  const useGemini = userPlan === "free" || userPlan === "starter" || userPlan === "payonce";

  if (useGemini) {
    // Gemini Flash — cheap, free-tier friendly, used for free/starter/payonce
    try {
      const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=YOUR_GEMINI_API_KEY",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${systemPrompt}\n\n${prompt}` }] }],
            generationConfig: { maxOutputTokens: 600 }
          }),
        }
      );
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, please try again.";
    } catch {
      return "Connection error. Please try again.";
    }
  } else {
    // Claude Sonnet — Pro & Firm tier, better reasoning for complex outputs
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1200,
        system: systemPrompt,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await response.json();
    return data.content?.[0]?.text || "Sorry, please try again.";
  }
};

const Spinner = ({ label = "AI is thinking..." }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10, color: C.muted, fontSize: 14 }}>
    <div style={{ width: 18, height: 18, border: `2px solid ${C.border}`, borderTop: `2px solid ${C.accent}`, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
    {label}
  </div>
);

const LockedPanel = ({ tool, onUpgrade }) => {
  const requiredPlanCard = planCards.find(p => p.id === tool.minPlan);
  return (
    <div style={{ padding: 40, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", textAlign: "center" }}>
      <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>🔒</div>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{tool.name} is a {requiredPlanCard?.name} feature</div>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 24, maxWidth: 360 }}>
        Upgrade to {requiredPlanCard?.name} ({requiredPlanCard?.price}{requiredPlanCard?.period}) to unlock this tool, or buy a single ₹49 task pack.
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={() => onUpgrade(tool.minPlan)} style={{
          padding: "10px 22px", borderRadius: 10, border: "none",
          background: `linear-gradient(135deg, ${requiredPlanCard?.color}, ${requiredPlanCard?.color}cc)`,
          color: "white", fontWeight: 700, cursor: "pointer", fontSize: 13
        }}>Upgrade to {requiredPlanCard?.name} →</button>
        <button onClick={() => onUpgrade("payonce")} style={{
          padding: "10px 22px", borderRadius: 10, border: `1px solid ${C.pink}`,
          background: "transparent", color: C.pink, fontWeight: 700, cursor: "pointer", fontSize: 13
        }}>Try once — ₹49</button>
      </div>
    </div>
  );
};

const UsageBar = ({ userPlan, used, limit }) => {
  if (limit === "Unlimited" || limit === "1 task") return null;
  const pct = Math.min(100, (used / limit) * 100);
  return (
    <div style={{ padding: "10px 24px", background: C.surface, borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{ fontSize: 11, color: C.muted, whiteSpace: "nowrap" }}>{used}/{limit} queries today</span>
      <div style={{ flex: 1, height: 5, background: C.border, borderRadius: 3, maxWidth: 200 }}>
        <div style={{ height: "100%", width: `${pct}%`, background: pct > 80 ? C.red : C.accent, borderRadius: 3, transition: "width 0.3s" }} />
      </div>
      <span style={{ fontSize: 10, color: C.dim, marginLeft: "auto" }}>{PLANS[userPlan]?.model}</span>
    </div>
  );
};

// ── GENERIC TOOL PANEL ────────────────────────────────────────
function ToolPanel({ tool, userPlan, onUse }) {
  const [input, setInput] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const systemPrompts = {
    chat: "You are an expert Finance AI assistant specializing in Indian finance, accounting, IFRS, and corporate finance. Give precise, practical, professional answers. Use ₹ for Indian Rupee.",
    tax: "You are an expert Indian tax advisor (CA level). Give accurate, practical advice with specific current rates and examples on GST, Income Tax, TDS.",
    email: "You are a senior Finance Manager writing professional business emails. Write clear, concise, effective finance emails with subject line, greeting, body, and sign-off.",
    invoice: "You are an expert AP accountant. Extract invoice data and suggest GL codes precisely for a hospitality/services company.",
    ratio: "You are a financial analyst. Calculate and explain financial ratios (liquidity, profitability, efficiency, leverage) with plain-English commentary and India context where relevant.",
    variance: "You are a CFO writing board-level variance analysis. Be precise, professional and insightful.",
    commentary: "You are a CFO writing professional financial reports for board members and investors. Use formal, confident, authoritative language.",
    cashflow: "You are a treasury manager and cash flow expert. Create realistic, detailed forecasts with practical recommendations for Indian businesses.",
    fraud: "You are a forensic accountant. Analyze transactions for fraud red flags — duplicates, ghost vendors, split invoices, round numbers just below approval thresholds.",
    contract: "You are a contract review specialist with finance expertise. Extract key financial terms, payment conditions, penalties, and flag risky or one-sided clauses in plain English.",
  };

  const placeholders = {
    chat: "Ask any finance question... e.g. What is IFRS 15?",
    tax: "e.g. GST on hotel services, TDS on professional fees...",
    email: "Describe the situation... e.g. Vendor payment is 30 days overdue",
    invoice: "Paste invoice text here...",
    ratio: "Paste P&L/Balance Sheet figures... e.g. Revenue: 50,00,000, Net Profit: 8,00,000, Current Assets: 20,00,000, Current Liabilities: 12,00,000",
    variance: "Enter budget vs actual... e.g. Revenue Budget 50,00,000 Actual 46,50,000; Marketing Budget 3,00,000 Actual 4,20,000",
    commentary: "Enter company, period, revenue, expenses, profit, key notes...",
    cashflow: "Opening balance, expected inflows, expected outflows...",
    fraud: "Paste transaction data (Date, Description, Amount, Vendor)...",
    contract: "Paste contract text here...",
  };

  const run = async () => {
    if (!input.trim() || loading) return;
    setLoading(true);
    onUse();
    const res = await callAI(input, systemPrompts[tool.id], userPlan);
    setResult(res);
    setLoading(false);
  };

  return (
    <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14, height: "100%", overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: C.muted }}>Powered by <strong style={{ color: C.accentLight }}>{PLANS[userPlan]?.model}</strong></span>
        <span style={{ fontSize: 10, background: `${C.purple}22`, color: C.purple, padding: "3px 10px", borderRadius: 10 }}>{tool.category}</span>
      </div>
      <textarea value={input} onChange={e => setInput(e.target.value)} rows={6}
        placeholder={placeholders[tool.id]}
        style={{ width: "100%", padding: 14, borderRadius: 10, border: `1px solid ${C.border}`, background: C.card, color: C.text, fontSize: 13, resize: "vertical", outline: "none", boxSizing: "border-box", fontFamily: tool.id === "invoice" || tool.id === "fraud" || tool.id === "contract" ? "monospace" : "inherit" }} />
      <button onClick={run} disabled={loading || !input.trim()} style={{
        padding: "12px 24px", borderRadius: 10, border: "none",
        background: loading ? C.dim : `linear-gradient(135deg, ${C.accent}, #1d4ed8)`,
        color: "white", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontSize: 14
      }}>{loading ? "Working..." : `${tool.icon} ${tool.name}`}</button>
      {loading && <Spinner />}
      {result && (
        <div style={{ background: C.card, border: `1px solid ${C.green}`, borderRadius: 12, padding: 18 }}>
          <pre style={{ color: C.text, fontSize: 13, whiteSpace: "pre-wrap", lineHeight: 1.7, margin: 0, fontFamily: "inherit" }}>{result}</pre>
        </div>
      )}
    </div>
  );
}

// ── PRICING / UPGRADE VIEW ────────────────────────────────────
function PricingView({ userPlan, onSelectPlan }) {
  return (
    <div style={{ padding: 24, overflowY: "auto", height: "100%" }}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>Choose Your Plan</div>
        <div style={{ fontSize: 13, color: C.muted }}>Free & Starter run on Gemini Flash · Pro & Firm run on Claude Sonnet for deeper reasoning</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
        {planCards.map(plan => (
          <div key={plan.id} onClick={() => onSelectPlan(plan.id)} style={{
            background: userPlan === plan.id ? C.cardHover : C.card,
            border: `2px solid ${userPlan === plan.id ? plan.color : C.border}`,
            borderRadius: 14, padding: 18, cursor: "pointer", position: "relative", transition: "all 0.2s"
          }}>
            {plan.badge && <div style={{ position: "absolute", top: -9, left: "50%", transform: "translateX(-50%)", background: plan.color, color: "white", fontSize: 8, fontWeight: 800, padding: "3px 10px", borderRadius: 10, whiteSpace: "nowrap" }}>{plan.badge}</div>}
            <div style={{ fontSize: 24, marginBottom: 6 }}>{plan.icon}</div>
            <div style={{ fontSize: 10, fontWeight: 800, color: plan.color, letterSpacing: 1 }}>{plan.name}</div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>{plan.desc}</div>
            <div style={{ marginBottom: 10 }}>
              <span style={{ fontSize: 24, fontWeight: 900, color: plan.color }}>{plan.price}</span>
              <span style={{ fontSize: 11, color: C.muted }}>{plan.period}</span>
            </div>
            <div style={{ fontSize: 10, color: C.muted, marginBottom: 3 }}>🛠️ {plan.tools}/10 tools</div>
            <div style={{ fontSize: 10, color: C.muted, marginBottom: 3 }}>⚡ {plan.queriesPerDay} {typeof plan.queriesPerDay === "number" ? "queries/day" : ""}</div>
            <div style={{ fontSize: 10, color: C.dim }}>🤖 {plan.model}</div>
            {userPlan === plan.id && <div style={{ marginTop: 10, fontSize: 11, color: plan.color, fontWeight: 700 }}>✓ Current Plan</div>}
          </div>
        ))}
      </div>

      {/* Tool access grid */}
      <div style={{ marginTop: 32 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>What Each Plan Unlocks</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
            <thead>
              <tr style={{ background: C.surface }}>
                <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, color: C.muted }}>Tool</th>
                {planCards.filter(p => p.id !== "payonce").map(p => (
                  <th key={p.id} style={{ padding: "10px 12px", textAlign: "center", fontSize: 11, color: p.color }}>{p.icon} {p.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TOOLS.map((tool, i) => (
                <tr key={tool.id} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? "transparent" : `${C.surface}40` }}>
                  <td style={{ padding: "10px 12px", fontSize: 12, color: C.text }}>{tool.icon} {tool.name}</td>
                  {["free", "starter", "pro", "firm"].map(pid => (
                    <td key={pid} style={{ padding: "10px 12px", textAlign: "center", fontSize: 14 }}>
                      {hasAccess(pid, tool.minPlan) ? <span style={{ color: C.green }}>✅</span> : <span style={{ color: C.dim }}>❌</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────
export default function FinanceAIApp() {
  const [active, setActive] = useState("chat");
  const [userPlan, setUserPlan] = useState("free");
  const [usage, setUsage] = useState({});

  const todayKey = new Date().toDateString();
  const usedToday = usage[todayKey] || 0;
  const dailyLimit = userPlan === "free" ? 2 : userPlan === "starter" ? 30 : "Unlimited";

  const recordUsage = () => {
    setUsage(prev => ({ ...prev, [todayKey]: (prev[todayKey] || 0) + 1 }));
  };

  const limitReached = dailyLimit !== "Unlimited" && usedToday >= dailyLimit;

  const activeTool = TOOLS.find(t => t.id === active);
  const categories = ["Core", "Compliance", "Communication", "Operations", "Reporting", "Planning", "Audit"];

  const renderMain = () => {
    if (active === "pricing") {
      return <PricingView userPlan={userPlan} onSelectPlan={(p) => { setUserPlan(p); }} />;
    }
    if (!activeTool) return null;
    if (!hasAccess(userPlan, activeTool.minPlan)) {
      return <LockedPanel tool={activeTool} onUpgrade={(p) => setUserPlan(p)} />;
    }
    if (limitReached) {
      return (
        <div style={{ padding: 40, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>You've used your {dailyLimit} free queries today</div>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 24, maxWidth: 360 }}>
            Upgrade to Pro for unlimited access, or grab a ₹49 single-task pack right now.
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setUserPlan("pro")} style={{ padding: "10px 22px", borderRadius: 10, border: "none", background: `linear-gradient(135deg, ${C.green}, #059669)`, color: "white", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>Upgrade to Pro — ₹199/mo →</button>
            <button onClick={() => setUserPlan("payonce")} style={{ padding: "10px 22px", borderRadius: 10, border: `1px solid ${C.pink}`, background: "transparent", color: C.pink, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>Buy 1 task — ₹49</button>
          </div>
        </div>
      );
    }
    return <ToolPanel tool={activeTool} userPlan={userPlan} onUse={recordUsage} />;
  };

  return (
    <div style={{ display: "flex", height: "100vh", background: C.bg, color: C.text, fontFamily: "'Inter','DM Sans',system-ui,sans-serif", overflow: "hidden" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 4px; }
        input::placeholder, textarea::placeholder { color: ${C.dim}; }
      `}</style>

      {/* SIDEBAR */}
      <div style={{ width: 230, background: C.surface, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "18px 16px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: `linear-gradient(135deg, ${C.accent}, #1d4ed8)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>₹</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, letterSpacing: -0.5 }}>AIRupee Finance AI</div>
              <div style={{ fontSize: 9, color: C.muted }}>10 tools · Gemini + Claude</div>
            </div>
          </div>
        </div>

        <nav style={{ flex: 1, padding: "10px 8px", display: "flex", flexDirection: "column", gap: 10, overflowY: "auto" }}>
          {categories.map(cat => {
            const toolsInCat = TOOLS.filter(t => t.category === cat);
            if (toolsInCat.length === 0) return null;
            return (
              <div key={cat}>
                <div style={{ fontSize: 9, fontWeight: 800, color: C.dim, letterSpacing: 1, padding: "0 8px", marginBottom: 4 }}>{cat.toUpperCase()}</div>
                {toolsInCat.map(t => {
                  const locked = !hasAccess(userPlan, t.minPlan);
                  return (
                    <button key={t.id} onClick={() => setActive(t.id)} style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 7, width: "100%",
                      border: "none", background: active === t.id ? `${C.accent}22` : "transparent",
                      color: active === t.id ? C.accentLight : locked ? C.dim : C.muted, cursor: "pointer", textAlign: "left",
                      borderLeft: active === t.id ? `3px solid ${C.accent}` : "3px solid transparent",
                    }}>
                      <span style={{ fontSize: 14 }}>{t.icon}</span>
                      <span style={{ fontSize: 11.5, fontWeight: active === t.id ? 700 : 500, flex: 1, lineHeight: 1.3 }}>{t.name}</span>
                      {locked && <span style={{ fontSize: 10 }}>🔒</span>}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        <div style={{ padding: "10px 8px", borderTop: `1px solid ${C.border}` }}>
          <button onClick={() => setActive("pricing")} style={{
            width: "100%", padding: "9px 12px", borderRadius: 8, border: `1px solid ${C.green}`,
            background: active === "pricing" ? `${C.green}22` : "transparent", color: C.greenLight,
            cursor: "pointer", fontSize: 12, fontWeight: 700, marginBottom: 8
          }}>💳 Plans & Pricing</button>
          <div style={{ fontSize: 9, color: C.dim, textAlign: "center" }}>AIRupee.in · v2.0</div>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "14px 24px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 12, background: C.surface }}>
          <span style={{ fontSize: 20 }}>{active === "pricing" ? "💳" : activeTool?.icon}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{active === "pricing" ? "Plans & Pricing" : activeTool?.name}</div>
            <div style={{ fontSize: 11, color: C.muted }}>{active === "pricing" ? "Compare plans and switch anytime" : activeTool?.desc}</div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: `${PLANS[userPlan].color}18`, border: `1px solid ${PLANS[userPlan].color}40`, padding: "4px 10px", borderRadius: 16 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: PLANS[userPlan].color }} />
              <span style={{ fontSize: 11, color: PLANS[userPlan].color, fontWeight: 700 }}>{PLANS[userPlan].name}</span>
            </div>
          </div>
        </div>

        {active !== "pricing" && <UsageBar userPlan={userPlan} used={usedToday} limit={dailyLimit} />}

        <div style={{ flex: 1, overflow: "hidden" }}>
          {renderMain()}
        </div>
      </div>
    </div>
  );
}

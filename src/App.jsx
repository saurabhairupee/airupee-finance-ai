
# Create the COMPLETE fixed App.jsx with client-side tax calculator properly integrated

complete_app_jsx = '''import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import Auth from "./Auth";

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

// ============================================
// TAX CALCULATOR ENGINE (CLIENT-SIDE)
// ============================================
const FY_2026_27 = {
  newRegime: {
    slabs: [
      { limit: 400000, rate: 0 },
      { limit: 800000, rate: 0.05 },
      { limit: 1200000, rate: 0.10 },
      { limit: 1600000, rate: 0.15 },
      { limit: 2000000, rate: 0.20 },
      { limit: 2400000, rate: 0.25 },
      { limit: Infinity, rate: 0.30 }
    ],
    rebate87A: { limit: 1200000, amount: 60000 },
    standardDeduction: 75000,
  },
  oldRegime: {
    slabs: [
      { limit: 250000, rate: 0 },
      { limit: 500000, rate: 0.05 },
      { limit: 1000000, rate: 0.20 },
      { limit: Infinity, rate: 0.30 }
    ],
    rebate87A: { limit: 500000, amount: 12500 },
    standardDeduction: 75000,
  },
  cessRate: 0.04,
};

function calculateTax(income, regime, deductions = {}) {
  let taxableIncome = income;
  const appliedDeductions = [];
  const config = FY_2026_27[regime + 'Regime'];
  
  // Standard Deduction
  if (deductions.isSalaried !== false) {
    taxableIncome -= config.standardDeduction;
    appliedDeductions.push({ name: 'Standard Deduction (Section 16(ia))', amount: config.standardDeduction });
  }
  
  if (regime === 'old') {
    // 80C
    const c80C = Math.min(deductions.c80C || 0, 150000);
    if (c80C > 0) { taxableIncome -= c80C; appliedDeductions.push({ name: '80C (PPF, ELSS, LIC, etc.)', amount: c80C }); }
    
    // 80CCD(1B) - NPS
    const ccd1b = Math.min(deductions.c80CCD_1B || 0, 50000);
    if (ccd1b > 0) { taxableIncome -= ccd1b; appliedDeductions.push({ name: '80CCD(1B) - NPS Additional', amount: ccd1b }); }
    
    // 80D - Health Insurance
    const healthSelf = Math.min(deductions.c80D_self || 0, 25000);
    if (healthSelf > 0) { taxableIncome -= healthSelf; appliedDeductions.push({ name: '80D - Health Insurance (Self)', amount: healthSelf }); }
    
    // HRA
    if (deductions.hraAmount > 0) {
      taxableIncome -= deductions.hraAmount;
      appliedDeductions.push({ name: 'HRA Exemption (Section 10(13A))', amount: deductions.hraAmount });
    }
  }
  
  taxableIncome = Math.max(0, taxableIncome);
  
  // Calculate tax
  let tax = 0;
  let remaining = taxableIncome;
  let prevLimit = 0;
  const slabBreakdown = [];
  
  for (const slab of config.slabs) {
    const slabAmount = Math.min(remaining, slab.limit - prevLimit);
    const slabTax = slabAmount * slab.rate;
    if (slabAmount > 0) {
      tax += slabTax;
      slabBreakdown.push({ from: prevLimit, to: slab.limit === Infinity ? 'Above' : slab.limit, amount: slabAmount, rate: slab.rate * 100, tax: slabTax });
    }
    remaining -= slabAmount;
    prevLimit = slab.limit;
    if (remaining <= 0) break;
  }
  
  // Rebate 87A
  let rebate = 0;
  if (taxableIncome <= config.rebate87A.limit) {
    rebate = Math.min(tax, config.rebate87A.amount);
  }
  
  const taxAfterRebate = Math.max(0, tax - rebate);
  const cess = taxAfterRebate * FY_2026_27.cessRate;
  const finalTax = taxAfterRebate + cess;
  
  return {
    regime,
    income,
    taxableIncome,
    deductions: appliedDeductions,
    totalDeductions: income - taxableIncome,
    taxBeforeRebate: tax,
    rebate87A: rebate,
    taxAfterRebate,
    cess,
    finalTax,
    effectiveRate: income > 0 ? ((finalTax / income) * 100).toFixed(2) : '0.00',
    monthlyTax: Math.round(finalTax / 12),
    slabBreakdown
  };
}

function compareRegimes(income, deductions) {
  const oldResult = calculateTax(income, 'old', deductions);
  const newResult = calculateTax(income, 'new', deductions);
  const savings = Math.abs(oldResult.finalTax - newResult.finalTax);
  const betterRegime = oldResult.finalTax < newResult.finalTax ? 'old' : 'new';
  
  return { old: oldResult, new: newResult, savings, betterRegime };
}

// ============================================
// GST DATABASE (CLIENT-SIDE)
// ============================================
const GST_DB = {
  hsn: {
    '8471': { desc: 'Automatic data processing machines (computers)', rate: '18%' },
    '847130': { desc: 'Portable automatic data processing machines', rate: '18%' },
    '8517': { desc: 'Telephone sets, including mobile phones', rate: '18%' },
    '851712': { desc: 'Telephones for cellular networks (mobile phones)', rate: '18%' },
    '7108': { desc: 'Gold (including gold plated with platinum)', rate: '1.5%' },
    '7113': { desc: 'Articles of jewellery and parts thereof', rate: '1.5%' },
    '7114': { desc: 'Articles of goldsmiths or silversmiths', rate: '1.5%' },
    '0401': { desc: 'Milk and cream, not concentrated', rate: '0%' },
    '0402': { desc: 'Milk and cream, concentrated', rate: '5%' },
    '1001': { desc: 'Wheat and meslin', rate: '0%' },
    '1006': { desc: 'Rice', rate: '0%' },
    '1701': { desc: 'Cane or beet sugar', rate: '5%' },
    '0901': { desc: 'Coffee, whether or not roasted', rate: '5%' },
    '0902': { desc: 'Tea, whether or not flavoured', rate: '5%' },
    '1507': { desc: 'Soya-bean oil', rate: '5%' },
    '1905': { desc: 'Bread, pastry, cakes, biscuits', rate: '18%' },
    '8414': { desc: 'Air conditioning machines', rate: '28%' },
    '8418': { desc: 'Refrigerators, freezers', rate: '28%' },
    '8450': { desc: 'Household washing machines', rate: '28%' },
    '8703': { desc: 'Motor cars and other motor vehicles', rate: '28%' },
    '8711': { desc: 'Motorcycles and cycles with auxiliary motor', rate: '28%' },
  },
  tds: {
    '194C': { desc: 'Payment to contractor', rate: '1% (Individual/HUF), 2% (Others)', threshold: 30000 },
    '194I': { desc: 'Rent', rate: '2% (Plant/Machinery), 10% (Land/Building)', threshold: 240000 },
    '194IA': { desc: 'Payment on transfer of immovable property', rate: '1%', threshold: 5000000 },
    '194J': { desc: 'Fees for professional or technical services', rate: '2% (Technical), 10% (Professional)', threshold: 30000 },
    '194H': { desc: 'Commission or brokerage', rate: '5%', threshold: 15000 },
    '194A': { desc: 'Interest other than interest on securities', rate: '10%', threshold: 40000 },
    '192': { desc: 'Salary', rate: 'Slab rate', threshold: 0 },
    '194': { desc: 'Dividend', rate: '10%', threshold: 5000 },
    '194B': { desc: 'Winnings from lottery', rate: '30%', threshold: 10000 },
    '194D': { desc: 'Insurance commission', rate: '5%', threshold: 15000 },
    '194DA': { desc: 'Payment in respect of life insurance policy', rate: '5%', threshold: 100000 },
    '194G': { desc: 'Commission on sale of lottery tickets', rate: '5%', threshold: 15000 },
    '194K': { desc: 'Payment of income in respect of units', rate: '10%', threshold: 5000 },
    '194M': { desc: 'Payment to resident contractors/professionals', rate: '5%', threshold: 5000000 },
    '194N': { desc: 'Cash withdrawal exceeding certain amount', rate: '2% (above ₹20L), 5% (above ₹1Cr)', threshold: 20000000 },
    '194O': { desc: 'Payment by e-commerce operator', rate: '1%', threshold: 500000 },
    '194Q': { desc: 'Payment for purchase of goods', rate: '0.1%', threshold: 5000000 },
    '195': { desc: 'Payment to non-resident', rate: 'Varies', threshold: 0 },
  }
};

function searchGST(query) {
  const q = query.toLowerCase();
  const results = [];
  for (const [code, data] of Object.entries(GST_DB.hsn)) {
    if (code.includes(q) || data.desc.toLowerCase().includes(q)) {
      results.push({ type: 'HSN', code, ...data });
    }
  }
  for (const [code, data] of Object.entries(GST_DB.tds)) {
    if (code.includes(q) || data.desc.toLowerCase().includes(q)) {
      results.push({ type: 'TDS', code, ...data });
    }
  }
  return results;
}

// ============================================
// PLANS & TOOLS
// ============================================
const PLANS = {
  free: { id: "free", name: "FREE", color: C.muted, model: "Gemini Flash", queriesPerDay: 4 },
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

const TOOLS = [
  {
    id: "chat", icon: "💬", name: "Get Instant Finance Answers", category: "Core",
    desc: "Ask anything — IFRS, GST, tax, investing, journal entries",
    minPlan: "free", modelTier: "light",
    samples: [
      { label: "IFRS 15 Revenue", text: "Explain IFRS 15 revenue recognition with a practical example for a SaaS company in India." },
    ]
  },
  {
    id: "tax", icon: "🧾", name: "Get Tax & GST Guidance", category: "Compliance",
    desc: "India GST, Income Tax, TDS rates with real examples",
    minPlan: "free", modelTier: "light",
    samples: [
      { label: "🧮 Tax Regime Comparison", text: "Compare old vs new regime for ₹12L income, 80C ₹1.5L, NPS ₹50K, HRA ₹2.4L", isCalc: true },
      { label: "🧮 Calculate Tax (New)", text: "Calculate tax on ₹18 lakh salary under new regime", isCalc: true },
      { label: "📋 TDS Rate Lookup", text: "What is TDS rate under Section 194I for commercial rent?", isLookup: true },
      { label: "📋 GST Rate Lookup", text: "What is GST rate and HSN code for mobile phones?", isLookup: true },
      { label: "🧮 GST Input Credit", text: "A manufacturer buys raw materials with ₹50,000 GST paid. They sell finished goods with ₹80,000 GST collected. Calculate net GST liability.", isCalc: true },
    ]
  },
  {
    id: "email", icon: "📧", name: "Get Your Finance Email Drafted", category: "Communication",
    desc: "Professional emails — vendor reminders, audit responses, approvals",
    minPlan: "free", modelTier: "light",
    samples: [
      { label: "Payment Reminder", text: "Draft a polite but firm email to a vendor whose invoice of ₹2,50,000 is 45 days overdue." },
    ]
  },
  {
    id: "invoice", icon: "📄", name: "Get Your Invoice GL-Coded", category: "Operations",
    desc: "Extract data, suggest GL codes, flag issues automatically",
    minPlan: "free", modelTier: "light",
    samples: []
  },
  {
    id: "gst_reco", icon: "🔄", name: "Get Your GST Reconciled", category: "Compliance",
    desc: "Match Purchase Register vs GSTR-2B, flag ITC risk & vendor issues",
    minPlan: "starter", modelTier: "heavy",
    fileSlots: ["Purchase Register", "GSTR-2B"],
    samples: []
  },
  {
    id: "ratio", icon: "📐", name: "Get Your Financial Ratios Calculated", category: "Reporting",
    desc: "15+ liquidity, profitability, efficiency & leverage ratios with commentary",
    minPlan: "starter", modelTier: "heavy",
    samples: []
  },
  {
    id: "variance", icon: "📊", name: "Get Your Variance Report Written", category: "Reporting",
    desc: "CFO-level budget vs actual commentary, ready to send",
    minPlan: "starter", modelTier: "heavy",
    samples: []
  },
  {
    id: "commentary", icon: "✍️", name: "Get Your Board Report Drafted", category: "Reporting",
    desc: "Board reports, MD&A, investor updates — formal & polished",
    minPlan: "starter", modelTier: "heavy",
    samples: []
  },
  {
    id: "cashflow", icon: "💰", name: "Get Your Cash Flow Forecasted", category: "Planning",
    desc: "3-12 month cash position prediction with liquidity risk flags",
    minPlan: "pro", modelTier: "heavy",
    samples: []
  },
  {
    id: "fraud", icon: "🔍", name: "Get Your Transactions Fraud-Checked", category: "Audit",
    desc: "Spot duplicates, anomalies, suspicious patterns automatically",
    minPlan: "pro", modelTier: "heavy",
    samples: []
  },
  {
    id: "contract", icon: "📑", name: "Get Your Contract Risk-Analyzed", category: "Operations",
    desc: "Extract financial terms, flag risky clauses, plain-English summary",
    minPlan: "pro", modelTier: "heavy",
    samples: []
  },
];

const planRank = { free: 0, payonce: 1, starter: 1, pro: 2, firm: 2 };
const FILE_TOOLS = ["fraud", "invoice", "contract"];
const MAX_FILE_MB = 4;

const hasAccess = (userPlan, toolMinPlan) => planRank[userPlan] >= planRank[toolMinPlan];

const callAI = async (prompt, systemPrompt, userPlan, file = null, files = null) => {
  const useClaude = userPlan === "pro" || userPlan === "firm";
  try {
    const response = await fetch("/api/gemini", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, systemPrompt, useClaude, file, files }),
    });
    const data = await response.json();
    return data.text || "Sorry, please try again.";
  } catch {
    return "Connection error. Please try again.";
  }
};

const Spinner = ({ label = "AI is thinking..." }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10, color: C.muted, fontSize: 14 }}>
    <div style={{ width: 18, height: 18, border: `2px solid ${C.border}`, borderTop: `2px solid ${C.accent}`, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
    {label}
  </div>
);

// ============================================
// FORMAT RESULTS
// ============================================
function formatTaxComparison(comparison, income) {
  const { old: o, new: n, savings, betterRegime } = comparison;
  
  return `## 📊 Tax Regime Comparison (FY 2026-27)

**Gross Income:** ₹${income.toLocaleString('en-IN')}

---

### 🟢 NEW TAX REGIME

| Item | Amount |
|------|--------|
| Gross Income | ₹${income.toLocaleString('en-IN')} |
| Less: Standard Deduction (16(ia)) | ₹75,000 |
| **Taxable Income** | **₹${n.taxableIncome.toLocaleString('en-IN')}** |

**Slab-wise Tax:**
${n.slabBreakdown.map(s => {
  const toLabel = s.to === 'Above' ? 'Above' : `₹${s.to.toLocaleString('en-IN')}`;
  return `| ₹${s.from.toLocaleString('en-IN')} – ${toLabel} @ ${s.rate}% | ₹${Math.round(s.tax).toLocaleString('en-IN')} |`;
}).join('\\n')}

| Tax Before Rebate | ₹${Math.round(n.taxBeforeRebate).toLocaleString('en-IN')} |
| Less: Rebate u/s 87A | ₹${Math.round(n.rebate87A).toLocaleString('en-IN')} |
| Tax After Rebate | ₹${Math.round(n.taxAfterRebate).toLocaleString('en-IN')} |
| Add: Cess @ 4% | ₹${Math.round(n.cess).toLocaleString('en-IN')} |
| **➡️ FINAL TAX** | **₹${Math.round(n.finalTax).toLocaleString('en-IN')}** |

**Effective Rate:** ${n.effectiveRate}% | **Monthly:** ₹${n.monthlyTax.toLocaleString('en-IN')}

---

### 🔵 OLD TAX REGIME

| Item | Amount |
|------|--------|
| Gross Income | ₹${income.toLocaleString('en-IN')} |
${o.deductions.map(d => `| Less: ${d.name} | ₹${d.amount.toLocaleString('en-IN')} |`).join('\\n')}
| **Taxable Income** | **₹${o.taxableIncome.toLocaleString('en-IN')}** |

**Slab-wise Tax:**
${o.slabBreakdown.map(s => {
  const toLabel = s.to === 'Above' ? 'Above' : `₹${s.to.toLocaleString('en-IN')}`;
  return `| ₹${s.from.toLocaleString('en-IN')} – ${toLabel} @ ${s.rate}% | ₹${Math.round(s.tax).toLocaleString('en-IN')} |`;
}).join('\\n')}

| Tax Before Rebate | ₹${Math.round(o.taxBeforeRebate).toLocaleString('en-IN')} |
| Less: Rebate u/s 87A | ₹${Math.round(o.rebate87A).toLocaleString('en-IN')} |
| Tax After Rebate | ₹${Math.round(o.taxAfterRebate).toLocaleString('en-IN')} |
| Add: Cess @ 4% | ₹${Math.round(o.cess).toLocaleString('en-IN')} |
| **➡️ FINAL TAX** | **₹${Math.round(o.finalTax).toLocaleString('en-IN')}** |

**Effective Rate:** ${o.effectiveRate}% | **Monthly:** ₹${o.monthlyTax.toLocaleString('en-IN')}

---

### 🏆 RECOMMENDATION

**Choose the ${betterRegime.toUpperCase()} Tax Regime**

💰 **You save ₹${savings.toLocaleString('en-IN')} per year**

| | Old Regime | New Regime |
|--|-----------|------------|
| Taxable Income | ₹${o.taxableIncome.toLocaleString('en-IN')} | ₹${n.taxableIncome.toLocaleString('en-IN')} |
| Final Tax | ₹${Math.round(o.finalTax).toLocaleString('en-IN')} | ₹${Math.round(n.finalTax).toLocaleString('en-IN')} |
| Effective Rate | ${o.effectiveRate}% | ${n.effectiveRate}% |

${n.finalTax === 0 ? '✅ **Zero tax in New Regime!** Your taxable income is within the ₹12 lakh rebate limit.\\n' : ''}⚠️ *This is an automated calculation. Please verify with a practicing CA before filing.*`;
}

function formatSingleTax(calc, income) {
  return `## 🧾 Tax Calculation — ${calc.regime.toUpperCase()} Regime (FY 2026-27)

**Gross Income:** ₹${income.toLocaleString('en-IN')}

**Deductions Applied:**
${calc.deductions.map(d => `- ${d.name}: ₹${d.amount.toLocaleString('en-IN')}`).join('\\n') || 'None'}

**Taxable Income:** ₹${calc.taxableIncome.toLocaleString('en-IN')}

---

**Slab-wise Tax:**
${calc.slabBreakdown.map(s => {
  const toLabel = s.to === 'Above' ? 'Above' : `₹${s.to.toLocaleString('en-IN')}`;
  return `| ₹${s.from.toLocaleString('en-IN')} – ${toLabel} @ ${s.rate}% | ₹${Math.round(s.tax).toLocaleString('en-IN')} |`;
}).join('\\n')}

---

| Tax Before Rebate | ₹${Math.round(calc.taxBeforeRebate).toLocaleString('en-IN')} |
| Rebate u/s 87A | ₹${Math.round(calc.rebate87A).toLocaleString('en-IN')} |
| Tax After Rebate | ₹${Math.round(calc.taxAfterRebate).toLocaleString('en-IN')} |
| Cess @ 4% | ₹${Math.round(calc.cess).toLocaleString('en-IN')} |

### 💰 FINAL TAX: ₹${Math.round(calc.finalTax).toLocaleString('en-IN')}

- Effective Tax Rate: ${calc.effectiveRate}%
- Monthly Tax: ₹${calc.monthlyTax.toLocaleString('en-IN')}

${calc.finalTax === 0 ? '✅ You pay ZERO tax!' : ''}

⚠️ *Verify with a CA before filing.*`;
}

function formatGSTLookup(results) {
  if (results.length === 0) return "❌ No results found. Try: HSN code (8471), product name (mobile), or TDS section (194C)";
  
  return results.map(r => 
    `📋 ${r.type}: ${r.code}\\n   ${r.desc}\\n   💰 Rate: ${r.rate}${r.threshold ? ` | 📌 Threshold: ₹${r.threshold.toLocaleString('en-IN')}` : ''}`
  ).join('\\n\\n');
}

// ============================================
// INPUT PARSERS
// ============================================
function parseIncome(text) {
  const patterns = [
    /₹?\\s*(\\d{1,2}(?:,\\d{2}){0,2}(?:,\\d{3})?)\\s*[Ll](?:akh)?/,
    /₹?\\s*(\\d{6,8})\\s*(?:per\\s*annum|p\\.a\\.)?/i,
    /income\\s*(?:of\\s*)?₹?\\s*(\\d{1,2}(?:,\\d{2}){0,2}(?:,\\d{3})?)/i,
    /₹?\\s*(\\d{1,2})\\s*[Ll](?:akh)?/,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const val = match[1].replace(/,/g, '');
      if (val.length >= 6) return parseInt(val);
      return parseInt(val) * 100000;
    }
  }
  return 0;
}

function parseDeductions(text, income) {
  const deductions = { isSalaried: true };
  
  // 80C
  const c80CMatch = text.match(/80[Cc].*?₹?\\s*(\\d+(?:,\\d+)*)\\s*(?:[Ll](?:akh)?|[Kk])/i);
  if (c80CMatch) deductions.c80C = parseAmount(c80CMatch[0], c80CMatch[1]);
  
  // NPS
  const npsMatch = text.match(/NPS.*?₹?\\s*(\\d+(?:,\\d+)*)\\s*(?:[Kk]|[Ll](?:akh)?)/i);
  if (npsMatch) deductions.c80CCD_1B = parseAmount(npsMatch[0], npsMatch[1]);
  
  // HRA
  const hraMatch = text.match(/HRA.*?₹?\\s*(\\d+(?:,\\d+)*)\\s*(?:[Ll](?:akh)?|[Kk])/i);
  if (hraMatch) {
    const hraAmount = parseAmount(hraMatch[0], hraMatch[1]);
    const basicSalary = income * 0.6;
    const rentPaid = hraAmount * 1.25;
    const metroLimit = basicSalary * 0.5;
    const rentMinus10 = Math.max(0, rentPaid - basicSalary * 0.1);
    deductions.hraAmount = Math.min(hraAmount, metroLimit, rentMinus10);
  }
  
  return deductions;
}

function parseAmount(fullMatch, numberPart) {
  const val = parseInt(numberPart.replace(/,/g, ''));
  if (fullMatch.match(/[Ll](?:akh)?/)) return val * 100000;
  if (fullMatch.match(/[Kk](?:\\s*Thousand)?/)) return val * 1000;
  if (val < 1000) return val * 100000;
  return val;
}

// ============================================
// COMPONENTS
// ============================================
function Tooltip({ children, content, position = "top" }) {
  const [visible, setVisible] = useState(false);
  const posStyles = {
    top: { bottom: "100%", left: "50%", transform: "translateX(-50%)", marginBottom: 8 },
    bottom: { top: "100%", left: "50%", transform: "translateX(-50%)", marginTop: 8 },
  };
  return (
    <div style={{ position: "relative", display: "inline-block" }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}>
      {children}
      {visible && (
        <div style={{ position: "absolute", ...posStyles[position], background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 16px", minWidth: 240, maxWidth: 320, zIndex: 100, boxShadow: "0 8px 32px rgba(0,0,0,0.4)", fontSize: 12, lineHeight: 1.6, color: C.text }}>
          {content}
        </div>
      )}
    </div>
  );
}

function GuestBadge({ onLogin }) {
  const tooltipContent = (
    <div>
      <div style={{ fontWeight: 700, marginBottom: 8, color: C.accentLight }}>🚀 Why create a free account?</div>
      <div style={{ color: C.muted, marginBottom: 6 }}>✅ Save query history across sessions</div>
      <div style={{ color: C.muted, marginBottom: 6 }}>✅ Access all 4 free tools anytime</div>
      <div style={{ color: C.muted, marginBottom: 6 }}>✅ 4 queries per day (resets daily)</div>
      <div style={{ color: C.muted, marginBottom: 10 }}>✅ Export results to copy/paste</div>
      <button onClick={onLogin} style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "none", background: `linear-gradient(135deg, ${C.accent}, #1d4ed8)`, color: "white", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>Create Free Account →</button>
    </div>
  );
  return (
    <Tooltip content={tooltipContent} position="bottom">
      <div style={{ display: "flex", alignItems: "center", gap: 6, background: `${C.amber}18`, border: `1px solid ${C.amber}40`, padding: "4px 10px", borderRadius: 16, cursor: "pointer" }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.amber }} />
        <span style={{ fontSize: 11, color: C.amber, fontWeight: 700 }}>FREE (Guest)</span>
        <span style={{ fontSize: 10, color: C.amber, opacity: 0.7 }}>?</span>
      </div>
    </Tooltip>
  );
}

const LockedPanel = ({ tool, onUpgrade, onLogin }) => {
  const requiredPlanCard = planCards.find(p => p.id === tool.minPlan);
  return (
    <div style={{ padding: 40, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", textAlign: "center" }}>
      <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>🔒</div>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{tool.name} is a {requiredPlanCard?.name} feature</div>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 24, maxWidth: 360 }}>Upgrade to {requiredPlanCard?.name} to unlock this tool.</div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
        <button onClick={() => onUpgrade(tool.minPlan)} style={{ padding: "10px 22px", borderRadius: 10, border: "none", background: `linear-gradient(135deg, ${requiredPlanCard?.color}, ${requiredPlanCard?.color}cc)`, color: "white", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>Upgrade →</button>
        {onLogin && <button onClick={onLogin} style={{ padding: "10px 22px", borderRadius: 10, border: `1px solid ${C.accent}`, background: "transparent", color: C.accentLight, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>Log in →</button>}
      </div>
    </div>
  );
};

const UsageBar = ({ userPlan, used, limit, isGuest }) => {
  if (limit === "Unlimited" || limit === "1 task") return null;
  const pct = Math.min(100, (used / limit) * 100);
  return (
    <div style={{ padding: "10px 24px", background: C.surface, borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{ fontSize: 11, color: C.muted, whiteSpace: "nowrap" }}>{used}/{limit} queries today{isGuest ? " (guest)" : ""}</span>
      <div style={{ flex: 1, height: 5, background: C.border, borderRadius: 3, maxWidth: 200 }}>
        <div style={{ height: "100%", width: `${pct}%`, background: pct > 80 ? C.red : C.accent, borderRadius: 3, transition: "width 0.3s" }} />
      </div>
      <span style={{ fontSize: 10, color: C.dim, marginLeft: "auto" }}>{PLANS[userPlan]?.model}</span>
    </div>
  );
};

function SampleQueries({ tool, onSelect }) {
  if (!tool.samples || tool.samples.length === 0) return null;
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 11, color: C.greenLight, fontWeight: 700 }}>✨ Try these examples</span>
        <span style={{ fontSize: 10, color: C.dim, background: `${C.green}15`, padding: "2px 8px", borderRadius: 10 }}>No quota used</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {tool.samples.map((sample, i) => (
          <button key={i} onClick={() => onSelect(sample)} style={{ textAlign: "left", padding: "10px 14px", borderRadius: 8, border: `1px solid ${C.border}`, background: `${C.accent}08`, color: C.accentLight, fontSize: 12, cursor: "pointer", fontWeight: 500, lineHeight: 1.4 }}>
            <span style={{ fontSize: 10, color: C.dim, display: "block", marginBottom: 4, fontWeight: 700 }}>{sample.label}</span>
            <span style={{ color: C.text, opacity: 0.85 }}>{sample.text.length > 120 ? sample.text.slice(0, 120) + "..." : sample.text}</span>
            <span style={{ fontSize: 10, color: C.green, display: "block", marginTop: 4 }}>▶ Click to try (free)</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================
// TOOL PANEL (FIXED - CLIENT-SIDE FOR TAX)
// ============================================
function ToolPanel({ tool, userPlan, onUse, session }) {
  const [input, setInput] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [showVerify, setShowVerify] = useState(false);
  const [lastCalc, setLastCalc] = useState(null);

  // ---- CLIENT-SIDE TAX CALCULATION ----
  const runTaxCalculation = () => {
    const income = parseIncome(input);
    if (!income || income <= 0) {
      setResult("❌ Please specify a valid income. Example: ₹12 lakh, ₹12,00,000, or 1200000");
      setLoading(false);
      return;
    }

    const isComparison = /compare|old vs new|which.*better|both regime/i.test(input.toLowerCase());
    const deductions = parseDeductions(input, income);

    if (isComparison) {
      const comparison = compareRegimes(income, deductions);
      setResult(formatTaxComparison(comparison, income));
      setLastCalc(comparison.new);
    } else {
      const regime = /old regime/i.test(input) ? 'old' : 'new';
      const calc = calculateTax(income, regime, deductions);
      setResult(formatSingleTax(calc, income));
      setLastCalc(calc);
    }
    setLoading(false);
  };

  // ---- CLIENT-SIDE GST/TDS LOOKUP ----
  const runGSTLookup = () => {
    const hsnMatch = input.match(/\\b\\d{4,8}\\b/);
    const query = input.toLowerCase().replace(/hsn|sac|tds|gst|rate|section|what is|for/g, '').trim();
    
    let results = [];
    if (hsnMatch) {
      results = searchGST(hsnMatch[0]);
    } else {
      results = searchGST(query || input);
    }
    
    setResult(formatGSTLookup(results));
    setLoading(false);
  };

  // ---- MAIN RUN ----
  const run = async () => {
    if (!input.trim() || loading) return;
    
    // ===== CRITICAL: Route tax tool to client-side =====
    if (tool.id === "tax") {
      const lower = input.toLowerCase();
      
      // Tax calculations (bypass AI completely)
      const isCalc = /calculate|compute|compare|old vs new|how much tax|tax liability|tax on ₹?\\d|regime/i.test(lower);
      // GST/TDS lookups (bypass AI completely)
      const isLookup = /hsn|sac code|gst rate|tds.*section|tds.*rate|section \\d{3}|194[a-z]/i.test(lower);
      
      if (isCalc || isLookup) {
        setLoading(true);
        onUse();
        setResult("");
        
        if (isCalc) return runTaxCalculation();
        if (isLookup) return runGSTLookup();
      }
    }
    
    // ---- FALLBACK TO AI FOR NON-TAX QUERIES ----
    setLoading(true);
    onUse();
    setResult("");
    
    const systemPrompts = {
      chat: "You are an expert Finance AI assistant specializing in Indian finance, accounting, IFRS, and corporate finance. Give precise, practical, professional answers. Use ₹ for Indian Rupee.",
      tax: "You are an expert Indian tax advisor (CA level). Give accurate, practical advice with specific current rates and examples on GST, Income Tax, TDS. For FY 2026-27, New Regime slabs: 0-4L nil, 4-8L 5%, 8-12L 10%, 12-16L 15%, 16-20L 20%, 20-24L 25%, 30% above 24L. Standard deduction: ₹75,000. Rebate 87A: ₹60,000 (new, income ≤12L), ₹12,500 (old, income ≤5L). Cess: 4%.",
      email: "You are a senior Finance Manager writing professional business emails. Write clear, concise, effective finance emails with subject line, greeting, body, and sign-off.",
    };
    
    const res = await callAI(input, systemPrompts[tool.id] || systemPrompts.chat, userPlan);
    setResult(res);
    setLoading(false);
  };

  // ---- SAMPLE CLICK HANDLER ----
  const handleSampleClick = (sample) => {
    setInput(sample.text);
    
    // For tax samples, run client-side immediately
    if (tool.id === "tax" && (sample.isCalc || sample.isLookup)) {
      setTimeout(() => {
        setLoading(true);
        onUse();
        setResult("");
        if (sample.isCalc) runTaxCalculation();
        if (sample.isLookup) runGSTLookup();
      }, 50);
    } else {
      // Non-tax samples use AI
      setTimeout(() => run(), 50);
    }
  };

  return (
    <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14, height: "100%", overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: C.muted }}>Powered by <strong style={{ color: C.accentLight }}>{PLANS[userPlan]?.model}</strong></span>
        <span style={{ fontSize: 10, background: `${C.purple}22`, color: C.purple, padding: "3px 10px", borderRadius: 10 }}>{tool.category}</span>
      </div>

      <SampleQueries tool={tool} onSelect={handleSampleClick} />

      <textarea 
        value={input} 
        onChange={e => setInput(e.target.value)} 
        rows={6}
        placeholder={tool.id === "tax" 
          ? "Try: Compare old vs new regime for ₹12L income, 80C ₹1.5L, NPS ₹50K\\nOr: What is GST rate for mobile phones?\\nOr: TDS rate for contractor Section 194C"
          : "Ask your question..."
        }
        style={{ width: "100%", padding: 14, borderRadius: 10, border: `1px solid ${C.border}`, background: C.card, color: C.text, fontSize: 13, resize: "vertical", outline: "none", boxSizing: "border-box" }} 
      />
      
      <button onClick={run} disabled={loading || !input.trim()} style={{
        padding: "12px 24px", borderRadius: 10, border: "none",
        background: loading ? C.dim : `linear-gradient(135deg, ${C.accent}, #1d4ed8)`,
        color: "white", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontSize: 14
      }}>{loading ? "Calculating..." : `${tool.icon} ${tool.name}`}</button>
      
      {loading && <Spinner label={tool.id === "tax" ? "Calculating..." : "AI is thinking..."} />}

      {lastCalc && (
        <button onClick={() => setShowVerify(true)} style={{
          padding: "10px 20px", borderRadius: 8, border: `1px solid ${C.green}`,
          background: `${C.green}15`, color: C.greenLight,
          cursor: "pointer", fontSize: 13, fontWeight: 700
        }}>🔍 Verify Calculation Step-by-Step</button>
      )}

      {result && (
        <div style={{ background: C.card, border: `1px solid ${C.green}`, borderRadius: 12, padding: 18 }}>
          <pre style={{ color: C.text, fontSize: 13, whiteSpace: "pre-wrap", lineHeight: 1.7, margin: 0, fontFamily: "inherit" }}>{result}</pre>
        </div>
      )}

      {showVerify && lastCalc && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.8)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ width: "100%", maxWidth: 600, maxHeight: "90vh", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>🔍 Verify Calculation</div>
                <div style={{ fontSize: 11, color: C.muted }}>{lastCalc.regime?.toUpperCase()} Regime · FY 2026-27</div>
              </div>
              <button onClick={() => setShowVerify(false)} style={{ background: "transparent", border: "none", color: C.muted, fontSize: 20, cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
              {lastCalc.slabBreakdown?.map((s, i) => (
                <div key={i} style={{ padding: "10px 12px", marginBottom: 8, background: C.card, borderRadius: 8, border: `1px solid ${C.border}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, color: C.muted }}>₹{s.from.toLocaleString('en-IN')} – {s.to === 'Above' ? 'Above' : `₹${s.to.toLocaleString('en-IN')}`} @ {s.rate}%</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>₹{Math.round(s.tax).toLocaleString('en-IN')}</span>
                  </div>
                </div>
              ))}
              <div style={{ marginTop: 16, padding: "16px 20px", background: `linear-gradient(135deg, ${C.green}15, ${C.green}05)`, border: `1px solid ${C.green}40`, borderRadius: 12, textAlign: "center" }}>
                <div style={{ fontSize: 11, color: C.greenLight }}>Final Tax Liability</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: C.greenLight }}>₹{Math.round(lastCalc.finalTax).toLocaleString('en-IN')}</div>
                <div style={{ fontSize: 11, color: C.muted }}>Effective Rate: {lastCalc.effectiveRate}%</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// PRICING VIEW
// ============================================
function PricingView({ userPlan, onSelectPlan }) {
  return (
    <div style={{ padding: 24, overflowY: "auto", height: "100%" }}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>Choose Your Plan</div>
        <div style={{ fontSize: 13, color: C.muted }}>Free & Starter run on Gemini Flash · Pro & Firm run on Claude Sonnet</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
        {planCards.map(plan => (
          <div key={plan.id} onClick={() => onSelectPlan(plan.id)} style={{ background: userPlan === plan.id ? C.cardHover : C.card, border: `2px solid ${userPlan === plan.id ? plan.color : C.border}`, borderRadius: 14, padding: 18, cursor: "pointer", position: "relative" }}>
            {plan.badge && <div style={{ position: "absolute", top: -9, left: "50%", transform: "translateX(-50%)", background: plan.color, color: "white", fontSize: 8, fontWeight: 800, padding: "3px 10px", borderRadius: 10 }}>{plan.badge}</div>}
            <div style={{ fontSize: 24, marginBottom: 6 }}>{plan.icon}</div>
            <div style={{ fontSize: 10, fontWeight: 800, color: plan.color }}>{plan.name}</div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>{plan.desc}</div>
            <div style={{ marginBottom: 10 }}><span style={{ fontSize: 24, fontWeight: 900, color: plan.color }}>{plan.price}</span><span style={{ fontSize: 11, color: C.muted }}>{plan.period}</span></div>
            <div style={{ fontSize: 10, color: C.muted }}>🛠️ {plan.tools}/10 tools · ⚡ {plan.queriesPerDay} {typeof plan.queriesPerDay === "number" ? "/day" : ""}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// MAIN APP
// ============================================
export default function FinanceAIApp() {
  const [active, setActive] = useState("chat");
  const [userPlan, setUserPlan] = useState("free");
  const [usage, setUsage] = useState({});
  const [session, setSession] = useState(undefined);
  const [profileReady, setProfileReady] = useState(false);
  const [showAuth, setShowAuth] = useState(false);

  const todayKey = new Date().toDateString();
  const todayISO = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (!newSession) { setUserPlan("free"); setUsage({}); setProfileReady(false); }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      (async () => {
        const { data: profile } = await supabase.from("profiles").select("plan").eq("id", session.user.id).single();
        if (profile) setUserPlan(profile.plan);
        const { data: usageRow } = await supabase.from("usage").select("count").eq("user_id", session.user.id).eq("date", todayISO).single();
        setUsage(prev => ({ ...prev, [todayKey]: usageRow?.count || 0 }));
        setProfileReady(true);
      })();
    } else {
      const guestUsage = JSON.parse(localStorage.getItem("airupee_usage") || "{}");
      setUsage(guestUsage);
      setProfileReady(true);
    }
  }, [session]);

  const dailyLimit = userPlan === "free" ? 4 : userPlan === "starter" ? 30 : "Unlimited";
  const usedToday = usage[todayKey] || 0;

  const recordUsage = async () => {
    const newCount = (usage[todayKey] || 0) + 1;
    setUsage(prev => ({ ...prev, [todayKey]: newCount }));
    if (session) {
      await supabase.from("usage").upsert({ user_id: session.user.id, date: todayISO, count: newCount }, { onConflict: "user_id,date" });
    } else {
      const guestUsage = JSON.parse(localStorage.getItem("airupee_usage") || "{}");
      guestUsage[todayKey] = newCount;
      localStorage.setItem("airupee_usage", JSON.stringify(guestUsage));
    }
  };

  const updatePlan = async (p) => { setUserPlan(p); if (session) await supabase.from("profiles").update({ plan: p }).eq("id", session.user.id); };
  const limitReached = dailyLimit !== "Unlimited" && usedToday >= dailyLimit;
  const activeTool = TOOLS.find(t => t.id === active);
  const categories = ["Core", "Compliance", "Communication", "Operations", "Reporting", "Planning", "Audit"];

  const renderMain = () => {
    if (active === "pricing") return <PricingView userPlan={userPlan} onSelectPlan={updatePlan} />;
    if (!activeTool) return null;
    if (!hasAccess(userPlan, activeTool.minPlan)) return <LockedPanel tool={activeTool} onUpgrade={updatePlan} onLogin={() => setShowAuth(true)} />;
    if (limitReached) return (
      <div style={{ padding: 40, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{session ? "Daily limit reached" : "Free preview limit reached"}</div>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 24 }}>{session ? "Upgrade to Pro for unlimited access." : "Create a free account for 4 queries/day."}</div>
        {!session && <button onClick={() => setShowAuth(true)} style={{ padding: "10px 22px", borderRadius: 10, border: "none", background: `linear-gradient(135deg, ${C.accent}, #1d4ed8)`, color: "white", fontWeight: 700, cursor: "pointer" }}>Create Free Account →</button>}
      </div>
    );
    return <ToolPanel key={activeTool.id} tool={activeTool} userPlan={userPlan} onUse={recordUsage} session={session} />;
  };

  if (!profileReady) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg, color: C.muted }}><Spinner label="Loading..." /></div>;

  return (
    <div style={{ display: "flex", height: "100vh", background: C.bg, color: C.text, fontFamily: "'Inter','DM Sans',system-ui,sans-serif", overflow: "hidden" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } * { box-sizing: border-box; } ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 4px; }`}</style>
      
      <div style={{ width: 230, background: C.surface, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "18px 16px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: `linear-gradient(135deg, ${C.accent}, #1d4ed8)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>₹</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15 }}>AIRupee Finance AI</div>
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
                    <button key={t.id} onClick={() => setActive(t.id)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 7, width: "100%", border: "none", background: active === t.id ? `${C.accent}22` : "transparent", color: active === t.id ? C.accentLight : locked ? C.dim : C.muted, cursor: "pointer", textAlign: "left", borderLeft: active === t.id ? `3px solid ${C.accent}` : "3px solid transparent" }}>
                      <span style={{ fontSize: 14 }}>{t.icon}</span>
                      <span style={{ fontSize: 11.5, fontWeight: active === t.id ? 700 : 500, flex: 1 }}>{t.name}</span>
                      {locked && <span style={{ fontSize: 10 }}>🔒</span>}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>
        
        <div style={{ padding: "10px 8px", borderTop: `1px solid ${C.border}` }}>
          <button onClick={() => setActive("pricing")} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: `1px solid ${C.green}`, background: active === "pricing" ? `${C.green}22` : "transparent", color: C.greenLight, cursor: "pointer", fontSize: 12, fontWeight: 700, marginBottom: 8 }}>💳 Plans & Pricing</button>
          {session ? (
            <>
              <div style={{ fontSize: 10, color: C.dim, textAlign: "center", marginBottom: 6 }}>{session.user.email}</div>
              <button onClick={() => supabase.auth.signOut()} style={{ width: "100%", padding: "7px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: "transparent", color: C.muted, cursor: "pointer", fontSize: 11 }}>Log out</button>
            </>
          ) : (
            <button onClick={() => setShowAuth(true)} style={{ width: "100%", padding: "7px 12px", borderRadius: 8, border: `1px solid ${C.accent}`, background: "transparent", color: C.accentLight, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>Log in / Sign up</button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "14px 24px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 12, background: C.surface }}>
          <span style={{ fontSize: 20 }}>{active === "pricing" ? "💳" : activeTool?.icon}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{active === "pricing" ? "Plans & Pricing" : activeTool?.name}</div>
            <div style={{ fontSize: 11, color: C.muted }}>{active === "pricing" ? "Compare plans" : activeTool?.desc}</div>
          </div>
          <div style={{ marginLeft: "auto" }}>
            {!session ? <GuestBadge onLogin={() => setShowAuth(true)} /> : (
              <div style={{ display: "flex", alignItems: "center", gap: 6, background: `${PLANS[userPlan].color}18`, border: `1px solid ${PLANS[userPlan].color}40`, padding: "4px 10px", borderRadius: 16 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: PLANS[userPlan].color }} />
                <span style={{ fontSize: 11, color: PLANS[userPlan].color, fontWeight: 700 }}>{PLANS[userPlan].name}</span>
              </div>
            )}
          </div>
        </div>
        {active !== "pricing" && <UsageBar userPlan={userPlan} used={usedToday} limit={dailyLimit} isGuest={!session} />}
        <div style={{ flex: 1, overflow: "hidden" }}>{renderMain()}</div>
      </div>

      {showAuth && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "relative", width: 400 }}>
            <button onClick={() => setShowAuth(false)} style={{ position: "absolute", top: -40, right: 0, background: "transparent", border: "none", color: C.muted, fontSize: 24, cursor: "pointer" }}>✕</button>
            <Auth onSuccess={() => setShowAuth(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
'''

with open('/mnt/agents/output/App_COMPLETE_FIXED.jsx', 'w') as f:
    f.write(complete_app_jsx)

print(f"Complete fixed App.jsx created: {len(complete_app_jsx)} characters")

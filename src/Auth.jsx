import { useState } from "react";
import { supabase } from "./supabaseClient";

const C = {
  bg: "#060d1f",
  surface: "#0d1729",
  card: "#111f35",
  border: "#1e3a5f",
  accent: "#3b82f6",
  accentLight: "#60a5fa",
  green: "#10b981",
  red: "#ef4444",
  text: "#f1f5f9",
  muted: "#94a3b8",
  dim: "#475569",
};

export default function Auth() {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim() || loading) return;
    setError("");
    setInfo("");
    setLoading(true);

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else setInfo("Account created! Check your email to confirm, then log in.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: C.bg, color: C.text, fontFamily: "'Inter','DM Sans',system-ui,sans-serif",
    }}>
      <div style={{ width: 380, padding: 32, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${C.accent}, #1d4ed8)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}>₹</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>AIRupee Finance AI</div>
            <div style={{ fontSize: 11, color: C.muted }}>{mode === "login" ? "Log in to continue" : "Create your account"}</div>
          </div>
        </div>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 6 }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              placeholder="you@example.com"
              style={{ width: "100%", padding: 11, borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, color: C.text, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 6 }}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6}
              placeholder="At least 6 characters"
              style={{ width: "100%", padding: 11, borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, color: C.text, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
          </div>

          {error && <div style={{ fontSize: 12, color: C.red, background: `${C.red}15`, padding: "8px 10px", borderRadius: 8 }}>{error}</div>}
          {info && <div style={{ fontSize: 12, color: C.green, background: `${C.green}15`, padding: "8px 10px", borderRadius: 8 }}>{info}</div>}

          <button type="submit" disabled={loading} style={{
            padding: "12px 20px", borderRadius: 10, border: "none", marginTop: 4,
            background: loading ? C.dim : `linear-gradient(135deg, ${C.accent}, #1d4ed8)`,
            color: "white", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontSize: 14,
          }}>
            {loading ? "Please wait..." : mode === "login" ? "Log In" : "Sign Up"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: 18, fontSize: 12, color: C.muted }}>
          {mode === "login" ? "New here?" : "Already have an account?"}{" "}
          <span
            onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); setInfo(""); }}
            style={{ color: C.accentLight, cursor: "pointer", fontWeight: 700 }}
          >
            {mode === "login" ? "Create an account" : "Log in"}
          </span>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "./supabaseClient";

// ─── Config ───
// PIN stored as SHA-256 hash. To change, run in browser console:
//   crypto.subtle.digest('SHA-256', new TextEncoder().encode('YOUR_PIN'))
//     .then(b => console.log(Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join('')))
const ADMIN_PIN_HASH = "4229bd1a81747458afe1c8974f2b26a332a2d6e8d194e2281ba2712ad2fcc763";
const SESSION_TIMEOUT_MS = 5 * 60 * 1000;
const RATE_LIMIT_MS = 3000;
const MAX_NAME_LENGTH = 80;
const MAX_PHONE_LENGTH = 20;
const MAX_MEMO_LENGTH = 300;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MS = 60 * 1000;

const UPSWELL_LOGO = "data:image/jpeg;base64,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";

// ─── Helpers ───
async function hashPin(pin) {
  const data = new TextEncoder().encode(pin);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((x) => x.toString(16).padStart(2, "0")).join("");
}

function isValidPhone(phone) {
  return /^[0-9\s\-().+]{7,20}$/.test(phone);
}

function sanitize(str, maxLen) {
  return str.slice(0, maxLen).replace(/[<>]/g, "");
}

function formatDate(isoString) {
  return new Date(isoString).toLocaleString("en-US");
}

export default function App() {
  const [view, setView] = useState("customer");
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [memo, setMemo] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [copiedId, setCopiedId] = useState(null);
  const [toast, setToast] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [phoneError, setPhoneError] = useState("");
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState(0);

  const lastSubmitTime = useRef(0);
  const sessionTimer = useRef(null);

  // ─── Load from Supabase ───
  const fetchCustomers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setCustomers(
        (data || []).map((row) => ({
          id: row.id,
          name: row.name,
          phone: row.phone,
          memo: row.memo || "",
          date: formatDate(row.created_at),
        }))
      );
    } catch {
      showToast("error", "Failed to load customers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // ─── Session timeout (admin auto-logout) ───
  const resetSessionTimer = useCallback(() => {
    if (sessionTimer.current) clearTimeout(sessionTimer.current);
    sessionTimer.current = setTimeout(() => {
      setView("customer");
      showToast("info", "Logged out due to inactivity");
    }, SESSION_TIMEOUT_MS);
  }, []);

  useEffect(() => {
    if (view === "admin") {
      resetSessionTimer();
      return () => { if (sessionTimer.current) clearTimeout(sessionTimer.current); };
    }
  }, [view, resetSessionTimer]);

  const adminAction = useCallback(
    (fn) =>
      (...args) => {
        resetSessionTimer();
        return fn(...args);
      },
    [resetSessionTimer]
  );

  // ─── Toast ───
  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  // ─── Submit to Supabase ───
  const handleSubmit = async () => {
    const now = Date.now();
    if (now - lastSubmitTime.current < RATE_LIMIT_MS) return;

    const cleanName = sanitize(name.trim(), MAX_NAME_LENGTH);
    const cleanPhone = phone.trim();
    const cleanMemo = sanitize(memo.trim(), MAX_MEMO_LENGTH);

    if (!cleanName || !cleanPhone) return;
    if (!isValidPhone(cleanPhone)) {
      setPhoneError("Please enter a valid phone number");
      return;
    }

    setSubmitting(true);
    lastSubmitTime.current = now;

    try {
      const { error } = await supabase
        .from("customers")
        .insert({ name: cleanName, phone: cleanPhone, memo: cleanMemo || null });
      if (error) throw error;

      setSubmitted(true);
      setName(""); setPhone(""); setMemo(""); setPhoneError("");
      // Refresh list so admin sees latest
      fetchCustomers();
    } catch {
      showToast("error", "Save failed. Please try again.");
    }
    setSubmitting(false);
  };

  // ─── Admin Login (hashed + lockout) ───
  const handleAdminLogin = async () => {
    if (Date.now() < lockoutUntil) {
      const secs = Math.ceil((lockoutUntil - Date.now()) / 1000);
      setPinError(`Locked out. Try again in ${secs}s`);
      return;
    }
    const hash = await hashPin(pin);
    if (hash === ADMIN_PIN_HASH) {
      setView("admin"); setPinError(""); setPin(""); setLoginAttempts(0);
      fetchCustomers(); // refresh on login
    } else {
      const next = loginAttempts + 1;
      setLoginAttempts(next);
      if (next >= MAX_LOGIN_ATTEMPTS) {
        setLockoutUntil(Date.now() + LOCKOUT_MS);
        setPinError("Too many attempts. Locked for 60s");
        setLoginAttempts(0);
      } else {
        setPinError(`Incorrect PIN (${MAX_LOGIN_ATTEMPTS - next} left)`);
      }
    }
  };

  // ─── Delete from Supabase ───
  const confirmDelete = async () => {
    try {
      if (deleteConfirmId === "all") {
        // Delete all rows
        const { error } = await supabase
          .from("customers")
          .delete()
          .neq("id", "00000000-0000-0000-0000-000000000000"); // matches all rows
        if (error) throw error;
        setCustomers([]);
      } else {
        const { error } = await supabase
          .from("customers")
          .delete()
          .eq("id", deleteConfirmId);
        if (error) throw error;
        setCustomers(customers.filter((c) => c.id !== deleteConfirmId));
      }
    } catch {
      showToast("error", "Delete failed. Please try again.");
    }
    setDeleteConfirmId(null);
  };

  const handleCopy = (customer) => {
    const text = `${customer.name} / ${customer.phone}${customer.memo ? ` / ${customer.memo}` : ""}`;
    navigator.clipboard.writeText(text).catch(() => showToast("error", "Copy failed"));
    setCopiedId(customer.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  // ─── CSV Export ───
  const escapeCSV = (val) => {
    const str = val == null ? "" : String(val);
    if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
    return str;
  };

  const handleExportCSV = () => {
    if (customers.length === 0) {
      showToast("error", "No customers to export");
      return;
    }
    const header = "Name,Phone,Interested Restaurant,Created At";
    const rows = customers.map(
      (c) => [c.name, c.phone, c.memo || "", c.date].map(escapeCSV).join(",")
    );
    const bom = "\uFEFF";
    const csv = bom + [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const date = new Date().toISOString().slice(0, 10);
    const a = document.createElement("a");
    a.href = url;
    a.download = `upswell-customers-${date}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("success", "CSV downloaded");
  };

  // ─── Search (case-insensitive) ───
  const term = searchTerm.toLowerCase();
  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(term) ||
      c.phone.includes(term) ||
      (c.memo && c.memo.toLowerCase().includes(term))
  );

  // ═══════════════════════════════════════
  // Styles
  // ═══════════════════════════════════════
  const font = "'DM Sans', 'SF Pro Display', -apple-system, sans-serif";

  const gradientBg = {
    background: "linear-gradient(145deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
    minHeight: "100vh", fontFamily: font,
  };
  const card = {
    background: "rgba(255,255,255,0.04)", backdropFilter: "blur(20px)",
    border: "1px solid rgba(255,255,255,0.08)", borderRadius: "20px",
    padding: "36px 28px", maxWidth: "420px", width: "100%", margin: "0 auto",
    boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
  };
  const inputStyle = {
    width: "100%", padding: "14px 16px", borderRadius: "12px",
    border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)",
    color: "#f1f5f9", fontSize: "16px", fontFamily: font, outline: "none",
    boxSizing: "border-box", transition: "border-color 0.2s",
  };
  const btnPrimary = {
    width: "100%", padding: "15px", borderRadius: "12px", border: "none",
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff",
    fontSize: "16px", fontWeight: "600", fontFamily: font, cursor: "pointer",
    transition: "transform 0.15s, box-shadow 0.15s, opacity 0.15s",
    boxShadow: "0 4px 16px rgba(99,102,241,0.3)",
  };
  const btnSecondary = {
    padding: "8px 16px", borderRadius: "8px",
    border: "1px solid rgba(255,255,255,0.15)", background: "transparent",
    color: "#94a3b8", fontSize: "13px", fontFamily: font, cursor: "pointer",
  };
  const labelStyle = {
    color: "#94a3b8", fontSize: "13px", fontWeight: "500",
    marginBottom: "6px", display: "block", letterSpacing: "0.02em",
  };

  // ─── Shared UI pieces ───
  const ToastBanner = () =>
    toast ? (
      <div style={{
        position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)",
        padding: "10px 20px", borderRadius: "10px", fontSize: "13px", fontFamily: font, zIndex: 999,
        background: toast.type === "error" ? "rgba(239,68,68,0.9)" : "rgba(34,197,94,0.9)",
        color: "#fff", boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
      }}>
        {toast.message}
      </div>
    ) : null;

  const DeleteModal = () =>
    deleteConfirmId !== null ? (
      <div
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 998, padding: 16 }}
        onClick={() => setDeleteConfirmId(null)}
      >
        <div style={{ ...card, textAlign: "center", padding: "28px 24px", maxWidth: "340px" }} onClick={(e) => e.stopPropagation()}>
          <p style={{ color: "#f1f5f9", fontSize: "15px", margin: "0 0 6px", fontWeight: "600" }}>
            {deleteConfirmId === "all" ? "Delete all customers?" : "Delete this customer?"}
          </p>
          <p style={{ color: "#64748b", fontSize: "13px", margin: "0 0 20px" }}>
            This action cannot be undone.
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <button style={{ ...btnSecondary, flex: 1, padding: "10px" }} onClick={() => setDeleteConfirmId(null)}>
              Cancel
            </button>
            <button
              style={{ ...btnSecondary, flex: 1, padding: "10px", color: "#ef4444", borderColor: "rgba(239,68,68,0.4)" }}
              onClick={adminAction(confirmDelete)}
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    ) : null;

  // ═══════════════════════════════════════
  // Views
  // ═══════════════════════════════════════

  const UpswellFooter = () => (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      gap: 8, padding: "24px 0 16px", opacity: 0.45,
    }}>
      <img src={UPSWELL_LOGO} alt="Upswell" style={{ width: 22, height: 22, borderRadius: "50%" }} />
      <span style={{ color: "#94a3b8", fontSize: "12px", fontFamily: font, letterSpacing: "0.03em" }}>
        Powered by <span style={{ fontWeight: "600" }}>Upswell</span>
      </span>
    </div>
  );

  // ─── Customer Form ───
  if (view === "customer") {
    const canSubmit = name.trim() && phone.trim() && !submitting;
    return (
      <div style={gradientBg}>
        <ToastBanner />
        <div style={{ padding: "40px 16px", display: "flex", flexDirection: "column", alignItems: "center", minHeight: "100vh" }}>

          <div style={{
            width: 48, height: 48, borderRadius: "50%",
            background: "linear-gradient(135deg, #6366f1, #a78bfa)", marginBottom: 28,
            boxShadow: "0 0 40px rgba(99,102,241,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
          </div>

          {!submitted ? (
            <div style={card}>
              <h1 style={{ color: "#f8fafc", fontSize: "22px", fontWeight: "700", margin: "0 0 4px", textAlign: "center" }}>
                Customer Registration
              </h1>
              <p style={{ color: "#64748b", fontSize: "14px", textAlign: "center", margin: "0 0 28px" }}>
                Please enter your information below
              </p>

              <div style={{ marginBottom: 18 }}>
                <label style={labelStyle}>Name</label>
                <input style={inputStyle} placeholder="John Smith" value={name} maxLength={MAX_NAME_LENGTH}
                  onChange={(e) => setName(e.target.value)}
                  onFocus={(e) => e.target.style.borderColor = "rgba(99,102,241,0.5)"}
                  onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.12)"}
                />
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={labelStyle}>Phone Number</label>
                <input
                  style={{ ...inputStyle, borderColor: phoneError ? "rgba(239,68,68,0.5)" : undefined }}
                  placeholder="(555) 123-4567" type="tel" value={phone} maxLength={MAX_PHONE_LENGTH}
                  onChange={(e) => { setPhone(e.target.value); setPhoneError(""); }}
                  onFocus={(e) => { if (!phoneError) e.target.style.borderColor = "rgba(99,102,241,0.5)"; }}
                  onBlur={(e) => { if (!phoneError) e.target.style.borderColor = "rgba(255,255,255,0.12)"; }}
                />
                {phoneError && <p style={{ color: "#ef4444", fontSize: "12px", marginTop: 6 }}>{phoneError}</p>}
              </div>

              <div style={{ marginBottom: 28 }}>
                <label style={labelStyle}>Which restaurant are you interested in?</label>
                <textarea
                  style={{ ...inputStyle, minHeight: "80px", resize: "vertical", lineHeight: "1.5" }}
                  placeholder="e.g. Italian place on Main St, Joe's BBQ..." value={memo} maxLength={MAX_MEMO_LENGTH}
                  onChange={(e) => setMemo(e.target.value)}
                  onFocus={(e) => e.target.style.borderColor = "rgba(99,102,241,0.5)"}
                  onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.12)"}
                />
                <p style={{ color: "#475569", fontSize: "11px", textAlign: "right", margin: "4px 0 0" }}>
                  {memo.length}/{MAX_MEMO_LENGTH}
                </p>
              </div>

              <button
                style={{ ...btnPrimary, opacity: canSubmit ? 1 : 0.4, cursor: canSubmit ? "pointer" : "not-allowed" }}
                onClick={handleSubmit} disabled={!canSubmit}
                onMouseEnter={(e) => { if (canSubmit) e.target.style.transform = "translateY(-1px)"; }}
                onMouseLeave={(e) => { e.target.style.transform = "translateY(0)"; }}
              >
                {submitting ? "Submitting..." : "Submit"}
              </button>
            </div>
          ) : (
            <div style={{ ...card, textAlign: "center" }}>
              <div style={{
                width: 64, height: 64, borderRadius: "50%", background: "rgba(34,197,94,0.12)",
                display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px",
              }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <h2 style={{ color: "#f8fafc", fontSize: "20px", margin: "0 0 8px" }}>All Set!</h2>
              <p style={{ color: "#64748b", fontSize: "14px", margin: "0 0 24px" }}>Thank you. Your information has been saved.</p>
              <button style={{ ...btnSecondary, padding: "10px 24px" }} onClick={() => setSubmitted(false)}>
                Register Another
              </button>
            </div>
          )}

          <button onClick={() => setView("admin-login")} style={{
            marginTop: 40, background: "none", border: "none",
            color: "rgba(100,116,139,0.4)", fontSize: "11px",
            cursor: "pointer", fontFamily: font, letterSpacing: "0.05em",
          }}>
            Admin
          </button>
          <UpswellFooter />
        </div>
      </div>
    );
  }

  // ─── Admin Login ───
  if (view === "admin-login") {
    const isLocked = Date.now() < lockoutUntil;
    return (
      <div style={gradientBg}>
        <div style={{ padding: "60px 16px", display: "flex", flexDirection: "column", alignItems: "center", minHeight: "100vh" }}>
          <div style={card}>
            <h2 style={{ color: "#f8fafc", fontSize: "20px", fontWeight: "700", margin: "0 0 4px", textAlign: "center" }}>
              Admin Login
            </h2>
            <p style={{ color: "#64748b", fontSize: "13px", textAlign: "center", margin: "0 0 24px" }}>
              Enter your PIN
            </p>
            <div style={{ marginBottom: 20 }}>
              <input
                style={{
                  ...inputStyle, textAlign: "center", fontSize: "24px", letterSpacing: "12px",
                  borderColor: pinError ? "rgba(239,68,68,0.5)" : "rgba(255,255,255,0.12)",
                }}
                type="password" maxLength={8} placeholder="····" value={pin} disabled={isLocked}
                onChange={(e) => { setPin(e.target.value); setPinError(""); }}
                onKeyDown={(e) => e.key === "Enter" && !isLocked && handleAdminLogin()}
                autoFocus
              />
              {pinError && (
                <p style={{ color: "#ef4444", fontSize: "12px", textAlign: "center", marginTop: 8 }}>
                  {pinError}
                </p>
              )}
            </div>
            <button style={{ ...btnPrimary, opacity: isLocked ? 0.4 : 1 }} onClick={handleAdminLogin} disabled={isLocked}>
              Login
            </button>
            <button
              onClick={() => { setView("customer"); setPin(""); setPinError(""); }}
              style={{ ...btnSecondary, width: "100%", marginTop: 12, textAlign: "center" }}
            >
              Go Back
            </button>
          </div>
          <UpswellFooter />
        </div>
      </div>
    );
  }

  // ─── Admin Dashboard ───
  return (
    <div style={gradientBg}>
      <ToastBanner />
      <DeleteModal />
      <div style={{ padding: "32px 16px", maxWidth: "600px", margin: "0 auto", minHeight: "100vh" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h1 style={{ color: "#f8fafc", fontSize: "22px", fontWeight: "700", margin: 0 }}>Customers</h1>
            <p style={{ color: "#64748b", fontSize: "13px", margin: "4px 0 0" }}>
              {loading ? "Loading..." : `${customers.length} total`}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button style={{ ...btnSecondary, color: "#6366f1", borderColor: "rgba(99,102,241,0.3)" }}
              onClick={adminAction(handleExportCSV)}>
              Download CSV
            </button>
            {customers.length > 0 && (
              <button style={{ ...btnSecondary, color: "#ef4444", borderColor: "rgba(239,68,68,0.25)" }}
                onClick={adminAction(() => setDeleteConfirmId("all"))}>
                Delete All
              </button>
            )}
            <button style={btnSecondary} onClick={() => setView("customer")}>Exit</button>
          </div>
        </div>

        {customers.length > 3 && (
          <div style={{ marginBottom: 20 }}>
            <input style={{ ...inputStyle, padding: "11px 16px", fontSize: "14px" }}
              placeholder="Search by name, phone, or memo..." value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        )}

        {filtered.length === 0 ? (
          <div style={{ ...card, textAlign: "center", padding: "48px 28px" }}>
            <p style={{ color: "#475569", fontSize: "14px", margin: 0 }}>
              {loading ? "Loading..." : customers.length === 0 ? "No customers registered yet" : "No results found"}
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.map((c) => (
              <div key={c.id} style={{
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "14px", padding: "16px 18px", display: "flex",
                justifyContent: "space-between", alignItems: "center",
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: "#f1f5f9", fontSize: "15px", fontWeight: "600", marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.name}
                  </div>
                  <div style={{ color: "#8b9dc3", fontSize: "14px", marginBottom: 2 }}>{c.phone}</div>
                  {c.memo && (
                    <div style={{ color: "#a78bfa", fontSize: "13px", marginBottom: 2, fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.memo}
                    </div>
                  )}
                  <div style={{ color: "#475569", fontSize: "11px" }}>{c.date}</div>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0, marginLeft: 10 }}>
                  <button onClick={adminAction(() => handleCopy(c))} style={{
                    ...btnSecondary, padding: "6px 10px", fontSize: "11px",
                    color: copiedId === c.id ? "#22c55e" : "#94a3b8",
                    borderColor: copiedId === c.id ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.15)",
                  }}>
                    {copiedId === c.id ? "Copied" : "Copy"}
                  </button>
                  <button onClick={adminAction(() => setDeleteConfirmId(c.id))} style={{
                    ...btnSecondary, padding: "6px 10px", fontSize: "11px",
                    color: "#ef4444", borderColor: "rgba(239,68,68,0.2)",
                  }}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <UpswellFooter />
      </div>
    </div>
  );
}

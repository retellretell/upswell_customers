import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "./supabaseClient";

// ─── Config ───
const ADMIN_PIN_HASH = "4229bd1a81747458afe1c8974f2b26a332a2d6e8d194e2281ba2712ad2fcc763";
const SESSION_TIMEOUT_MS = 5 * 60 * 1000;
const RATE_LIMIT_MS = 3000;
const MAX_NAME_LENGTH = 80;
const MAX_PHONE_LENGTH = 20;
const MAX_MEMO_LENGTH = 300;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MS = 60 * 1000;

// ─── Brand Colors (matching mom.upswell.ai) ───
const BRAND = {
  coral: "#E84C6F",       // Primary CTA
  coralDark: "#D03658",   // Hover state
  coralLight: "#FCE9EE",  // Tinted bg for badges
  danger: "#B91C3C",      // Destructive actions (darker than coral)
  ink: "#1A1A1A",         // Heading black
  body: "#4A4A4A",        // Body text
  muted: "#8A8A8A",       // Secondary text
  hint: "#B8B8B8",        // Tertiary
  border: "#E8E8E8",      // Subtle border
  bg: "#FAFAF7",          // Soft off-white page bg
  cardBg: "#FFFFFF",      // Card surface
};

const UPSWELL_LOGO = "/upswell-logo.png";

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

// ─── Shared font ───
const FONT = "'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif";

// ─── Sub-components (defined at module scope to avoid remount on each render) ───

function ToastBanner({ toast }) {
  if (!toast) return null;
  const bg =
    toast.type === "error" ? BRAND.danger :
    toast.type === "success" ? BRAND.coral :
    BRAND.ink;
  return (
    <div
      role="alert"
      style={{
        position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)",
        padding: "12px 22px", borderRadius: "999px", fontSize: "14px", fontWeight: "600",
        fontFamily: FONT, zIndex: 999,
        background: bg, color: "#fff",
        boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
      }}
    >
      {toast.message}
    </div>
  );
}

function BrandHeader() {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px 16px 12px",
    }}>
      <img
        src={UPSWELL_LOGO}
        alt="Upswell"
        style={{ height: 32 }}
      />
    </div>
  );
}

function DeleteModal({ deleteConfirmId, onCancel, onConfirm }) {
  if (deleteConfirmId === null) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 998, padding: 16,
      }}
      onClick={onCancel}
    >
      <div
        style={{ ...card, textAlign: "center", padding: "32px 28px", maxWidth: "360px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <p style={{ color: BRAND.ink, fontSize: "20px", margin: "0 0 8px", fontWeight: "700" }}>
          {deleteConfirmId === "all" ? "Delete all customers?" : "Delete this customer?"}
        </p>
        <p style={{ color: BRAND.muted, fontSize: "14px", margin: "0 0 24px" }}>
          This action cannot be undone.
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            style={{ ...btnSecondary, flex: 1, padding: "14px" }}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            style={{
              ...btnSecondary,
              flex: 1,
              padding: "14px",
              fontSize: "14px",
              color: "#fff",
              background: BRAND.danger,
              borderColor: BRAND.danger,
            }}
            onClick={onConfirm}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// Styles (module-scope — only depend on BRAND and FONT constants)
// ═══════════════════════════════════════

const pageBg = {
  background: BRAND.bg,
  minHeight: "100vh",
  fontFamily: FONT,
  color: BRAND.body,
};

const card = {
  background: BRAND.cardBg,
  border: `1px solid ${BRAND.border}`,
  borderRadius: "16px",
  padding: "32px 28px",
  maxWidth: "440px",
  width: "100%",
  margin: "0 auto",
};

const inputStyle = {
  width: "100%",
  padding: "16px 18px",
  borderRadius: "12px",
  border: `1.5px solid ${BRAND.border}`,
  background: BRAND.cardBg,
  color: BRAND.ink,
  fontSize: "16px",
  fontFamily: FONT,
  fontWeight: "500",
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 0.15s",
};

const btnPrimary = {
  width: "100%",
  padding: "18px",
  borderRadius: "999px",
  border: "none",
  background: BRAND.coral,
  color: "#fff",
  fontSize: "17px",
  fontWeight: "700",
  fontFamily: FONT,
  cursor: "pointer",
  transition: "background 0.15s, transform 0.1s",
  letterSpacing: "0.01em",
};

const btnSecondary = {
  padding: "10px 18px",
  borderRadius: "999px",
  border: `1.5px solid ${BRAND.border}`,
  background: BRAND.cardBg,
  color: BRAND.body,
  fontSize: "13px",
  fontWeight: "600",
  fontFamily: FONT,
  cursor: "pointer",
  transition: "border-color 0.15s",
};

const labelStyle = {
  color: BRAND.body,
  fontSize: "14px",
  fontWeight: "600",
  marginBottom: "8px",
  display: "block",
};

export default function App() {
  const [view, setView] = useState("customer");
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
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

  // ─── Toast (defined first so other callbacks can depend on it) ───
  const showToast = useCallback((type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // ─── Load from Supabase (only called when admin view is entered) ───
  const fetchCustomers = useCallback(async () => {
    setLoading(true);
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
    } catch (e) {
      console.error("fetchCustomers failed:", e);
      showToast("error", "Failed to load customers");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  // ─── Session timeout ───
  const resetSessionTimer = useCallback(() => {
    if (sessionTimer.current) clearTimeout(sessionTimer.current);
    sessionTimer.current = setTimeout(() => {
      setView("customer");
      setDeleteConfirmId(null);
      showToast("info", "Logged out due to inactivity");
    }, SESSION_TIMEOUT_MS);
  }, [showToast]);

  useEffect(() => {
    if (view === "admin") {
      resetSessionTimer();
      return () => { if (sessionTimer.current) clearTimeout(sessionTimer.current); };
    }
  }, [view, resetSessionTimer]);

  const adminAction = useCallback(
    (fn) => (...args) => {
      resetSessionTimer();
      return fn(...args);
    },
    [resetSessionTimer]
  );

  // ─── Submit ───
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
    } catch (e) {
      console.error("Submit failed:", e);
      showToast("error", "Save failed. Please try again.");
    }
    setSubmitting(false);
  };

  // ─── Admin Login ───
  const handleAdminLogin = async () => {
    if (Date.now() < lockoutUntil) {
      const secs = Math.ceil((lockoutUntil - Date.now()) / 1000);
      setPinError(`Locked out. Try again in ${secs}s`);
      return;
    }
    const hash = await hashPin(pin);
    if (hash === ADMIN_PIN_HASH) {
      setView("admin"); setPinError(""); setPin(""); setLoginAttempts(0);
      fetchCustomers();
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

  // ─── Delete ───
  const confirmDelete = async () => {
    try {
      if (deleteConfirmId === "all") {
        const { error } = await supabase
          .from("customers")
          .delete()
          .neq("id", "00000000-0000-0000-0000-000000000000");
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
    } catch (e) {
      console.error("Delete failed:", e);
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

  const term = searchTerm.toLowerCase();
  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(term) ||
      c.phone.includes(term) ||
      (c.memo && c.memo.toLowerCase().includes(term))
  );

  // ─── Customer Form ───
  if (view === "customer") {
    const canSubmit = name.trim() && phone.trim() && !submitting;
    return (
      <div style={pageBg}>
        <ToastBanner toast={toast} />
        <BrandHeader />
        <div style={{
          padding: "20px 16px 60px",
          display: "flex", flexDirection: "column", alignItems: "center",
        }}>
          {!submitted ? (
            <div style={{ maxWidth: "440px", width: "100%" }}>
              <div style={{ textAlign: "center", marginBottom: 32, padding: "0 8px" }}>
                <h1 style={{
                  color: BRAND.ink, fontSize: "32px", fontWeight: "800",
                  margin: "0 0 12px", lineHeight: "1.15", letterSpacing: "-0.02em",
                }}>
                  Get the best <span style={{ color: BRAND.coral }}>restaurant deals</span> in your area
                </h1>
                <p style={{
                  color: BRAND.body, fontSize: "16px",
                  margin: "0", lineHeight: "1.5",
                }}>
                  Drop your info and we'll keep you posted on exclusive offers and events.
                </p>
              </div>

              <div style={card}>
                <div style={{ marginBottom: 18 }}>
                  <label style={labelStyle}>Name</label>
                  <input
                    style={inputStyle}
                    placeholder="Your name"
                    value={name}
                    maxLength={MAX_NAME_LENGTH}
                    onChange={(e) => setName(e.target.value)}
                    onFocus={(e) => (e.target.style.borderColor = BRAND.coral)}
                    onBlur={(e) => (e.target.style.borderColor = BRAND.border)}
                  />
                </div>

                <div style={{ marginBottom: 18 }}>
                  <label style={labelStyle}>Phone number</label>
                  <input
                    style={{
                      ...inputStyle,
                      borderColor: phoneError ? BRAND.coral : BRAND.border,
                    }}
                    placeholder="(555) 123-4567"
                    type="tel"
                    value={phone}
                    maxLength={MAX_PHONE_LENGTH}
                    onChange={(e) => { setPhone(e.target.value); setPhoneError(""); }}
                    onFocus={(e) => { if (!phoneError) e.target.style.borderColor = BRAND.coral; }}
                    onBlur={(e) => { if (!phoneError) e.target.style.borderColor = BRAND.border; }}
                  />
                  {phoneError && (
                    <p style={{ color: BRAND.coral, fontSize: "13px", marginTop: 6, fontWeight: "500" }}>
                      {phoneError}
                    </p>
                  )}
                </div>

                <div style={{ marginBottom: 24 }}>
                  <label style={labelStyle}>Which restaurant?</label>
                  <textarea
                    style={{
                      ...inputStyle, minHeight: "90px", resize: "vertical", lineHeight: "1.5",
                    }}
                    placeholder="e.g. My-O-My Shawarma, Joe's BBQ..."
                    value={memo}
                    maxLength={MAX_MEMO_LENGTH}
                    onChange={(e) => setMemo(e.target.value)}
                    onFocus={(e) => (e.target.style.borderColor = BRAND.coral)}
                    onBlur={(e) => (e.target.style.borderColor = BRAND.border)}
                  />
                  <p style={{
                    color: BRAND.hint, fontSize: "12px",
                    textAlign: "right", margin: "6px 0 0",
                  }}>
                    {memo.length}/{MAX_MEMO_LENGTH}
                  </p>
                </div>

                <button
                  style={{
                    ...btnPrimary,
                    opacity: canSubmit ? 1 : 0.4,
                    cursor: canSubmit ? "pointer" : "not-allowed",
                  }}
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  onMouseEnter={(e) => { if (canSubmit) e.target.style.background = BRAND.coralDark; }}
                  onMouseLeave={(e) => { e.target.style.background = BRAND.coral; }}
                >
                  {submitting ? "Submitting..." : "Sign me up"}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ ...card, textAlign: "center", padding: "48px 28px" }}>
              <div style={{
                width: 72, height: 72, borderRadius: "50%",
                background: BRAND.coralLight,
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 24px",
              }}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
                  stroke={BRAND.coral} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <h2 style={{
                color: BRAND.ink, fontSize: "28px", margin: "0 0 12px", fontWeight: "800",
                letterSpacing: "-0.01em",
              }}>
                You're in!
              </h2>
              <p style={{
                color: BRAND.body, fontSize: "16px", margin: "0 0 28px", lineHeight: "1.5",
              }}>
                Thanks for signing up. We'll be in touch soon.
              </p>
              <button
                style={btnSecondary}
                onClick={() => setSubmitted(false)}
              >
                Register another
              </button>
            </div>
          )}

          <button
            onClick={() => setView("admin-login")}
            style={{
              marginTop: 48, background: "none", border: "none",
              color: BRAND.hint, fontSize: "12px", cursor: "pointer",
              fontFamily: FONT, fontWeight: "500",
            }}
          >
            Admin
          </button>
        </div>
      </div>
    );
  }

  // ─── Admin Login ───
  if (view === "admin-login") {
    const isLocked = Date.now() < lockoutUntil;
    return (
      <div style={pageBg}>
        <ToastBanner toast={toast} />
        <BrandHeader />
        <div style={{ padding: "60px 16px", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={card}>
            <h2 style={{
              color: BRAND.ink, fontSize: "26px", fontWeight: "800",
              margin: "0 0 8px", textAlign: "center", letterSpacing: "-0.01em",
            }}>
              Admin login
            </h2>
            <p style={{
              color: BRAND.muted, fontSize: "15px",
              textAlign: "center", margin: "0 0 28px",
            }}>
              Enter your PIN to continue
            </p>

            <div style={{ marginBottom: 20 }}>
              <input
                style={{
                  ...inputStyle, textAlign: "center", fontSize: "26px",
                  letterSpacing: "10px", fontWeight: "700",
                  borderColor: pinError ? BRAND.coral : BRAND.border,
                }}
                type="password"
                maxLength={8}
                placeholder="••••••••"
                value={pin}
                disabled={isLocked}
                onChange={(e) => { setPin(e.target.value); setPinError(""); }}
                onKeyDown={(e) => e.key === "Enter" && !isLocked && handleAdminLogin()}
                autoFocus
              />
              {pinError && (
                <p style={{
                  color: BRAND.coral, fontSize: "13px", textAlign: "center",
                  marginTop: 10, fontWeight: "500",
                }}>
                  {pinError}
                </p>
              )}
            </div>

            <button
              style={{ ...btnPrimary, opacity: isLocked ? 0.4 : 1 }}
              onClick={handleAdminLogin}
              disabled={isLocked}
              onMouseEnter={(e) => { if (!isLocked) e.target.style.background = BRAND.coralDark; }}
              onMouseLeave={(e) => { e.target.style.background = BRAND.coral; }}
            >
              Log in
            </button>

            <button
              onClick={() => { setView("customer"); setPin(""); setPinError(""); }}
              style={{
                ...btnSecondary, width: "100%", marginTop: 12,
                textAlign: "center", padding: "14px",
              }}
            >
              Go back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Admin Dashboard ───
  return (
    <div style={pageBg}>
      <ToastBanner toast={toast} />
      <DeleteModal
        deleteConfirmId={deleteConfirmId}
        onCancel={() => setDeleteConfirmId(null)}
        onConfirm={adminAction(confirmDelete)}
      />
      <BrandHeader />
      <div style={{ padding: "16px 16px 60px", maxWidth: "720px", margin: "0 auto" }}>

        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "flex-start",
          marginBottom: 24, gap: 12, flexWrap: "wrap",
        }}>
          <div>
            <h1 style={{
              color: BRAND.ink, fontSize: "28px", fontWeight: "800",
              margin: 0, letterSpacing: "-0.01em",
            }}>
              Customers
            </h1>
            <p style={{ color: BRAND.muted, fontSize: "14px", margin: "4px 0 0", fontWeight: "500" }}>
              {loading ? "Loading..." : `${customers.length} ${customers.length === 1 ? "person" : "people"}`}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              style={{ ...btnSecondary, color: BRAND.coral, borderColor: BRAND.coralLight }}
              onClick={adminAction(handleExportCSV)}
            >
              Download CSV
            </button>
            {customers.length > 0 && (
              <button
                style={btnSecondary}
                onClick={adminAction(() => setDeleteConfirmId("all"))}
              >
                Delete all
              </button>
            )}
            <button style={btnSecondary} onClick={() => setView("customer")}>
              Exit
            </button>
          </div>
        </div>

        {customers.length > 3 && (
          <div style={{ marginBottom: 20 }}>
            <input
              style={{ ...inputStyle, padding: "14px 18px", fontSize: "15px" }}
              placeholder="Search by name, phone, or restaurant..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={(e) => (e.target.style.borderColor = BRAND.coral)}
              onBlur={(e) => (e.target.style.borderColor = BRAND.border)}
            />
          </div>
        )}

        {filtered.length === 0 ? (
          <div style={{ ...card, textAlign: "center", padding: "60px 28px" }}>
            <p style={{ color: BRAND.muted, fontSize: "15px", margin: 0, fontWeight: "500" }}>
              {loading
                ? "Loading..."
                : customers.length === 0
                ? "No customers registered yet"
                : "No results found"}
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map((c) => (
              <div
                key={c.id}
                style={{
                  background: BRAND.cardBg,
                  border: `1px solid ${BRAND.border}`,
                  borderRadius: "14px",
                  padding: "18px 20px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    color: BRAND.ink, fontSize: "16px", fontWeight: "700",
                    marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis",
                    whiteSpace: "nowrap", letterSpacing: "-0.005em",
                  }}>
                    {c.name}
                  </div>
                  <div style={{
                    color: BRAND.body, fontSize: "14px", marginBottom: 4, fontWeight: "500",
                  }}>
                    {c.phone}
                  </div>
                  {c.memo && (
                    <div style={{
                      color: BRAND.coral, fontSize: "13px", marginBottom: 4,
                      fontWeight: "600", overflow: "hidden", textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}>
                      {c.memo}
                    </div>
                  )}
                  <div style={{ color: BRAND.hint, fontSize: "12px", fontWeight: "500" }}>
                    {c.date}
                  </div>
                </div>
                <div style={{
                  display: "flex", gap: 6, alignItems: "center",
                  flexShrink: 0,
                }}>
                  <button
                    onClick={adminAction(() => handleCopy(c))}
                    style={{
                      ...btnSecondary,
                      padding: "8px 14px",
                      fontSize: "12px",
                      color: copiedId === c.id ? BRAND.coral : BRAND.body,
                      borderColor: copiedId === c.id ? BRAND.coralLight : BRAND.border,
                    }}
                  >
                    {copiedId === c.id ? "Copied" : "Copy"}
                  </button>
                  <button
                    onClick={adminAction(() => setDeleteConfirmId(c.id))}
                    style={{
                      ...btnSecondary,
                      padding: "8px 14px",
                      fontSize: "12px",
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

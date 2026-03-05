/**
 * Standalone page for email verification: user arrives with ?token= from signup email.
 * GET /api/auth/verify-email?token= sets client_verified; shows loading then success or error.
 */
import { useState, useEffect } from "react";

const API_BASE = import.meta.env?.VITE_API_URL ?? "";

const styles = `
  .verify-page { min-height: 100vh; background: #F7F6F2; display: flex; align-items: center; justify-content: center; padding: 24px; font-family: 'DM Sans', system-ui, sans-serif; }
  .verify-card { background: #fff; border-radius: 12px; padding: 32px; max-width: 400px; width: 100%; box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
  .verify-title { font-size: 24px; font-weight: 700; color: #1A1814; margin-bottom: 8px; }
  .verify-subtitle { font-size: 14px; color: #6B6660; margin-bottom: 24px; }
  .verify-success { background: #D8F3DC; color: #1B4332; padding: 12px; border-radius: 8px; margin-bottom: 16px; font-size: 14px; }
  .verify-error { background: #FEE2E2; color: #DC2626; padding: 12px; border-radius: 8px; margin-bottom: 16px; font-size: 14px; }
  .verify-link { color: #2D6A4F; font-weight: 600; text-decoration: none; }
  .verify-link:hover { text-decoration: underline; }
  .verify-spinner { display: inline-block; width: 20px; height: 20px; border: 2px solid #E2DDD5; border-top-color: #2D6A4F; border-radius: 50%; animation: verify-spin 0.8s linear infinite; margin-right: 10px; vertical-align: middle; }
  @keyframes verify-spin { to { transform: rotate(360deg); } }
`;

export default function VerifyEmailPage() {
  const [status, setStatus] = useState("loading"); // 'loading' | 'success' | 'error'
  const [message, setMessage] = useState("");

  // On mount: read token from URL and call verify-email API
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token") || "";
    if (!token.trim()) {
      setStatus("error");
      setMessage("Invalid or missing verification link.");
      return;
    }
    fetch(`${API_BASE}/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (ok) {
          setStatus("success");
          setMessage(data.message || "Email verified.");
        } else {
          setStatus("error");
          setMessage(data.error || "Link invalid or expired.");
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("Something went wrong. Try again or request a new verification email.");
      });
  }, []);

  return (
    <>
      <style>{styles}</style>
      <div className="verify-page">
        <div className="verify-card">
          <h1 className="verify-title">Verify your email</h1>
          {status === "loading" && (
            <>
              <p className="verify-subtitle">Verifying your email…</p>
              <p style={{ display: "flex", alignItems: "center" }}>
                <span className="verify-spinner" />
                Please wait.
              </p>
            </>
          )}
          {status === "success" && (
            <>
              <p className="verify-subtitle">Your Mmaraka account is now verified.</p>
              <div className="verify-success">{message}</div>
              <p>You can close this page and sign in to the Mmaraka app.</p>
              <p style={{ marginTop: 16 }}>
                <a href="/" className="verify-link">← Back to home</a>
              </p>
            </>
          )}
          {status === "error" && (
            <>
              <p className="verify-subtitle">We couldn’t verify your email.</p>
              <div className="verify-error">{message}</div>
              <p>You can request a new verification email from the app (check your account or sign up again).</p>
              <p style={{ marginTop: 16 }}>
                <a href="/" className="verify-link">← Back to home</a>
              </p>
            </>
          )}
        </div>
      </div>
    </>
  );
}

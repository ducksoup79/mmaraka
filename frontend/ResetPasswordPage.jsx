import { useState, useEffect } from "react";

const API_BASE = import.meta.env?.VITE_API_URL ?? "";

const styles = `
  .reset-page { min-height: 100vh; background: #F7F6F2; display: flex; align-items: center; justify-content: center; padding: 24px; font-family: 'DM Sans', system-ui, sans-serif; }
  .reset-card { background: #fff; border-radius: 12px; padding: 32px; max-width: 400px; width: 100%; box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
  .reset-title { font-size: 24px; font-weight: 700; color: #1A1814; margin-bottom: 8px; }
  .reset-subtitle { font-size: 14px; color: #6B6660; margin-bottom: 24px; }
  .reset-label { display: block; font-size: 13px; font-weight: 500; color: #6B6660; margin-bottom: 6px; }
  .reset-input { width: 100%; border: 1px solid #E2DDD5; border-radius: 8px; padding: 12px 14px; font-size: 16px; color: #1A1814; margin-bottom: 16px; box-sizing: border-box; }
  .reset-input:focus { outline: none; border-color: #2D6A4F; }
  .reset-btn { width: 100%; background: #2D6A4F; color: #fff; border: none; padding: 14px; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; }
  .reset-btn:hover:not(:disabled) { background: #1B4332; }
  .reset-btn:disabled { opacity: 0.7; cursor: not-allowed; }
  .reset-error { background: #FEE2E2; color: #DC2626; padding: 12px; border-radius: 8px; margin-bottom: 16px; font-size: 14px; }
  .reset-success { background: #D8F3DC; color: #1B4332; padding: 12px; border-radius: 8px; margin-bottom: 16px; font-size: 14px; }
  .reset-link { color: #2D6A4F; font-weight: 600; text-decoration: none; }
  .reset-link:hover { text-decoration: underline; }
`;

export default function ResetPasswordPage() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setToken(params.get("token") || "");
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!token.trim()) {
      setError("Invalid or expired link. Request a new password reset from the app.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password: password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || res.statusText || "Failed to reset password.");
        return;
      }
      setSuccess(true);
      setPassword("");
      setConfirm("");
    } catch (err) {
      setError(err.message || "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <>
        <style>{styles}</style>
        <div className="reset-page">
          <div className="reset-card">
            <h1 className="reset-title">Password reset</h1>
            <p className="reset-subtitle">Your password has been updated. You can now sign in with your new password.</p>
            <div className="reset-success">You can close this page and open the Mmaraka app to sign in.</div>
            <a href="/" className="reset-link">← Back to home</a>
          </div>
        </div>
      </>
    );
  }

  if (!token) {
    return (
      <>
        <style>{styles}</style>
        <div className="reset-page">
          <div className="reset-card">
            <h1 className="reset-title">Reset password</h1>
            <p className="reset-subtitle">This link is invalid or has expired. Request a new password reset from the Mmaraka app (Forgot password?).</p>
            <a href="/" className="reset-link">← Back to home</a>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{styles}</style>
      <div className="reset-page">
        <div className="reset-card">
          <h1 className="reset-title">Set new password</h1>
          <p className="reset-subtitle">Enter your new password below. It must be at least 6 characters.</p>
          <form onSubmit={handleSubmit}>
            {error && <div className="reset-error">{error}</div>}
            <label className="reset-label">New password</label>
            <input
              type="password"
              className="reset-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              minLength={6}
            />
            <label className="reset-label">Confirm password</label>
            <input
              type="password"
              className="reset-input"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              minLength={6}
            />
            <button type="submit" className="reset-btn" disabled={loading}>
              {loading ? "Updating…" : "Reset password"}
            </button>
          </form>
          <p style={{ marginTop: 16, fontSize: 14, color: "#6B6660" }}>
            <a href="/" className="reset-link">← Back to home</a>
          </p>
        </div>
      </div>
    </>
  );
}

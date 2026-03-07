/**
 * Mmaraka web SPA: single-file app with inline CSS. No React Router; screen state (products, services,
 * messages, etc.) is held in useState. Auth: token in window.__marketplace_token and localStorage.
 * API_BASE from VITE_API_URL (empty in dev = Vite proxy). Contains: API helpers, design tokens (css),
 * AuthScreen, ProductsPage, AddProductPage, ServicesPage, AddServicePage, MyListingsPage, MessagesPage,
 * SettingsPage, ReportPage, TermsPage, AdminPage, and main App with header/sidebar and renderPage switch.
 */
import { useState, useEffect, useRef, useCallback, createContext, useContext } from "react";

// API base: empty in dev (Vite proxy forwards /api); set VITE_API_URL for production build
const API_BASE = import.meta.env?.VITE_API_URL ?? "";

/** JSON API client; adds Bearer token from window.__marketplace_token when present. */
async function api(path, options = {}) {
  const token = typeof window !== "undefined" && window.__marketplace_token;
  const headers = {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText || "Request failed");
  return data;
}

/** Upload image via POST /api/uploads/image; returns path for product/service image. */
async function uploadImage(file) {
  const token = typeof window !== "undefined" && window.__marketplace_token;
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${API_BASE}/api/uploads/image`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: fd,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText || "Upload failed");
  return data.path;
}

function formatRelative(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now - d;
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "1d ago";
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

// ─── Design tokens & global CSS (layout, header, sidebar, forms, cards, etc.) ───
const css = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Playfair+Display:wght@600;700&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:        #F7F6F2;
    --surface:   #FFFFFF;
    --surface2:  #F0EEE8;
    --border:    #E2DDD5;
    --text:      #1A1814;
    --text2:     #6B6660;
    --text3:     #9E9990;
    --accent:    #2D6A4F;
    --accent2:   #40916C;
    --accent-lt: #D8F3DC;
    --gold:      #B7791F;
    --gold-lt:   #FEF3C7;
    --sky:       #1D4ED8;
    --sky-lt:    #DBEAFE;
    --danger:    #DC2626;
    --danger-lt: #FEE2E2;
    --shadow-sm: 0 1px 3px rgba(0,0,0,0.07);
    --shadow:    0 4px 16px rgba(0,0,0,0.08);
    --shadow-lg: 0 12px 40px rgba(0,0,0,0.12);
    --radius:    12px;
    --radius-sm: 8px;
    --radius-lg: 20px;
    --font:      'DM Sans', sans-serif;
    --font-disp: 'Playfair Display', serif;
    --sidebar:   240px;
    --header:    64px;
    --banner:    112px;
  }

  body { font-family: var(--font); background: var(--bg); color: var(--text); }

  /* Scrollbar */
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }

  /* Layout */
  .app { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
  .header {
    height: var(--header); background: var(--surface); border-bottom: 1px solid var(--border);
    display: flex; align-items: center; padding: 0 24px; gap: 16px;
    position: relative; z-index: 100; flex-shrink: 0;
    box-shadow: var(--shadow-sm);
  }
  .header-logo { font-family: var(--font-disp); font-size: 22px; color: var(--accent); font-weight: 700; cursor: pointer; display: flex; flex-direction: column; align-items: flex-start; line-height: 1.2; }
  .header-logo span { color: var(--text3); font-weight: 600; font-size: 18px; }
  .header-logo-sub { font-size: 12px; font-weight: 400; color: var(--text3); margin-top: 2px; }
  .header-spacer { flex: 1; }
  .header-user {
    display: flex; align-items: center; gap: 10px; cursor: pointer;
    padding: 6px 12px; border-radius: var(--radius-sm); transition: background .15s;
  }
  .header-user:hover { background: var(--surface2); }
  .avatar {
    width: 34px; height: 34px; border-radius: 50%; background: var(--accent);
    display: flex; align-items: center; justify-content: center;
    color: #fff; font-size: 13px; font-weight: 600; flex-shrink: 0;
  }
  .avatar.gold { background: var(--gold); }
  .avatar.silver { background: #6B7280; }

  .body { display: flex; flex: 1; overflow: hidden; }

  /* Sidebar */
  .sidebar {
    width: var(--sidebar); background: var(--surface); border-right: 1px solid var(--border);
    display: flex; flex-direction: column; padding: 20px 12px; gap: 2px; flex-shrink: 0;
    overflow-y: auto;
  }
  .nav-section { font-size: 10px; font-weight: 600; color: var(--text3); letter-spacing: .08em;
    text-transform: uppercase; padding: 16px 12px 6px; }
  .nav-item {
    display: flex; align-items: center; gap: 10px; padding: 9px 12px;
    border-radius: var(--radius-sm); cursor: pointer; font-size: 14px; font-weight: 500;
    color: var(--text2); transition: all .15s; position: relative;
  }
  .nav-item:hover { background: var(--surface2); color: var(--text); }
  .nav-item.active { background: var(--accent-lt); color: var(--accent); }
  .nav-item .icon { font-size: 16px; width: 20px; text-align: center; }
  .nav-item .nav-unread {
    margin-left: auto;
    padding: 2px 6px;
    min-width: 18px;
    font-size: 11px;
    font-weight: 600;
    text-align: center;
    background: var(--accent);
    color: white;
    border-radius: 10px;
  }
  .nav-badge {
    margin-left: auto; background: var(--accent); color: #fff;
    font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 10px;
  }

  /* Main content */
  .main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
  .page { flex: 1; overflow-y: auto; padding: 28px 32px; }

  /* Ad banner */
  .ad-banner {
    height: var(--banner); background: linear-gradient(135deg, var(--text) 0%, #2D3748 100%);
    display: flex; align-items: center; justify-content: center; gap: 16px;
    flex-shrink: 0; overflow: hidden; position: relative; padding: 12px 16px;
  }
  .ad-banner-inner { display: flex; align-items: center; gap: 16px; animation: adSlide 0.5s ease; max-width: 100%; min-width: 0; cursor: pointer; }
  @keyframes adSlide { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  .ad-logo {
    width: calc(var(--banner) - 24px); height: calc(var(--banner) - 24px);
    min-width: 64px; min-height: 64px; max-width: 200px; max-height: 96px;
    border-radius: 8px; background: var(--accent);
    display: flex; align-items: center; justify-content: center; color: #fff; font-size: 28px;
    flex-shrink: 0; overflow: hidden;
  }
  .ad-logo img { width: 100%; height: 100%; object-fit: contain; border-radius: 8px; }
  .ad-text { color: #fff; font-size: 15px; line-height: 1.35; min-width: 0; }
  .ad-text strong { color: #FCD34D; font-size: 16px; }
  .ad-label {
    position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
    font-size: 9px; color: rgba(255,255,255,.4); letter-spacing: .06em; text-transform: uppercase;
  }
  .ad-dot { width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,.3); cursor: pointer; }
  .ad-dot.active { background: #FCD34D; }
  .ad-dots { display: flex; gap: 4px; position: absolute; left: 16px; bottom: 8px; }

  /* Page headings */
  .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; }
  .page-title { font-family: var(--font-disp); font-size: 26px; font-weight: 700; line-height: 1.2; }
  .page-subtitle { font-size: 14px; color: var(--text2); margin-top: 4px; }
  .btn {
    display: inline-flex; align-items: center; gap: 8px; padding: 9px 18px;
    border-radius: var(--radius-sm); font-family: var(--font); font-size: 14px; font-weight: 600;
    cursor: pointer; border: none; transition: all .15s; text-decoration: none;
  }
  .btn-primary { background: var(--accent); color: #fff; }
  .btn-primary:hover { background: var(--accent2); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(45,106,79,.3); }
  .btn-outline { background: transparent; border: 1.5px solid var(--border); color: var(--text2); }
  .btn-outline:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-lt); }
  .btn-ghost { background: transparent; color: var(--text2); }
  .btn-ghost:hover { background: var(--surface2); color: var(--text); }
  .btn-sm { padding: 6px 12px; font-size: 12px; }
  .btn-danger { background: var(--danger); color: #fff; }

  /* Cards */
  .card {
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
    box-shadow: var(--shadow-sm); transition: all .2s;
  }
  .card:hover { box-shadow: var(--shadow); transform: translateY(-2px); }

  /* Product grid */
  .product-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
  .product-card { overflow: hidden; cursor: pointer; }
  .product-img {
    width: 100%; aspect-ratio: 4/3; background: var(--surface2);
    display: flex; align-items: center; justify-content: center;
    font-size: 36px; overflow: hidden; position: relative;
  }
  .product-img img { width: 100%; height: 100%; object-fit: cover; }
  .product-badge {
    position: absolute; top: 8px; left: 8px; font-size: 10px; font-weight: 700;
    padding: 3px 8px; border-radius: 20px; letter-spacing: .04em; text-transform: uppercase;
  }
  .badge-diamond { background: var(--gold); color: #fff; }
  .badge-silver { background: #6B7280; color: #fff; }
  .badge-sold { background: var(--danger); color: #fff; }
  .badge-dormant { background: var(--text3); color: #fff; }
  .product-body { padding: 12px 14px 14px; min-width: 0; }
  .product-name { font-size: 14px; font-weight: 600; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .product-cat { font-size: 12px; color: var(--text3); margin-bottom: 8px; }
  .product-footer { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
  .product-footer .product-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; justify-content: flex-end; min-width: 0; }
  .product-price { font-size: 16px; font-weight: 700; color: var(--accent); }
  .product-meta { font-size: 11px; color: var(--text3); }

  /* Filters */
  .filters { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; align-items: center; }
  .search-box {
    flex: 1; min-width: 200px; display: flex; align-items: center;
    background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--radius-sm);
    padding: 0 12px; gap: 8px; transition: border-color .15s;
  }
  .search-box:focus-within { border-color: var(--accent); }
  .search-box input { flex: 1; border: none; outline: none; font-family: var(--font); font-size: 14px;
    background: transparent; padding: 9px 0; color: var(--text); }
  .search-icon { color: var(--text3); font-size: 15px; }
  .filter-select {
    appearance: none; border: 1.5px solid var(--border); background: var(--surface);
    padding: 9px 32px 9px 12px; border-radius: var(--radius-sm); font-family: var(--font);
    font-size: 13px; color: var(--text2); cursor: pointer; outline: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236B6660' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 10px center; transition: border-color .15s;
  }
  .filter-select:focus { border-color: var(--accent); }

  /* Service cards */
  .service-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
  .service-card { display: flex; gap: 14px; padding: 18px; align-items: flex-start; }
  .service-logo {
    width: 52px; height: 52px; border-radius: 10px; background: var(--accent-lt);
    display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0;
  }
  .service-info { flex: 1; min-width: 0; }
  .service-name { font-size: 15px; font-weight: 600; margin-bottom: 4px; }
  .service-desc { font-size: 13px; color: var(--text2); line-height: 1.5; display: -webkit-box;
    -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .service-tier { display: inline-flex; align-items: center; gap: 4px; margin-top: 8px;
    font-size: 11px; font-weight: 600; }

  /* Stats */
  .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 28px; }
  .stat-card { padding: 20px; }
  .stat-num { font-size: 28px; font-weight: 700; font-family: var(--font-disp); }
  .stat-label { font-size: 13px; color: var(--text2); margin-top: 2px; }
  .stat-change { font-size: 12px; margin-top: 6px; }
  .stat-up { color: var(--accent); }
  .stat-down { color: var(--danger); }

  /* Form */
  .form-grid { display: grid; gap: 20px; }
  .form-grid-2 { grid-template-columns: 1fr 1fr; }
  .form-group { display: flex; flex-direction: column; gap: 6px; }
  .form-label { font-size: 13px; font-weight: 600; color: var(--text); }
  .form-label span { color: var(--danger); margin-left: 2px; }
  .form-input, .form-select, .form-textarea {
    border: 1.5px solid var(--border); background: var(--surface); border-radius: var(--radius-sm);
    padding: 10px 12px; font-family: var(--font); font-size: 14px; color: var(--text);
    outline: none; transition: border-color .15s; width: 100%;
  }
  .form-input:focus, .form-select:focus, .form-textarea:focus { border-color: var(--accent); }
  .form-textarea { resize: vertical; min-height: 90px; }
  .form-select { appearance: none; cursor: pointer;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236B6660' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 12px center; padding-right: 32px; }
  .form-hint { font-size: 12px; color: var(--text3); }
  .form-error { font-size: 12px; color: var(--danger); }

  /* Upload zone */
  .upload-zone {
    border: 2px dashed var(--border); border-radius: var(--radius); padding: 32px;
    text-align: center; cursor: pointer; transition: all .2s; background: var(--surface2);
  }
  .upload-zone:hover { border-color: var(--accent); background: var(--accent-lt); }
  .upload-icon { font-size: 32px; margin-bottom: 8px; }
  .upload-text { font-size: 14px; color: var(--text2); }
  .upload-hint { font-size: 12px; color: var(--text3); margin-top: 4px; }

  /* Tier cards */
  .tier-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; max-width: 700px; }
  .tier-card { padding: 24px; border-radius: var(--radius); position: relative; overflow: hidden; }
  .tier-card.basic { border: 2px solid var(--border); background: var(--surface); }
  .tier-card.silver { border: 2px solid #9CA3AF; background: linear-gradient(135deg, #fff 0%, #F9FAFB 100%); }
  .tier-card.diamond { border: 2px solid var(--gold); background: linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%); }
  .tier-card.active-tier { box-shadow: 0 0 0 3px var(--accent); }
  .tier-badge {
    position: absolute; top: 12px; right: 12px; font-size: 10px; font-weight: 700;
    padding: 2px 8px; border-radius: 20px; text-transform: uppercase; letter-spacing: .06em;
  }
  .tier-badge.current { background: var(--accent); color: #fff; }
  .tier-name { font-family: var(--font-disp); font-size: 20px; font-weight: 700; margin-bottom: 4px; }
  .tier-price { font-size: 28px; font-weight: 700; margin: 12px 0; }
  .tier-price small { font-size: 13px; font-weight: 400; color: var(--text2); }
  .tier-features { list-style: none; display: flex; flex-direction: column; gap: 8px; margin: 16px 0; }
  .tier-features li { font-size: 13px; color: var(--text2); display: flex; align-items: center; gap: 8px; }
  .tier-features li::before { content: '✓'; color: var(--accent); font-weight: 700; }

  /* Settings */
  .settings-section { margin-bottom: 32px; }
  .settings-title { font-size: 16px; font-weight: 700; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--border); }

  /* Profile */
  .profile-header { display: flex; align-items: center; gap: 20px; padding: 24px; margin-bottom: 24px; }
  .profile-avatar { width: 72px; height: 72px; border-radius: 50%; background: var(--accent);
    display: flex; align-items: center; justify-content: center; color: #fff; font-size: 26px; font-weight: 700; }
  .profile-info h2 { font-size: 20px; font-weight: 700; }
  .profile-info p { font-size: 14px; color: var(--text2); margin-top: 2px; }

  /* Table */
  .table-wrap { overflow-x: auto; border-radius: var(--radius); border: 1px solid var(--border); }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { background: var(--surface2); text-align: left; padding: 12px 16px; font-weight: 600; color: var(--text2); font-size: 12px; letter-spacing: .04em; text-transform: uppercase; border-bottom: 1px solid var(--border); }
  td { padding: 12px 16px; border-bottom: 1px solid var(--border); color: var(--text); }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: var(--surface2); }

  /* Status chips */
  .chip { display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; }
  .chip-avail { background: var(--accent-lt); color: var(--accent); }
  .chip-sold { background: var(--danger-lt); color: var(--danger); }
  .chip-dormant { background: var(--surface2); color: var(--text3); }
  .chip-active { background: var(--accent-lt); color: var(--accent); }
  .chip-inactive { background: var(--surface2); color: var(--text3); }

  /* Login screen */
  .login-screen {
    min-height: 100vh; display: flex; background: var(--bg);
  }
  .login-left {
    flex: 1; background: linear-gradient(150deg, #1A3C2E 0%, var(--accent) 60%, var(--accent2) 100%);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 48px; position: relative; overflow: hidden;
  }
  .login-left::before {
    content: ''; position: absolute; inset: 0;
    background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.04'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
  }
  .login-brand { color: #fff; text-align: center; position: relative; }
  .login-brand-name { font-family: var(--font-disp); font-size: 40px; font-weight: 700; }
  .login-brand-tagline { font-size: 16px; color: rgba(255,255,255,.7); margin-top: 12px; line-height: 1.6; }
  .login-illustration { font-size: 80px; margin-bottom: 32px; }

  .login-right {
    width: 460px; display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 48px 56px; overflow-y: auto;
  }
  .login-title { font-family: var(--font-disp); font-size: 28px; font-weight: 700; margin-bottom: 8px; }
  .login-sub { font-size: 14px; color: var(--text2); margin-bottom: 32px; }
  .login-form { width: 100%; display: flex; flex-direction: column; gap: 16px; }
  .login-switch { font-size: 14px; color: var(--text2); margin-top: 20px; text-align: center; }
  .login-switch a { color: var(--accent); cursor: pointer; font-weight: 600; text-decoration: none; }
  .login-switch a:hover { text-decoration: underline; }
  .forgot-link { font-size: 12px; color: var(--accent); cursor: pointer; text-align: right; margin-top: -8px; }
  .forgot-link:hover { text-decoration: underline; }
  .divider { display: flex; align-items: center; gap: 12px; color: var(--text3); font-size: 12px; margin: 4px 0; }
  .divider::before, .divider::after { content: ''; flex: 1; height: 1px; background: var(--border); }
  .checkbox-row { display: flex; align-items: flex-start; gap: 10px; font-size: 13px; color: var(--text2); }
  .checkbox-row input { margin-top: 2px; accent-color: var(--accent); flex-shrink: 0; }
  .checkbox-row a { color: var(--accent); cursor: pointer; }

  /* Password strength */
  .pwd-strength { display: flex; gap: 4px; margin-top: 6px; }
  .pwd-bar { height: 4px; flex: 1; border-radius: 2px; background: var(--border); transition: background .3s; }
  .pwd-bar.weak { background: var(--danger); }
  .pwd-bar.fair { background: var(--gold); }
  .pwd-bar.strong { background: var(--accent); }

  /* Tabs */
  .tabs { display: flex; border-bottom: 2px solid var(--border); margin-bottom: 24px; gap: 0; }
  .tab { padding: 10px 20px; font-size: 14px; font-weight: 500; cursor: pointer; color: var(--text2);
    border-bottom: 2px solid transparent; margin-bottom: -2px; transition: all .15s; }
  .tab:hover { color: var(--text); }
  .tab.active { color: var(--accent); border-bottom-color: var(--accent); font-weight: 600; }

  /* Terms */
  .terms-body { font-size: 14px; line-height: 1.8; color: var(--text2); }
  .terms-body h3 { color: var(--text); font-size: 16px; margin: 20px 0 8px; }
  .terms-body p { margin-bottom: 12px; }

  /* Error report */
  .report-wrap { max-width: 560px; }

  /* Admin */
  .admin-table-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; margin-bottom: 28px; }
  .admin-table-item { padding: 16px; border-radius: var(--radius); display: flex; flex-direction: column; gap: 6px; cursor: pointer; }
  .admin-table-item:hover { box-shadow: var(--shadow); transform: translateY(-2px); }
  .admin-table-icon { font-size: 20px; }
  .admin-table-name { font-size: 13px; font-weight: 600; }
  .admin-table-count { font-size: 12px; color: var(--text3); }

  /* Alert / notification */
  .alert { padding: 12px 16px; border-radius: var(--radius-sm); font-size: 13px; margin-bottom: 16px; display: flex; align-items: center; gap: 10px; }
  .alert-warning { background: var(--gold-lt); color: var(--gold); border: 1px solid #FDE68A; }
  .alert-success { background: var(--accent-lt); color: var(--accent); border: 1px solid #A7F3D0; }
  .alert-danger { background: var(--danger-lt); color: var(--danger); border: 1px solid #FECACA; }

  /* Phone input */
  .phone-row { display: flex; gap: 8px; }
  .country-select { width: 110px; flex-shrink: 0; }

  /* Empty state */
  .empty { text-align: center; padding: 60px 20px; color: var(--text3); }
  .empty-icon { font-size: 48px; margin-bottom: 12px; }
  .empty-title { font-size: 16px; font-weight: 600; color: var(--text2); margin-bottom: 6px; }
  .empty-sub { font-size: 14px; }

  /* Misc */
  .tag { display: inline-flex; padding: 3px 10px; background: var(--surface2); color: var(--text2); border-radius: 20px; font-size: 12px; }
  .text-accent { color: var(--accent); }
  .text-muted { color: var(--text2); font-size: 13px; }
  .fw-600 { font-weight: 600; }
  .mt-4 { margin-top: 4px; }
  .mt-8 { margin-top: 8px; }
  .mt-16 { margin-top: 16px; }
  .mb-8 { margin-bottom: 8px; }
  .mb-16 { margin-bottom: 16px; }
  .flex { display: flex; }
  .items-center { align-items: center; }
  .gap-8 { gap: 8px; }
  .gap-12 { gap: 12px; }
  .w-full { width: 100%; }
  .cursor-pointer { cursor: pointer; }

  /* ─── Mobile / smartphone ─────────────────────────────────────────────────── */
  .header-menu-btn {
    display: none; align-items: center; justify-content: center; width: 44px; height: 44px;
    border: none; background: transparent; border-radius: var(--radius-sm); cursor: pointer;
    font-size: 20px; color: var(--text2); margin-right: 4px;
  }
  .header-menu-btn:hover { background: var(--surface2); color: var(--text); }
  .sidebar-overlay {
    display: none; position: fixed; inset: 0; background: rgba(0,0,0,.4); z-index: 199;
    transition: opacity .2s;
  }
  .sidebar-overlay.is-open { display: block; }

  @media (max-width: 768px) {
    .header { padding: 0 12px; gap: 8px; }
    .header-logo { font-size: 18px; }
    .header-logo span { font-size: 15px; }
    .header-logo-sub { font-size: 11px; }
    .header-user span { display: none; }
    .header-menu-btn { display: flex; }
    .body { position: relative; }
    .sidebar {
      position: fixed; left: 0; top: var(--header); bottom: 0; z-index: 200; width: 260px;
      transform: translateX(-100%); transition: transform .25s ease; box-shadow: var(--shadow-lg);
    }
    .sidebar.is-open { transform: translateX(0); }
    .sidebar-overlay.is-open { display: block; }
    .main { min-width: 0; }
    .page { padding: 16px; }
    .page-header { flex-direction: column; gap: 12px; margin-bottom: 16px; align-items: stretch; }
    .page-title { font-size: 22px; }
    .page-subtitle { font-size: 13px; }
    .product-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; }
    .product-body { padding: 10px; }
    .product-name { font-size: 13px; }
    .product-footer { flex-wrap: wrap; gap: 6px; }
    .product-footer .flex { flex-wrap: wrap; }
    .filters { flex-direction: column; gap: 8px; margin-bottom: 16px; }
    .search-box { min-width: 0; }
    .filter-select { width: 100%; }
    .service-grid { grid-template-columns: 1fr; }
    .service-card { padding: 14px; }
    .service-logo { width: 44px; height: 44px; font-size: 20px; }
    .service-name { font-size: 14px; }
    .service-contact { font-size: 11px; margin-top: 8px; padding-top: 8px; }
    .stats-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; }
    .stat-card { padding: 14px; }
    .stat-num { font-size: 22px; }
    .form-grid-2 { grid-template-columns: 1fr; }
    .ad-banner { height: 96px; padding: 10px 12px; }
    .ad-logo { width: 76px; height: 76px; min-width: 56px; min-height: 56px; max-width: 140px; max-height: 76px; font-size: 24px; }
    .ad-text { font-size: 13px; }
    .ad-text strong { font-size: 14px; }
    .btn { min-height: 44px; padding: 10px 16px; }
    .btn-sm { min-height: 36px; padding: 8px 12px; }
    .nav-item { min-height: 44px; padding: 12px 14px; }
    .table-wrap { margin: 0 -16px; overflow-x: auto; }
    .table-wrap table { min-width: 500px; }
    .admin-table-list { grid-template-columns: repeat(2, 1fr); }
    .tier-grid { grid-template-columns: 1fr; }
    .login-screen { flex-direction: column; }
    .login-left { min-height: 180px; padding: 24px; }
    .login-brand-name { font-size: 28px; }
    .login-illustration { font-size: 48px; margin-bottom: 16px; }
    .login-right { width: 100%; max-width: 100%; padding: 24px 20px; }
    .login-title { font-size: 22px; }
  }

  @media (max-width: 480px) {
    .product-grid { grid-template-columns: 1fr; }
    .page { padding: 12px; }
    .product-footer .flex { width: 100%; justify-content: space-between; flex-wrap: nowrap; }
  }

  /* Notification toasts and confirm modal */
  .notification-toast-container {
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-width: 360px;
    pointer-events: none;
  }
  .notification-toast {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 18px;
    border-radius: var(--radius);
    box-shadow: var(--shadow-lg);
    background: var(--surface);
    border-left: 4px solid var(--accent);
    pointer-events: auto;
    animation: notificationSlideIn 0.25s ease;
  }
  .notification-toast--success {
    border-left-color: var(--accent);
  }
  .notification-toast--success .notification-toast-icon {
    color: var(--accent);
    font-weight: 700;
  }
  .notification-toast--error {
    border-left-color: var(--danger);
  }
  .notification-toast--error .notification-toast-icon {
    color: var(--danger);
    font-weight: 700;
  }
  .notification-toast--info {
    border-left-color: var(--sky);
  }
  .notification-toast-icon {
    flex-shrink: 0;
    font-size: 16px;
  }
  .notification-toast-message {
    font-size: 14px;
    color: var(--text);
    line-height: 1.4;
  }
  @keyframes notificationSlideIn {
    from { opacity: 0; transform: translateX(20px); }
    to { opacity: 1; transform: translateX(0); }
  }
  .notification-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    padding: 24px;
  }
  .notification-confirm-card {
    background: var(--surface);
    border-radius: var(--radius);
    box-shadow: var(--shadow-lg);
    max-width: 400px;
    width: 100%;
    overflow: hidden;
  }
  .notification-confirm-header {
    padding: 20px;
    border-bottom: 1px solid var(--border);
    font-size: 16px;
  }
  .notification-confirm-body {
    padding: 20px;
  }
  .notification-confirm-message {
    margin: 0 0 20px 0;
    color: var(--text2);
    font-size: 14px;
    line-height: 1.5;
  }
  .notification-confirm-actions {
    display: flex;
    gap: 10px;
    justify-content: flex-end;
  }
`;

// ─── Mock Data ────────────────────────────────────────────────────────────────
const MOCK_PRODUCTS = [
  { id:1, name:"Samsung 65\" 4K TV", cat:"Electronics", price:"P3,200", status:"avail", tier:"diamond", emoji:"📺", days:"2d ago" },
  { id:2, name:"Toyota Hilux 2019", cat:"Vehicles", price:"P285,000", status:"avail", tier:"diamond", emoji:"🚗", days:"1d ago" },
  { id:3, name:"Leather Couch Set", cat:"Furniture", price:"P4,500", status:"avail", tier:"silver", emoji:"🛋️", days:"3d ago" },
  { id:4, name:"Bosch Washing Machine", cat:"Appliances", price:"P2,100", status:"sold", tier:"basic", emoji:"🫧", days:"1d ago" },
  { id:5, name:"Mountain Bike", cat:"Sports & Outdoors", price:"P1,800", status:"avail", tier:"silver", emoji:"🚵", days:"5h ago" },
  { id:6, name:"Kitchen Mixer", cat:"Kitchen & Dining", price:"P650", status:"avail", tier:"basic", emoji:"🍳", days:"1d ago" },
  { id:7, name:"Cement Mixer", cat:"Building & Hardware", price:"P3,400", status:"dormant", tier:"basic", emoji:"🏗️", days:"4d ago" },
  { id:8, name:"Boys Bicycle 20\"", cat:"Toys & Games", price:"P480", status:"avail", tier:"basic", emoji:"🚲", days:"2d ago" },
];

const MOCK_SERVICES = [
  { id:1, name:"ProFix Plumbing", desc:"Professional plumbing, burst pipes, installations and renovations. Available 24/7.", tier:"diamond", emoji:"🔧", category:"Home Services" },
  { id:2, name:"Kalahari Motors", desc:"Full vehicle service centre, panel beating, spray painting and mechanical repairs.", tier:"diamond", emoji:"🔩", category:"Automotive" },
  { id:3, name:"Pixel Studio", desc:"Graphic design, web development and branding for businesses of all sizes.", tier:"silver", emoji:"🎨", category:"Creative" },
  { id:4, name:"Fresh & Clean Laundry", desc:"Same-day laundry, dry cleaning and ironing service delivered to your door.", tier:"silver", emoji:"👕", category:"Cleaning" },
  { id:5, name:"Tummy Treats Catering", desc:"Events, parties and corporate catering. Local flavours, global presentation.", tier:"basic", emoji:"🍽️", category:"Food" },
  { id:6, name:"Legal Wise Consultants", desc:"Business registration, contracts, property transfers and wills at affordable rates.", tier:"basic", emoji:"⚖️", category:"Legal" },
];

const CATEGORIES = ["All","Vehicles","Electronics","Appliances","Furniture","Clothing & Accessories","Books & Stationery","Sports & Outdoors","Kitchen & Dining","Building & Hardware","Toys & Games","Garden & Outdoor","Boats & Watercraft"];

// ─── Components ───────────────────────────────────────────────────────────────

const NotificationContext = createContext(null);

function NotificationProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState({
    open: false,
    title: "",
    message: "",
    confirmLabel: "Confirm",
    cancelLabel: "Cancel",
    danger: false,
  });
  const confirmResolveRef = useRef(null);

  const toast = useCallback((message, type = "info") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const confirm = useCallback((options = {}) => {
    return new Promise((resolve) => {
      confirmResolveRef.current = resolve;
      setConfirmState({
        open: true,
        title: options.title ?? "Confirm",
        message: options.message ?? "",
        confirmLabel: options.confirmLabel ?? "Confirm",
        cancelLabel: options.cancelLabel ?? "Cancel",
        danger: options.danger !== false,
      });
    });
  }, []);

  const handleConfirmClose = (result) => {
    if (confirmResolveRef.current) confirmResolveRef.current(result);
    confirmResolveRef.current = null;
    setConfirmState((s) => ({ ...s, open: false }));
  };

  return (
    <NotificationContext.Provider value={{ toast, confirm }}>
      {children}
      {/* Toast container */}
      <div className="notification-toast-container" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`notification-toast notification-toast--${t.type}`}
            role="alert"
          >
            {t.type === "success" && <span className="notification-toast-icon">✓</span>}
            {t.type === "error" && <span className="notification-toast-icon">!</span>}
            {t.type === "info" && <span className="notification-toast-icon">ℹ</span>}
            <span className="notification-toast-message">{t.message}</span>
          </div>
        ))}
      </div>
      {/* Global confirm modal */}
      {confirmState.open && (
        <div
          className="notification-overlay"
          onClick={() => handleConfirmClose(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
        >
          <div
            className="notification-confirm-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="notification-confirm-header">
              <strong id="confirm-title">{confirmState.title}</strong>
            </div>
            <div className="notification-confirm-body">
              {confirmState.message && (
                <p className="notification-confirm-message">{confirmState.message}</p>
              )}
              <div className="notification-confirm-actions">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => handleConfirmClose(false)}
                >
                  {confirmState.cancelLabel}
                </button>
                <button
                  type="button"
                  className={confirmState.danger ? "btn btn-danger" : "btn btn-primary"}
                  onClick={() => handleConfirmClose(true)}
                >
                  {confirmState.confirmLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
}

function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) return { toast: (...a) => window.alert(a[0]), confirm: (o) => Promise.resolve(window.confirm(o?.message || "Confirm?")) };
  return ctx;
}

function ConfirmModal({ open, title, message, confirmLabel = "Delete", danger = true, onConfirm, onCancel, loading = false }) {
  if (!open) return null;
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.45)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:24}} onClick={onCancel}>
      <div className="card" style={{maxWidth:400,width:"100%"}} onClick={e=>e.stopPropagation()}>
        <div style={{padding:20,borderBottom:"1px solid var(--border)"}}>
          <strong>{title}</strong>
        </div>
        <div style={{padding:20}}>
          <p style={{margin:0,color:"var(--text2)",fontSize:14,lineHeight:1.5}}>{message}</p>
          <div style={{display:"flex",gap:10,marginTop:20,justifyContent:"flex-end"}}>
            <button className="btn btn-outline" onClick={onCancel} disabled={loading}>Cancel</button>
            <button className={danger ? "btn btn-danger" : "btn btn-primary"} onClick={onConfirm} disabled={loading}>{loading ? "Deleting…" : confirmLabel}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdBanner({ ads, onAdClick }) {
  const [idx, setIdx] = useState(0);
  const list = Array.isArray(ads) ? ads : [];
  useEffect(() => {
    if (list.length === 0) return;
    const t = setInterval(() => setIdx(i => (i + 1) % list.length), 8000);
    return () => clearInterval(t);
  }, [list.length]);
  if (list.length === 0) return null;
  const ad = list[idx];
  if (!ad) return null;
  const logoUrl = ad.logo ? `${API_BASE}${ad.logo}` : null;
  const handleClick = () => {
    if (ad.service_id != null && typeof onAdClick === "function") onAdClick(ad);
  };
  return (
    <div className="ad-banner">
      <div className="ad-banner-inner" key={idx} onClick={handleClick} role="button" tabIndex={0} onKeyDown={e=>{ if (e.key==="Enter"||e.key===" ") { e.preventDefault(); handleClick(); } }} aria-label={`View ${ad.name} service`}>
        <div className="ad-logo">
          {logoUrl ? <img src={logoUrl} alt="" /> : <span>🏢</span>}
        </div>
        <div className="ad-text">
          <strong>{ad.name}</strong>
          {ad.text ? <> — {ad.text}</> : null}
        </div>
      </div>
      <div className="ad-dots">
        {list.map((_,i) => <div key={i} className={`ad-dot${i===idx?" active":""}`} onClick={()=>setIdx(i)}/>)}
      </div>
      <div className="ad-label">Sponsored</div>
    </div>
  );
}

function ProductCard({ p, onClick, onBuy, onEdit, onDelete, onMessage, onContactBuyer }) {
  return (
    <div className="card product-card" onClick={onClick}>
      <div className="product-img">
        {p.img
          ? <img alt={p.name} src={p.img} />
          : <span>{p.emoji}</span>
        }
        {p.tier==="diamond" && <span className="product-badge badge-diamond">◆ Diamond</span>}
        {p.tier==="silver" && <span className="product-badge badge-silver">◈ Silver</span>}
        {p.status==="sold" && <span className="product-badge badge-sold">Sold</span>}
        {p.status==="dormant" && <span className="product-badge badge-dormant">Dormant</span>}
      </div>
      <div className="product-body">
        <div className="product-name">{p.name}</div>
        <div className="product-cat">{p.cat}</div>
        {p.seller && <div className="product-seller" style={{fontSize:12,color:"var(--text3)",marginBottom:6}}>Sold by @{p.seller}</div>}
        {p.status==="sold" && p.buyer_username && <div className="product-seller" style={{fontSize:12,color:"var(--text3)",marginBottom:6}}>Buyer: @{p.buyer_username}</div>}
        <div className="product-footer">
          <span className="product-price">{p.price}</span>
          <div className="product-actions">
            <span className="product-meta">{p.days}</span>
            {onContactBuyer && p.status === "sold" && p.buyer_id && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={(e) => { e.stopPropagation(); onContactBuyer(p); }}
              >
                Contact buyer
              </button>
            )}
            {onMessage && (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={(e) => { e.stopPropagation(); onMessage(p); }}
              >
                Message
              </button>
            )}
            {onBuy && (
              <button
                className="btn btn-primary btn-sm"
                onClick={(e) => { e.stopPropagation(); onBuy(p); }}
              >
                Buy
              </button>
            )}
            {(onEdit || onDelete) && (
              <>
                {onEdit && <button type="button" className="btn btn-primary btn-sm" onClick={(e)=>{ e.stopPropagation(); onEdit(p); }}>Edit</button>}
                {onDelete && <button type="button" className="btn btn-danger btn-sm" onClick={(e)=>{ e.stopPropagation(); onDelete(p); }}>Delete</button>}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Pages ────────────────────────────────────────────────────────────────────

function ProductsPage({ setScreen, user, setEditListingId, setReturnTo, setMessageWithClientId }) {
  const { toast, confirm } = useNotifications();
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("All");
  const [status, setStatus] = useState("All");
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteConfirmProduct, setDeleteConfirmProduct] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api("/api/products")
      .then((rows) => {
        setProducts(rows.map((p) => ({
          id: p.listing_id,
          client_id: p.client_id,
          name: p.product_name,
          cat: p.category_name || "Uncategorized",
          seller: p.seller_username || "",
          price: "P" + Number(p.product_price).toLocaleString(),
          status: p.status || "avail",
          tier: "basic",
          emoji: "📦",
          img: p.product_image_path ? `${API_BASE}${p.product_image_path}` : null,
          days: p.listing_date ? formatRelative(p.listing_date) : "",
        })));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleBuy = async (p) => {
    const ok = await confirm({ title: "Buy item", message: "Buy this item? It will be marked as sold.", confirmLabel: "Buy", cancelLabel: "Cancel", danger: false });
    if (!ok) return;
    try {
      await api(`/api/products/${p.id}/buy`, { method: "PATCH" });
      setProducts((prev) => prev.filter((x) => x.id !== p.id));
    } catch (err) {
      toast(err.message || "Failed to buy item", "error");
    }
  };

  const handleDeleteProduct = async (p) => {
    setDeleteConfirmProduct(p);
  };

  const doDeleteProduct = async () => {
    if (!deleteConfirmProduct) return;
    setDeleting(true);
    try {
      await api(`/api/products/${deleteConfirmProduct.id}`, { method: "DELETE" });
      setProducts((prev) => prev.filter((x) => x.id !== deleteConfirmProduct.id));
      setDeleteConfirmProduct(null);
    } catch (err) {
      toast(err.message || "Failed to delete", "error");
    } finally {
      setDeleting(false);
    }
  };

  const filtered = products.filter(p =>
    (cat==="All" || p.cat===cat) &&
    (status==="All" || p.status===status) &&
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="page"><div className="empty"><div className="empty-icon">⏳</div><div className="empty-title">Loading…</div></div></div>;
  if (error) return <div className="page"><div className="alert alert-danger">{error}</div><button className="btn btn-outline" onClick={()=>window.location.reload()}>Retry</button></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Mmaraka</div>
          <div className="page-subtitle">Browse and discover second-hand items near you</div>
        </div>
        <button className="btn btn-primary" onClick={()=>{ setReturnTo?.("products"); setEditListingId(null); setScreen("add-product"); }}>＋ Add Listing</button>
      </div>

      <div className="filters">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input placeholder="Search listings…" value={search} onChange={e=>setSearch(e.target.value)} />
        </div>
        <select className="filter-select" value={cat} onChange={e=>setCat(e.target.value)}>
          {CATEGORIES.map(c=><option key={c}>{c}</option>)}
        </select>
        <select className="filter-select" value={status} onChange={e=>setStatus(e.target.value)}>
          <option value="All">All Status</option>
          <option value="avail">Available</option>
          <option value="sold">Sold</option>
          <option value="dormant">Dormant</option>
        </select>
      </div>

      {filtered.length === 0
        ? <div className="empty"><div className="empty-icon">📦</div><div className="empty-title">No listings found</div><div className="empty-sub">Try adjusting your filters</div></div>
        : <div className="product-grid">{filtered.map(p=><ProductCard key={p.id} p={p} onClick={()=>setScreen("product-detail")} onBuy={handleBuy} onMessage={user && p.client_id !== user.client_id ? (x)=>{ setMessageWithClientId(x.client_id); setScreen("messages"); } : null} onEdit={user && p.client_id === user.client_id ? ()=> { setReturnTo?.("products"); setEditListingId(p.id); setScreen("add-product"); } : null} onDelete={user && p.client_id === user.client_id ? ()=>handleDeleteProduct(p) : null} />)}</div>
      }
      <ConfirmModal
        open={!!deleteConfirmProduct}
        title="Delete listing?"
        message="This cannot be undone. The listing will be permanently removed."
        confirmLabel="Delete"
        danger
        loading={deleting}
        onConfirm={doDeleteProduct}
        onCancel={()=>!deleting&&setDeleteConfirmProduct(null)}
      />
    </div>
  );
}

function AddProductPage({ setScreen, editListingId, setEditListingId, returnTo = "products" }) {
  const [form, setForm] = useState({ name:"", desc:"", price:"", category:"", category_id:"", location:"", status:"avail" });
  const [imagePreview, setImagePreview] = useState(null);
  const [imagePath, setImagePath] = useState(null);
  const [errors, setErrors] = useState({});
  const [categories, setCategories] = useState([]);
  const [categoriesError, setCategoriesError] = useState(null);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(!!editListingId);
  const fileInputRef = useRef(null);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const loadCategories = useCallback(() => {
    setCategoriesError(null);
    setCategoriesLoading(true);
    api("/api/misc/categories")
      .then((data) => {
        const list = Array.isArray(data) ? data : (data?.categories ?? data?.data ?? []);
        setCategories(list);
      })
      .catch((err) => {
        setCategoriesError(err?.message || "Could not load categories");
        setCategories([]);
      })
      .finally(() => setCategoriesLoading(false));
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    if (!editListingId) return;
    setLoadingEdit(true);
    api(`/api/products/${editListingId}`)
      .then((row) => {
        setForm({
          name: row.product_name || "",
          desc: row.product_description || "",
          price: row.product_price != null ? String(row.product_price) : "",
          category: row.category_name || "",
          category_id: row.category_id != null ? String(row.category_id) : "",
          location: "",
          status: row.status || "avail",
        });
        setImagePath(row.product_image_path || null);
        if (row.product_image_path) setImagePreview(`${API_BASE}${row.product_image_path}`);
      })
      .catch(() => setErrors({ submit: "Failed to load listing" }))
      .finally(() => setLoadingEdit(false));
  }, [editListingId]);

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Product name is required";
    if (!form.price || isNaN(form.price)) e.price = "Enter a valid price";
    if (!form.category_id) e.category = "Select a category";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      if (editListingId) {
        await api(`/api/products/${editListingId}`, {
          method: "PATCH",
          body: JSON.stringify({
            product_name: form.name.trim(),
            product_description: form.desc.trim() || null,
            product_price: parseFloat(form.price),
            category_id: parseInt(form.category_id, 10),
            product_image_path: imagePath || null,
            status: form.status || "avail",
          }),
        });
        if (setEditListingId) setEditListingId(null);
      } else {
        await api("/api/products", {
          method: "POST",
          body: JSON.stringify({
            product_name: form.name.trim(),
            product_description: form.desc.trim() || null,
            product_price: parseFloat(form.price),
            category_id: parseInt(form.category_id, 10),
            product_image_path: imagePath || null,
          }),
        });
      }
      setScreen(returnTo);
    } catch (err) {
      setErrors({ submit: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">{editListingId ? "Edit Listing" : "New Listing"}</div>
          <div className="page-subtitle">{editListingId ? "Update your listing" : "Add an item you want to sell"}</div>
        </div>
        <button className="btn btn-outline" onClick={()=>{ if (setEditListingId) setEditListingId(null); setScreen(returnTo); }}>← Back</button>
      </div>

      {loadingEdit ? <div className="empty"><div className="empty-icon">⏳</div><div className="empty-title">Loading…</div></div> : (
      <div style={{maxWidth:640}}>
        <div className="form-grid" style={{gap:20}}>
          <div className="form-group">
            <label className="form-label">Photo<span>*</span></label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{display:"none"}}
              onChange={async (e) => {
                const file = e.target.files && e.target.files[0];
                if (!file) return;
                setErrors((x) => ({ ...x, photo: null }));
                const localUrl = URL.createObjectURL(file);
                setImagePreview(localUrl);
                try {
                  const path = await uploadImage(file);
                  setImagePath(path);
                } catch (err) {
                  setErrors((x) => ({ ...x, photo: err.message }));
                  setImagePath(null);
                }
              }}
            />
            <div className="upload-zone" onClick={()=>fileInputRef.current && fileInputRef.current.click()}>
              {imagePreview
                ? <div><img alt="Preview" src={imagePreview} style={{width:"100%",maxHeight:220,objectFit:"cover",borderRadius:12}} /><p className="upload-hint" style={{marginTop:8}}>Tap to change</p></div>
                : <><div className="upload-icon">📷</div><div className="upload-text">Click to upload a photo</div><div className="upload-hint">JPG, PNG — max 5MB</div></>
              }
            </div>
            {errors.photo && <span className="form-error">{errors.photo}</span>}
          </div>

          <div className="form-group">
            <label className="form-label">Product name<span>*</span></label>
            <input className="form-input" placeholder="e.g. Samsung 65″ 4K TV" value={form.name} onChange={e=>set("name",e.target.value)} />
            {errors.name && <span className="form-error">{errors.name}</span>}
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-textarea" placeholder="Describe the item — condition, age, reason for selling…" value={form.desc} onChange={e=>set("desc",e.target.value)} />
          </div>

          <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label">Price (BWP)<span>*</span></label>
              <input className="form-input" type="number" placeholder="0.00" value={form.price} onChange={e=>set("price",e.target.value)} />
              {errors.price && <span className="form-error">{errors.price}</span>}
            </div>
            <div className="form-group">
              <label className="form-label">Category<span>*</span></label>
              {categoriesError ? (
                <div className="form-error" style={{ marginBottom: 8 }}>
                  {categoriesError}
                  <button type="button" className="btn btn-outline" style={{ marginLeft: 8 }} onClick={loadCategories}>
                    Retry
                  </button>
                </div>
              ) : null}
              <select
                className="form-select"
                value={form.category_id}
                onChange={e=>{ const v = e.target.value; set("category_id", v); set("category", v); }}
                disabled={categoriesLoading}
              >
                <option value="">
                  {categoriesLoading ? "Loading…" : categories.length === 0 ? "No categories available" : "Select category…"}
                </option>
                {categories.map(c=> <option key={c.category_id} value={c.category_id}>{c.category_name}</option>)}
              </select>
              {errors.category && <span className="form-error">{errors.category}</span>}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Location</label>
            <select className="form-select" value={form.location} onChange={e=>set("location",e.target.value)}>
              <option value="">Select your town…</option>
              {["Maun","Kasane","Gaborone","Francistown"].map(t=><option key={t}>{t}</option>)}
            </select>
          </div>

          {editListingId && (
            <div className="form-group">
              <label className="form-label">Listing status</label>
              <select className="form-select" value={form.status} onChange={e=>set("status",e.target.value)}>
                <option value="avail">Available</option>
                <option value="sold">Sold</option>
                <option value="dormant">Dormant</option>
              </select>
              <div className="text-muted mt-4" style={{fontSize:12}}>If the buyer defaulted, set back to Available to relist.</div>
            </div>
          )}

          <div className="alert alert-warning">⚠️ Listings are active for <strong>3 days</strong>. You can reinstate up to 2 times.</div>

          {errors.submit && <div className="alert alert-danger">{errors.submit}</div>}

          <div style={{display:"flex",gap:12}}>
            <button className="btn btn-primary w-full" onClick={handleSubmit} disabled={submitting}>{submitting ? "Saving…" : editListingId ? "Update Listing" : "Publish Listing"}</button>
            <button className="btn btn-outline" onClick={()=>{ if (setEditListingId) setEditListingId(null); setScreen(returnTo); }}>Cancel</button>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}

function ServicesPage({ setScreen, user, setEditServiceId, setReturnTo, setMessageWithClientId, selectedServiceId, setSelectedServiceId }) {
  const { toast } = useNotifications();
  const [search, setSearch] = useState("");
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteConfirmService, setDeleteConfirmService] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [fullImageService, setFullImageService] = useState(null);

  useEffect(() => {
    api("/api/services")
      .then((rows) => {
        setServices(rows.map((s) => ({
          id: s.service_id,
          client_id: s.client_id,
          name: s.service_name,
          desc: s.service_description || "",
          tier: "basic",
          emoji: "🏢",
          logo: s.service_logo_path ? `${API_BASE}${s.service_logo_path}` : null,
          category: "Services",
          clientName: [s.client_first_name, s.client_last_name].filter(Boolean).join(" ") || s.client_username || "",
          clientEmail: s.client_email || "",
          clientWhatsapp: s.client_whatsapp ? (s.client_country_code || "") + s.client_whatsapp : "",
        })));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedServiceId || services.length === 0) return;
    const id = requestAnimationFrame(() => {
      const el = document.querySelector(`[data-service-id="${selectedServiceId}"]`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      setSelectedServiceId?.(null);
    });
    return () => cancelAnimationFrame(id);
  }, [selectedServiceId, services, setSelectedServiceId]);

  const filtered = services.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || s.desc.toLowerCase().includes(search.toLowerCase()));

  const handleDeleteService = async (s) => {
    setDeleteConfirmService(s);
  };

  const doDeleteService = async () => {
    if (!deleteConfirmService) return;
    setDeleting(true);
    try {
      await api(`/api/services/${deleteConfirmService.id}`, { method: "DELETE" });
      setServices((prev) => prev.filter((x) => x.id !== deleteConfirmService.id));
      setDeleteConfirmService(null);
    } catch (err) {
      toast(err.message || "Failed to delete", "error");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <div className="page"><div className="empty"><div className="empty-icon">⏳</div><div className="empty-title">Loading…</div></div></div>;
  if (error) return <div className="page"><div className="alert alert-danger">{error}</div><button className="btn btn-outline" onClick={()=>window.location.reload()}>Retry</button></div>;

  const hasService = user && services.some(s => s.client_id === user.client_id);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Services Directory</div>
          <div className="page-subtitle">Find trusted local service providers</div>
        </div>
        {hasService ? (
          <span className="text-muted" style={{fontSize:13}}>One service per account — edit yours below</span>
        ) : (
          <button className="btn btn-primary" onClick={()=>{ setReturnTo?.("services"); setEditServiceId(null); setScreen("add-service"); }}>＋ List Your Service</button>
        )}
      </div>

      <div className="filters">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input placeholder="Search services…" value={search} onChange={e=>setSearch(e.target.value)} />
        </div>
      </div>

      <div className="service-grid">
        {filtered.map(s=>(
          <div key={s.id} className="card service-card" data-service-id={s.id}>
            <div
              className="service-logo"
              style={{ overflow: "hidden", cursor: s.logo ? "pointer" : undefined }}
              onClick={(e) => { e.stopPropagation(); if (s.logo) setFullImageService(s); }}
              role={s.logo ? "button" : undefined}
              aria-label={s.logo ? `View full image for ${s.name}` : undefined}
            >
              {s.logo ? <img alt={s.name} src={s.logo} style={{width:"100%",height:"100%",objectFit:"cover"}} /> : s.emoji}
            </div>
            <div className="service-info" style={{flex:1,minWidth:0}}>
              <div className="service-name">{s.name}</div>
              <div className="service-desc">{s.desc}</div>
              {(s.clientName || s.clientEmail || s.clientWhatsapp) && (
                <div className="service-contact" style={{marginTop:10,paddingTop:10,borderTop:"1px solid var(--border)",fontSize:12,color:"var(--text2)"}}>
                  {s.clientName && <div style={{fontWeight:600,color:"var(--text)"}}>{s.clientName}</div>}
                  {s.clientEmail && <div>✉ {s.clientEmail}</div>}
                  {s.clientWhatsapp && <div>📱 {s.clientWhatsapp}</div>}
                </div>
              )}
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:8,flexWrap:"wrap",gap:8}}>
                <span className="tag">{s.category}</span>
                {user && s.client_id !== user.client_id && (
                  <button type="button" className="btn btn-ghost btn-sm" style={{ border: "1px solid var(--border)" }} onClick={()=>{ setMessageWithClientId(s.client_id); setScreen("messages"); }}>Message</button>
                )}
                {user && s.client_id === user.client_id && (
                  <span className="flex items-center gap-4">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={()=>{ setReturnTo?.("services"); setEditServiceId(s.id); setScreen("add-service"); }}>Edit</button>
                    <button type="button" className="btn btn-ghost btn-sm" style={{color:"var(--danger)"}} onClick={()=>handleDeleteService(s)}>Delete</button>
                  </span>
                )}
                {s.tier==="diamond" && <span className="chip badge-diamond" style={{padding:"2px 8px",fontSize:10}}>◆ Diamond</span>}
                {s.tier==="silver" && <span style={{fontSize:11,color:"#6B7280",fontWeight:600}}>◈ Silver</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
      {fullImageService?.logo && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 24 }}
          onClick={() => setFullImageService(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Service image"
        >
          <button
            type="button"
            style={{ position: "absolute", top: 16, right: 16, width: 40, height: 40, borderRadius: "50%", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 20, cursor: "pointer", zIndex: 1 }}
            onClick={() => setFullImageService(null)}
            aria-label="Close"
          >
            ×
          </button>
          <img
            src={fullImageService.logo}
            alt={fullImageService.name}
            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 8 }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
      <ConfirmModal
        open={!!deleteConfirmService}
        title="Delete service?"
        message="This cannot be undone. Your service listing will be permanently removed."
        confirmLabel="Delete"
        danger
        loading={deleting}
        onConfirm={doDeleteService}
        onCancel={()=>!deleting&&setDeleteConfirmService(null)}
      />
    </div>
  );
}

function MyListingsPage({ user, setScreen, setEditListingId, setEditServiceId, setReturnTo, setMessageWithClientId }) {
  const { toast, confirm } = useNotifications();
  const [products, setProducts] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    Promise.all([api("/api/products/mine"), api("/api/services")])
      .then(([productRows, serviceRows]) => {
        setProducts(productRows.map((p) => ({
          id: p.listing_id,
          client_id: p.client_id,
          name: p.product_name,
          cat: p.category_name || "Uncategorized",
          seller: p.seller_username || "",
          price: "P" + Number(p.product_price).toLocaleString(),
          status: p.status || "avail",
          tier: "basic",
          emoji: "📦",
          img: p.product_image_path ? `${API_BASE}${p.product_image_path}` : null,
          days: p.listing_date ? formatRelative(p.listing_date) : "",
          buyer_id: p.buyer_id || null,
          buyer_username: p.buyer_username || "",
        })));
        setServices(serviceRows.map((s) => ({
          id: s.service_id,
          client_id: s.client_id,
          name: s.service_name,
          desc: s.service_description || "",
          tier: "basic",
          emoji: "🏢",
          logo: s.service_logo_path ? `${API_BASE}${s.service_logo_path}` : null,
          category: "Services",
          clientName: [s.client_first_name, s.client_last_name].filter(Boolean).join(" ") || s.client_username || "",
          clientEmail: s.client_email || "",
          clientWhatsapp: s.client_whatsapp ? (s.client_country_code || "") + s.client_whatsapp : "",
        })));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const myProducts = user?.client_id != null ? products : [];
  const myServices = user?.client_id != null ? services.filter((s) => s.client_id === user.client_id) : [];

  const handleBuy = async (p) => {
    const ok = await confirm({ title: "Buy item", message: "Buy this item? It will be marked as sold.", confirmLabel: "Buy", cancelLabel: "Cancel", danger: false });
    if (!ok) return;
    try {
      await api(`/api/products/${p.id}/buy`, { method: "PATCH" });
      setProducts((prev) => prev.filter((x) => x.id !== p.id));
    } catch (err) {
      toast(err.message || "Failed to buy item", "error");
    }
  };

  const handleDeleteProduct = async (p) => {
    setDeleteConfirm({ type: "product", item: p });
  };

  const handleDeleteService = async (s) => {
    setDeleteConfirm({ type: "service", item: s });
  };

  const doDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      if (deleteConfirm.type === "product") {
        await api(`/api/products/${deleteConfirm.item.id}`, { method: "DELETE" });
        setProducts((prev) => prev.filter((x) => x.id !== deleteConfirm.item.id));
      } else {
        await api(`/api/services/${deleteConfirm.item.id}`, { method: "DELETE" });
        setServices((prev) => prev.filter((x) => x.id !== deleteConfirm.item.id));
      }
      setDeleteConfirm(null);
    } catch (err) {
      toast(err.message || "Failed to delete", "error");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <div className="page"><div className="empty"><div className="empty-icon">⏳</div><div className="empty-title">Loading…</div></div></div>;
  if (error) return <div className="page"><div className="alert alert-danger">{error}</div></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">My Listings</div>
          <div className="page-subtitle">Your product listings and services in one place</div>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <button className="btn btn-primary" onClick={()=>{ setReturnTo?.("my-listings"); setEditListingId(null); setScreen("add-product"); }}>＋ Add product</button>
          {myServices.length === 0 ? (
            <button className="btn btn-outline" onClick={()=>{ setReturnTo?.("my-listings"); setEditServiceId(null); setScreen("add-service"); }}>＋ Add service</button>
          ) : (
            <span className="text-muted" style={{fontSize:13}}>One service per account — edit below</span>
          )}
        </div>
      </div>

      <div className="settings-title" style={{marginTop:24,marginBottom:12}}>Product listings</div>
      {myProducts.length === 0 ? (
        <div className="empty"><div className="empty-icon">📦</div><div className="empty-title">No product listings yet</div><div className="empty-sub">Add an item from Mmaraka or use the button above</div></div>
      ) : (
        <div className="product-grid">
          {myProducts.map((p) => (
            <ProductCard
              key={p.id}
              p={p}
              onClick={() => { setReturnTo?.("my-listings"); setEditListingId(p.id); setScreen("add-product"); }}
              onBuy={null}
              onEdit={() => { setReturnTo?.("my-listings"); setEditListingId(p.id); setScreen("add-product"); }}
              onDelete={handleDeleteProduct}
              onContactBuyer={setMessageWithClientId ? (p) => { setMessageWithClientId(p.buyer_id); setScreen("messages"); } : null}
            />
          ))}
        </div>
      )}

      <div className="settings-title" style={{marginTop:32,marginBottom:12}}>Services</div>
      {myServices.length === 0 ? (
        <div className="empty"><div className="empty-icon">🏢</div><div className="empty-title">No services listed yet</div><div className="empty-sub">List your service using the button above</div></div>
      ) : (
        <div className="service-grid">
          {myServices.map((s) => (
            <div key={s.id} className="card service-card">
              <div className="service-logo" style={{overflow:"hidden"}}>
                {s.logo ? <img alt={s.name} src={s.logo} style={{width:"100%",height:"100%",objectFit:"cover"}} /> : s.emoji}
              </div>
              <div className="service-info" style={{flex:1,minWidth:0}}>
                <div className="service-name">{s.name}</div>
                <div className="service-desc">{s.desc}</div>
                {(s.clientName || s.clientEmail || s.clientWhatsapp) && (
                  <div className="service-contact" style={{marginTop:10,paddingTop:10,borderTop:"1px solid var(--border)",fontSize:12,color:"var(--text2)"}}>
                    {s.clientName && <div style={{fontWeight:600,color:"var(--text)"}}>{s.clientName}</div>}
                    {s.clientEmail && <div>✉ {s.clientEmail}</div>}
                    {s.clientWhatsapp && <div>📱 {s.clientWhatsapp}</div>}
                  </div>
                )}
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:8,flexWrap:"wrap",gap:8}}>
                  <span className="tag">{s.category}</span>
                  <span className="flex items-center gap-4">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={()=>{ setReturnTo?.("my-listings"); setEditServiceId(s.id); setScreen("add-service"); }}>Edit</button>
                    <button type="button" className="btn btn-ghost btn-sm" style={{color:"var(--danger)"}} onClick={()=>handleDeleteService(s)}>Delete</button>
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <ConfirmModal
        open={!!deleteConfirm}
        title={deleteConfirm?.type === "service" ? "Delete service?" : "Delete listing?"}
        message={deleteConfirm?.type === "service" ? "This cannot be undone. Your service listing will be permanently removed." : "This cannot be undone. The listing will be permanently removed."}
        confirmLabel="Delete"
        danger
        loading={deleting}
        onConfirm={doDelete}
        onCancel={()=>!deleting&&setDeleteConfirm(null)}
      />
    </div>
  );
}

function AddServicePage({ setScreen, editServiceId, setEditServiceId, returnTo = "services" }) {
  const [form, setForm] = useState({ name:"", desc:"", logo:null });
  const [logoPreview, setLogoPreview] = useState(null);
  const [logoPath, setLogoPath] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [loadingEdit, setLoadingEdit] = useState(!!editServiceId);
  const fileInputRef = useRef(null);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  useEffect(() => {
    if (!editServiceId) return;
    setLoadingEdit(true);
    api(`/api/services/${editServiceId}`)
      .then((row) => {
        setForm({ name: row.service_name || "", desc: row.service_description || "" });
        setLogoPath(row.service_logo_path || null);
        if (row.service_logo_path) setLogoPreview(`${API_BASE}${row.service_logo_path}`);
      })
      .catch(() => setError("Failed to load service"))
      .finally(() => setLoadingEdit(false));
  }, [editServiceId]);

  const handleSubmit = async () => {
    if (!form.name.trim()) { setError("Business name is required"); return; }
    setError(null);
    setSubmitting(true);
    try {
      if (editServiceId) {
        await api(`/api/services/${editServiceId}`, {
          method: "PATCH",
          body: JSON.stringify({
            service_name: form.name.trim(),
            service_description: form.desc.trim() || null,
            service_logo_path: logoPath || null,
          }),
        });
        if (setEditServiceId) setEditServiceId(null);
      } else {
        await api("/api/services", {
          method: "POST",
          body: JSON.stringify({
            service_name: form.name.trim(),
            service_description: form.desc.trim() || null,
            service_logo_path: logoPath || null,
          }),
        });
      }
      setScreen(returnTo);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div><div className="page-title">{editServiceId ? "Edit Service" : "List Your Service"}</div><div className="page-subtitle">{editServiceId ? "Update your business profile" : "Create your business profile"}</div></div>
        <button className="btn btn-outline" onClick={()=>{ if (setEditServiceId) setEditServiceId(null); setScreen(returnTo); }}>← Back</button>
      </div>
      {loadingEdit ? <div className="empty"><div className="empty-icon">⏳</div><div className="empty-title">Loading…</div></div> : (
      <div style={{maxWidth:560}}>
        <div className="form-grid" style={{gap:20}}>
          <div className="form-group">
            <label className="form-label">Business Logo</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{display:"none"}}
              onChange={async (e) => {
                const file = e.target.files && e.target.files[0];
                if (!file) return;
                const localUrl = URL.createObjectURL(file);
                setLogoPreview(localUrl);
                try {
                  const path = await uploadImage(file);
                  setLogoPath(path);
                } catch (err) {
                  setError(err.message);
                  setLogoPath(null);
                }
              }}
            />
            <div className="upload-zone" style={{padding:20}} onClick={()=>fileInputRef.current && fileInputRef.current.click()}>
              {logoPreview
                ? <div><img alt="Logo preview" src={logoPreview} style={{width:"100%",maxHeight:180,objectFit:"cover",borderRadius:12}} /><p className="upload-hint" style={{marginTop:8}}>Tap to change</p></div>
                : <><div className="upload-icon">🖼️</div><div className="upload-text">Upload your logo</div><div className="upload-hint">Recommended: 400×400px — JPG, PNG, WebP</div></>
              }
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Business Name<span style={{color:"var(--danger)"}}>*</span></label>
            <input className="form-input" placeholder="Your business name" value={form.name} onChange={e=>set("name",e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Description<span style={{color:"var(--danger)"}}>*</span></label>
            <textarea className="form-textarea" style={{minHeight:120}} placeholder="Describe your services, specialities, and what makes you stand out…" value={form.desc} onChange={e=>set("desc",e.target.value)} />
          </div>
          <div className="alert alert-success" style={{background:"var(--gold-lt)",color:"var(--gold)",borderColor:"#FDE68A"}}>
            💡 Upgrade to <strong>Diamond</strong> to appear in the rotating bottom banner on all screens
          </div>
          {error && <div className="alert alert-danger">{error}</div>}
          <div style={{display:"flex",gap:12}}>
            <button className="btn btn-primary w-full" onClick={handleSubmit} disabled={submitting}>{submitting ? "Saving…" : editServiceId ? "Update Listing" : "Create Listing"}</button>
            <button className="btn btn-outline" onClick={()=>{ if (setEditServiceId) setEditServiceId(null); setScreen(returnTo); }}>Cancel</button>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}

function SettingsPage({ user, setScreen, onProfileUpdate }) {
  const { toast, confirm } = useNotifications();
  const [tab, setTab] = useState("profile");
  const [profile, setProfile] = useState({ username: user?.name ?? "", email: user?.email ?? "", whatsapp: "", country_code: "+267", location_id: "" });
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState(null);
  const setProfileField = (k, v) => setProfile(p => ({ ...p, [k]: v }));
  const [plans, setPlans] = useState([]);
  const [cart, setCart] = useState([]);
  const [paymentConfig, setPaymentConfig] = useState({ paypal_client_id: "", paypal_sandbox: true, currency_code: "BWP", plan_ids: {} });
  const [paypalError, setPaypalError] = useState(null);
  const [upgradeSuccess, setUpgradeSuccess] = useState(null);
  const paypalContainerRef = useRef(null);
  const [mySubscription, setMySubscription] = useState(null);
  const [unsubscribeLoading, setUnsubscribeLoading] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState(null);
  const [passwordSaving, setPasswordSaving] = useState(false);

  useEffect(() => {
    if (tab !== "profile") return;
    setProfileLoading(true);
    setProfileError(null);
    api("/api/auth/me")
      .then((me) => {
        setProfile({
          username: me.username ?? "",
          email: me.email ?? "",
          whatsapp: me.whatsapp ? String(me.whatsapp).replace(/\D/g, "") : "",
          country_code: me.country_code || "+267",
          location_id: me.location_id != null ? String(me.location_id) : "",
        });
      })
      .catch(() => setProfileError("Failed to load profile"))
      .finally(() => setProfileLoading(false));
  }, [tab]);

  useEffect(() => {
    if (tab !== "subscription") return;
    api("/api/misc/roles")
      .then((rows) => setPlans(rows.filter((r) => r.client_role !== "Admin")))
      .catch(() => setPlans([]));
    api("/api/payment/config")
      .then(setPaymentConfig)
      .catch(() => setPaymentConfig({ paypal_client_id: "", paypal_sandbox: true, currency_code: "BWP", plan_ids: {} }));
    api("/api/payment/my-subscription")
      .then(setMySubscription)
      .catch(() => setMySubscription({ active: false }));
  }, [tab]);

  useEffect(() => {
    if (tab !== "subscription" || cart.length === 0 || !paymentConfig.paypal_client_id || !paypalContainerRef.current) return;
    setPaypalError(null);
    paypalContainerRef.current.innerHTML = "";
    const planIds = paymentConfig.plan_ids || {};
    const planId = cart[0] && planIds[cart[0].client_role];
    const isSubscription = Boolean(planId);

    const renderButtons = () => {
      if (isSubscription) {
        window.paypal.Buttons({
          style: { shape: 'rect', color: 'gold', layout: 'vertical', label: 'subscribe' },
          createSubscription: (data, actions) => actions.subscription.create({ plan_id: planId }),
          onApprove: async (data) => {
            try {
              const res = await api("/api/payment/subscription-approved", {
                method: "POST",
                body: JSON.stringify({ subscriptionID: data.subscriptionID, client_role_id: cart[0].client_role_id }),
              });
              setCart([]);
              setUpgradeSuccess(res.plan || "Subscribed!");
              if (onProfileUpdate) onProfileUpdate({});
            } catch (e) {
              setPaypalError(e.message || "Subscription failed");
            }
          },
          onError: (err) => {
            const msg = typeof err === 'string' ? err : (err?.message || err?.details?.[0]?.description || JSON.stringify(err));
            const isPlanNotFound = /RESOURCE_NOT_FOUND|INVALID_RESOURCE_ID|resource does not exist/i.test(msg);
            setPaypalError(isPlanNotFound
              ? "Subscription plan not found. In Admin → Payment, use a Plan ID from the same PayPal app (Sandbox or Live) as your Client ID. Create the plan in developer.paypal.com under the same app."
              : (msg || "PayPal error"));
          },
        }).render(paypalContainerRef.current);
      } else {
        window.paypal.Buttons({
          createOrder: async () => {
            const res = await api("/api/payment/create-order", {
              method: "POST",
              body: JSON.stringify({ client_role_id: cart[0].client_role_id }),
            });
            return res.orderId;
          },
          onApprove: async (data) => {
            try {
              const res = await api("/api/payment/capture-order", {
                method: "POST",
                body: JSON.stringify({ orderId: data.orderID }),
              });
              setCart([]);
              setUpgradeSuccess(res.plan || "Plan upgraded!");
              if (onProfileUpdate) onProfileUpdate({});
            } catch (e) {
              setPaypalError(e.message || "Capture failed");
            }
          },
          onError: (err) => setPaypalError(err.message || "PayPal error"),
        }).render(paypalContainerRef.current);
      }
    };
    if (window.paypal) {
      renderButtons();
      return;
    }
    const script = document.createElement("script");
    script.src = isSubscription
      ? `https://www.paypal.com/sdk/js?client-id=${paymentConfig.paypal_client_id}&vault=true&intent=subscription${paymentConfig.paypal_sandbox ? "&debug=true" : ""}`
      : `https://www.paypal.com/sdk/js?client-id=${paymentConfig.paypal_client_id}&currency=${(paymentConfig.currency_code || "BWP")}&intent=capture${paymentConfig.paypal_sandbox ? "&debug=true" : ""}`;
    script.async = true;
    script.onload = renderButtons;
    document.body.appendChild(script);
    return () => { if (script.parentNode) script.parentNode.removeChild(script); };
  }, [tab, cart, paymentConfig.paypal_client_id, paymentConfig.paypal_sandbox, paymentConfig.currency_code, paymentConfig.plan_ids]);

  const handleSaveProfile = async () => {
    setProfileError(null);
    setProfileSaving(true);
    try {
      const payload = {
        username: profile.username.trim(),
        email: profile.email.trim(),
        whatsapp: profile.whatsapp.trim().replace(/\D/g, "") || null,
        country_code: profile.country_code?.trim() || null,
        location_id: profile.location_id ? parseInt(profile.location_id, 10) : null,
      };
      const updated = await api("/api/auth/me", { method: "PATCH", body: JSON.stringify(payload) });
      if (onProfileUpdate) onProfileUpdate({ name: updated.username, email: updated.email });
    } catch (err) {
      setProfileError(err.message || "Failed to save");
    } finally {
      setProfileSaving(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div><div className="page-title">Settings</div><div className="page-subtitle">Manage your profile and preferences</div></div>
      </div>
      <div className="tabs">
        {["profile","subscription","security"].map(t=>(
          <div key={t} className={`tab${tab===t?" active":""}`} onClick={()=>setTab(t)}>
            {t.charAt(0).toUpperCase()+t.slice(1)}
          </div>
        ))}
      </div>

      {tab==="profile" && (
        <div style={{maxWidth:560}}>
          <div className="card profile-header">
            <div className="profile-avatar">{(profile.username || user?.name || "?")[0].toUpperCase()}</div>
            <div className="profile-info">
              <h2>{profile.username || user?.name}</h2>
              <p>{profile.email || user?.email}</p>
              <span className={`chip ${user?.client_role==="Diamond"?"badge-diamond":user?.client_role==="Silver"?"badge-silver":"chip-avail"}`} style={{marginTop:6,fontSize:11}}>
                {user?.client_role==="Diamond"?"◆ ":user?.client_role==="Silver"?"◈ ":""}{user?.client_role || "Basic"} Plan
              </span>
            </div>
          </div>
          {profileLoading ? <div className="empty"><div className="empty-icon">⏳</div><div className="empty-title">Loading profile…</div></div> : (
          <div className="form-grid" style={{gap:16}}>
            {profileError && <div className="alert alert-danger">{profileError}</div>}
            <div className="form-grid form-grid-2">
              <div className="form-group">
                <label className="form-label">Username</label>
                <input className="form-input" value={profile.username} onChange={e=>setProfileField("username", e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" type="email" value={profile.email} onChange={e=>setProfileField("email", e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">WhatsApp Number</label>
              <div className="phone-row">
                <select className="form-select country-select" value={profile.country_code} onChange={e=>setProfileField("country_code", e.target.value)}>
                  <option value="+267">🇧🇼 +267</option>
                  <option value="+27">🇿🇦 +27</option>
                </select>
                <input className="form-input" placeholder="7123 4567" value={profile.whatsapp} onChange={e=>setProfileField("whatsapp", e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Location</label>
              <select className="form-select" value={profile.location_id} onChange={e=>setProfileField("location_id", e.target.value)}>
                <option value="">Select town…</option>
                <option value="1">Maun</option><option value="2">Kasane</option><option value="3">Gaborone</option><option value="4">Francistown</option>
              </select>
            </div>
            <button className="btn btn-primary" style={{width:"fit-content"}} onClick={handleSaveProfile} disabled={profileSaving}>{profileSaving ? "Saving…" : "Save Changes"}</button>
          </div>
          )}
        </div>
      )}

      {tab==="subscription" && (
        <div>
          {upgradeSuccess && (
            <div className="alert alert-success" style={{maxWidth:560,marginBottom:24}}>
              <div style={{fontWeight:600,marginBottom:4}}>✓ Plan upgraded successfully</div>
              <div style={{fontSize:14,color:"var(--text2)"}}>
                {upgradeSuccess && !["Plan upgraded!","Subscribed!","Upgraded"].includes(upgradeSuccess)
                  ? `You're now on the ${upgradeSuccess} plan. You have access to all ${upgradeSuccess} benefits.`
                  : "Your subscription is active. You have access to your new plan benefits."}
              </div>
              <button type="button" className="btn btn-sm" style={{marginTop:8}} onClick={()=>setUpgradeSuccess(null)} aria-label="Dismiss">Dismiss</button>
            </div>
          )}
          <div className="tier-grid">
            {plans.map((p) => {
              const isCurrentPlan = user?.client_role_id != null ? p.client_role_id === user.client_role_id : parseFloat(p.sub_price) === 0;
              return (
              <div key={p.client_role_id} className={`tier-card ${(p.client_role || "").toLowerCase()} ${isCurrentPlan ? "active-tier" : ""}`}>
                {isCurrentPlan && <span className="tier-badge current">Current</span>}
                <div className="tier-name" style={p.client_role === "Diamond" ? {color:"var(--gold)"} : undefined}>{p.client_role}</div>
                <div className="tier-price" style={p.client_role === "Diamond" ? {color:"var(--gold)"} : undefined}>
                  {parseFloat(p.sub_price) === 0 ? "Free" : (<>{({BWP:"P",USD:"$",EUR:"€",ZAR:"R",GBP:"£"}[paymentConfig.currency_code] || paymentConfig.currency_code || "P")}{Number(p.sub_price).toFixed(2)}<small>/month</small></>)}
                </div>
                {p.plan_description && <p className="text-muted" style={{fontSize:13,margin:"0 0 8px 0"}}>{p.plan_description}</p>}
                <ul className="tier-features">
                  {(Array.isArray(p.plan_features) ? p.plan_features : []).length > 0
                    ? (Array.isArray(p.plan_features) ? p.plan_features : []).map((f, i) => <li key={i}>{f}</li>)
                    : <li>{(p.client_role || "").toLowerCase()} plan benefits</li>}
                </ul>
                {parseFloat(p.sub_price) > 0 && !isCurrentPlan && (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    style={{marginTop:8}}
                    onClick={() => setCart([{ client_role_id: p.client_role_id, client_role: p.client_role, sub_price: p.sub_price }])}
                  >
                    Upgrade
                  </button>
                )}
              </div>
            );
            })}
          </div>
          {mySubscription?.active && (
            <div className="settings-section" style={{ maxWidth: 560, marginTop: 24 }}>
              <div className="settings-title">Active PayPal subscription</div>
              <p className="text-muted" style={{ fontSize: 14, marginBottom: 16 }}>
                You are on the {mySubscription.plan} plan via PayPal. Cancel to stop future charges and move to Basic.
              </p>
              <button
                type="button"
                className="btn btn-outline"
                style={{ borderColor: "var(--danger)", color: "var(--danger)" }}
                disabled={unsubscribeLoading}
                onClick={async () => {
                  const ok = await confirm({
                    title: "Unsubscribe",
                    message: "Cancel your PayPal subscription? You will be moved to the Basic plan and will not be charged again.",
                    confirmLabel: "Unsubscribe",
                    cancelLabel: "Keep subscription",
                    danger: true,
                  });
                  if (!ok) return;
                  setUnsubscribeLoading(true);
                  try {
                    const res = await api("/api/payment/cancel-subscription", { method: "POST" });
                    toast(res.message || "Subscription cancelled.");
                    setMySubscription({ active: false });
                    if (onProfileUpdate) onProfileUpdate({});
                  } catch (e) {
                    toast(e.message || "Failed to cancel subscription");
                  } finally {
                    setUnsubscribeLoading(false);
                  }
                }}
              >
                {unsubscribeLoading ? "Cancelling…" : "Unsubscribe"}
              </button>
            </div>
          )}
          {cart.length > 0 && (
            <div className="settings-section" style={{maxWidth:560,marginTop:24}}>
              <div className="settings-title">Checkout</div>
              <ul style={{listStyle:"none",padding:0,margin:"0 0 16px 0"}}>
                {cart.map((item, i) => (
                  <li key={i} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid var(--border)"}}>
                    <span>{item.client_role} — {({BWP:"P",USD:"$",EUR:"€",ZAR:"R",GBP:"£"}[paymentConfig.currency_code] || paymentConfig.currency_code || "P")}{Number(item.sub_price).toFixed(2)}/month</span>
                  </li>
                ))}
              </ul>
              <p style={{fontWeight:600}}>Total: {({BWP:"P",USD:"$",EUR:"€",ZAR:"R",GBP:"£"}[paymentConfig.currency_code] || paymentConfig.currency_code || "P")}{cart.reduce((sum, i) => sum + Number(i.sub_price), 0).toFixed(2)}/month</p>
              <button type="button" className="btn btn-outline btn-sm" style={{marginBottom:16}} onClick={() => setCart([])}>Clear cart</button>
              {paymentConfig.paypal_client_id ? (
                <div>
                  {paypalError && <div className="alert alert-danger" style={{marginBottom:12}}>{paypalError}</div>}
                  <div ref={paypalContainerRef} />
                </div>
              ) : (
                <p className="text-muted">PayPal is not configured. Ask the admin to set up payments.</p>
              )}
            </div>
          )}
        </div>
      )}

      {tab==="security" && (
        <div style={{maxWidth:400}}>
          <div className="settings-section">
            <div className="settings-title">Change Password</div>
            <div className="form-grid" style={{gap:14}}>
              {passwordError && <div className="alert alert-danger">{passwordError}</div>}
              <div className="form-group">
                <label className="form-label">Current password</label>
                <input className="form-input" type="password" placeholder="••••••••" value={currentPassword} onChange={e=>{ setCurrentPassword(e.target.value); setPasswordError(null); }} />
              </div>
              <div className="form-group">
                <label className="form-label">New password</label>
                <input className="form-input" type="password" placeholder="Min. 6 characters" value={newPassword} onChange={e=>{ setNewPassword(e.target.value); setPasswordError(null); }} />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm new password</label>
                <input className="form-input" type="password" placeholder="••••••••" value={confirmPassword} onChange={e=>{ setConfirmPassword(e.target.value); setPasswordError(null); }} />
              </div>
              <button
                className="btn btn-primary"
                style={{width:"fit-content"}}
                disabled={passwordSaving}
                onClick={async () => {
                  setPasswordError(null);
                  if (!currentPassword.trim()) { setPasswordError("Enter your current password"); return; }
                  if (newPassword.length < 6) { setPasswordError("New password must be at least 6 characters"); return; }
                  if (newPassword !== confirmPassword) { setPasswordError("New password and confirmation do not match"); return; }
                  setPasswordSaving(true);
                  try {
                    await api("/api/auth/change-password", {
                      method: "POST",
                      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
                    });
                    setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
                    toast("Password updated successfully", "success");
                  } catch (err) {
                    setPasswordError(err.message || "Failed to update password");
                  } finally {
                    setPasswordSaving(false);
                  }
                }}
              >
                {passwordSaving ? "Updating…" : "Update Password"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getAdminPkCol(table) {
  const map = {
    product_listing: 'listing_id', service_listing: 'service_listing_id',
    advert_list: 'advert_list_id', error_report: 'report_id',
    product_category: 'category_id',
  };
  return map[table] || `${table.replace(/s$/, '')}_id`;
}

function AdminPage() {
  const { toast, confirm } = useNotifications();
  const [tab, setTab] = useState("dashboard");
  const [tableList, setTableList] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [tableData, setTableData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editRow, setEditRow] = useState(null);
  const [saving, setSaving] = useState(false);
  const [addRecordOpen, setAddRecordOpen] = useState(false);
  const [tableSchema, setTableSchema] = useState([]);
  const [newRecord, setNewRecord] = useState({});
  const [addRecordSaving, setAddRecordSaving] = useState(false);
  const [addRecordError, setAddRecordError] = useState(null);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [deleteConfirmRow, setDeleteConfirmRow] = useState(null);
  const [deletingRow, setDeletingRow] = useState(false);
  const [paypalClientId, setPaypalClientId] = useState("");
  const [paypalClientSecret, setPaypalClientSecret] = useState("");
  const [paypalSandbox, setPaypalSandbox] = useState(true);
  const [paypalPlanIdSilver, setPaypalPlanIdSilver] = useState("");
  const [paypalPlanIdDiamond, setPaypalPlanIdDiamond] = useState("");
  const [paypalWebhookId, setPaypalWebhookId] = useState("");
  const [currencyCode, setCurrencyCode] = useState("BWP");
  const [paymentConfigLoading, setPaymentConfigLoading] = useState(false);
  const [paymentConfigSaving, setPaymentConfigSaving] = useState(false);
  const [paymentConfigError, setPaymentConfigError] = useState(null);
  const [planPrices, setPlanPrices] = useState([]);
  const [planPricesSaving, setPlanPricesSaving] = useState(false);
  const [planPricesError, setPlanPricesError] = useState(null);
  const [dashboardStats, setDashboardStats] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState(null);
  const [dashboardActivity, setDashboardActivity] = useState([]);
  const [clientsList, setClientsList] = useState([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [clientsError, setClientsError] = useState(null);
  const [editingClientId, setEditingClientId] = useState(null);
  const [editingClient, setEditingClient] = useState(null);
  const [editingClientRoles, setEditingClientRoles] = useState([]);
  const [editingClientLoading, setEditingClientLoading] = useState(false);
  const [editingClientSaving, setEditingClientSaving] = useState(false);
  const [editingClientError, setEditingClientError] = useState(null);
  const [reportsList, setReportsList] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsError, setReportsError] = useState(null);
  const [reportActionId, setReportActionId] = useState(null); // resolving or deleting

  useEffect(() => {
    if (tab !== "tables") return;
    api("/api/admin/tables")
      .then((list) => setTableList(list))
      .catch((err) => setError(err.message));
  }, [tab]);

  useEffect(() => {
    if (tab !== "dashboard") return;
    setDashboardLoading(true);
    setDashboardError(null);
    api("/api/admin/dashboard")
      .then(setDashboardStats)
      .catch((err) => setDashboardError(err.message))
      .finally(() => setDashboardLoading(false));
    api("/api/admin/dashboard/activity")
      .then(setDashboardActivity)
      .catch(() => setDashboardActivity([]));
  }, [tab]);

  useEffect(() => {
    if (tab !== "clients") return;
    setClientsLoading(true);
    setClientsError(null);
    api("/api/admin/clients")
      .then(setClientsList)
      .catch((err) => { setClientsError(err.message); setClientsList([]); })
      .finally(() => setClientsLoading(false));
  }, [tab]);

  useEffect(() => {
    if (tab !== "reports") return;
    setReportsLoading(true);
    setReportsError(null);
    api("/api/admin/reports")
      .then(setReportsList)
      .catch((err) => { setReportsError(err.message); setReportsList([]); })
      .finally(() => setReportsLoading(false));
  }, [tab]);

  useEffect(() => {
    if (!editingClientId) {
      setEditingClient(null);
      setEditingClientError(null);
      return;
    }
    setEditingClientLoading(true);
    setEditingClientError(null);
    Promise.all([
      api(`/api/admin/clients/${editingClientId}`),
      api("/api/misc/roles"),
    ])
      .then(([client, roles]) => {
        setEditingClient(client);
        setEditingClientRoles(Array.isArray(roles) ? roles.filter((r) => r.client_role !== "Admin") : []);
      })
      .catch((err) => {
        setEditingClientError(err.message || "Failed to load client");
        setEditingClient(null);
      })
      .finally(() => setEditingClientLoading(false));
  }, [editingClientId]);

  useEffect(() => {
    if (!selectedTable) { setTableData([]); return; }
    setLoading(true);
    setError(null);
    api(`/api/admin/tables/${selectedTable}`)
      .then(setTableData)
      .catch((err) => { setError(err.message); setTableData([]); })
      .finally(() => setLoading(false));
  }, [selectedTable]);

  useEffect(() => {
    if (tab !== "payment") return;
    setPaymentConfigLoading(true);
    setPaymentConfigError(null);
    api("/api/admin/payment-config")
      .then((c) => {
        setPaypalClientId(c.paypal_client_id || "");
        setPaypalClientSecret(c.paypal_client_secret ? "********" : "");
        setPaypalSandbox(c.paypal_sandbox !== false);
        setPaypalPlanIdSilver(c.paypal_plan_id_Silver || "");
        setPaypalPlanIdDiamond(c.paypal_plan_id_Diamond || "");
        setPaypalWebhookId(c.paypal_webhook_id || "");
        setCurrencyCode((c.currency_code || "BWP").toUpperCase());
      })
      .catch((err) => setPaymentConfigError(err.message))
      .finally(() => setPaymentConfigLoading(false));
  }, [tab]);

  useEffect(() => {
    if (tab !== "payment") return;
    api("/api/admin/plans")
      .then(setPlanPrices)
      .catch(() => setPlanPrices([]));
  }, [tab]);

  const handleSavePaymentConfig = async () => {
    setPaymentConfigSaving(true);
    setPaymentConfigError(null);
    try {
      const body = { paypal_client_id: paypalClientId.trim(), paypal_sandbox: paypalSandbox, paypal_plan_id_Silver: paypalPlanIdSilver.trim(), paypal_plan_id_Diamond: paypalPlanIdDiamond.trim(), paypal_webhook_id: paypalWebhookId.trim(), currency_code: currencyCode.trim().toUpperCase() || "BWP" };
      if (paypalClientSecret !== "********") body.paypal_client_secret = paypalClientSecret.trim();
      await api("/api/admin/payment-config", { method: "PUT", body: JSON.stringify(body) });
      setPaypalClientSecret("********");
    } catch (err) {
      setPaymentConfigError(err.message || "Save failed");
    } finally {
      setPaymentConfigSaving(false);
    }
  };

  const handleSaveClientEdit = async () => {
    if (!editingClient) return;
    setEditingClientSaving(true);
    setEditingClientError(null);
    try {
      await api(`/api/admin/clients/${editingClient.client_id}`, {
        method: "PUT",
        body: JSON.stringify({
          username: editingClient.username?.trim(),
          email: editingClient.email?.trim(),
          active: editingClient.active,
          client_role_id: editingClient.client_role_id != null ? parseInt(editingClient.client_role_id, 10) : undefined,
          first_name: editingClient.first_name?.trim() || null,
          last_name: editingClient.last_name?.trim() || null,
          whatsapp: editingClient.whatsapp?.trim().replace(/\D/g, "") || null,
          country_code: editingClient.country_code?.trim() || null,
          location_id: editingClient.location_id != null && editingClient.location_id !== "" ? parseInt(editingClient.location_id, 10) : null,
        }),
      });
      const list = await api("/api/admin/clients");
      setClientsList(list);
      setEditingClientId(null);
    } catch (err) {
      setEditingClientError(err.message || "Save failed");
    } finally {
      setEditingClientSaving(false);
    }
  };

  const setPlanPrice = (clientRoleId, value) => {
    setPlanPrices(prev => prev.map(p => p.client_role_id === clientRoleId ? { ...p, sub_price: value } : p));
  };
  const setPlanDescription = (clientRoleId, value) => {
    setPlanPrices(prev => prev.map(p => p.client_role_id === clientRoleId ? { ...p, plan_description: value } : p));
  };
  const setPlanFeatures = (clientRoleId, value) => {
    const arr = typeof value === 'string' ? value.split('\n') : (Array.isArray(value) ? value : []);
    setPlanPrices(prev => prev.map(p => p.client_role_id === clientRoleId ? { ...p, plan_features: arr } : p));
  };

  const handleSavePlanPrices = async () => {
    setPlanPricesSaving(true);
    setPlanPricesError(null);
    try {
      const prices = planPrices.map(p => ({
        client_role_id: p.client_role_id,
        sub_price: parseFloat(p.sub_price) || 0,
        plan_description: p.plan_description != null ? String(p.plan_description).trim() || null : undefined,
        plan_features: p.plan_features != null ? (Array.isArray(p.plan_features) ? p.plan_features : []).map(s => String(s).trim()).filter(Boolean) : undefined,
      }));
      const updated = await api("/api/admin/plans/prices", { method: "PUT", body: JSON.stringify({ prices }) });
      setPlanPrices(updated);
    } catch (err) {
      setPlanPricesError(err.message || "Save failed");
    } finally {
      setPlanPricesSaving(false);
    }
  };

  const pkCol = selectedTable ? getAdminPkCol(selectedTable) : null;
  const columns = tableData.length > 0 ? Object.keys(tableData[0]) : [];

  const handleSaveEdit = async () => {
    if (!editRow || !selectedTable || !pkCol) return;
    const id = editRow[pkCol];
    const body = { ...editRow };
    delete body[pkCol];
    if (selectedTable === "product_category") delete body.product_category;
    setSaving(true);
    try {
      await api(`/api/admin/tables/${selectedTable}/${id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      setTableData((prev) => prev.map((r) => (r[pkCol] === id ? { ...editRow } : r)));
      setEditRow(null);
    } catch (err) {
      toast(err.message || "Update failed", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row) => {
    setDeleteConfirmRow(row);
  };

  const doDeleteRow = async () => {
    if (!deleteConfirmRow || !selectedTable || !pkCol) return;
    const id = deleteConfirmRow[pkCol];
    setDeletingRow(true);
    try {
      await api(`/api/admin/tables/${selectedTable}/${id}`, { method: "DELETE" });
      setTableData((prev) => prev.filter((r) => r[pkCol] !== id));
      setDeleteConfirmRow(null);
    } catch (err) {
      toast(err.message || "Delete failed", "error");
    } finally {
      setDeletingRow(false);
    }
  };

  const refetchTableData = () => {
    if (!selectedTable) return;
    api(`/api/admin/tables/${selectedTable}`)
      .then(setTableData)
      .catch((err) => setError(err.message));
  };

  const openAddRecord = () => {
    setAddRecordError(null);
    setSchemaLoading(true);
    api(`/api/admin/tables/${selectedTable}/schema`)
      .then((schema) => {
        setTableSchema(schema);
        setNewRecord(schema.reduce((acc, c) => ({ ...acc, [c.name]: "" }), {}));
        setAddRecordOpen(true);
      })
      .catch((err) => setAddRecordError(err.message))
      .finally(() => setSchemaLoading(false));
  };

  const handleAddRecord = async () => {
    const body = {};
    tableSchema.forEach((col) => {
      if (col.auto) return;
      const v = newRecord[col.name];
      const s = v !== undefined && v !== null ? String(v).trim() : "";
      if (s === "") return;
      if (col.type === "boolean") {
        const lower = s.toLowerCase();
        body[col.name] = ["true", "t", "1", "yes"].includes(lower);
      } else if (["integer", "bigint", "numeric", "decimal", "real", "double precision"].includes(col.type)) {
        const n = Number(s);
        if (!Number.isNaN(n)) body[col.name] = n;
        else body[col.name] = s;
      } else {
        body[col.name] = s;
      }
    });
    if (Object.keys(body).length === 0) {
      setAddRecordError("Fill in at least one field.");
      return;
    }
    setAddRecordError(null);
    setAddRecordSaving(true);
    try {
      await api(`/api/admin/tables/${selectedTable}`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      refetchTableData();
      setAddRecordOpen(false);
      setNewRecord({});
    } catch (err) {
      setAddRecordError(err.message || "Insert failed");
    } finally {
      setAddRecordSaving(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div><div className="page-title">Admin Dashboard</div><div className="page-subtitle">Manage the Mmaraka platform</div></div>
      </div>

      <div className="tabs">
        {["dashboard","clients","reports","tables","payment"].map(t=>(
          <div key={t} className={`tab${tab===t?" active":""}`} onClick={()=>setTab(t)}>
            {t === "reports" ? "Error Reports" : t.charAt(0).toUpperCase()+t.slice(1)}
          </div>
        ))}
      </div>

      {tab==="dashboard" && (
        <>
          {dashboardError && <div className="alert alert-danger" style={{marginBottom:16}}>{dashboardError}</div>}
          {dashboardLoading ? (
            <div className="empty"><div className="empty-icon">⏳</div><div className="empty-title">Loading dashboard…</div></div>
          ) : (
          <div className="stats-grid">
            {[
              { n: dashboardStats?.clients ?? 0, l: "Registered Users", c: dashboardStats?.clients_this_week != null ? `↑ ${dashboardStats.clients_this_week} this week` : "Total", up: true },
              { n: dashboardStats?.product_listings ?? 0, l: "Total Listings", c: dashboardStats?.product_listings_this_week != null ? `↑ ${dashboardStats.product_listings_this_week} this week` : "Total", up: true },
              { n: dashboardStats?.services ?? 0, l: "Service Providers", c: dashboardStats?.services_this_week != null ? `↑ ${dashboardStats.services_this_week} this week` : "Total", up: true },
              { n: dashboardStats?.unresolved_reports ?? 0, l: "Unresolved Reports", c: "Needs attention", up: false },
            ].map((s,i)=>(
              <div key={i} className="card stat-card">
                <div className="stat-num">{s.n}</div>
                <div className="stat-label">{s.l}</div>
                <div className={`stat-change ${s.up?"stat-up":"stat-down"}`}>{s.c}</div>
              </div>
            ))}
          </div>
          )}
          <div className="card" style={{padding:20}}>
            <div className="settings-title">Recent Activity</div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>User</th><th>Action</th><th>Time</th></tr></thead>
                <tbody>
                  {dashboardActivity.length === 0 ? (
                    <tr><td colSpan={3} style={{color:"var(--text3)",textAlign:"center",padding:24}}>No recent activity</td></tr>
                  ) : (
                    dashboardActivity.map((row, i) => (
                      <tr key={i}><td><strong>{row.user}</strong></td><td>{row.action}</td><td style={{color:"var(--text3)"}}>{formatRelative(row.time)}</td></tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab==="reports" && (
        <>
          {reportsError && <div className="alert alert-danger" style={{marginBottom:16}}>{reportsError}</div>}
          {reportsLoading ? (
            <div className="empty"><div className="empty-icon">⏳</div><div className="empty-title">Loading error reports…</div></div>
          ) : reportsList.length === 0 ? (
            <div className="empty"><div className="empty-icon">🐛</div><div className="empty-title">No error reports</div></div>
          ) : (
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              {reportsList.map((report) => (
                <div key={report.report_id} className="card" style={{padding:20}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:8}}>
                        <strong>{report.subject || "No subject"}</strong>
                        {report.resolved && <span className="chip chip-active" style={{fontSize:11}}>Resolved</span>}
                        <span style={{color:"var(--text3)",fontSize:13}}>
                          {report.reporter_username ? `by ${report.reporter_username}` : "Anonymous"} · {report.submitted_at ? formatRelative(report.submitted_at) : "—"}
                        </span>
                      </div>
                      {report.description && <p style={{margin:0,color:"var(--text2)",whiteSpace:"pre-wrap"}}>{report.description}</p>}
                      {report.screenshot_path && (
                        <div style={{marginTop:12}}>
                          <a href={`${API_BASE}${report.screenshot_path}`} target="_blank" rel="noopener noreferrer" style={{fontSize:13}}>View screenshot</a>
                          <img src={`${API_BASE}${report.screenshot_path}`} alt="Report screenshot" style={{display:"block",maxWidth:"100%",maxHeight:200,marginTop:8,borderRadius:8,border:"1px solid var(--border)"}} />
                        </div>
                      )}
                    </div>
                    <div style={{display:"flex",gap:8,flexShrink:0}}>
                      {!report.resolved && (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={reportActionId === report.report_id}
                          onClick={async () => {
                            setReportActionId(report.report_id);
                            try {
                              await api(`/api/admin/reports/${report.report_id}/resolved`, { method: "PATCH" });
                              const r = await api("/api/admin/reports");
                              setReportsList(r);
                            } catch (e) {
                              setReportsError(e.message || "Failed to mark resolved");
                            } finally {
                              setReportActionId(null);
                            }
                          }}
                        >
                          {reportActionId === report.report_id ? "…" : "Resolved"}
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{color:"var(--danger)"}}
                        disabled={reportActionId === report.report_id}
                        onClick={async () => {
                          const ok = await confirm({ title: "Delete report", message: "Delete this report?", confirmLabel: "Delete", cancelLabel: "Cancel", danger: true });
                          if (!ok) return;
                          setReportActionId(report.report_id);
                          try {
                            await api(`/api/admin/reports/${report.report_id}`, { method: "DELETE" });
                            setReportsList((prev) => prev.filter((r) => r.report_id !== report.report_id));
                          } catch (e) {
                            setReportsError(e.message || "Failed to delete");
                          } finally {
                            setReportActionId(null);
                          }
                        }}
                      >
                        {reportActionId === report.report_id ? "…" : "Delete"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab==="clients" && (
        <div className="table-wrap">
          {clientsError && <div className="alert alert-danger" style={{marginBottom:16}}>{clientsError}</div>}
          {clientsLoading ? (
            <div className="empty"><div className="empty-icon">⏳</div><div className="empty-title">Loading clients…</div></div>
          ) : (
          <table>
            <thead><tr><th>#</th><th>Username</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead>
            <tbody>
              {clientsList.map(c=>(
                <tr key={c.client_id}>
                  <td>{c.client_id}</td>
                  <td><strong>{c.username}</strong></td>
                  <td>{c.email}</td>
                  <td>
                    <span className={`chip ${c.client_role==="Diamond"?"badge-diamond":c.client_role==="Silver"?"badge-silver":"chip-avail"}`} style={{fontSize:11}}>
                      {c.client_role==="Diamond"?"◆ ":c.client_role==="Silver"?"◈ ":""}{c.client_role}
                    </span>
                  </td>
                  <td><span className={`chip ${c.active?"chip-active":"chip-inactive"}`}>{c.active?"Active":"Inactive"}</span></td>
                  <td style={{color:"var(--text3)"}}>{c.join_date ? new Date(c.join_date).toLocaleDateString() : "—"}</td>
                  <td><button type="button" className="btn btn-ghost btn-sm" onClick={()=>setEditingClientId(c.client_id)}>Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
          {editingClientId && (
            <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:24}} onClick={()=>!editingClientSaving&&setEditingClientId(null)}>
              <div className="card" style={{maxWidth:480,width:"100%",maxHeight:"90vh",overflow:"auto"}} onClick={e=>e.stopPropagation()}>
                <div style={{padding:20,borderBottom:"1px solid var(--border)"}}>
                  <strong>Edit client</strong> #{editingClientId}
                </div>
                <div style={{padding:20}}>
                  {editingClientLoading ? (
                    <div className="empty"><div className="empty-icon">⏳</div><div className="empty-title">Loading…</div></div>
                  ) : editingClientError ? (
                    <div className="alert alert-danger">{editingClientError}</div>
                  ) : editingClient ? (
                    <>
                      {editingClientError && <div className="alert alert-danger" style={{marginBottom:16}}>{editingClientError}</div>}
                      <div className="form-grid" style={{gap:12}}>
                        <div className="form-group">
                          <label className="form-label">Username</label>
                          <input className="form-input" value={editingClient.username ?? ""} onChange={e=>setEditingClient(c=>({...c,username:e.target.value}))} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Email</label>
                          <input className="form-input" type="email" value={editingClient.email ?? ""} onChange={e=>setEditingClient(c=>({...c,email:e.target.value}))} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Plan / Role</label>
                          <select className="form-input" value={editingClient.client_role_id ?? ""} onChange={e=>setEditingClient(c=>({...c,client_role_id:e.target.value}))}>
                            {editingClientRoles.map((r)=>(<option key={r.client_role_id} value={r.client_role_id}>{r.client_role}</option>))}
                          </select>
                        </div>
                        <div className="form-group" style={{display:"flex",alignItems:"center",gap:10}}>
                          <input type="checkbox" id="edit-client-active" checked={!!editingClient.active} onChange={e=>setEditingClient(c=>({...c,active:e.target.checked}))} />
                          <label htmlFor="edit-client-active" className="form-label" style={{marginBottom:0}}>Active</label>
                        </div>
                        <div className="form-group">
                          <label className="form-label">First name</label>
                          <input className="form-input" value={editingClient.first_name ?? ""} onChange={e=>setEditingClient(c=>({...c,first_name:e.target.value}))} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Last name</label>
                          <input className="form-input" value={editingClient.last_name ?? ""} onChange={e=>setEditingClient(c=>({...c,last_name:e.target.value}))} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">WhatsApp</label>
                          <input className="form-input" value={editingClient.whatsapp ?? ""} onChange={e=>setEditingClient(c=>({...c,whatsapp:e.target.value}))} placeholder="Digits only" />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Country code</label>
                          <input className="form-input" value={editingClient.country_code ?? ""} onChange={e=>setEditingClient(c=>({...c,country_code:e.target.value}))} placeholder="e.g. +267" />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Location ID</label>
                          <input className="form-input" type="number" value={editingClient.location_id ?? ""} onChange={e=>setEditingClient(c=>({...c,location_id:e.target.value}))} placeholder="1–4 or empty" />
                        </div>
                      </div>
                      <div style={{display:"flex",gap:10,marginTop:16}}>
                        <button type="button" className="btn btn-primary" onClick={handleSaveClientEdit} disabled={editingClientSaving}>{editingClientSaving ? "Saving…" : "Save"}</button>
                        <button type="button" className="btn btn-outline" onClick={()=>setEditingClientId(null)} disabled={editingClientSaving}>Cancel</button>
                      </div>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab==="tables" && (
        <>
          <p className="text-muted mb-16">Direct access to all database tables. Use with care.</p>
          {selectedTable ? (
            <>
              <div className="flex items-center gap-12 mb-16">
                <button className="btn btn-outline btn-sm" onClick={()=>{ setSelectedTable(null); setEditRow(null); setAddRecordOpen(false); }}>← Back to tables</button>
                <button className="btn btn-primary btn-sm" onClick={openAddRecord} disabled={schemaLoading}>{schemaLoading ? "Loading…" : "+ Add record"}</button>
                <span className="fw-600">{selectedTable}</span>
                <span className="text-muted">({tableData.length} rows)</span>
              </div>
              {error && <div className="alert alert-danger mb-16">{error}</div>}
              {loading ? (
                <div className="empty"><div className="empty-icon">⏳</div><div className="empty-title">Loading…</div></div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        {columns.map((col) => <th key={col}>{col}</th>)}
                        <th style={{width:140}}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableData.map((row, idx) => (
                        <tr key={row[pkCol] ?? idx}>
                          {columns.map((col) => (
                            <td key={col} style={{maxWidth:200,overflow:"hidden",textOverflow:"ellipsis"}} title={String(row[col] ?? "")}>
                              {row[col] != null ? String(row[col]) : "—"}
                            </td>
                          ))}
                          <td>
                            <button className="btn btn-ghost btn-sm" onClick={()=>setEditRow({...row})}>Edit</button>
                            <button className="btn btn-ghost btn-sm" style={{color:"var(--danger)"}} onClick={()=>handleDelete(row)}>Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {editRow && (
                <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:24}} onClick={()=>!saving&&setEditRow(null)}>
                  <div className="card" style={{maxWidth:520,width:"100%",maxHeight:"90vh",overflow:"auto"}} onClick={e=>e.stopPropagation()}>
                    <div style={{padding:20,borderBottom:"1px solid var(--border)"}}>
                      <strong>Edit row</strong> — {selectedTable}
                    </div>
                    <div style={{padding:20}}>
                      {columns.map((col) => (
                        <div key={col} className="form-group" style={{marginBottom:12}}>
                          <label className="form-label">{col}</label>
                          <input
                            className="form-input"
                            readOnly={col === pkCol}
                            value={editRow[col] != null ? editRow[col] : ""}
                            onChange={e=>setEditRow(r=>({...r,[col]:e.target.value}))}
                          />
                        </div>
                      ))}
                      <div style={{display:"flex",gap:10,marginTop:16}}>
                        <button className="btn btn-primary" onClick={handleSaveEdit} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
                        <button className="btn btn-outline" onClick={()=>setEditRow(null)} disabled={saving}>Cancel</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {addRecordOpen && (
                <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:24}} onClick={()=>!addRecordSaving&&setAddRecordOpen(false)}>
                  <div className="card" style={{maxWidth:520,width:"100%",maxHeight:"90vh",overflow:"auto"}} onClick={e=>e.stopPropagation()}>
                    <div style={{padding:20,borderBottom:"1px solid var(--border)"}}>
                      <strong>Add record</strong> — {selectedTable}
                    </div>
                    <div style={{padding:20}}>
                      {addRecordError && <div className="alert alert-danger mb-16">{addRecordError}</div>}
                      {tableSchema.map((col) => (
                        <div key={col.name} className="form-group" style={{marginBottom:12}}>
                          <label className="form-label">{col.name}{col.auto ? " (auto)" : ""}</label>
                          {col.auto ? (
                            <input className="form-input" readOnly placeholder="Generated by database" value="" style={{opacity:0.8}} />
                          ) : col.type === "boolean" ? (
                            <select className="form-input" value={newRecord[col.name] || ""} onChange={e=>setNewRecord(r=>({...r,[col.name]:e.target.value}))}>
                              <option value="">—</option>
                              <option value="true">true</option>
                              <option value="false">false</option>
                            </select>
                          ) : (
                            <input
                              className="form-input"
                              placeholder={col.type && col.type.includes("int") ? "Number" : ""}
                              value={newRecord[col.name] != null ? newRecord[col.name] : ""}
                              onChange={e=>setNewRecord(r=>({...r,[col.name]:e.target.value}))}
                            />
                          )}
                        </div>
                      ))}
                      <div style={{display:"flex",gap:10,marginTop:16}}>
                        <button className="btn btn-primary" onClick={handleAddRecord} disabled={addRecordSaving}>{addRecordSaving ? "Adding…" : "Add record"}</button>
                        <button className="btn btn-outline" onClick={()=>setAddRecordOpen(false)} disabled={addRecordSaving}>Cancel</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <ConfirmModal
                open={!!deleteConfirmRow}
                title="Delete row?"
                message="This cannot be undone. The row will be permanently removed from the table."
                confirmLabel="Delete"
                danger
                loading={deletingRow}
                onConfirm={doDeleteRow}
                onCancel={()=>!deletingRow&&setDeleteConfirmRow(null)}
              />
            </>
          ) : (
            <div className="admin-table-list">
              {(tableList.length ? tableList : ["client","product","product_listing","service","service_listing","advert_list","error_report","location","currency","client_role"]).map((name)=>{
                const icons = { client:"👤", product:"📦", product_listing:"📋", service:"🏢", service_listing:"📄", advert_list:"📢", error_report:"🐛", location:"📍", currency:"💰", client_role:"🏷️", product_category:"🏷️" };
                return (
                  <div key={name} className="card admin-table-item" onClick={()=>setSelectedTable(name)}>
                    <div className="admin-table-icon">{icons[name] || "📄"}</div>
                    <div className="admin-table-name">{name}</div>
                    <div className="admin-table-count">Click to view & edit</div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {tab==="payment" && (
        <div className="card" style={{maxWidth:520,padding:24}}>
          <div className="settings-title">PayPal configuration</div>
          <p className="text-muted" style={{marginBottom:16}}>Set your PayPal client credentials. Use Test mode for sandbox testing.</p>
          <details style={{marginBottom:16}}>
            <summary style={{cursor:"pointer",fontWeight:600,color:"var(--accent)"}}>How to get a Plan ID (for subscriptions)</summary>
            <ol style={{marginTop:10,paddingLeft:20,color:"var(--text2)",fontSize:13,lineHeight:1.6}}>
              <li>Go to <a href="https://developer.paypal.com/dashboard/applications/sandbox" target="_blank" rel="noopener noreferrer" style={{color:"var(--accent)"}}>developer.paypal.com</a> → Apps &amp; Credentials.</li>
              <li>Open the <strong>same app</strong> you use for the Client ID above (Sandbox app if Test mode is on, Live app if off).</li>
              <li>In the app, go to <strong>Products &amp; plans</strong> → create a <strong>Product</strong> (e.g. &quot;Silver monthly&quot;) → then add a <strong>Plan</strong> (billing cycle, price).</li>
              <li>Copy the <strong>Plan ID</strong> (starts with <code>P-</code>) and paste it in &quot;Silver plan ID&quot; or &quot;Diamond plan ID&quot; below.</li>
              <li>Save. The plan must be from the same app and environment (Sandbox/Live) as your Client ID.</li>
            </ol>
          </details>
          {paymentConfigError && <div className="alert alert-danger" style={{marginBottom:16}}>{paymentConfigError}</div>}
          {paymentConfigLoading ? (
            <div className="empty"><div className="empty-icon">⏳</div><div className="empty-title">Loading…</div></div>
          ) : (
            <div className="form-grid" style={{gap:14}}>
              <div className="form-group">
                <label className="form-label">PayPal Client ID</label>
                <input
                  className="form-input"
                  value={paypalClientId}
                  onChange={e=>setPaypalClientId(e.target.value)}
                  placeholder="Client ID from developer.paypal.com"
                />
              </div>
              <div className="form-group">
                <label className="form-label">PayPal Client Secret</label>
                <input
                  className="form-input"
                  type="password"
                  value={paypalClientSecret}
                  onChange={e=>setPaypalClientSecret(e.target.value)}
                  placeholder="Leave blank to keep existing"
                />
              </div>
              <div className="form-group" style={{display:"flex",alignItems:"center",gap:10}}>
                <input
                  type="checkbox"
                  id="paypal-sandbox"
                  checked={paypalSandbox}
                  onChange={e=>setPaypalSandbox(e.target.checked)}
                />
                <label htmlFor="paypal-sandbox" className="form-label" style={{marginBottom:0}}>Test mode (sandbox)</label>
              </div>
              <div className="form-group">
                <label className="form-label">Currency</label>
                <select className="form-input" value={currencyCode} onChange={e=>setCurrencyCode(e.target.value)}>
                  <option value="BWP">BWP (Pula)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="ZAR">ZAR (R)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Silver plan ID (monthly subscription)</label>
                <input
                  className="form-input"
                  value={paypalPlanIdSilver}
                  onChange={e=>setPaypalPlanIdSilver(e.target.value)}
                  placeholder="e.g. P-4SH6904222287000TNGRQL5Y"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Diamond plan ID (optional)</label>
                <input
                  className="form-input"
                  value={paypalPlanIdDiamond}
                  onChange={e=>setPaypalPlanIdDiamond(e.target.value)}
                  placeholder="PayPal subscription plan ID"
                />
                <p className="text-muted" style={{fontSize:12,marginTop:6,marginBottom:0}}>Plan IDs must be created in the same PayPal app (Sandbox or Live) as your Client ID above. Create products &amp; plans in developer.paypal.com.</p>
              </div>
              <div className="form-group">
                <label className="form-label">Webhook URL (for subscription defaults)</label>
                <input className="form-input" readOnly value={typeof window !== "undefined" ? `${window.location.origin}/api/payment/webhook` : "https://your-backend-domain.com/api/payment/webhook"} style={{fontFamily:"monospace",fontSize:12}} />
                <p className="text-muted" style={{fontSize:12,marginTop:6,marginBottom:0}}>PayPal will send events to this URL. If your API runs on a different domain, use that base URL + <code>/api/payment/webhook</code>. In developer.paypal.com → Webhooks, add this URL and subscribe to <strong>BILLING.SUBSCRIPTION.CANCELLED</strong>, <strong>BILLING.SUBSCRIPTION.SUSPENDED</strong>, <strong>BILLING.SUBSCRIPTION.EXPIRED</strong>, <strong>BILLING.SUBSCRIPTION.PAYMENT.FAILED</strong>. When a subscription defaults, the user is downgraded to Basic. Copy the Webhook ID below after creating the webhook.</p>
              </div>
              <div className="form-group">
                <label className="form-label">Webhook ID</label>
                <input
                  className="form-input"
                  value={paypalWebhookId}
                  onChange={e=>setPaypalWebhookId(e.target.value)}
                  placeholder="e.g. 1JE4291016473214C (from PayPal after creating webhook)"
                />
              </div>
              <button type="button" className="btn btn-primary" style={{width:"fit-content"}} onClick={handleSavePaymentConfig} disabled={paymentConfigSaving}>
                {paymentConfigSaving ? "Saving…" : "Save"}
              </button>
            </div>
          )}
        </div>
      )}

      {tab==="payment" && (
        <div className="card" style={{maxWidth:520,padding:24,marginTop:24}}>
          <div className="settings-title">Plan prices</div>
          <p className="text-muted" style={{marginBottom:16}}>Set the monthly price shown for each plan (currency is set in PayPal config above).</p>
          {planPricesError && <div className="alert alert-danger" style={{marginBottom:16}}>{planPricesError}</div>}
          <div style={{display:"flex",flexDirection:"column",gap:20}}>
            {planPrices.map((p) => (
              <div key={p.client_role_id} className="card" style={{padding:16}}>
                <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",marginBottom:12}}>
                  <span style={{minWidth:100,fontWeight:600}}>{p.client_role}</span>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{color:"var(--text3)"}}>{({BWP:"P",USD:"$",EUR:"€",ZAR:"R",GBP:"£"}[currencyCode] || currencyCode)}</span>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      className="form-input"
                      style={{width:100}}
                      value={p.sub_price ?? ""}
                      onChange={e=>setPlanPrice(p.client_role_id, e.target.value)}
                    />
                    <span style={{color:"var(--text3)"}}>/month</span>
                  </div>
                </div>
                <div className="form-group" style={{marginBottom:10}}>
                  <label className="form-label">Description (optional)</label>
                  <textarea
                    className="form-input"
                    rows={2}
                    placeholder="Short plan description"
                    value={p.plan_description ?? ""}
                    onChange={e=>setPlanDescription(p.client_role_id, e.target.value)}
                  />
                </div>
                <div className="form-group" style={{marginBottom:0}}>
                  <label className="form-label">Features (one per line)</label>
                  <textarea
                    className="form-input"
                    rows={3}
                    placeholder="List products & services&#10;Standard placement&#10;Community access"
                    value={Array.isArray(p.plan_features) ? p.plan_features.join('\n') : (p.plan_features || '')}
                    onChange={e=>setPlanFeatures(p.client_role_id, e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>
          <button type="button" className="btn btn-primary" style={{width:"fit-content",marginTop:16}} onClick={handleSavePlanPrices} disabled={planPricesSaving || planPrices.length === 0}>
            {planPricesSaving ? "Saving…" : "Save prices"}
          </button>
        </div>
      )}
    </div>
  );
}

function MessagesPage({ user, setScreen, openWithClientId, clearOpenWithClientId, onUnreadChange }) {
  const { toast, confirm } = useNotifications();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [peer, setPeer] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [newBody, setNewBody] = useState("");
  const [sending, setSending] = useState(false);
  const [deletingConversation, setDeletingConversation] = useState(false);
  const notifiedUnreadRef = useRef(new Set());
  const POLL_INTERVAL_MS = 12000;

  useEffect(() => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") Notification.requestPermission();
  }, []);

  const fetchConversations = useCallback(() => {
    return api("/api/messages/conversations")
      .then((list) => {
        const next = list || [];
        setConversations(next);
        const total = next.reduce((s, c) => s + (c.unread_count || 0), 0);
        if (typeof onUnreadChange === "function") onUnreadChange(total);
        next.forEach((c) => {
          if (c.unread_count > 0 && c.other_id !== selectedId && !notifiedUnreadRef.current.has(c.other_id)) {
            notifiedUnreadRef.current.add(c.other_id);
            if (typeof window !== "undefined" && window.Notification && Notification.permission === "granted") {
              try {
                new Notification("Mmaraka", { body: `New message from @${c.other_username}` });
              } catch (_) {}
            }
          }
        });
      })
      .catch(() => {});
  }, [selectedId, onUnreadChange]);

  const fetchMessages = useCallback((withId) => {
    if (!withId) return Promise.resolve();
    return api(`/api/messages?with=${withId}`).then(setMessages).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchConversations()
      .catch((err) => { setError(err.message); setConversations([]); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      fetchConversations();
      if (selectedId) fetchMessages(selectedId);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchConversations, fetchMessages, selectedId]);

  useEffect(() => {
    if (openWithClientId) {
      setSelectedId(openWithClientId);
      notifiedUnreadRef.current.delete(openWithClientId);
      clearOpenWithClientId?.();
      api(`/api/messages/peer/${openWithClientId}`)
        .then(setPeer)
        .catch(() => setPeer(null));
    }
  }, [openWithClientId, clearOpenWithClientId]);

  const otherId = selectedId;
  useEffect(() => {
    if (!otherId) {
      setMessages([]);
      setPeer((p) => (p && p.client_id === otherId ? p : null));
      return;
    }
    notifiedUnreadRef.current.delete(otherId);
    setMessagesLoading(true);
    api(`/api/messages?with=${otherId}`)
      .then((list) => {
        setMessages(list);
        setConversations((prev) => {
          const has = prev.some((c) => c.other_id === otherId);
          if (has) return prev.map((c) => (c.other_id === otherId ? { ...c, unread_count: 0 } : c));
          return prev;
        });
        api("/api/messages/unread-count").then((d) => { if (typeof onUnreadChange === "function") onUnreadChange(d.count || 0); }).catch(() => {});
      })
      .catch(() => setMessages([]))
      .finally(() => setMessagesLoading(false));
    api(`/api/messages/peer/${otherId}`).then(setPeer).catch(() => setPeer(null));
  }, [otherId]);

  const sendMessage = async () => {
    const body = newBody.trim();
    if (!body || !otherId || sending) return;
    setSending(true);
    try {
      const sent = await api("/api/messages", {
        method: "POST",
        body: JSON.stringify({ recipient_id: otherId, body }),
      });
      setMessages((prev) => [...prev, { ...sent, sender_username: user?.name || "" }]);
      setNewBody("");
      setConversations((prev) => {
        const existing = prev.find((c) => c.other_id === otherId);
        if (existing) {
          return [{ ...existing, last_body: body, last_at: sent.created_at, i_sent_last: true }, ...prev.filter((c) => c.other_id !== otherId)];
        }
        return [{ other_id: otherId, other_username: peer?.username || "User", last_body: body, last_at: sent.created_at, i_sent_last: true, unread_count: 0 }, ...prev];
      });
    } catch (err) {
      toast(err.message || "Failed to send", "error");
    } finally {
      setSending(false);
    }
  };

  const formatTime = (d) => {
    if (!d) return "";
    const dt = new Date(d);
    const now = new Date();
    const sameDay = dt.toDateString() === now.toDateString();
    return sameDay ? dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : dt.toLocaleDateString() + " " + dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const deleteConversation = async () => {
    if (!otherId || deletingConversation) return;
    const ok = await confirm({ title: "Delete chat", message: "Confirm you want to delete this chat?", confirmLabel: "Delete", cancelLabel: "Cancel", danger: true });
    if (!ok) return;
    setDeletingConversation(true);
    try {
      await api(`/api/messages/conversations/${otherId}`, { method: "DELETE" });
      setSelectedId(null);
      setMessages([]);
      setPeer(null);
      fetchConversations();
      api("/api/messages/unread-count").then((d) => { if (typeof onUnreadChange === "function") onUnreadChange(d.count || 0); }).catch(() => {});
    } catch (err) {
      toast(err.message || "Failed to delete conversation", "error");
    } finally {
      setDeletingConversation(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Messages</div>
          <div className="page-subtitle">Chat with buyers and sellers</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "stretch", marginTop: 16 }}>
        <div className="card" style={{ width: 280, minHeight: 360, padding: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: 12, borderBottom: "1px solid var(--border)", fontWeight: 600 }}>Conversations</div>
          {error && <div className="alert alert-danger" style={{ margin: 12 }}>{error}</div>}
          {loading ? (
            <div className="empty"><div className="empty-icon">⏳</div><div className="empty-title">Loading…</div></div>
          ) : conversations.length === 0 ? (
            <div className="empty"><div className="empty-icon">💬</div><div className="empty-title">No conversations yet</div><p className="text-muted" style={{ fontSize: 13 }}>Message a seller from a listing or start from here once you have chats.</p></div>
          ) : (
            <div style={{ flex: 1, overflow: "auto" }}>
              {conversations.map((c) => (
                <div
                  key={c.other_id}
                  onClick={() => setSelectedId(c.other_id)}
                  style={{
                    padding: "12px 16px",
                    cursor: "pointer",
                    borderBottom: "1px solid var(--border)",
                    background: selectedId === c.other_id ? "var(--accent-lt)" : undefined,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong>@{c.other_username}</strong>
                    {c.unread_count > 0 && <span className="chip chip-avail" style={{ fontSize: 11 }}>{c.unread_count}</span>}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.i_sent_last && "You: "}{c.last_body || "—"}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>{c.last_at ? formatTime(c.last_at) : ""}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="card" style={{ flex: 1, minWidth: 280, minHeight: 360, padding: 0, display: "flex", flexDirection: "column" }}>
          {!otherId ? (
            <div className="empty" style={{ flex: 1 }}><div className="empty-icon">💬</div><div className="empty-title">Select a conversation</div><p className="text-muted" style={{ fontSize: 13 }}>Choose a chat from the list or message someone from a listing.</p></div>
          ) : (
            <>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontWeight: 600 }}>@{peer?.username || otherId}</span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ color: "var(--danger)" }}
                  disabled={deletingConversation}
                  onClick={deleteConversation}
                  title="Delete conversation"
                >
                  {deletingConversation ? "…" : "Delete conversation"}
                </button>
              </div>
              <div style={{ flex: 1, overflow: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                {messagesLoading ? (
                  <div className="empty"><div className="empty-icon">⏳</div><div className="empty-title">Loading…</div></div>
                ) : (
                  messages.map((m) => {
                    const isMe = m.sender_id === user?.client_id;
                    return (
                      <div key={m.message_id} style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start" }}>
                        <div style={{ maxWidth: "75%", padding: "8px 12px", borderRadius: 12, background: isMe ? "var(--accent)" : "var(--border)", color: isMe ? "white" : "var(--text)" }}>
                          {!isMe && <div style={{ fontSize: 10, color: "var(--text3)", marginBottom: 2 }}>@{m.sender_username}</div>}
                          <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{m.body}</div>
                          <div style={{ fontSize: 10, opacity: 0.8, marginTop: 4 }}>{formatTime(m.created_at)}</div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <div style={{ padding: 12, borderTop: "1px solid var(--border)", display: "flex", gap: 8 }}>
                <input
                  className="form-input"
                  placeholder="Type a message…"
                  value={newBody}
                  onChange={(e) => setNewBody(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMessage())}
                  style={{ flex: 1 }}
                />
                <button type="button" className="btn btn-primary" onClick={sendMessage} disabled={sending || !newBody.trim()}>{sending ? "…" : "Send"}</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ReportPage({ setScreen }) {
  const { toast } = useNotifications();
  const [form, setForm] = useState({ subject: "", desc: "" });
  const [screenshot, setScreenshot] = useState(null);
  const [screenshotPreview, setScreenshotPreview] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleScreenshotChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      setScreenshot(null);
      setScreenshotPreview(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file (e.g. PNG, JPG)");
      return;
    }
    setError(null);
    setScreenshot(file);
    const reader = new FileReader();
    reader.onload = () => setScreenshotPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const removeScreenshot = () => {
    setScreenshot(null);
    setScreenshotPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async () => {
    if (!form.desc.trim()) {
      setError("Please describe the issue.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      let screenshot_path = null;
      if (screenshot) {
        screenshot_path = await uploadImage(screenshot);
      }
      await api("/api/misc/report-error", {
        method: "POST",
        body: JSON.stringify({
          subject: form.subject.trim() || null,
          description: form.desc.trim(),
          screenshot_path,
        }),
      });
      setForm({ subject: "", desc: "" });
      removeScreenshot();
      toast("Thank you for helping us smash bugs!", "success");
    } catch (err) {
      setError(err.message || "Failed to send report");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div><div className="page-title">Report an Issue</div><div className="page-subtitle">Let us know if something isn't working</div></div>
      </div>
      <div className="report-wrap">
        <div className="form-grid" style={{gap:18}}>
          {error && <div className="alert alert-danger">{error}</div>}
          <div className="form-group">
            <label className="form-label">Subject</label>
            <input className="form-input" placeholder="Brief description of the problem" value={form.subject} onChange={e=>set("subject",e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Details<span style={{color:"var(--danger)"}}>*</span></label>
            <textarea className="form-textarea" style={{minHeight:140}} placeholder="Please describe the issue in as much detail as possible…" value={form.desc} onChange={e=>set("desc",e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Screenshot (optional)</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="form-input"
              onChange={handleScreenshotChange}
              style={{padding:8}}
            />
            {screenshotPreview && (
              <div style={{marginTop:10,position:"relative",display:"inline-block"}}>
                <img src={screenshotPreview} alt="Screenshot preview" style={{maxWidth:280,maxHeight:200,objectFit:"contain",borderRadius:8,border:"1px solid var(--border)"}} />
                <button type="button" className="btn btn-ghost btn-sm" style={{position:"absolute",top:4,right:4,background:"rgba(0,0,0,.6)",color:"#fff"}} onClick={removeScreenshot} aria-label="Remove screenshot">×</button>
              </div>
            )}
          </div>
          <button className="btn btn-primary" style={{width:"fit-content"}} onClick={handleSubmit} disabled={sending}>
            {sending ? "Sending…" : "Send Report"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TermsPage({ setScreen }) {
  return (
    <div className="page">
      <div className="page-header">
        <div><div className="page-title">Terms & Conditions</div><div className="page-subtitle">Please read carefully before using Mmaraka</div></div>
        <button className="btn btn-primary" onClick={()=>setScreen("products")}>Back to Mmaraka</button>
      </div>
      <div className="card" style={{padding:"28px 32px",maxWidth:700}}>
        <div className="terms-body">
          <h3>1. Acceptance of Terms</h3>
          <p>By accessing or using Mmaraka, you agree to be bound by these terms. If you do not agree, please do not use the platform.</p>
          <h3>2. Mmaraka Role</h3>
          <p>Mmaraka is a platform that facilitates peer-to-peer buying and selling of second-hand goods. We do not process payments or act as a party to any transaction between buyers and sellers.</p>
          <h3>3. User Accounts</h3>
          <p>You must be 18 years or older to register. You are responsible for keeping your credentials secure. Each person may hold one account only.</p>
          <h3>4. Listings</h3>
          <p>All product listings are the sole responsibility of the seller. Listings remain active for 3 days and may be reinstated up to 2 times. After the reinstatement limit is reached or 7 days of dormancy, listings are permanently removed.</p>
          <h3>5. Prohibited Content</h3>
          <p>You may not list illegal items, counterfeit goods, stolen property, or any item that violates applicable laws. Mmaraka reserves the right to remove any listing and suspend any account at its sole discretion.</p>
          <h3>6. Services Directory</h3>
          <p>Service listings are advertising tools only. Mmaraka does not vet, endorse, or guarantee any service provider or the quality of their work.</p>
          <h3>7. Subscriptions</h3>
          <p>Subscription fees are charged in the local currency of your registered location. Fees are non-refundable. Subscription benefits apply to listing placement and advertising visibility only.</p>
          <h3>8. Privacy</h3>
          <p>We collect only the data necessary to operate the platform. We do not sell personal data to third parties. Advertising on the platform is served through the service listings you interact with.</p>
          <h3>9. Limitation of Liability</h3>
          <p>Mmaraka is not liable for any transaction, dispute, loss, or damage arising from use of the platform. Users transact entirely at their own risk.</p>
          <h3>10. Changes to Terms</h3>
          <p>We may update these terms at any time. Continued use of the platform constitutes acceptance of updated terms.</p>
        </div>
      </div>
    </div>
  );
}

// ─── Login / Signup ──────────────────────────────────────────────────────────
function AuthScreen({ onLogin }) {
  const { toast } = useNotifications();
  const [mode, setMode] = useState("login"); // login | signup | forgot
  const [form, setForm] = useState({ username:"", email:"", password:"", password2:"", whatsapp:"", location:"", location_id: null, terms:false, countryCode:"+267" });
  const [locations, setLocations] = useState([]);
  const [errors, setErrors] = useState({});
  const [pwdStrength, setPwdStrength] = useState(0);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  useEffect(() => {
    if (mode === "login") {
      setForm(f => ({ ...f, email: "", password: "" }));
      setErrors({});
    }
  }, [mode]);

  useEffect(() => {
    if (mode !== "signup") return;
    api("/api/misc/locations").then(setLocations).catch(() => {});
  }, [mode]);

  const checkPwd = (v) => {
    set("password",v);
    let s=0;
    if(v.length>=6) s++;
    if(/[A-Z]/.test(v)) s++;
    if(/[0-9!@#$%^&*]/.test(v)) s++;
    setPwdStrength(s);
  };

  const handleLogin = async () => {
    if (!form.email || !form.password) { setErrors({ login: "Please enter your email and password." }); return; }
    try {
      const data = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: form.email.trim(), password: form.password }),
      });
      if (typeof window !== "undefined") window.__marketplace_token = data.access_token;
      onLogin({
        name: data.user.username,
        email: data.user.email,
        isAdmin: !!data.user.is_admin,
        client_id: data.user.client_id,
        client_role_id: data.user.client_role_id,
        client_role: data.user.client_role,
        location_id: data.user.location_id,
        location_name: data.user.location_name,
      });
    } catch (err) {
      setErrors({ login: err.message || "Invalid credentials" });
    }
  };

  const handleSignup = async () => {
    const e = {};
    if (!form.username.trim()) e.username = "Username is required";
    if (!form.email.includes("@")) e.email = "Enter a valid email";
    if (form.password.length < 6) e.password = "Password must be at least 6 characters";
    if (form.password !== form.password2) e.password2 = "Passwords do not match";
    if (!form.terms) e.terms = "You must accept the terms and conditions";
    setErrors(e);
    if (Object.keys(e).length === 0) {
      try {
        await api("/api/auth/register", {
          method: "POST",
          body: JSON.stringify({
            username: form.username.trim(),
            email: form.email.trim(),
            password: form.password,
            whatsapp: (() => {
              const digits = (form.whatsapp || "").replace(/\D/g, "");
              return digits.length ? digits : undefined;
            })(),
            country_code: (form.whatsapp || "").trim().length ? (form.countryCode || "+267") : undefined,
            location_id: form.location_id || undefined,
            first_name: form.first_name?.trim() || undefined,
            last_name: form.last_name?.trim() || undefined,
          }),
        });
        setErrors({});
        setMode("login");
      } catch (err) {
        setErrors({ signup: err.message || "Registration failed" });
      }
    }
  };

  return (
    <div className="login-screen">
      <div className="login-left">
        <div className="login-brand">
          <div className="login-illustration">🛒</div>
          <div className="login-brand-name">Mmaraka</div>
          <div className="login-brand-tagline">Your local second-hand marketplace.<br/>Buy, sell, and discover services near you.</div>
        </div>
      </div>
      <div className="login-right">
        {mode==="login" && <>
          <div className="login-title">Welcome back</div>
          <div className="login-sub">Sign in to your Mmaraka account</div>
          {errors.login && <div className="alert alert-danger" style={{width:"100%"}}>{errors.login}</div>}
          <div className="login-form">
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" placeholder="you@example.com" value={form.email} onChange={e=>set("email",e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleLogin()} />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input className="form-input" type="password" placeholder="••••••••" value={form.password} onChange={e=>set("password",e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleLogin()} />
              <div className="forgot-link" onClick={()=>setMode("forgot")}>Forgot password?</div>
            </div>
            <button className="btn btn-primary w-full" onClick={handleLogin}>Sign In</button>
          </div>
          <div className="login-switch">Don't have an account? <a onClick={()=>{setErrors({});setMode("signup")}}>Sign up</a></div>
        </>}

        {mode==="signup" && <>
          <div className="login-title">Create account</div>
          <div className="login-sub">Join the local marketplace today</div>
          {errors.signup && <div className="alert alert-danger" style={{width:"100%"}}>{errors.signup}</div>}
          <div className="login-form">
            <div className="form-group">
              <label className="form-label">Username<span style={{color:"var(--danger)"}}>*</span></label>
              <input className="form-input" placeholder="Choose a username" value={form.username} onChange={e=>set("username",e.target.value)} />
              {errors.username&&<span className="form-error">{errors.username}</span>}
            </div>
            <div className="form-group">
              <label className="form-label">Email<span style={{color:"var(--danger)"}}>*</span></label>
              <input className="form-input" type="email" placeholder="you@example.com" value={form.email} onChange={e=>set("email",e.target.value)} />
              {errors.email&&<span className="form-error">{errors.email}</span>}
            </div>
            <div className="form-group">
              <label className="form-label">WhatsApp</label>
              <div className="phone-row">
                <select className="form-select country-select" value={form.countryCode} onChange={e=>set("countryCode",e.target.value)}>
                  <option value="+267">🇧🇼 +267</option>
                  <option value="+27">🇿🇦 +27</option>
                </select>
                <input className="form-input" placeholder="7123 4567" value={form.whatsapp} onChange={e=>set("whatsapp",e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Password<span style={{color:"var(--danger)"}}>*</span></label>
              <input className="form-input" type="password" placeholder="Min. 6 characters" value={form.password} onChange={e=>checkPwd(e.target.value)} />
              {form.password&&<div className="pwd-strength">{[0,1,2].map(i=><div key={i} className={`pwd-bar ${i<pwdStrength?pwdStrength===1?"weak":pwdStrength===2?"fair":"strong":""}`}/>)}</div>}
              {errors.password&&<span className="form-error">{errors.password}</span>}
            </div>
            <div className="form-group">
              <label className="form-label">Confirm Password<span style={{color:"var(--danger)"}}>*</span></label>
              <input className="form-input" type="password" placeholder="••••••••" value={form.password2} onChange={e=>set("password2",e.target.value)} />
              {errors.password2&&<span className="form-error">{errors.password2}</span>}
            </div>
            <div className="form-grid form-grid-2">
            <div className="form-group">
              <label className="form-label">Location</label>
              <select className="form-select" value={form.location_id ?? ""} onChange={e=>{ const v = e.target.value; set("location_id", v ? parseInt(v,10) : null); set("location", v); }}>
                <option value="">Select town…</option>
                {locations.map(l=> <option key={l.location_id} value={l.location_id}>{l.location_name}</option>)}
              </select>
            </div>
            </div>
            <div className="checkbox-row">
              <input type="checkbox" id="terms" checked={form.terms} onChange={e=>set("terms",e.target.checked)} />
              <label htmlFor="terms">I have read and agree to the <a onClick={()=>setMode("terms")}>Terms & Conditions</a></label>
            </div>
            {errors.terms&&<span className="form-error">{errors.terms}</span>}
            <button className="btn btn-primary w-full" onClick={handleSignup}>Create Account</button>
          </div>
          <div className="login-switch">Already have an account? <a onClick={()=>{setErrors({});setMode("login")}}>Sign in</a></div>
        </>}

        {mode==="forgot" && <>
          <div className="login-title">Reset password</div>
          <div className="login-sub">We'll send a reset link to your email</div>
          <div className="login-form">
            <div className="form-group">
              <label className="form-label">Email address</label>
              <input className="form-input" type="email" placeholder="you@example.com"
                value={form.email} onChange={e=>set("email", e.target.value)} />
            </div>
            <button className="btn btn-primary w-full" onClick={async ()=>{
              if (!form.email) { toast("Please enter your email address.", "error"); return; }
              try {
                await api("/api/auth/forgot-password", { method:"POST", body: JSON.stringify({ email: form.email }) });
                toast("✅ Reset link sent! Check your email.", "success");
                setMode("login");
              } catch(e) {
                toast(e.message || "Failed to send reset link.", "error");
              }
            }}>Send Reset Link</button>
          </div>
          <div className="login-switch"><a onClick={()=>setMode("login")}>← Back to sign in</a></div>
        </>}

        {mode==="terms" && <>
          <div className="login-title" style={{fontSize:22}}>Terms & Conditions</div>
          <div style={{overflow:"auto",flex:1,marginTop:16,fontSize:13,color:"var(--text2)",lineHeight:1.7}}>
            <p><strong>1. Acceptance</strong> — By signing up you agree to these terms.</p>
            <p><strong>2. Mmaraka Role</strong> — We facilitate listings only; we do not process payments or guarantee transactions.</p>
            <p><strong>3. Listings</strong> — Active for 3 days, reinstatable up to 2 times, deleted after 7 dormant days.</p>
            <p><strong>4. Prohibited Items</strong> — No illegal, stolen, or counterfeit goods. Violations result in account suspension.</p>
            <p><strong>5. Privacy</strong> — Your data is used only to operate the platform and is never sold to third parties.</p>
            <p><strong>6. Liability</strong> — Mmaraka bears no liability for transactions, disputes, or losses.</p>
          </div>
          <button className="btn btn-outline" style={{marginTop:20,width:"100%"}} onClick={()=>setMode("signup")}>← Back to Sign Up</button>
        </>}
      </div>
    </div>
  );
}

// ─── App Shell ────────────────────────────────────────────────────────────────
const NAV = [
  { id:"products",    label:"Mmaraka",  icon:"🛍️" },
  { id:"services",    label:"Services",     icon:"🏢" },
  { id:"my-listings", label:"My Listings",  icon:"📋" },
  { id:"messages",    label:"Messages",     icon:"💬" },
  { id:"settings",    label:"Settings",     icon:"⚙️" },
  { id:"report",      label:"Report Issue", icon:"🐛" },
  { id:"terms",       label:"Terms & Conditions", icon:"📜" },
];

/** Root App: restores token from localStorage, holds screen state and user; renders AuthScreen or main layout with sidebar and current page. */
export default function App() {
  const [user, setUser] = useState(null);
  const [screen, setScreen] = useState("products");
  const [editListingId, setEditListingId] = useState(null);
  const [editServiceId, setEditServiceId] = useState(null);
  const [returnTo, setReturnTo] = useState(null);
  const [adverts, setAdverts] = useState([]);
  const [messageWithClientId, setMessageWithClientId] = useState(null);
  const [messagesUnreadCount, setMessagesUnreadCount] = useState(0);
  const [selectedServiceId, setSelectedServiceId] = useState(null);

  useEffect(() => {
    const token = typeof window !== "undefined" && localStorage.getItem("marketplace_token");
    if (!token) return;
    window.__marketplace_token = token;
    api("/api/auth/me")
      .then((u) => {
        setUser({
          name: u.username,
          email: u.email,
          isAdmin: !!u.is_admin,
          client_id: u.client_id,
          client_role_id: u.client_role_id,
          client_role: u.client_role,
          location_id: u.location_id,
          location_name: u.location_name,
        });
      })
      .catch(() => {
        localStorage.removeItem("marketplace_token");
        delete window.__marketplace_token;
      });
  }, []);

  useEffect(() => {
    api("/api/misc/adverts").then(setAdverts).catch(() => setAdverts([]));
  }, []);

  useEffect(() => {
    if (!user) return;
    const fetchUnread = () => api("/api/messages/unread-count").then((d) => setMessagesUnreadCount(d.count || 0)).catch(() => setMessagesUnreadCount(0));
    fetchUnread();
    const id = setInterval(fetchUnread, 15000);
    return () => clearInterval(id);
  }, [user]);

  const handleLogin = (u) => {
    setUser(u);
    setScreen("products");
    const token = window.__marketplace_token;
    if (token) localStorage.setItem("marketplace_token", token);
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("marketplace_token");
    delete window.__marketplace_token;
  };

  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!user) return (
    <>
      <style>{css}</style>
      <NotificationProvider>
        <AuthScreen onLogin={handleLogin} />
      </NotificationProvider>
    </>
  );

  const navItems = user.isAdmin
    ? [...NAV, { id:"admin", label:"Admin Panel", icon:"🛠️" }]
    : NAV;

  const renderPage = () => {
    switch(screen) {
      case "products":    return <ProductsPage user={user} setScreen={setScreen} setEditListingId={setEditListingId} setReturnTo={setReturnTo} setMessageWithClientId={setMessageWithClientId} />;
      case "add-product": return <AddProductPage setScreen={setScreen} editListingId={editListingId} setEditListingId={setEditListingId} returnTo={returnTo ?? "products"} />;
      case "services":    return <ServicesPage user={user} setScreen={setScreen} setEditServiceId={setEditServiceId} setReturnTo={setReturnTo} setMessageWithClientId={setMessageWithClientId} selectedServiceId={selectedServiceId} setSelectedServiceId={setSelectedServiceId} />;
      case "add-service": return <AddServicePage setScreen={setScreen} editServiceId={editServiceId} setEditServiceId={setEditServiceId} returnTo={returnTo ?? "services"} />;
      case "my-listings": return <MyListingsPage user={user} setScreen={setScreen} setEditListingId={setEditListingId} setEditServiceId={setEditServiceId} setReturnTo={setReturnTo} setMessageWithClientId={setMessageWithClientId} />;
      case "messages":    return <MessagesPage user={user} setScreen={setScreen} openWithClientId={messageWithClientId} clearOpenWithClientId={()=>setMessageWithClientId(null)} onUnreadChange={setMessagesUnreadCount} />;
      case "settings":    return <SettingsPage user={user} setScreen={setScreen} onProfileUpdate={u => { if (u && Object.keys(u).length === 0) { api("/api/auth/me").then(me => setUser(prev => ({ ...prev, name: me.username, email: me.email, client_id: me.client_id, client_role_id: me.client_role_id, client_role: me.client_role, isAdmin: !!me.is_admin, location_id: me.location_id, location_name: me.location_name }))); } else if (u) setUser(prev => ({ ...prev, ...u })); }} />;
      case "report":      return <ReportPage setScreen={setScreen} />;
      case "terms":       return <TermsPage setScreen={setScreen} />;
      case "admin":       return <AdminPage />;
      default:            return <ProductsPage user={user} setScreen={setScreen} setEditListingId={setEditListingId} setReturnTo={setReturnTo} setMessageWithClientId={setMessageWithClientId} />;
    }
  };

  return (
    <>
      <style>{css}</style>
      <NotificationProvider>
      <div className="app">
        {/* Header */}
        <header className="header">
          <button type="button" className="header-menu-btn" onClick={() => setSidebarOpen(true)} aria-label="Open menu">☰</button>
          <div className="header-logo" onClick={()=>setScreen("products")}>
            Mmaraka
            {user.location_name && <span className="header-logo-sub">{user.location_name}</span>}
          </div>
          <div className="header-spacer" />
          {user.isAdmin && <span className="chip chip-avail" style={{fontSize:11}}>Admin</span>}
          <div className="header-user" onClick={()=>{ setScreen("settings"); setSidebarOpen(false); }}>
            <div className={`avatar ${user.isAdmin?"gold":""}`}>{user.name[0].toUpperCase()}</div>
            <span style={{fontSize:14,fontWeight:500}}>{user.name}</span>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={handleLogout}>Sign out</button>
        </header>

        <div className="body">
          <div className={`sidebar-overlay ${sidebarOpen ? "is-open" : ""}`} onClick={() => setSidebarOpen(false)} aria-hidden="true" />
          <nav className={`sidebar ${sidebarOpen ? "is-open" : ""}`}>
            <div className="nav-section">Menu</div>
            {navItems.map(n=>(
              <div key={n.id} className={`nav-item${screen===n.id||screen===`add-${n.id}`?" active":""}`} onClick={()=>{ setScreen(n.id); setSidebarOpen(false); }}>
                <span className="icon">{n.icon}</span>
                {n.label}
                {n.id === "messages" && messagesUnreadCount > 0 && (
                  <span className="nav-unread" aria-label={`${messagesUnreadCount} unread`}>
                    {messagesUnreadCount > 99 ? "99+" : messagesUnreadCount}
                  </span>
                )}
              </div>
            ))}
            <div style={{flex:1}} />
            <div className="nav-section">Account</div>
            <div className="nav-item" onClick={()=>{ handleLogout(); setSidebarOpen(false); }}>
              <span className="icon">🚪</span> Sign Out
            </div>
          </nav>

          {/* Main */}
          <main className="main">
            {renderPage()}
            <AdBanner ads={adverts} onAdClick={(ad)=>{ if (ad.service_id != null) { setSelectedServiceId(ad.service_id); setScreen("services"); } }} />
          </main>
        </div>
      </div>
      </NotificationProvider>
    </>
  );
}

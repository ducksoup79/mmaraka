# Deploy backend on a VPS

Steps to run the Mmaraka API on a VPS (e.g. DigitalOcean, Linode, AWS EC2) so the mobile app and password reset/verification emails work.

## Prerequisites

- **Node.js** 18+ on the VPS
- **PostgreSQL** 14+ (on the same VPS or managed DB)
- **Domain** (optional but recommended for HTTPS and `PASSWORD_RESET_BASE_URL`)

## 1. Server setup

- Install Node 18+, PostgreSQL, and (if using) Nginx or Caddy for reverse proxy.
- Create the database and run schema/seed (same as local: `npm run setup` or your migration flow).
- Copy `.env.example` to `.env` and set at least:
  - `DB_*`, `JWT_SECRET`, `REFRESH_TOKEN_SECRET`
  - `ADMIN_PASSWORD` if you use the seeded admin user

## 2. Email (Gmail SMTP) – no mail server on the VPS

The backend does **not** run an SMTP server. It connects **outbound** to Gmail to send mail.

- You do **not** need Postfix, Sendmail, or any mail server on the VPS.
- In `.env` set:
  - `SMTP_HOST=smtp.gmail.com`
  - `SMTP_PORT=587`
  - `SMTP_SECURE=false`
  - `SMTP_USER=yourname@gmail.com`
  - `SMTP_PASS=<16-char Gmail App Password>`  
    (Google Account → Security → 2-Step Verification → App passwords.)
  - `MAIL_FROM=yourname@gmail.com` (or same as `SMTP_USER`)
  - `PASSWORD_RESET_BASE_URL=https://your-domain.com` (or your app’s reset URL)

Restart the backend after changing `.env`. Use **GET /api/admin/test-email** (with admin auth) to verify SMTP from the VPS.

## 3. Firewall

- **Inbound:** Open only what your app needs (e.g. 80, 443 for HTTP/HTTPS). Do **not** open port 587 inbound.
- **Outbound:** The app initiates connections to `smtp.gmail.com:587`. Most VPS firewalls allow outbound traffic by default, so you usually do **not** need to allow port 587 explicitly.  
  If your provider blocks outbound SMTP, add an **egress** rule allowing TCP 587 (and 465 if you use it) to the internet.

**Example (UFW on Ubuntu):**

```bash
# Allow SSH, HTTP, HTTPS inbound
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
# Outbound 587 is allowed by default; no rule needed for Gmail.
```

## 4. Run the API

- Use a process manager (e.g. **PM2**): `pm2 start src/index.js --name mmaraka-api` (or your entry script).
- Put Nginx/Caddy in front and proxy to the Node port (e.g. 3001).
- Use HTTPS (e.g. Let’s Encrypt) so `PASSWORD_RESET_BASE_URL` and cookies work correctly.

## Where to find logs on the server

Backend logs (including email errors) go to **stdout** and **stderr**. Where you see them depends on how you run the app.

### If you use PM2

- **Live tail (recommended):**
  ```bash
  pm2 logs
  ```
  Or only your API app:
  ```bash
  pm2 logs mmaraka-api
  ```
- **Log file locations** (PM2’s default):
  - **stdout:** `~/.pm2/logs/mmaraka-api-out.log`
  - **stderr:** `~/.pm2/logs/mmaraka-api-error.log`
- **View last lines:**
  ```bash
  pm2 logs mmaraka-api --lines 200
  ```
- **Search for email-related errors:**
  ```bash
  grep -E 'forgot-password|verification email|send email failed' ~/.pm2/logs/mmaraka-api-error.log
  ```

Email send failures are logged as:
- `[forgot-password] send email failed: ...`
- `[register] verification email failed: ...`

### If you run with `node` directly

- Logs appear in the terminal. If you run in the background (e.g. `node src/index.js &` or via `nohup`), check wherever you redirected output (e.g. `nohup node src/index.js >> app.log 2>&1` → `app.log`).

### See the exact SMTP error without reading logs

Call the admin endpoint with a **valid access token** (from logging in as an admin user), not the JWT secret.

**Step 1 – Get an admin access token**

Log in as the seeded admin user (username `admin`, email `admin@marketplace.com`, password = `ADMIN_PASSWORD` from your `.env`, e.g. `admin123`):

```bash
curl -s -X POST https://api.mmaraka.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@marketplace.com","password":"YOUR_ADMIN_PASSWORD"}'
```

From the response, copy the `access_token` value (long string, not the refresh_token).

**Step 2 – Call test-email with that token**

```bash
curl -s -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE" https://api.mmaraka.com/api/admin/test-email
```

Replace `YOUR_ACCESS_TOKEN_HERE` with the token from step 1. The response will show `ok: true` or the exact SMTP error.

## 5. Quick checklist

| Item | Action |
|------|--------|
| SMTP on VPS | Not needed; app is SMTP client only |
| Open port 587 inbound | No |
| Outbound 587 | Usually already allowed; allow egress 587 only if your host blocks it |
| `.env` Gmail | App Password in `SMTP_PASS`, correct `SMTP_USER` / `MAIL_FROM` |
| Test email | `GET /api/admin/test-email` with admin JWT |

# Run backend locally on this computer

Steps to run the API server on your machine (same as “deploy locally”).

## Prerequisites

- **Node.js** 18+  
- **PostgreSQL** 14+ running locally (e.g. via Postgres.app, Homebrew `brew services start postgresql`, or Docker).

## 1. Go to the backend folder

```bash
cd /Users/johannesgroenewald/Desktop/Buy_Sell/production/mobile_testing/backend
```

## 2. Install dependencies

```bash
npm install
```

## 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set at least:

- **`DB_PASSWORD`** – PostgreSQL password for `DB_USER` (default user `postgres`).
- **`JWT_SECRET`** – Any long random string (e.g. 32+ chars) for signing tokens.
- **`REFRESH_TOKEN_SECRET`** – Same or another long random string.

Optional:

- **`PORT`** – Default `3001`.
- **`ADMIN_PASSWORD`** – Password for the seeded admin user (default `admin123`).

## 4. Create database and seed data (first time only)

```bash
npm run setup
```

This will:

- Create the `marketplace` database if it doesn’t exist.
- Apply the schema (tables).
- Insert seed data: locations, roles, categories, and the admin user (username `admin`, email `admin@marketplace.com`, password = `ADMIN_PASSWORD`).

If you already ran this before, you can skip it.

## 5. Start the server

```bash
npm run dev
```

Or use the helper (creates `.env` from `.env.example` if missing, then starts):

```bash
npm run run-local
```

You should see:

- `MarketPlace API running at http://localhost:3001`
- `Network: http://<this-machine-ip>:3001`

The API is then available at:

- **On this machine:** `http://localhost:3001`
- **From other devices on your LAN (e.g. phone for mobile app):** `http://<your-computer-ip>:3001`

To stop: press `Ctrl+C` in the terminal.

---

## If `npm install` fails with EACCES

Fix npm cache permissions (macOS/Linux), then run `npm install` again:

```bash
sudo chown -R $(whoami) ~/.npm
```

---

## Quick reference

| Command             | Purpose                              |
|---------------------|--------------------------------------|
| `npm install`       | Install dependencies                  |
| `npm run setup`      | Create DB, schema, seed (first time)  |
| `npm run dev`        | Start server with auto-reload         |
| `npm run run-local`  | Ensure .env exists, then start server |
| `npm start`          | Start server (no reload)              |

## If PostgreSQL is not installed

- **macOS (Homebrew):** `brew install postgresql@14` then `brew services start postgresql@14`
- **Postgres.app:** https://postgresapp.com/
- **Docker:** `docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:14`

Then create a user/password that matches your `.env` (e.g. `DB_USER=postgres`, `DB_PASSWORD=postgres`) or run `npm run setup` and use the same credentials in `.env`.

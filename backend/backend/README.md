# MarketPlace — API Server

## Quick Start (local development)

### Prerequisites
- Node.js 18+
- PostgreSQL 14+

### 1. Install dependencies
```
npm install
```

### 2. Configure environment
```
cp .env.example .env
```
Edit `.env` and set:
- `DB_USER` and `DB_PASSWORD` for your local PostgreSQL
- `ADMIN_EMAIL` and `ADMIN_PASSWORD` for the admin account
- `JWT_SECRET` and `REFRESH_TOKEN_SECRET` (any long random strings)

### 3. Set up the database
```
npm run setup
```
This creates the `marketplace` database, applies the schema, and inserts seed data including:
- 4 locations: Maun, Kasane, Gaborone, Francistown
- 3 subscription tiers: Basic (free), Silver (P50), Diamond (P100)
- 12 product categories
- Admin account

### 4. Start the server
```
npm run dev
```
Server runs on http://localhost:3001

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/register | Sign up |
| POST | /api/auth/login | Login |
| GET  | /api/auth/verify-email?token= | Verify email |
| POST | /api/auth/forgot-password | Request reset |
| POST | /api/auth/reset-password | Reset password |
| GET  | /api/auth/me | Get own profile |
| GET  | /api/products | List products |
| POST | /api/products | Create listing |
| PATCH| /api/products/:id/reinstate | Reinstate dormant |
| GET  | /api/services | List services |
| POST | /api/services | Create service |
| GET  | /api/misc/locations | Get all locations |
| GET  | /api/misc/roles | Get subscription tiers |
| POST | /api/misc/report-error | Submit error report |
| GET  | /api/admin/dashboard | Admin stats |
| GET  | /api/admin/tables | Admin: list tables |
| GET  | /api/admin/tables/:table | Admin: view records |
| POST | /api/admin/tables/:table | Admin: insert record |
| PUT  | /api/admin/tables/:table/:id | Admin: update record |
| DELETE | /api/admin/tables/:table/:id | Admin: delete record |

---

## Listing Lifecycle
- Listed for **3 days** → goes **dormant** (owner gets notified)
- Dormant for **7 days** → **deleted** automatically
- Can be reinstated **up to 2 times**

## Subscription Tiers
| Tier | Price | Listing Position |
|------|-------|-----------------|
| Basic | Free | Bottom |
| Silver | P50/month | Middle |
| Diamond | P100/month | Top + rotating banner ad |

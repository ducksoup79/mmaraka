# MarketPlace Frontend

Runs from `index.html` and connects to the MarketPlace backend API.

## Setup

```bash
npm install
```

## Development

1. Start the **backend** (from the `Backend` folder):
   ```bash
   cd ../Backend && npm run dev
   ```
   API runs at `http://localhost:3001`.

2. Start the **frontend**:
   ```bash
   npm run dev
   ```
   App runs at `http://localhost:5173`. Vite proxies `/api` to the backend.

3. Open **http://localhost:5173** in your browser.

## Production build

```bash
npm run build
```

Then serve the `dist` folder (e.g. with a static server or your backend). Set `VITE_API_URL` to your API base URL when building if the API is on a different origin:

```bash
VITE_API_URL=https://api.example.com npm run build
```

## Backend connection

- **Dev:** Requests to `/api/*` are proxied to `http://localhost:3001` (see `vite.config.js`).
- **Production:** Set `VITE_API_URL` to the full API base (e.g. `https://api.example.com`) so the app calls that host.

Login uses **email + password** (POST `/api/auth/login`). Sign up uses POST `/api/auth/register`. Products and services are loaded from GET `/api/products` and GET `/api/services`.

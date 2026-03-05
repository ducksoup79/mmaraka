================================================================================
MMARAKA – DESIGN README (Frontend, Backend, Mobile App)
================================================================================

This file describes how the Mmaraka marketplace code works across the web
frontend, the Node/Express backend, and the React Native (Expo) mobile app.
All three talk to the same backend API and share the same data model.


================================================================================
1. BACKEND (Node.js + Express + PostgreSQL)
================================================================================

Location: mobile_production/backend/

1.1 Entry point and server
--------------------------
- src/index.js
  - Loads .env via dotenv.
  - Creates Express app, enables CORS, mounts JSON body parser.
  - Payment webhook uses express.raw() for signature verification before
    express.json().
  - Serves static files from ../uploads at /uploads (product/service images).
  - Mounts route modules under /api/* (auth, products, services, misc, admin,
    uploads, payment, messages, push-token).
  - GET /health returns { ok: true }.
  - Starts HTTP server on PORT (default 3001), bound to 0.0.0.0.
  - Schedules cleanup jobs: sold product listings older than 3 days, and
    messages older than 7 days (run on boot and every hour).

1.2 Database
------------
- src/db/pool.js
  - Single pg Pool using DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME from
    .env. All routes use this pool for queries.

- schema.sql (and migrations)
  - Core tables: currency, location, client_role, client, product_category,
    product, product_listing, service, service_listing, advert_list,
    error_report. Later migrations add: message, push_token, payment-related
    tables, plan_description/plan_features on client_role, etc.
  - client: username, email, password_hash, client_role_id, location_id,
    verify_token/verify_token_expiry, reset_token/reset_token_expiry, etc.
  - product_listing links product to client (seller), optional buyer_id,
    status (avail|sold|dormant).
  - service belongs to client; service_listing exposes it with position and
    status. advert_list links services for Diamond banner ads.

1.3 Authentication and authorization
------------------------------------
- src/middleware/auth.js
  - verifyToken: reads Authorization: Bearer <token>, verifies JWT with
    JWT_SECRET, loads client (+ role, location) from DB; sets req.user. On
    invalid/missing token or inactive user returns 401.
  - requireAdmin: used after verifyToken; returns 403 if !req.user.is_admin.

- src/routes/auth.js
  - POST /register: body username, email, password (optional: whatsapp,
    location_id, first_name, last_name, country_code). Hashes password
    (bcrypt), inserts client with client_role Basic, sets verify_token and
    verify_token_expiry, calls sendVerificationEmail (no-op if SMTP not set).
  - POST /login: body email (or username), password. Looks up client, checks
    password, updates last_login, returns { access_token, user } (JWT sub =
    client_id).
  - GET /verify-email?token=: validates verify_token, sets client_verified=true,
    clears token/expiry.
  - POST /forgot-password: body email. Generates reset_token, sets
    reset_token_expiry (1 hour), calls sendPasswordResetEmail (no-op if SMTP
    not set). Always returns same success message (no email enumeration).
  - POST /reset-password: body token, new_password. Validates reset_token and
    expiry, updates password_hash, clears reset token.
  - GET /me: verifyToken; returns current user (username, email, client_id,
    is_admin, client_role_id, client_role, location_id, location_name, etc.).
  - PATCH /me: verifyToken; update profile (username, email, whatsapp,
    country_code, location_id, first_name, last_name).
  - POST /change-password: verifyToken; body current_password, new_password;
    updates password_hash.

1.4 Email
---------
- src/lib/email.js
  - getTransporter(): builds nodemailer transport from SMTP_HOST, SMTP_PORT,
    SMTP_SECURE, SMTP_USER, SMTP_PASS (cached). Returns null if SMTP_HOST
    not set.
  - sendPasswordResetEmail(to, token): builds reset URL from
    PASSWORD_RESET_BASE_URL (or BASE_URL), sends HTML/text email with link
    /reset-password?token=... No-op if base URL or transporter missing.
  - sendVerificationEmail(to, token): same pattern for /verify-email?token=...
  - MAIL_FROM from env or SMTP_USER or default noreply@mmaraka.com.

1.5 API routes (summary)
-------------------------
- /api/auth/*          – auth.js (register, login, verify-email, forgot/reset
                          password, me, change-password).
- /api/products        – products.js: GET / (list), GET /mine, GET /:id,
                          POST / (create), PATCH /:id (update), PATCH /:id/buy,
                          DELETE /:id, PATCH /:id/reinstate.
- /api/services         – services.js: GET /, GET /mine, GET /:id, POST /,
                          PATCH /:id, DELETE /:id.
- /api/misc             – misc.js: GET /locations, /roles, /categories, /adverts;
                          POST /report-error (verifyToken).
- /api/admin            – admin.js: all routes use verifyToken + requireAdmin;
                          dashboard, clients CRUD, payment-config, plans/prices,
                          tables, reports, etc.
- /api/uploads/image    – uploads.js: POST, verifyToken, multer single file;
                          saves to backend/uploads/, returns { path: /uploads/... }.
- /api/payment           – payment.js: config, create-order, capture-order,
                          return/cancel, subscription-approved, webhook (raw body).
- /api/messages         – messages.js: verifyToken; unread-count, peer/:id,
                          conversations, GET/POST messages, PATCH read,
                          DELETE conversations/:withId.
- /api/push-token       – push-token.js: POST / (register), DELETE / (remove);
                          verifyToken.

1.6 Uploads and static files
----------------------------
- Uploads are stored under backend/uploads/. Filename: timestamp + random hex
  + extension. Multer limit 5MB, image/* only. Served by Express at /uploads
  so image URLs are API_BASE + path (e.g. /uploads/1234-abc.jpg).

1.7 Background jobs
--------------------
- cleanupSoldProducts: deletes product_listing rows with status=sold and
  updated_at older than 3 days; then deletes product rows that have no
  listings left.
- cleanupOldMessages: deletes message rows older than 7 days.


================================================================================
2. WEB FRONTEND (React + Vite, single-page app)
================================================================================

Location: mobile_production/frontend/

2.1 Entry and routing
---------------------
- index.html loads main.jsx.
- main.jsx: by pathname chooses:
  - /verify-email → VerifyEmailPage (standalone, token in query).
  - /reset-password → ResetPasswordPage (standalone, token in query).
  - Otherwise → App (marketplace-preview.jsx), the main SPA.

No React Router: the main app uses internal state (e.g. screen name) to
render one “page” at a time.

2.2 API and config
------------------
- API_BASE = import.meta.env.VITE_API_URL ?? "" (empty in dev so Vite proxy
  forwards /api to backend).
- api(path, options): fetch to API_BASE+path, JSON body; adds
  Authorization: Bearer window.__marketplace_token if set. Parses JSON, throws
  on !res.ok.
- uploadImage(file): POST to API_BASE + /api/uploads/image, FormData with
  "file"; returns data.path.

2.3 Auth state (main app)
-------------------------
- Token is stored in memory only: window.__marketplace_token.
- On login success the app sets window.__marketplace_token = access_token.
- On logout or 401 it deletes window.__marketplace_token.
- User state (username, email, client_id, is_admin, client_role, etc.) is
  kept in React state and refreshed from GET /api/auth/me when needed (e.g.
  after profile update).

2.4 Screen state and layout
----------------------------
- Root state: screen (string), user, sidebarOpen, editListingId, editServiceId,
  returnTo, messageWithClientId, messagesUnreadCount.
- setScreen("products"|"add-product"|"services"|"add-service"|"my-listings"|
  "messages"|"settings"|"report"|"terms"|"product-detail") switches the main
  content. Edit flows set returnTo and editListingId/editServiceId so that
  AddProductPage/AddServicePage load existing data when editing.
- Layout: header (logo, nav, user avatar), optional sidebar (nav links), body
  with current “page” component. CSS is in a single template literal (design
  tokens: colors, radii, fonts; classes for header, sidebar, cards, forms,
  etc.).

2.5 Main “pages” (components)
------------------------------
- ProductsPage: GET /api/products, filter by search/category; ProductCard grid;
  Add Listing → add-product; edit/delete/message per card.
- AddProductPage: form (photo upload via uploadImage, name, description, price,
  category from GET /api/misc/categories, location). POST /api/products or
  PATCH /api/products/:id; on success setScreen(returnTo). Handles empty/failed
  categories with retry.
- ServicesPage: GET /api/services; service cards; Add Service, Message, Edit.
- AddServicePage: form for service (logo upload, name, description); POST or
  PATCH /api/services.
- MyListingsPage: GET /api/products/mine and /api/services/mine; combined list;
  add product/service, edit, contact buyer, reinstate.
- MessagesPage: GET /api/messages/conversations; list of conversations; select
  peer then GET /api/messages?with=id; send POST /api/messages; mark read
  PATCH /api/messages/read. Can open with openWithClientId (e.g. from product
  “Message seller”).
- SettingsPage: GET /api/auth/me, form to PATCH /api/auth/me; sign out clears
  token and user.
- ReportPage: form (subject, description, optional screenshot); POST
  /api/misc/report-error.
- TermsPage: static terms; link back to products.
- ProductDetailView (product-detail): GET /api/products/:id, show full details,
  Buy / Message.

2.6 Standalone pages
---------------------
- ResetPasswordPage: reads token from ?token=; form new_password; POST
  /api/auth/reset-password.
- VerifyEmailPage: reads token from ?token=; GET /api/auth/verify-email;
  shows success or error.

2.7 Images
----------
- Product/service images: API_BASE + path returned by API (e.g. API_BASE +
  /uploads/xxx.jpg). Rendered in img src or similar. No thumbnail pipeline in
  this frontend; full image URL is used.


================================================================================
3. MOBILE APP (Expo / React Native)
================================================================================

Location: mobile_production/mobile_app/

3.1 Entry and navigation
-------------------------
- App.js: SafeAreaProvider → AuthProvider → AppContent.
- AppContent: if loading (restoring token) shows spinner; if !user shows
  AuthScreen; else NavigationContainer with Stack.Navigator.
- Stack: Main (tabs), ProductDetail, AddProduct, EditProduct, ServiceDetail,
  AddService, EditService, Chat, Subscription.
- Main = Bottom Tab Navigator: Products (ProductsScreen), Services, My Listings,
  Messages, Settings. Each tab is a screen component.

3.2 Auth
--------
- src/AuthContext.js: AuthProvider holds user and loading. On mount loads
  token from AsyncStorage (key marketplace_token), sets it via setAuthToken in
  api.js, calls GET /api/auth/me, sets user state; on failure clears token
  and storage. login(userData, token) saves token to AsyncStorage and
  setAuthToken, sets user, calls registerForPushNotificationsAsync. logout
  clears token, user, AsyncStorage, unregisterPushToken.
- src/api.js: API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'.
  authToken in memory; setAuthToken/getAuthToken used by AuthContext. api(path,
  options) adds Authorization: Bearer authToken, fetch, JSON, throw on !res.ok.
  uploadImage(input): accepts { uri, type, name } or similar, FormData POST to
  /api/uploads/image, returns data.path.

3.3 Screens (summary)
----------------------
- AuthScreen: login/register/forgot-password forms; on success calls onLogin(user,
  token). Uses same /api/auth endpoints as web.
- ProductsScreen: GET /api/products; list with image (API_BASE + product_image_path);
  tap → ProductDetailScreen(listingId).
- ProductDetailScreen: GET /api/products/:id; image, price, message/buy.
- AddProductScreen / EditProductScreen: form with image picker, upload via
  uploadImage, name, description, price, category (GET /api/misc/categories),
  POST or PATCH /api/products.
- ServicesScreen: GET /api/services; list; tap → ServiceDetailScreen.
- ServiceDetailScreen: GET /api/services/:id; logo, message.
- AddServiceScreen / EditServiceScreen: logo upload, name, description; POST or
  PATCH /api/services.
- MyListingsScreen: GET /api/products/mine, /api/services/mine; combined list;
  add/edit product or service, navigate to chat.
- MessagesScreen: GET /api/messages/conversations; tap conversation →
  ChatScreen(with peer id).
- ChatScreen: GET /api/messages?with=id, POST /api/messages; list messages,
  send new.
- SettingsScreen: profile summary, sign out (onLogout), link to Subscription.
- SubscriptionScreen: GET /api/misc/roles, /api/payment/config; upgrade flow.
- AdvertBar (component): GET /api/misc/adverts; rotating banner; images
  API_BASE + logo path.

3.4 Images
----------
- All image URLs built as API_BASE + path (e.g. product_image_path,
  service_logo_path). No thumbnail API in this app; same backend /uploads as
  web.

3.5 Push notifications
------------------------
- registerForPushNotificationsAsync (in pushNotifications module): gets Expo
  push token, POST /api/push-token with token. On login and after token restore.
- unregisterPushToken: DELETE /api/push-token on logout.
- Notifications.addNotificationResponseReceivedListener: on tap, if type
  message → navigate to Chat(sender_id); if type product → ProductDetail(listing_id).

3.6 Theme and styling
----------------------
- src/theme.js: colors (bg, surface, accent, text, etc.) used across screens
  and tab bar. Matches web accent (e.g. green) for brand consistency.


================================================================================
4. HOW THE THREE PIECES FIT TOGETHER
================================================================================

- Backend is the single source of truth: PostgreSQL holds users, products,
  services, messages, payments, etc. All mutations go through the API.

- Web and mobile both use the same REST API:
  - Auth: register, login, forgot/reset password, verify email, me, change
    password.
  - Products: list, get one, create, update, delete, buy, reinstate.
  - Services: list, get one, create, update, delete.
  - Misc: locations, roles, categories, adverts; report-error.
  - Messages: conversations, thread with peer, send, mark read, delete
    conversation.
  - Uploads: POST image, get URL back; images served at /uploads/*.
  - Payment: config, create-order, capture, return/cancel, subscription,
    webhook.
  - Push: register/remove token.

- Auth: web keeps JWT in memory (window.__marketplace_token); mobile keeps
  JWT in AsyncStorage and in memory. Both send Authorization: Bearer <token>
  and rely on backend verifyToken for protected routes.

- Password reset and email verification: backend sends emails (if SMTP
  configured) with links to the web app (PASSWORD_RESET_BASE_URL). Web app
  has dedicated routes /reset-password and /verify-email that read token
  from query and call the auth API. Mobile does not implement these pages;
  users open the link in a browser.

- Images: uploaded once via POST /api/uploads/image; returned path is used
  as API_BASE + path on both web and mobile. Backend serves files from
  uploads/ at /uploads.

- Admin: only backend enforces is_admin (requireAdmin). Web app has admin
  UI (tables, reports, payment config, plans); mobile does not.


================================================================================
5. CONFIGURATION (env)
================================================================================

Backend (.env):
- PORT, NODE_ENV, BASE_URL, PASSWORD_RESET_BASE_URL
- MAIL_FROM, SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS
- DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
- ADMIN_PASSWORD (for setup), JWT_SECRET, REFRESH_TOKEN_SECRET

Web frontend (build-time):
- VITE_API_URL: full backend URL in production (e.g. https://api.mmaraka.com).
  Empty in dev so Vite proxy forwards /api.

Mobile (build-time / .env):
- EXPO_PUBLIC_API_URL: backend URL (e.g. https://api.mmaraka.com for
  production builds). EAS build profiles set this in eas.json.


================================================================================
END OF DESIGN README
================================================================================

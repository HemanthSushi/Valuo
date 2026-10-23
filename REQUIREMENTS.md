# Software Requirements Specification

**Project:** Valuo — House Price Prediction & Analytics Platform
**Document type:** Requirements gathered from the client
**Version:** 1.0 | **Date:** 12 October 2026

---

## 1. Purpose and background

The client has an existing full-stack web application that lets users upload a housing dataset, explore it, train machine learning models, and predict and forecast house prices. The current version works but has too many models, a generic-looking interface, and basic authentication screens. This document records what the client wants changed and what the finished product must do.

### 1.1 Goals

1. Rebrand the product under a new name.
2. Simplify the ML core to two models: Random Forest and XGBoost.
3. Replace the current UI with a minimalist design that does not look AI-generated or templated.
4. Provide high-quality, secure login and signup.
5. Update all documentation to match.

### 1.2 Target users

| User | Need |
| :--- | :--- |
| Real estate analyst | Upload data, compare models, understand drivers of price |
| Home buyer | Get a quick estimated price for a property |
| Investor | See historical trends and future price projection |

### 1.3 Scope

**In scope:** rename, model reduction, UI redesign, authentication, README and docs, screenshots.
**Out of scope (unless the client says otherwise):** payments, multi-tenant organizations, mobile native apps, new ML models, live property listing integrations.

---

## 2. Client requirements (as stated)

| ID | Requirement | Priority |
| :--- | :--- | :--- |
| CR-1 | Review the complete existing README and project before changing anything | Must |
| CR-2 | Keep only **XGBoost** and **Random Forest**; remove Linear Regression and LightGBM | Must |
| CR-3 | Change the project name from the legacy name to a new name (Valuo) | Must |
| CR-4 | Login and signup must be "very good" | Must |
| CR-5 | UI must be very minimalist and must not look AI-generated | Must |
| CR-6 | Deliver a prompt that can drive these changes in a coding assistant | Must |

---

## 3. Functional requirements

### 3.1 Branding

- **FR-1.1** Replace every occurrence of the old name, in every casing, in code, config, UI text, page titles, meta tags, package names, database name, API titles, the README and scripts.
- **FR-1.2** The new name must be short, easy to spell, and not conflict with a well-known product. Working choice: *Plinth*. Alternatives: Valuo, Hearth, Quoin.
- **FR-1.3** A case-insensitive search for the old name must return zero results at handover.

### 3.2 Authentication

- **FR-2.1** Users can sign up with name, email and password.
- **FR-2.2** Users can log in with email and password and log out.
- **FR-2.3** Passwords are hashed (bcrypt or argon2) and never stored or logged in plain text.
- **FR-2.4** Sessions use JWT or httpOnly cookies; the frontend attaches credentials automatically through the HTTP client.
- **FR-2.5** Emails are unique (database unique index); duplicate signup shows a clear message.
- **FR-2.6** All app pages except login and signup are protected routes; unauthenticated users are redirected to login and returned to their target page afterwards.
- **FR-2.7** Login page offers "Remember me" and a "Forgot password" link.
- **FR-2.8** Signup includes confirm-password and a password strength hint.
- **FR-2.9** Forms validate inline on blur with specific messages, show a loading and disabled state on submit, display server errors clearly, support Enter to submit, autofocus the first field, include a show/hide password toggle, and use correct `autocomplete` attributes.

### 3.3 Dataset upload and metadata

- **FR-3.1** Upload CSV and Excel files via drag-and-drop or file picker.
- **FR-3.2** The system detects column types (numeric, categorical, datetime) and suggests a target column.
- **FR-3.3** Each upload gets a dataset ID and its own workspace.

### 3.4 Exploratory data analysis

- **FR-4.1** Show row and column counts, missing-value distribution, summary statistics, and top correlations with the target.

### 3.5 Model training

- **FR-5.1** Offer exactly two models: Random Forest and XGBoost.
- **FR-5.2** User selects target column and test-split size, then trains with one action.
- **FR-5.3** Preprocessing: median imputation for numeric, most-frequent for categorical, RobustScaler for numeric, OneHotEncoder (max 10 categories, unknown ignored) for categorical.
- **FR-5.4** Save the preprocessor, feature names and trained models per dataset ID.
- **FR-5.5** Old workspaces containing Linear Regression or LightGBM files must be ignored without errors.

### 3.6 Model comparison

- **FR-6.1** Leaderboard table with RMSE, MAE, R², MAPE and training time for both models.
- **FR-6.2** Highlight the best model automatically.
- **FR-6.3** Comparison charts for the key metrics.

### 3.7 Explainability

- **FR-7.1** Show global feature importance and SHAP values for the selected model.

### 3.8 Prediction

- **FR-8.1** Enter property attributes and get an estimated price (displayed in Lakhs, ₹).
- **FR-8.2** Missing inputs are imputed automatically.
- **FR-8.3** A "random test row" action compares predicted versus actual price.

### 3.9 Forecasting

- **FR-9.1** ARIMA forecast of price trend with historical series, projection and 95% confidence interval.

---

## 4. UI and UX requirements

### 4.1 Visual language

| Area | Requirement |
| :--- | :--- |
| Overall feel | Minimalist, quiet, editorial; should look hand-designed |
| Palette | Near-white background, near-black text, one restrained accent colour; proper dark mode (not inverted) |
| Shape | 1px hairline borders instead of shadows; 4 to 6px radius |
| Spacing | Strict 4/8px scale, generous whitespace, left-aligned content |
| Typography | One distinctive neutral typeface (Geist, IBM Plex Sans or Instrument Sans) plus a monospace for numbers; tabular numerals |
| Navigation | Simple top bar or slim sidebar with plain text links |
| Charts | Thin lines, muted gridlines, accent colour only for the best model or key series |
| Copy | Short, concrete, human; no marketing fluff, no exclamation marks |
| Motion | Minimal, 150 to 200ms opacity or transform only |

### 4.2 Things to avoid

Gradient text, glassmorphism or backdrop blur, glowing or large soft shadows, emoji in the UI, sparkle or wand icons, pill-shaped everything, nested cards, centered-everything layouts, generic "Unlock the power of..." copy, three-icon feature grids, purple or blue gradients.

### 4.3 Login and signup design

- Single focused form column with a small wordmark.
- Optional plain side panel: one short product statement or a real product figure; no stock illustrations or gradients.
- Visible labels (not placeholder-only), left-aligned, consistent with the rest of the app, works in light and dark mode.

### 4.4 States

Every view needs designed empty, loading, error and success states.

---

## 5. Non-functional requirements

| ID | Category | Requirement |
| :--- | :--- | :--- |
| NFR-1 | Accessibility | WCAG AA contrast, visible focus rings, labelled inputs, full keyboard navigation |
| NFR-2 | Responsiveness | Fluid layout across phone, tablet, laptop (1366×768, 1080p @ 125%), and wide desktop via `min-h-screen` and `overflow-y-auto` |
| NFR-3 | Security | Hashed passwords, secrets in `.env`, CORS restricted to known origins, upload limits, HMAC-SHA256 model artifact signing, strict UUID path validation |
| NFR-4 | Performance | Page loads under 2s; asynchronous worker threads for long-running ML training jobs (`/api/train/async`) preventing event loop starvation |
| NFR-5 | Maintainability | Design tokens (colours, radii, spacing, fonts) in one place (Tailwind config and CSS variables) |
| NFR-6 | Compatibility | Python 3.11 to 3.13, Node 18+, modern evergreen browsers; clean root startup via standard `uvicorn backend.server:app` |
| NFR-7 | Reliability | App starts cleanly with no console or server errors; stale files do not crash it; real statistical uncertainty intervals without fake fallbacks |

---

## 6. Technical constraints

- **Frontend:** React 19, React Router v7, Tailwind CSS, Radix UI, Recharts, Lucide (sparingly), Sonner, Axios.
- **Backend:** FastAPI with Uvicorn, Pandas, NumPy, scikit-learn, XGBoost, SHAP, Statsmodels, SQLite3.
- **Database:** SQLite (embedded, zero-server database with WAL mode for users, datasets metadata, models, and predictions); local disk workspace for binary artifacts.
- **Remove:** LightGBM dependency, Linear Regression code paths, MongoDB/Motor dependencies.

### 6.1 API surface (after change)

| Method | Endpoint | Purpose |
| :--- | :--- | :--- |
| POST | `/api/auth/signup` | Create account |
| POST | `/api/auth/login` | Authenticate, issue token or cookie |
| POST | `/api/auth/logout` | End session |
| GET | `/api/auth/me` | Current user |
| GET | `/api/` | Health check |
| POST | `/api/upload` | Upload dataset |
| GET | `/api/meta/{dataset_id}` | Column types and target suggestions |
| GET | `/api/eda/{dataset_id}` | EDA results |
| POST | `/api/train` | Synchronous ML training for benchmark runs |
| POST | `/api/train/async` | Asynchronous training offloaded to worker thread pool |
| GET | `/api/train/status/{task_id}` | Real-time training progress and execution status polling |
| GET | `/api/models/{dataset_id}` | Leaderboard metrics |
| POST | `/api/predict` | Predict price with empirical 95% confidence intervals |
| GET | `/api/predict/random/{dataset_id}/{model_name}` | Random test-row check |
| GET | `/api/explainability/{dataset_id}/{model_name}` | SHAP and importance |
| POST | `/api/forecast` | ARIMA forecast with ADF unit-root stationarity check |

New environment variables: `JWT_SECRET`, token expiry, `SQLITE_DB_PATH`, `CORS_ORIGINS`, `ARTIFACT_SIGNING_KEY`.

---

## 7. Documentation requirements

- Rewrite README for the new name: updated badges (no LightGBM), features, stack, architecture diagram, API table, ML pipeline, all showing only two models.
- Replace the glassmorphism design description with an accurate minimalist one.
- Document auth endpoints, async task queue, security signing, and new `.env` variables; fix install steps and the repository tree.
- Fewer emoji in headings; professional tone.
- Regenerate screenshots with the updated capture script (new login flow and page names).

---

## 8. Acceptance criteria

1. Searching the repo for the old name (any casing) returns nothing.
2. Only Random Forest and XGBoost appear in the backend, frontend, README and `requirements.txt`.
3. Backend and frontend both start with no errors from repository root (`uvicorn backend.server:app --port 8000`).
4. A full flow works end to end: signup, login, upload, EDA, train both models (sync and async), compare, explain, predict, forecast, logout.
5. Visiting any protected page while logged out redirects to login.
6. Passwords are verified as hashed in the database.
7. A design review against the "things to avoid" list in 4.2 finds none present.
8. Light and dark mode both pass AA contrast checks on all pages.
9. Opening an old workspace with Linear Regression or LightGBM files does not crash the app.
10. Model artifacts are verified via HMAC-SHA256 signatures before loading; unsigned files are rejected.
11. Path traversal attempts on `dataset_id` are strictly rejected via UUID validation.
12. Predicted 95% confidence interval bands are calculated using genuine tree variance and test residuals.
13. Content is responsive and accessible without viewport clipping on common screen resolutions (1366×768 or 1080p @ 125% scaling).
14. README and documentation match the final product.

---

## 9. Assumptions

- The client has the full repository and will run the work in a coding assistant such as Claude Code or Cursor.
- Existing endpoints and data formats stay the same unless listed above.
- SQLite is embedded and available automatically via standard library, requiring no external database services.
- The product stays English-only with prices in Lakhs (₹).

## 10. Open questions for the client

1. **Name:** Is "Plinth" approved, or do you prefer another?
2. **Accent colour:** Any brand colour, or should one be chosen (e.g. a muted green or terracotta)?
3. **Auth extras:** Do you want Google or GitHub sign-in, email verification, or a working password-reset email?
4. **Roles:** Is a single user type enough, or do you need admin and analyst roles?
5. **Data ownership:** Should each user see only their own uploaded datasets?
6. **Hosting:** Local only, or will it be deployed (which affects cookies, CORS and secrets)?
7. **Dark mode default:** Follow system setting, or default to light?
8. **Dataset limits:** Maximum upload size and row count?
9. **Deadline:** When is the work needed (for example, before a project review or placement)?

---

## 11. Risks

| Risk | Mitigation |
| :--- | :--- |
| Removing models breaks charts or saved workspaces | Test with old workspace; ignore stale files |
| Adding auth breaks existing API calls | Central Axios client; protect routes in one place |
| UI still looks generic | Enforce the banned list and fixed tokens; review screenshots |
| Single large prompt overwhelms the assistant | Run in stages: rename and models, then UI and auth, then README |

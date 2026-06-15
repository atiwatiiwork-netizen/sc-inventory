# SC Inventory Management

ระบบจัดการสต็อกและบันทึกการใช้ประจำวันสำหรับโรงงาน/ผู้จัดจำหน่ายรางเหล็ก —
Steel-rail factory inventory & daily usage tracking.

Bilingual (Thai / English), mobile-friendly web app built with **Next.js 16
(App Router) · TypeScript · Tailwind CSS v4 · Supabase (PostgreSQL)**.

> **New here? Read [▶ Run the app locally](#-run-the-app-locally-step-by-step) below.**
> It is written for an operator with **no programming experience** — follow it
> top to bottom and the app will be running.

---

## ▶ Run the app locally (step by step)

You do this **once**. After the first setup, starting the app again is just
Step 5 (`npm run dev`).

There are 6 stages, matching exactly what you need:

1. Install dependencies
2. Configure Supabase (the database)
3. Start the development server
4. Access the application
5. Log in as Admin
6. Log in as Worker

---

### 0. Open a terminal in this folder (do this first)

1. Open **File Explorer** and go to the project folder
   `C:\Users\USER1\Desktop\ScAppProject\SCWarehouseInventoryManagement`.
2. Click once in the **address bar** at the top, type `powershell`, and press
   **Enter**. A blue terminal window opens, already pointing at this folder.

> Node.js (the engine that runs the app) is already installed on this machine.
> To confirm, type this and press Enter — you should see a version number like
> `v24.16.0`:
> ```powershell
> node --version
> ```
> If you instead see *"not recognized"*, close the terminal, reopen it (so it
> picks up the latest settings), and try again. If it still fails, install
> Node.js LTS from <https://nodejs.org> (click the **LTS** button, run the
> installer, accept all defaults), then reopen the terminal.

Keep this terminal open — every command below is typed into it.

---

### 1. Install dependencies

Downloads everything the app needs (run once). In the terminal, type:

```powershell
npm install
```

Wait until it finishes (a minute or two). You can ignore any yellow
"vulnerabilities" notes — they do not affect running the app.

---

### 2. Configure Supabase (the database)

The app stores its data in **Supabase**, a free online database. Set it up once:

**2a. Create the project**

1. Go to <https://supabase.com> and sign up (free).
2. Click **New project**. Give it a name (e.g. `sc-inventory`), choose a region
   near you, and set a database password (save it somewhere). Click
   **Create new project** and wait ~2 minutes until it is ready.

**2b. Create the tables and sample data**

1. In the Supabase dashboard left menu, click **SQL Editor** → **New query**.
2. Open the file [`supabase/schema.sql`](supabase/schema.sql) from this project
   (right-click it → open with Notepad), select **all** the text (Ctrl+A),
   copy it (Ctrl+C), paste it into the Supabase query box, and click **Run**.
3. Repeat the same copy-paste-**Run** with [`supabase/seed.sql`](supabase/seed.sql).
   This loads the 5 categories, ~50 products, 4 customer groups, and 4 workers.

> Upgrading a database you created during Phase 1? Also run
> [`supabase/phase2.sql`](supabase/phase2.sql) once. (A brand-new `schema.sql`
> already includes everything, so you can skip this.)

**2c. Copy your keys into the app**

1. In Supabase, go to **Project Settings** (gear icon) → **API**.
2. You will need three values from that page:
   - **Project URL**
   - **anon / public** key
   - **service_role** key (click *Reveal* — keep this one secret)
3. Back in your terminal, create the settings file from the template:
   ```powershell
   Copy-Item .env.local.example .env.local
   notepad .env.local
   ```
4. Notepad opens. Replace the placeholder values with your three keys, plus any
   long random text for the last line. Save (Ctrl+S) and close Notepad:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=paste-the-anon-public-key
   SUPABASE_SERVICE_ROLE_KEY=paste-the-service_role-key
   WORKER_SESSION_SECRET=type-any-long-random-text-here-1234567890
   ```

**2d. Create the administrator login**

1. In Supabase, go to **Authentication** → **Users** → **Add user** →
   **Create new user**.
2. Enter an email (e.g. `admin@screalrail.co.th`) and a password you will
   remember. Tick **Auto Confirm User**. Click **Create user**.
   *(Write down this email + password — it is your Admin login in Step 5.)*

---

### 3. Start the development server

In the terminal, type:

```powershell
npm run dev
```

Leave this window open while you use the app. You'll see a line like
`✓ Ready` and `Local: http://localhost:3000`.

> To **stop** the app later, click the terminal window and press **Ctrl+C**.
> To **start it again** another day: do Step 0, then just `npm run dev`.

---

### 4. Access the application locally

Open your web browser and go to:

```
http://localhost:3000
```

You'll see the **role chooser** — two cards: **พนักงาน · Worker** and
**ผู้ดูแล · Admin**.

---

### 5. Log in as Admin

1. On the role chooser, click **ผู้ดูแล · Administrator**
   (or go directly to `http://localhost:3000/admin/login`).
2. Enter the **email and password** you created in Step 2d.
3. Click **เข้าสู่ระบบ** (Sign in).

You land on the admin console. In Phase 1 you can manage **หมวดหมู่
(Categories)** and **สินค้า (Products)**. Other menu items show "coming soon"
and arrive in later phases.

---

### 6. Log in as Worker

1. On the role chooser, click **พนักงาน · Worker**
   (or go directly to `http://localhost:3000/worker/login`).
2. Enter one of the seeded 4-digit PINs on the keypad:

   | PIN  | Worker |
   | ---- | ------ |
   | 1111 | สมชาย (EMP001) |
   | 2222 | สมหญิง (EMP002) |
   | 3333 | วิชัย (EMP003) |
   | 4444 | ประเสริฐ (EMP004) |

The PIN is checked automatically once 4 digits are entered. You then complete the
daily flow: pick the date + customer group → enter quantities (grouped) → review
→ confirm. Re-opening the app the same day lets you **edit today's submission**.

---

## Phased delivery

| Phase | Scope | Status |
| ----- | ----- | ------ |
| **1** | Project setup · Supabase integration · DB schema · admin auth · worker PIN auth · product categories · product management | ✅ implemented |
| **2** | Stock input (grouped) · worker daily submission + review/confirm · transaction history | ✅ implemented |
| **3** | Category-centric dashboard (+ drill-down) · current inventory · daily/weekly/monthly reports · low-stock alerts (static + dynamic insights) | ✅ implemented |
| **4** | LINE text notifications (daily/weekly/monthly + low-stock) · settings · idempotent scheduled sends | ✅ implemented (deploy pending) |

**Low-stock model (hybrid):** alert colours are driven solely by the static
per-SKU `min_stock` thresholds — red `stock < min`, amber `stock ≤ min × 1.2`,
green above. Average daily usage and estimated days-of-cover are shown alongside
as decision support (computed from the last 30 days of real usage) and never
affect the colours. No forecasting or lead-time settings.

---

## For developers

### Quick command reference

```bash
npm install      # install dependencies
npm run dev      # start dev server at http://localhost:3000
npm run build    # production build
npm start        # run the production build
npm run lint     # lint
```

### Project structure

```
app/
  page.tsx                     role chooser (landing)
  admin/
    login/                     admin email/password sign-in (public)
    (console)/                 authenticated admin shell + screens
      page.tsx                 ✅ category-centric dashboard + drill-down
      categories/              ✅ product categories CRUD
      products/                ✅ product management CRUD
      stock-input/             ✅ grouped receiving (4-step + history)
      inventory/               ✅ current inventory (rail matrix + list)
      low-stock/               ✅ alerts (static colours + dynamic insights)
      reports/                 ✅ category reports (daily/weekly/monthly)
      line/                    ✅ LINE settings + live preview + test send
      adjustments/             ✅ stock adjustments (physical count)
      customer-groups/         ✅ customer-group management
      workers/                 ✅ worker PIN management
  api/cron/{daily,weekly,monthly}/  ✅ Vercel Cron endpoints (secret-protected)
  worker/
    login/                     PIN keypad (public)
    (secure)/                  ✅ daily usage flow (triggers daily LINE on completion)
  auth/actions.ts              admin + worker auth server actions
components/                    Icon, UI atoms, admin shell, feature clients
lib/
  supabase/                    browser / server / service clients + session proxy
  worker-session.ts            signed worker-session cookie
  settings.ts                  LINE settings get/save (server)
  line/                        format (pure) · client (push) · data · send (idempotent)
  insights.ts, queries.ts, grouping.ts, types.ts, nav.ts
supabase/
  schema.sql                   full schema (all phases) + RLS + commit functions
  seed.sql                     ~50 SKUs, 5 categories, 4 groups, 4 workers
  phase2.sql / phase4.sql      migrations for DBs created in an earlier phase
vercel.json                    cron schedules (daily/weekly/monthly)
proxy.ts                       route guards + Supabase session refresh
```

The design system (steel-grey neutrals, blue accent, IBM Plex Sans Thai / Mono)
lives in [`app/globals.css`](app/globals.css), exposed both as raw CSS variables
and Tailwind theme tokens.

### Security model (kept deliberately simple, per spec)

- **Admins** authenticate via Supabase Auth. All admin tables use RLS allowing
  any authenticated user — since only admins authenticate, that means admins.
- **Workers** never touch the database directly. PINs are verified server-side
  through a `SECURITY DEFINER` function (the workers table is never exposed to
  the browser), and a signed, httpOnly cookie holds the worker session
  (5-minute expiry).

### LINE notifications (Phase 4)

Text-only summaries are pushed to a management LINE group via the LINE Messaging
API. Everything except the secret is configured in-app at **Admin → ตั้งค่า LINE**
(stored in the database, editable any time without a redeploy):

- **Connection:** enable, Channel Access Token, recipient group/user id.
- **Format:** detail level (minimal / **summary** / detailed), low-stock mode
  (**digest** / immediate / off) + max items, and **custom header/footer text**.
- A **live preview** (using today's real data) and a **ส่งทดสอบ (test send)** button.

**Messages & schedule**
- **Daily** — sent when all active workers have submitted; **19:30** cron is the fallback.
- **Weekly** — Monday **08:00**. **Monthly** — 1st **08:00**. (Times are ICT; the cron
  expressions in `vercel.json` are in UTC = ICT−7.)
- Usage is reported **category-level** (each in its own unit, never mixed); SKUs appear
  only in low-stock lines and the monthly top-SKU list.
- **Idempotent:** every send is guarded by `notification_logs (unique kind+period_key)`,
  so the after-submit trigger and the cron fallback never double-send.
- To change message wording/structure, edit the single file `lib/line/format.ts`.

### Deploying to Vercel

1. Push the repo to GitHub and import it in Vercel.
2. Set env vars in Vercel (Project Settings → Environment Variables): the same
   four Supabase/worker keys as `.env.local`, plus **`CRON_SECRET`** (a long random
   string — Vercel Cron sends it automatically as the `Authorization` header).
3. The crons in `vercel.json` are picked up on deploy. **Note:** the Vercel Hobby
   plan limits cron frequency/count — the weekly/monthly jobs may require the Pro
   plan; the daily job runs on Hobby.
4. Run `supabase/schema.sql` + `seed.sql` on the production database (or the
   `phaseN.sql` migrations if upgrading), and create the admin user.

### Troubleshooting

| Symptom | Fix |
| ------- | --- |
| `node` / `npm` "not recognized" | Close and reopen the terminal so it picks up the updated PATH; or install Node LTS from nodejs.org. |
| Admin login says *"ยังไม่ได้ตั้งค่า Supabase"* | `.env.local` is missing or the keys are blank — redo Step 2c, then restart `npm run dev`. |
| Worker PIN says *"ยังไม่ได้ตั้งค่า Supabase"* | The `SUPABASE_SERVICE_ROLE_KEY` line in `.env.local` is missing — redo Step 2c. |
| Admin login fails with correct password | Make sure you created the user in Step 2d **with Auto Confirm**. |
| Worker PIN always "incorrect" | Make sure `seed.sql` ran successfully in Step 2b. |
| Changed `.env.local` but nothing changed | Stop the server (Ctrl+C) and run `npm run dev` again — env files load at startup. |
| LINE test send fails | Check the Channel Access Token and that the recipient id is a real group/user the bot is in. The error from LINE is shown under the buttons. |
| LINE messages never arrive on schedule | Confirm `CRON_SECRET` is set in Vercel and the deploy picked up `vercel.json`; check the cron run logs in the Vercel dashboard. |
| A summary sent twice | Shouldn't happen — sends are de-duplicated via `notification_logs`. If you intentionally need a resend, delete that row (matching `kind` + `period_key`). |

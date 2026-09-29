# Code Masters Round 2 — Standalone Python Debugging Platform

A dedicated, standalone online competitive programming and Python debugging assessment platform architected exclusively for **Code Masters Round 2**.

---

## 1. Architectural Highlights

- **100% Independent**: Completely isolated from the legacy Code Masters Round 1 portal and database.
- **Isolated Code Execution Sandbox**: Participant code is **never** evaluated in the browser or unsafely on the host. An isolated execution runner strictly enforces timeouts (3.0s), memory bounds, output size caps (32KB), stripped environments (no access to DB credentials or system secrets), and temporary sandbox directories.
- **Dual Test Case Partitioning**:
  - **Public Test Cases**: Visible in the participant IDE for practicing and testing (`Run Code`).
  - **Concealed / Hidden Test Cases**: Accessible strictly by the backend execution engine for authoritative server scoring (`Submit Code`).
- **Authoritative Server Scoring**: The client never calculates or determines final scores; all scoring happens on the backend against all authorized test suites.
- **Anti-Cheat Monitoring**: Tracks tab switching (`visibilitychange`), window blurs, right-click, clipboard copying/pasting, and DevTools shortcuts. Violations are logged to `round2_warnings` with configurable maximum tolerances before automatic disqualification.
- **Live Authoritative Timer**: Server-backed countdown timer with auto-submit capability when the competition expires.
- **Comprehensive Admin Portal**:
  - Question & Test Case CRUD with instant publish/unpublish toggles.
  - Submissions table with full code viewer and per-test execution diagnostics.
  - Participant management with administrative overrides (re-enable, unlock submission, reset warnings).
  - Real-time ranked Leaderboard with submission timestamp tie-breaking.
  - Zero fake data: All metrics and cards display real database entries.

---

## 2. Directory Structure

```
codemasters-round2-platform/
├── database/
│   ├── 01_schema.sql         # Production schema (PostgreSQL / Supabase)
│   ├── 02_rls_policies.sql   # Strict Row Level Security policies
│   └── 03_seed_dev.sql       # Optional dev-only sample question seed
├── backend/
│   ├── app/
│   │   ├── core/             # Config, security, and dual database manager
│   │   ├── models/           # Pydantic schemas
│   │   ├── routers/          # Auth, questions, run, submit, admin, warnings, settings
│   │   └── main.py           # FastAPI entrypoint with CORS
│   ├── tests/                # Automated API flow integration test
│   └── requirements.txt
├── execution-engine/
│   ├── app/
│   │   └── runner.py         # Isolated Python subprocess runner with sandbox
│   ├── tests/                # Sandbox tests (timeout, errors, env stripping)
│   └── Dockerfile            # Container deployment definition
├── frontend/
│   ├── src/
│   │   ├── components/       # Common, exam IDE, and admin widgets
│   │   ├── context/          # AuthProvider
│   │   ├── hooks/            # useAntiCheat, useExamTimer
│   │   ├── pages/            # Participant & Admin portals
│   │   ├── services/         # apiClient
│   │   └── styles/           # Modern dark competition design system
│   ├── package.json
│   └── vite.config.ts
├── README.md
└── .env.example
```

---

## 3. Quick Start Guide

### 1. Database Setup
In your **NEW** Supabase project SQL Editor (or PostgreSQL database):
1. Execute `database/01_schema.sql`.
2. Execute `database/02_rls_policies.sql`.
3. (Optional for local testing): Execute `database/03_seed_dev.sql`.

### 2. Backend & Execution Engine
```bash
cd backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
API Docs available at: `http://localhost:8000/docs`

### 3. Frontend Web Application
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 4. Default Credentials (Development)

- **Admin Portal**: `http://localhost:5173/#/admin/login`
  - **Email**: `admin@codemasters.com`
  - **Password**: `Admin@CM2026`
- **Participant Portal**: `http://localhost:5173/#/participant/login`
  - Students can register their official name, VTU roll number, and student email directly on the login page.

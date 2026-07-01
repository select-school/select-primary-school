# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A Hong Kong primary school ranking viewer (香港小學排名 2026). It displays ~80 schools (girl-only schools excluded) scraped from HKET TopSchool, with filtering, comparison, and personal rating/notes features. The UI is in Traditional Chinese.

## Commands

- `npm start` — run the Express dev server on port 3000
- `npm run convert` — regenerate `schools.json` from `top100_schools.csv`
- `node merge_school_data.js` — merge EDB PDF-extracted details (`school_details.json`) into `schools.json` and `public/schools.json`
- `python scrape_schools.py` — re-scrape school data from HKET (requires `requests`; venv in `.venv`)

## Architecture

**Two deployment targets with different backends:**

1. **Local dev** (`server.js`): Express serves `public/` as static files. Auth is bypassed — all API calls work without login. User data is stored in a local `user_data.json` file via `GET/PUT /api/user-data` and `PUT /api/preferences`.

2. **Vercel production** (`vercel.json` + `api/`): Static files served from `public/`. Serverless functions in `api/` handle authenticated requests:
   - `api/auth-helper.js` — creates Supabase client, extracts user ID from Bearer token
   - `api/user-data.js` — CRUD for school ratings/notes in `school_ratings` table
   - `api/preferences.js` — saves user preferences in `user_preferences` table
   - Auth uses Supabase (Google OAuth only), env vars: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - The `npm run build` script injects `SUPABASE_URL` and `SUPABASE_ANON_KEY` into `index.html` at deploy time

**Frontend** (`public/`): Single-page vanilla JS app — no build step, no framework. Uses ES modules.
- `index.html` — DaisyUI + Tailwind CDN, all markup, loads Supabase SDK from CDN
- `public/js/` — modular client code:
  - `auth.js` — entry point: initializes Supabase auth (or bypasses on localhost), boots the app, manages login/logout/onAuthStateChange
  - `shared.js` — global app state (`getAppState`/`setAppState`), API fetch helpers, the detail modal renderer (`showDetailModal`), and `window.__setRating`/`window.__saveNotes` globals
  - `router.js` — hash-based routing across 4 pages: dashboard, ranking, links, account
  - `dashboard.js` — dashboard cards: shortlist, region/type recommendations, district/tuition charts
  - `ranking.js` — main ranking table (desktop) + cards (mobile), filters, sorting, comparison modal
  - `onboarding.js` — 4-step first-login wizard for setting district/net/type preferences
  - `account.js` — account page: preference editing, sign-out
- `style.css` — minimal custom styles
- `schools.json` and `school_nets.json` are copied into `public/` for static serving

**Data pipeline**: `scrape_schools.py` → `top100_schools.csv` → `convert_csv.js` → `schools.json`. Then `extract_school_details.py` extracts from EDB PDFs into `school_details.json`, and `merge_school_data.js` enriches `schools.json` with those details. The `school_nets.json` maps school net numbers to districts and exists at both root and `public/` level.

**School data shape** (in `schools.json`): Core fields: `id`, `rank`, `name`, `gender`, `district`, `schoolNet` (array of numbers), `tuition`, `assessment`, `relatedSecondary`, `campusArea`, `classroomCount`, `specialRooms`, `facilities`. Extended fields (from EDB merge): `nameEn`, `address`, `phone`, `website`, `principal`, `foundingYear`, `religion`, `teachers`, `classStructure`, `fees`, `schoolLife`, `ecas`, `mission`, etc.

**User data shape** (keyed by school `id`): `rating` ("Top"/"High"/"Medium"/null), `ratingReason`, `notes`, `updatedAt`.

**Preferences shape**: `districts` (array), `schoolNets` (array of numbers), `schoolTypes` (array), `onboardingCompleted` (boolean). Stored under `_preferences` key in local dev, in `user_preferences` table on Vercel.

## Deployment

- **Repo**: https://github.com/select-school/select-primary-school (public)
- **Branch**: `v2` is the production branch
- **Auto-deploy**: Vercel is connected to the GitHub repo — `git push origin v2` triggers a production deploy automatically
- **Env vars**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` are configured in Vercel project settings, not in the repo
- **Version**: bumped in 3 places — `package.json`, `public/index.html` (sidebar), `public/js/account.js` (account page)

## Key Details

- District and school-net filters are bidirectionally linked — checking a district auto-checks its nets and vice versa. This sync logic is duplicated in `ranking.js`, `onboarding.js`, and `account.js`.
- Comparison is limited to 3 schools max
- `schools.json` uses sequential string IDs (`"1"`, `"2"`, ...) assigned during CSV conversion, not the HKET school IDs
- The `school-details/` directory contains PDF files with detailed school information by district (Chinese filenames)
- Local dev detection: `!SUPABASE_URL || SUPABASE_URL.includes('%%') || location.hostname === 'localhost'`
- `shared.js` exposes `window.__setRating` and `window.__saveNotes` as globals because they're called from innerHTML-rendered onclick handlers in the detail modal
- The `vercel.json` rewrites `/api/schools` → `/schools.json` and `/api/school-nets` → `/school_nets.json` for static data

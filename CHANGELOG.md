# Changelog

All notable changes to AdMachin are documented here.

---

## [Unreleased]

### 2025-12-22: Sora Web Automation Working

**Added:**
- Sora Web browser automation fully functional
- Storage bucket `video-generator` for video uploads
- Script `scripts/reset-web-task.ts` for resetting failed tasks

**Fixed:**
- Server sync-tasks now properly skips `web-` prefixed tasks
- Button selector updated to avoid clicking "Create Character"
- Video upload to Supabase storage working

---

### 2025-12-22: UI/UX Improvements & Video API Fixes

**Added:**
- Breadcrumb navigation component (`src/components/Breadcrumb.tsx`)
- EmptyState component with presets (`src/components/EmptyState.tsx`)
- Skeleton loading components (`src/components/Skeleton.tsx`)
- E2E production tests with Playwright (`e2e/production.spec.ts`)
- CLAUDE.md: Auto-read changelog at session start, auto-update after changes

**Changed:**
- Sidebar: "Ad Text" → "Ad Copy", "AI Video Generated" → "Generated Videos", "Profiles" → "FB Profiles"
- FBAdAccounts: "Account Overview" → "Ad Accounts"
- Standardized page titles to `text-2xl font-bold`
- Login page: Dynamic copyright year, updated password hint

**Fixed:**
- Video generation API now uses correct kie.ai endpoint (`/jobs/createTask`)
- Video API payload restructured: `model` at top level, `input` object with `n_frames`
- Duration options corrected to 10s and 15s (Sora 2 supported values)
- Aspect ratio options: landscape and portrait only (removed square)
- Status endpoint updated to `/jobs/recordInfo`

---

### 2025-12-21: Railway Migration (Express Server)

**Added:**
- Express server at `server/index.ts` replacing Vercel serverless functions
- All API routes converted to Express format in `server/routes/`
- node-cron for scheduled video sync (replaces Vercel crons)
- Railway configuration files: `railway.json`, `Procfile`, `nixpacks.toml`
- Server-specific TypeScript config: `tsconfig.server.json`

**New Scripts:**
- `npm run dev:server` - Start Express server in dev mode (port 3001)
- `npm run dev:all` - Run Vite + Express concurrently
- `npm run build:server` - Build server TypeScript
- `npm run start:server` - Start production server

**Files Created:**
- `server/index.ts` - Main Express server
- `server/routes/video.ts` - Video generation API
- `server/routes/ai.ts` - AI generation API
- `server/routes/presets.ts` - Presets CRUD API
- `server/routes/auth.ts` - Facebook OAuth API
- `server/routes/team.ts` - Team settings API
- `server/services/` - Shared services (tokenStorage, teamStorage, ai)

---

### 2025-12-21: Sora Web Automation

**Added:**
- New model option "Sora2 Web" for browser-based video generation via Playwright
- `scripts/sora-web-generator.ts` - Playwright automation for sora.chatgpt.com
- `npm run sora:generate` command to run local browser automation
- `uploadVideoFile()` function in supabase-service.ts for video uploads
- `metadata` field support in video_output table

**Changed:**
- VideoGenerator UI now shows model selector (API vs Web)
- Updated VideoGenerator, VideoGenerateRequest interfaces for new options

**Technical:**
- Added `tsx`, `dotenv` dev dependencies
- Added `playwright-data/` to .gitignore (browser session storage)

---

### 2025-12-21: Console Resize Feature

**Added:**
- Resizable console/log panels in VideoGenerator
- Drag top-left corner to resize (width: 300-800px, height: 200-600px)
- `resizeSession()` callback for size persistence

**Fixed:**
- TypeScript error in vite.config.ts (undefined state variable)

---

### 2025-12-20: Video Generation Logging Improvements

**Fixed:**
- Server-side logs now appear in console panel during video generation
- API rate limiting prevented with log deduplication
- Increased polling interval from 5s to 15s

**Added:**
- Generate button validation (disabled until all required fields filled)
- Tooltip showing missing fields

**Changed:**
- Moved `colorPalette` constant outside component as `COLOR_PALETTE`
- Fixed React ref access during render issues in DataTable and AdCreator

---

### 2025-12-19: DataTable & Team View

**Added:**
- Team Columns dropdown for AdCreator page
- Drag-and-drop row reordering
- Native gallery view in DataTable with CreativeCard

---

## Documentation

- `docs/RAILWAY_MIGRATION.md` - Guide for migrating from Vercel to Railway
- `CLAUDE.md` - Project conventions and instructions

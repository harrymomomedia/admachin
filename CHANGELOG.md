# Changelog

All notable changes to AdMachin are documented here.

---

## [Unreleased]

### 2025-12-22: Copy Wizard Save to CopyLibrary - E2E Verified

**Fixed:**
- Save Personas, Angles, and Ad Copies to CopyLibrary now working correctly
- Fixed database column mapping (was using `project_id`, now uses `campaign_parameter_id`)
- All save functions now properly insert to `ai_personas`, `ai_angles`, `ai_generated_ads` tables

**Added:**
- E2E test `Save Personas to CopyLibrary` fully automated and passing
- Test generates real personas for "Women's Prison California lawsuit" case
- Test uses Project: "Tort", Subproject: "Women's Prison"
- Verified: 6 personas generated, selected, saved, and confirmed in CopyLibrary

**Technical:**
- Updated test selectors for Playwright compatibility (no CSS comma selectors with text matchers)
- Test handles section expansion/collapse states correctly
- Test file: `e2e/copy-wizard-real.spec.ts`

---

### 2025-12-22: Creatives Page Column Updates & File Renaming

**Changed:**
- Removed `name` column from Creatives page (file names not relevant)
- Added `url` column showing the Supabase storage URL for each creative
- Removed `nameKey` from gallery config
- Renamed all creative files to `{row_number}.{extension}` format (e.g., `1.mp4`, `2.png`)

**Added:**
- `scripts/rename-creatives.ts` - Script to rename creative files to row number format

---

### 2025-12-22: Character Creation Button Restriction

**Changed:**
- "Create Character" button now disabled (grayed out) for non-Sora-Web videos
- Button only active for videos with `model === 'sora-2-web-t2v'`
- Added tooltip explaining restriction: "Character creation only available for Sora Web videos"

---

### 2025-12-22: Video Preview & Supabase Upload

**Added:**
- New `media` column type in DataTable for video/image previews with click-to-play
- Configurable thumbnail sizes: small (40px), medium (64px), large (96px), xl (128px)
- Media preview modal with video player and image viewer
- Auto-upload Kie.ai videos to Supabase storage on sync completion
- Thumbnail size selector in column context menu (right-click on media column header)
- Gallery view for AI Video Generated page (toggle in toolbar)

**Changed:**
- `syncVideoTasks` now downloads videos from Kie.ai and re-uploads to Supabase storage
- Video URLs now stored as permanent Supabase URLs instead of temporary Kie.ai URLs
- AIVideoGenerated page now shows video preview column with click-to-play
- Creatives page uses new `media` column type instead of `thumbnail`
- AdCombos page uses new `media` column type for creative previews

**Fixed:**
- Media column click-to-preview now works correctly (was missing callback from DataTable to SortableRow)

**Technical:**
- New `uploadVideoToSupabase` function in `server/routes/video.ts`
- `ThumbnailSize` type, `ThumbnailSizeRule` interface, and `THUMBNAIL_SIZES` config in DataTable types
- `mediaPreviewState` state for fullscreen preview modal
- `thumbnailSizeRules` state for per-column size preferences
- `onMediaPreviewClick` callback passed to SortableRow component
- Uses existing `video-generator` storage bucket
- Added computed `video_url` and `media_type` fields to VideoOutputRow for gallery view

---

### 2025-12-22: Copy Wizard - All Sections Always Visible

**Changed:**
- All sections (Personas, Angles, Ad Copies) now visible from the start
- Each section has a "Library" button to load existing data from CopyLibrary
- Can generate Angles without Personas - uses product description only
- Can generate Ad Copies without Angles - uses product description only
- Removed dependency chain requirement (was: must generate Personas → then Angles → then Ad Copies)

**Added:**
- "Library" button in Angles section header → loads angles from CopyLibrary
- "Library" button in Ad Copies section header → loads ad copies from CopyLibrary
- Modal dialogs for selecting and importing library items
- Import functions: click an item to import single, or "Import All" button

**Technical:**
- Updated `generateAngles()` in ai-service.ts to handle empty personas array
- Updated `generateAdCopies()` in ai-service.ts to handle empty angles array
- Added `getAIAngles`, `getAIGeneratedAds` imports for library loading
- New state: `showAnglesLibrary`, `showAdCopiesLibrary`, `libraryAngles`, `libraryAdCopies`

---

### 2025-12-22: Copy Wizard Save to CopyLibrary

**Fixed:**
- "Save as New" now saves Campaign Parameters to `campaign_parameters` table (CopyLibrary)
- "Save Selected" personas now saves to `ai_personas` table (CopyLibrary)
- Added "Save Selected" button for Angles → saves to `ai_angles` table
- Added "Save Selected" button for Ad Copies → saves to `ai_generated_ads` table
- Previously saved to wrong tables (`ai_copywriting_presets`, `saved_personas`)

**Changed:**
- "Load Preset" modal now only shows CopyLibrary `campaign_parameters` data (removed legacy `ai_copywriting_presets`)
- Single source of truth: all campaign data now exclusively uses CopyLibrary tables

**Added:**
- E2E test for Campaign Parameters save functionality
- Verification test to confirm data appears in CopyLibrary

---

### 2025-12-22: AI Copy E2E Tests Fixed

**Fixed:**
- E2E tests now properly follow the Copy Wizard UI flow
- Fixed project dropdown selection (was selecting Model dropdown instead)
- Tests now wait for sections to appear instead of button state changes
- Added persona/angle selection step (required before next generation)
- Deploy script now uses `railway up` instead of Vercel

**Changed:**
- Deploy command: `npm run deploy` now runs `railway up`

**Technical:**
- E2E tests use `--workers=1` to avoid Anthropic API rate limits
- Tests handle dialogs/alerts properly

---

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

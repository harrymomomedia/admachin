# Changelog

All notable changes to AdMachin are documented here.

---

## [Unreleased]

### 2025-12-24: Persona Frameworks Feature

**Added:**
- New Persona Frameworks page under AI Copy section with create row (+) button
- Database table `persona_frameworks` with columns: id, row_number, title, content, project_id, subproject_id, created_by, timestamps
- CRUD functions: getPersonaFrameworks, createPersonaFramework, updatePersonaFramework, deletePersonaFramework
- Persona Frameworks section in Copy Wizard as Step 2 (between Campaign Parameters and Select Personas)
- Users can select a persona framework to guide persona generation

**Changed:**
- Copy Wizard steps renumbered: Campaign Parameters (1), Persona Frameworks (2), Personas (3), Angles (4), Ad Copies (5), Export (6)
- Added Persona Frameworks to sidebar navigation below Campaign Parameters

---

### 2025-12-24: Create Row Button for AI Copy Pages

**Added:**
- Create row button (+) added to all AI Copy pages for manual content creation:
  - Campaign Parameters - creates "New Campaign"
  - AI Personas - creates "New Persona"
  - AI Angles - creates "New Angle"
  - Creative Concepts - creates "New Concept"
  - AI Ads - creates "New Ad Copy" with "FB Ad Text" type
- New rows inherit project/subproject from current filter selection

**Changed:**
- Updated empty state messages to mention clicking + to create

---

### 2025-12-24: Dead Code Cleanup

**Removed:**
- `src/contexts/AIContext.tsx` - unused context, never imported anywhere
- `src/pages/Register.tsx` - unused page with no route defined
- `src/components/PresetManagerModal.tsx` - unused modal component
- AI Copywriting Presets section from `supabase-service.ts` (~110 lines) - unused functions

**Changed:**
- Cleaned up misleading "Register Link" comment in Login.tsx

**Technical:**
- AdPreviewCard components investigated but not consolidated - they serve different purposes (data card vs Facebook ad mockup)

---

### 2025-12-24: Campaign Parameters Preview & AI Generation Context

**Added:**
- Campaign Parameters preview box now shows all new marketing context fields
- New fields displayed: Key Qualifying Criteria, Offer Flow, Proof Points, Primary Objections
- AI generation (Personas, Angles, Ad Copies) now includes all marketing context fields in prompts

**Changed:**
- "Swipe Files" renamed to "Swipe File/Winner Ad" in preview box
- AI prompts now include marketing context when available for more relevant output

**Technical:**
- Updated `ai-service.ts` interfaces: GeneratePersonasParams, GenerateAnglesParams, GenerateAdCopiesParams
- All AI generation functions now accept and use: keyQualifyingCriteria, offerFlow, proofPoints, primaryObjections

---

### 2025-12-24: Remove Copy Button from DataTable Action Column

**Fixed:**
- Copy button in DataTable action column now only shows when `onCopy` prop is provided
- Previously the button appeared on all tables even when copy functionality wasn't enabled
- Campaign Parameters and Copy Wizard tables no longer show the unnecessary copy button

---

### 2025-12-24: Shared Campaign Parameters Columns + Auto-Fill

**Added:**
- `createCampaignParamColumns()` shared function in `datatable-defaults.ts` for consistent columns across pages
- Auto-Fill button added to CampaignParams.tsx page (was only in CopyWizard before)
- 4 new columns for Campaign Parameters: Key Qualifying Criteria, Offer Flow, Proof Points, Primary Objections

**Changed:**
- CopyWizard.tsx now uses shared `createCampaignParamColumns()` function instead of manual column definition
- CampaignParams.tsx now uses shared function with Auto-Fill button
- Renamed "Swipe Files" column to "Swipe File/Winner Ad"
- Both CampaignParams and CopyWizard now have identical columns that stay in sync

**Technical:**
- Added `CampaignParamColumnsOptions` interface with `autoFillColumn` option for custom button injection
- Migration: `20251224010000_add_campaign_params_columns.sql` adds new columns to database

---

### 2025-12-24: DataTable Column Width Persistence Fix

**Fixed:**
- Fixed infinite loop in DataTable auto-save that caused column widths to be repeatedly saved and eventually overwritten
- The columnWidths sync effect was creating new state objects even when values hadn't changed, triggering unnecessary auto-saves
- Column resize preferences now persist correctly across page refreshes

**Technical:**
- Modified columnWidths sync effect to only return new object if values actually changed (prevents unnecessary state updates)
- Added `prefsAppliedRef` to fallback timer for users with no saved preferences

---

### 2025-12-23: DataTable Auto-Persistence

**Added:**
- Auto-persistence for DataTable view preferences when `viewId` prop is provided
- DataTable now automatically loads/saves: column widths, column order, row order, sort rules, filter rules, group rules, wrap settings, thumbnail sizes
- No boilerplate code needed - just add `viewId="my-view"` to enable persistence

**Changed:**
- All DataTable pages consolidated to use `viewId` only - removed ~500 lines of preference boilerplate
- Pages updated: Creatives, AdCopyLibrary, AdPlanning, AdCombosList, VideoGenerator, AIVideoGenerated, SoraCharacters, PersonaAICopy, AdCombos
- AI Copy pages: Campaign Params, Personas, Angles, Creative Concepts, AI Ads
- DataTable imports `useAuth` to get user ID automatically if not provided
- Team View dropdown now shows for any DataTable with `viewId` prop
- Bundle size reduced by ~14KB

**Fixed:**
- Added missing `thumbnail_size_config` column to `user_view_preferences` and `shared_view_preferences` tables
- Team View now works correctly: saving as Team View syncs both shared AND user preferences, ensuring user sees the team view on reload and UI shows "✓ Team View" indicator

**Technical:**
- DataTable.tsx: Added internal preference state, auto-load on mount, debounced auto-save on change
- Removed from all pages: getUserViewPreferences, saveUserViewPreferences, deleteUserViewPreferences, getSharedViewPreferences, saveSharedViewPreferences imports and handlers
- Migration: `20251224000000_add_thumbnail_size_config.sql`

---

### 2025-12-23: Break CopyLibrary into Separate Pages

**Changed:**
- Split CopyLibrary tabbed page into 5 separate pages for better horizontal scrolling
- New pages: Campaign Params, Personas, Angles, Creative Concepts, AI Ads
- Updated Sidebar navigation with expanded AI Copy section
- All pages use `DataTablePageLayout` and shared datatable-defaults

**Removed:**
- CopyLibrary.tsx (replaced by individual pages)
- Tab-based DataTable rendering that caused scroll issues

**Technical:**
- Routes: `/campaign-params`, `/personas`, `/angles`, `/creative-concepts`, `/ai-ads`
- Redirect `/copy-library` → `/campaign-params`

---

### 2025-12-23: Mobile-Responsive Tab Bar

**Fixed:**
- Tab bar now horizontally scrolls on smaller screens instead of wrapping awkwardly
- Added `scrollbar-thin` CSS utility for subtle 4px scrollbar
- Tab text no longer breaks onto multiple lines

---

### 2025-12-23: Copy Library Project/Subproject Columns

**Added:**
- `project_id` and `subproject_id` columns to AI tables: `ai_personas`, `ai_angles`, `ai_generated_ads`, `creative_concepts`
- Project and Subproject columns to all 5 tabs in Copy Library (Campaign Params, Personas, Angles, Creative Concepts, Ads)
- Quick filters for project_id and subproject_id in all Copy Library tabs

**Changed:**
- Wrapped CopyLibrary page with `DataTablePageLayout` - fixes column width constraints, enables horizontal overflow
- Refactored all 5 DataTables to use shared column builders (`createProjectColumn`, `createSubprojectColumn`)
- Consolidated DataTable props using `DEFAULT_DATATABLE_PROPS` and `DEFAULT_QUICK_FILTERS`
- Replaced local colorPalette with shared `generateColorMap()` utility

**Technical:**
- Database migration: `20251223000000_add_project_columns_to_ai_tables.sql`
- Updated TypeScript interfaces: `AIPersona`, `AIAngle`, `AIGeneratedAd`, `CreativeConcept`
- Updated `PersonaAICopy.tsx` save functions to include new fields

---

### 2025-12-23: DataTable Selection Modal for Ad Combos

**Added:**
- `DataTableSelectionModal` component - Reusable modal wrapper for DataTable with selection functionality
  - Full DataTable features: sorting, filtering, column resizing, view mode toggle
  - Selection state management with confirm/cancel actions
  - Select All / Clear buttons in footer
  - Keyboard support (Escape to close)
  - Body scroll prevention when open

**Changed:**
- `AdCombos.tsx` - Replaced inline DataTables with compact selection cards + modal approach
  - New `SelectionCard` component shows selected count with preview of selected items
  - Click card to open DataTableSelectionModal with full DataTable functionality
  - Color-coded cards: blue (Creatives), purple (Headlines), green (Primary Text), amber (Descriptions)
  - More compact UI - see all 4 selection categories at once

---

### 2025-12-23: Unified Project/Subproject Columns Across All DataTables

**Changed:**
- Refactored all DataTable pages to use shared `createProjectColumn()` and `createSubprojectColumn()` from `datatable-defaults.ts`
- All pages now share the same project/subproject column behavior: dynamic subproject filtering, color maps, dependency handling
- Removed duplicated color palette and color map generation from all pages

**Updated Pages:**
- `AdCopyLibrary.tsx` - Now uses `generateColorMap()`, `AD_COPY_TYPE_COLORS`, `TRAFFIC_PLATFORM_COLORS` from shared module
- `Creatives.tsx` - Replaced ~50 lines of inline column config with 2 function calls
- `AdCombosList.tsx` - Uses shared functions + `TRAFFIC_PLATFORM_COLORS`
- `VideoGenerator.tsx` - Removed local `COLOR_PALETTE` constant, uses shared functions
- `AIVideoGenerated.tsx` - Uses shared functions with `editable: false` for read-only columns
- `AdCombos.tsx` - Uses shared functions for both Creative and AdCopy column definitions
- `AdPlanning.tsx` - Uses shared functions, removed duplicated column logic
- `PersonaAICopy.tsx` - Already using shared code via `useDataTableConfig` hook

**Technical:**
- Single source of truth for project/subproject column behavior
- Consistent color palette across all tables
- `optionsEditable: false` and `fallbackKey: 'project'` applied consistently
- Added `fallbackKey: 'subproject'` to `createSubprojectColumn()` for legacy data support
- `dependsOn` configuration for subproject-project relationship in all tables

---

### 2025-12-23: Centralized DataTable Configuration

**Added:**
- `src/lib/datatable-defaults.ts` - Centralized configuration for all DataTable instances
  - `COLOR_PALETTE` - Standard 10-color palette for projects/subprojects
  - `generateColorMap()` - Generate color maps from any array of items
  - `COLUMN_WIDTH_DEFAULTS` - Standard widths by column type (id, select, project, longtext, etc.)
  - `createProjectColumn()`, `createSubprojectColumn()` - Pre-configured columns with colors and dependency
  - `createUserColumn()`, `createDateColumn()`, `createIdColumn()` - Common column builders
  - `validateProjectSubprojectUpdate()` - Shared validation for project/subproject changes
  - `applyRowOrder()` - Apply saved row order from preferences
  - `DEFAULT_DATATABLE_PROPS` - Standard props (sortable, resizable, fullscreen, showRowActions)
  - `DEFAULT_QUICK_FILTERS` - Common quick filter keys
- `src/hooks/useDataTableConfig.ts` - React hook for DataTable configuration
  - Auto-loads user and shared preferences from database
  - Provides `handlePreferencesChange`, `handleSaveForEveryone`, `handleResetPreferences`
  - Pre-built column helpers with project/subproject colors
  - `applyRowOrderFromPrefs()` for applying saved row order

**Changed:**
- AI Copy Wizard now uses centralized DataTable configuration
- All new DataTables automatically get persistence, color coding, and default widths

---

### 2025-12-23: Campaign Parameters DataTable

**Changed:**
- Replaced Campaign Parameters form with DataTable in AI Copy Wizard
- Users can now view, edit, create, and delete campaign parameters directly in the table
- Added Project and Subproject columns to campaign parameters (editable via dropdowns)
- Subproject options dynamically filter based on selected project per row
- "Use Selected" button loads selected campaign into active form for generation
- Removed legacy form fields (textareas for Product/Service, Target Audience, etc.)

**Technical:**
- New state: `selectedCampaignIds` (Set<string>) for DataTable selection
- New handlers: `handleCreateCampaignParam`, `handleCampaignParamUpdate`, `handleCampaignParamDelete`, `handleUseSelectedCampaign`
- Removed unused refs: `productDescRef`, `personaInputRef`, `swipeFilesRef`, `productCustomPromptRef`
- Removed auto-resize textarea logic (no longer needed)
- Uses `useDataTableConfig` hook for persistence and color mapping

---

### 2025-12-23: DataTable Horizontal Scroll & Column Sizing Improvements

**Fixed:**
- DataTable can now scroll horizontally when columns exceed viewport width
- Removed `overflow-hidden` constraints from DashboardLayout, DataTablePageLayout, and DataTable
- CopyLibrary page now has resizable columns (was missing `resizable` prop)

**Changed:**
- DashboardLayout content wrapper: `overflow-hidden` → `overflow-y-auto overflow-x-hidden`
- DataTablePageLayout: Removed `overflow-hidden` and `max-w-full`
- DataTable fullscreen mode: `overflow-hidden` → `overflow-y-hidden`
- DataTable scroll container: Added `overflow-y-auto` and `min-w-0`
- Added `resizable={true}` to all 5 DataTable instances in CopyLibrary

**Added:**
- Type-based default column widths in DataTable (global defaults):
  - `select`: 100px (was 120px) - fits short labels like "Tort" better
  - `people`: 100px
  - `id`: 50px
  - `date`: 100px
  - `thumbnail`/`media`: 60-80px
  - `url`: 150px
  - `longtext`/`textarea`: 250-300px
- Type-based minimum widths when resizing:
  - `select`/`people`: 60px min
  - `id`: 40px min
  - `date`: 80px min
- Reduced explicit column widths across all pages for project/subproject columns
- **Thumbnail/Preview size now saved** to user and team preferences (`thumbnail_size_config`)

**Fixed (Mobile UX):**
- Model dropdown text no longer cut off on mobile (shortened to "Sonnet 4.5", "Opus 4.5", etc.)
- Removed `max-w-[140px]` constraint that was truncating dropdown
- "Model:" label hidden on mobile to save space
- Preset buttons simplified: "Load Preset" → "Load", "Save as New" → "Save"
- Buttons now in horizontal row on mobile instead of awkward wrap
- Using preset badge truncated to max 200px with cleaner layout

**Fixed (Copy Wizard):**
- Personas Eye icon (prompt viewer) now shows when loading personas from Library
- `SavedPersonasModal` now passes prompts alongside personas to parent component
- Prompts saved with personas are now restored when loading from CopyLibrary

**Added (Iterative Refinement for Personas):**
- New "Refine Results" section appears after generating personas
- Feedback textarea to provide refinement instructions (e.g., "Make more specific to injury victims")
- "Regenerate with Feedback" button sends previous output + feedback to AI for improved results
- Round counter badge shows how many refinement rounds have been done
- "Show Context Being Sent" collapsible panel shows full history that AI will see
- "Clear History" button to start fresh without previous context
- AI prompt now includes all previous generations and feedback for iterative improvement

**Technical (Iterative Refinement):**
- New `RefinementRound` interface for tracking history (replaces local `GenerationRound`)
- New state: `personaHistory`, `personaFeedback`, `showPersonaContext`, `selectedCampaignParamId`
- Updated `GeneratePersonasParams` in ai-service.ts with `history` and `currentFeedback` fields
- `generatePersonas()` now accepts `withFeedback` and `likeSelected` parameters
- System prompt changes to refinement-focused instructions when history exists

**Added (Persistent Refinement History):**
- New `refinement_history` JSONB column in `campaign_parameters` table
- History persists at user/campaign level - survives page refresh and session changes
- `RefinementHistory` interface with sections for personas, angles, and ads
- `updateRefinementHistory()` and `clearRefinementHistory()` functions in supabase-service
- History automatically loads when campaign parameter is selected via "Load" button
- History automatically saves to database after each refinement round

**Added (Thumbs Up/Down Feedback):**
- Thumbs up (👍) button on each persona card to mark as "liked" - AI will generate more like these
- Thumbs down (👎) button to mark as "disliked" - AI will avoid generating similar ones
- Visual feedback: green ring for liked, red ring for disliked personas
- Liked/disliked selections accumulate as context without immediately regenerating
- "Regenerate with Feedback" button combines: liked personas + disliked personas + text feedback
- Mutual exclusivity: persona can only be liked OR disliked, not both
- Tags display in refinement section showing liked/disliked counts
- Context preview panel shows all pending feedback (liked, disliked, text) before regeneration

---

### 2025-12-22: AI Generation Prompt Viewer

**Added:**
- Eye button in Copy Wizard sections (Personas, Angles, Ad Copies) to view generation prompts
- Prompt viewer modal shows system prompt, user prompt, and model used
- Prompts are stored with saved personas, angles, and ad copies in CopyLibrary
- Prompts column in CopyLibrary DataTable for personas, angles, and ads tabs
- New `prompts` JSONB column in `ai_personas`, `ai_angles`, and `ai_generated_ads` tables

**Technical:**
- New `AIPrompts` interface: `{ system, user, model }`
- Updated `AIPersona`, `AIAngle`, `AIGeneratedAd` interfaces to include optional `prompts` field
- `GenerationResult<T>` wrapper returns prompts alongside generated data
- Migration: `20251222130000_add_prompts_column.sql`

---

### 2025-12-22: Simplified Persona Format & Auto-Fill Word Limits

**Changed:**
- Persona structure simplified to just `name` (2-4 word label) + `description` (max 100 words)
- Removed complex multi-field structure (age, role, tagline, background, pain_points, goals, etc.)
- PersonaSelector UI now shows compact 3-column grid with simple cards
- AI generation prompt optimized for concise, actionable personas
- Auto-Fill now limits each input section to max 100 words (productDescription, personaInput, swipeFiles, customPrompt)

**Removed:**
- `SavedPersonasLibrary.tsx` page (was redirected to /copy-library anyway)
- `SavedPersona` type and legacy `saved_personas` table functions
- `createSavedPersona()` and `getSavedPersonas()` functions
- Complex PersonaDetailModal with multiple sections

**Technical:**
- Updated `Persona` interface: `{ id, name, description, selected? }`
- Updated `generatePersonas()` prompt for simple paragraph format
- Updated `generateAngles()` to use simplified persona summary
- Cleaner, more compact UI in PersonaSelector and SavedPersonasModal

---

### 2025-12-22: Copy Wizard Library Modal Fix & Save Ad Copies E2E

**Fixed:**
- Library modal now queries `ai_personas` table instead of legacy `saved_personas` table
- SavedPersonasModal updated to parse JSON content from ai_personas records
- Library modal now properly displays personas saved via Copy Wizard
- Commented out broken `handleUpdatePreset` function (uses legacy preset system)

**Added:**
- E2E test `Save Ad Copies to CopyLibrary` fully automated and passing
- All three save tests now pass: Personas, Angles, and Ad Copies
- Direct ad copy generation (without personas/angles) working correctly

**Technical:**
- `SavedPersonasModal.tsx` now uses `getAIPersonas()` instead of `getSavedPersonas()`
- Added JSON parsing for `AIPersona.content` field to extract persona data
- Updated table display to use `tagline` and `background` fields from Persona type
- Fixed `createCampaignParameter` call to include `created_by` field

---

### 2025-12-22: Copy Wizard Save to CopyLibrary - E2E Verified

**Fixed:**
- Save Personas, Angles, and Ad Copies to CopyLibrary now working correctly
- Fixed database column mapping (was using `project_id`, now uses `campaign_parameter_id`)
- All save functions now properly insert to `ai_personas`, `ai_angles`, `ai_generated_ads` tables

**Added:**
- E2E test `Save Personas to CopyLibrary` fully automated and passing
- E2E test `Save Angles to CopyLibrary` fully automated and passing
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

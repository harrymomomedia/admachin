# AdMachin

AI-powered ad copy and creative management platform for Facebook/Meta advertising.

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **Icons**: Lucide React
- **Drag & Drop**: @dnd-kit
- **Charts**: Recharts
- **Routing**: React Router DOM v7
- **Deployment**: Railway

## Project Structure

```
src/
├── App.tsx              # Main app with routing
├── main.tsx             # Entry point
├── index.css            # Global styles (Tailwind)
├── components/          # Reusable UI components
│   ├── DataTable.tsx    # Core table component with sorting, filtering, pagination
│   ├── CardView.tsx     # Gallery/card view for creatives
│   ├── Sidebar.tsx      # Navigation sidebar
│   ├── Header.tsx       # Page headers
│   ├── ad-creator/      # Ad creation modal components
│   ├── launch-steps/    # Launch wizard step components
│   ├── launch/          # Launch page section components
│   ├── fields/          # Form field components (SingleSelect, SearchInput, etc.)
│   └── settings/        # Settings-related modals
├── pages/               # Route pages
│   ├── AdCopyLibrary.tsx    # Home - ad copy management
│   ├── Creatives.tsx        # Creative assets management
│   ├── AdCreator.tsx        # Ad creation wizard
│   ├── PersonaAICopy.tsx    # AI copywriting with personas
│   ├── LaunchAd.tsx         # Ad launch workflow
│   └── ...
├── contexts/            # React Context providers
│   ├── AuthContext.tsx      # Authentication state
│   ├── FacebookContext.tsx  # Facebook API state
│   └── AIContext.tsx        # AI generation state
├── lib/                 # Core services
│   ├── supabase.ts          # Supabase client
│   ├── supabase-service.ts  # Database operations (CRUD)
│   ├── ai-service.ts        # AI/LLM integrations
│   └── database.types.ts    # Generated Supabase types
├── services/            # External API integrations
│   ├── ai/                  # AI service implementations
│   └── facebook/            # Facebook Graph API
├── types/               # TypeScript type definitions
├── layouts/             # Layout components
└── utils/               # Utility functions (cn, etc.)
```

## Commands

```bash
npm run dev          # Start dev server (port 5173)
npm run build        # TypeScript check + Vite build
npm run test         # Run Vitest tests
npm run test:run     # Run tests once
npm run lint         # ESLint check
npm run deploy       # Save + deploy to Railway
```

## Code Conventions

### Components
- Functional components with hooks
- Named exports (not default)
- Props destructured with TypeScript interfaces
- Use `cn()` utility for conditional classNames

### State
- React Context for global state (Auth, Facebook, AI)
- `useState` for local component state
- State setters named `set<State>` (e.g., `setIsOpen`, `setSelectedRows`)

### Styling
- Tailwind CSS classes
- No inline styles except for dynamic values
- Gray scale: gray-50 (lightest) to gray-900 (darkest)
- Primary color: blue-600
- Consistent spacing: p-4, gap-2, etc.

### Tailwind Preflight Conflicts (IMPORTANT)

Tailwind's preflight CSS resets default browser styles, which can break third-party libraries that depend on them.

**Known Issue - BlockNote Editor:**

1. **Margin on `<p>` elements**:
   - **Problem**: Tailwind adds `margin-top: 1.25rem` to all `<p>` elements
   - **Impact**: BlockNote uses `<p class="bn-inline-content">` for text. This margin pushes text below icons
   - **Solution**: `.bn-inline-content { margin: 0 !important; }`

2. **Code block text color**:
   - **Problem**: BlockNote code blocks have dark background but default text color is dark
   - **Impact**: Black text on black background = illegible
   - **Solution**: `[data-content-type="codeBlock"] pre, code { color: #fff !important; }`

**When integrating new libraries**, check if Tailwind preflight is breaking their styles. Common issues:
- Margins/padding on semantic elements (`<p>`, `<h1>`, `<ul>`, etc.)
- List styling removed (`list-style: none`)
- Border defaults changed
- Button/input styling reset

### File Naming
- Components: PascalCase.tsx (e.g., `DataTable.tsx`)
- Utilities: kebab-case.ts (e.g., `ai-service.ts`)
- Types: kebab-case.ts in types/ folder

### Imports
- React imports first
- External packages second
- Internal imports last (components, lib, types)
- Use relative paths for internal imports

## Key Components

### DataTable (CRITICAL - READ THIS FIRST)

DataTable is the **ONE central component** for ALL table/list/grid views. There is only ONE DataTable - no forks, no variations, no custom implementations.

#### 🎯 Core Philosophy

**Single Source of Truth**: All table functionality lives in DataTable. Pages don't add custom table code - they configure DataTable via props.

**How it works:**
1. **Need a feature?** → Add it to DataTable centrally (benefits ALL pages)
2. **Don't need a feature?** → Toggle it off via props
3. **Need a new mode?** → Add it to DataTable, then toggle via props

**What this means:**
- ✅ Changes to DataTable affect all tables consistently
- ✅ New features become available to all pages automatically
- ✅ Bug fixes apply everywhere at once
- ✅ No divergent behavior between pages

#### ⛔ NEVER DO THIS

1. **NEVER create `<table>` elements outside DataTable**
2. **NEVER write custom grid/list layouts for data**
3. **NEVER add table logic in individual pages**
4. **NEVER create a "simpler" table component**
5. **NEVER fork DataTable for a specific use case**

#### ✅ ALWAYS DO THIS

1. **Use DataTable for ANY data listing** (tables, grids, cards, lists)
2. **Configure via props** - toggle features on/off
3. **Need something new?** → Propose adding it to DataTable centrally
4. **Use `datatable-defaults.ts`** for shared column definitions

#### Feature Toggle Examples

DataTable supports toggling features on/off. Pages configure what they need:

```tsx
// Full-featured table (Ad Text page)
<DataTable
    columns={columns}
    data={data}
    sortable={true}
    selectable={true}
    editable={true}
    pagination={true}
    quickFilters={['project_id', 'subproject_id']}
    showRowActions={true}
    layout="fullPage"
/>

// Minimal inline table (embedded in accordion)
<DataTable
    columns={columns}
    data={data}
    sortable={false}
    selectable={true}
    pagination={false}
    layout="inline"
    maxHeight="300px"
/>

// Gallery/card view (Creatives page)
<DataTable
    columns={columns}
    data={data}
    viewMode="gallery"
    galleryConfig={{...}}
/>
```

#### Adding New Functionality

When you need something DataTable doesn't support:

1. **Ask:** "Should this be a central feature that benefits all tables?"
2. **If YES:** Add it to DataTable with a prop to enable/disable
3. **If NO:** Reconsider - it probably should be central

**Example:** Need a "compact row" mode?
- ❌ WRONG: Create custom compact table in the page
- ✅ RIGHT: Add `rowSize="compact" | "normal"` prop to DataTable

#### Current Modes & Props

| Prop | Options | Description |
|------|---------|-------------|
| `layout` | `"fullPage"` / `"inline"` | Full page vs embedded |
| `viewMode` | `"table"` / `"gallery"` | Table rows vs card grid |
| `sortable` | `true` / `false` | Enable sorting |
| `selectable` | `true` / `false` | Enable row selection |
| `pagination` | `true` / `false` | Enable pagination |
| `showRowActions` | `true` / `false` | Show row action buttons |
| `resizable` | `true` / `false` | Column resizing |
| `reorderable` | `true` / `false` | Drag-drop row reorder |

#### Supported Column Types

All column types are centrally defined. Use these, don't create custom renderers:

- `text` / `longtext` - Text with inline edit
- `select` - Dropdown with colors
- `date` - Date display/picker
- `url` - Clickable link
- `priority` - P1-P5 indicator
- `people` - User avatar picker
- `id` - Row number
- `thumbnail` / `media` - Image/video preview
- `filesize` - Formatted size
- `adcopy` - Ad copy picker

**Need a new type?** Add it to DataTable's column type system - it then works everywhere.

#### Centralized Column Definitions

Project/subproject columns are defined ONCE in `datatable-defaults.ts`:

```tsx
// Pages use the central builders - NEVER define these inline
const columns = [
    dataTableConfig.createProjectCol(),      // Central definition
    dataTableConfig.createSubprojectCol(),   // Central definition
    dataTableConfig.createDateCol(),         // Central definition
];
```

**Dependency logic** (subproject auto-sets project, etc.) is handled centrally in DataTable via `dependsOn` config. Pages don't implement this.

#### ⚠️ Known Technical Debt

These violate the single-source rule and need migration to DataTable:

| Location | Issue |
|----------|-------|
| `team-settings/ProjectsTab.tsx` | Custom `<table>` |
| `team-settings/SubprojectsTab.tsx` | Custom `<table>` |
| `team-settings/UsersTab.tsx` | Custom `<table>` |
| `pages/FBAdLibrary.tsx` | Custom card grid |
| `pages/FBAdAccounts.tsx` | Custom list layout |

**Do NOT add to this list.** Migrate these when touched.

### DataTable Usage Pattern

**Central Files:**
- `src/components/datatable/DataTable.tsx` - The ONE table component
- `src/lib/datatable-defaults.ts` - Shared column builders, constants
- `src/hooks/useDataTableConfig.ts` - Hook for persistence & column helpers

**Standard Usage:**

```tsx
import { useDataTableConfig } from '../hooks/useDataTableConfig';

// Use the hook for everything
const dataTableConfig = useDataTableConfig({
    viewId: 'your-page-id',
    userId: currentUserId,
    projects,
    subprojects,
    users,
});

// Columns use central builders
const columns = [
    dataTableConfig.createProjectCol(),
    dataTableConfig.createSubprojectCol(),
    dataTableConfig.createDateCol(),
    // Custom columns use central types
    { key: 'name', header: 'Name', type: 'text', editable: true },
];

// DataTable with persistence
<DataTable
    {...dataTableConfig.defaultProps}
    columns={columns}
    data={data}
    viewId="your-page-id"
    userId={currentUserId}
/>
```

**Available Central Builders:**
- `createProjectCol()` / `createSubprojectCol()` - With dependency logic
- `createUserCol()` / `createDateCol()` / `createIdCol()`

**Available Constants (in `datatable-defaults.ts`):**
- `COLOR_PALETTE` - Standard colors
- `COLUMN_WIDTH_DEFAULTS` - Standard widths by type

### Contexts
- `useAuth()` - User authentication state
- `useFacebook()` - Facebook profiles & ad accounts
- `useAI()` - AI generation state & progress

## Database (Supabase)

Key tables:
- `profiles` - Facebook profiles
- `ad_accounts` - Connected ad accounts
- `creatives` - Creative assets (images/videos)
- `ad_copies` - Ad copy text content
- `subprojects` - Project organization

Use `src/lib/supabase-service.ts` for all database operations.

## Testing

- Test framework: Vitest + React Testing Library
- E2E: Playwright
- Test files: `*.test.tsx` alongside components
- Run `npm test` before committing

## Mandatory Feature Testing (CRITICAL)

**Every function/feature built MUST be tested with Playwright E2E tests before completing the task.** Do NOT tell the user to test - YOU must verify it works end-to-end.

### What Requires Testing

ANY new or modified functionality that involves:
- **Button clicks** - Any button that triggers an action (save, delete, generate, etc.)
- **Form submissions** - Creating, updating, or saving data
- **API calls** - Any function that calls the backend or database
- **File uploads** - Uploading images, videos, or documents
- **CRUD operations** - Create, Read, Update, Delete on any data
- **Modal interactions** - Opening modals, selecting items, confirming actions
- **Navigation flows** - Multi-step wizards, page transitions with state
- **DataTable features** - Column edits, row creation, filtering, sorting, reordering
- **UI state changes** - Dropdowns, toggles, expand/collapse, selections

### Testing Process (MANDATORY)

1. **Build completes** - Run `npm run build` to verify TypeScript compiles
2. **Write/run E2E test** - Create or run a Playwright test that exercises the feature
3. **Verify the action** - Test must confirm the intended behavior works
4. **Check data persistence** - Verify data is saved to database (not just UI update)
5. **Report results** - Show the test output to confirm pass/fail

### Running Tests

```bash
# Run specific test file
npx playwright test e2e/your-feature.spec.ts --project=chromium

# Run with grep to target specific test
npx playwright test --grep "feature name" --project=chromium

# Run in headed mode to see the browser
npx playwright test --headed --project=chromium

# Run with UI for debugging
npx playwright test --ui
```

### Test File Location

- E2E tests go in `e2e/` folder
- Name format: `feature-name.spec.ts`
- Use existing test patterns from other spec files

### Example Test Structure

```typescript
import { test, expect } from '@playwright/test';

test('should create new row in DataTable', async ({ page }) => {
  await page.goto('/ad-planning');

  // Click the + button to create row
  await page.click('[data-testid="create-row-btn"]');

  // Verify row was created
  await expect(page.locator('table tbody tr')).toHaveCount(/* expected count */);

  // Verify data persisted (reload and check)
  await page.reload();
  await expect(page.locator('table tbody tr')).toHaveCount(/* same count */);
});
```

### ⛔ Task is NOT Complete Until

1. Playwright test runs successfully
2. Test verifies the actual feature behavior
3. Test output shows PASS (not just "no errors")

**Never assume code works just because TypeScript compiles.** Database schemas, API responses, and runtime behavior must be verified through actual Playwright testing before marking any task as done.

## Environment Variables

Required in `.env.local`:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- Facebook API credentials (if using FB features)

Never commit `.env` files.

## Changelog (REQUIRED)

**READ `CHANGELOG.md` at the start of each session** to understand recent changes and context before starting work.

**ALWAYS update `CHANGELOG.md` after completing any feature, fix, or significant change - do not wait to be asked.**

When to update:
- After adding new features or components
- After fixing bugs
- After changing UI/UX behavior
- After API or database changes
- After dependency updates

Format:
```markdown
### YYYY-MM-DD: Brief Title

**Added:**
- New features

**Changed:**
- Modifications to existing features

**Fixed:**
- Bug fixes

**Technical:**
- Dependencies, configs, internal changes
```

Keep entries compact - one line per change. Group related changes together. Add to the `## [Unreleased]` section at the top.

## Documentation

- `docs/RAILWAY_MIGRATION.md` - Guide for Vercel → Railway migration
- `CHANGELOG.md` - Log of all major changes

## Railway Deployment (IMPORTANT)

**After every `git push`, check Railway build logs for errors:**

```bash
# Check build logs for errors
railway logs --build --lines 50

# Look for: "error TS", "Build Failed", "exit code"
```

**Common build failures:**
- TypeScript errors in server build (`npm run build:server`)
- Import errors when server imports from `src/` (fix `tsconfig.server.json`)
- Missing environment variables

**If build fails:**
1. Check logs with `railway logs --build --lines 100`
2. Fix the error locally
3. Run `npm run build && npm run build:server` to verify
4. Push fix and re-check logs

**Runtime error monitoring:**
```bash
railway logs --lines 100 --filter "@level:error"
```

## Server-Side Processing (IMPORTANT)

**All background processes must be server-side.** When any task is triggered:

1. Save the task state to the database immediately
2. Process the task on the server (via API routes or cron jobs)
3. Store all progress, logs, and results in the database
4. Frontend only displays current state from the database

**Never rely on the browser staying open.** If a user closes their browser, refreshes the page, or loses connection, all work must continue uninterrupted on the server.

This applies to:
- AI generation tasks
- Video/image processing
- File uploads and transformations
- Any long-running operations
- Status polling (use server cron, not browser polling)

## AI Model Configuration (CRITICAL)

**Single Source of Truth:** `src/lib/ai-models.ts`

All AI model configurations MUST be defined in this centralized file. NEVER hardcode model IDs elsewhere.

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/ai-models.ts` | **Central config** - model IDs, display names, providers, limits |
| `server/routes/ai.ts` | Server-side AI API routes - imports from ai-models.ts |
| `src/lib/ai-service.ts` | Client-side AI functions - imports AIModel type from ai-models.ts |

### Current Model IDs (Claude 4.5 Family)

| App Model ID | API Model ID | Max Tokens |
|--------------|--------------|------------|
| `claude-sonnet-4.5` | `claude-sonnet-4-5-20250929` | 64,000 |
| `claude-haiku-4.5` | `claude-haiku-4-5-20251001` | 64,000 |
| `claude-opus-4.5` | `claude-opus-4-5-20251101` | 64,000 |
| `gpt` | `gpt-4o` | 4,096 |
| `gemini` | `gemini-1.5-pro` | 8,192 |

### ⛔ Common Mistakes to Avoid

1. **NEVER hardcode model IDs** - Always use `getApiModelId()` from ai-models.ts
2. **NEVER guess model IDs** - Check Anthropic docs: https://platform.claude.com/docs/en/about-claude/models
3. **NEVER use `-latest` aliases in production** - Use dated versions for stability
4. **NEVER duplicate model config** - Import from ai-models.ts

### ✅ Correct Usage

```typescript
// In server code
import { getApiModelId } from '../../src/lib/ai-models.js';
const apiModelId = getApiModelId('claude-sonnet-4.5'); // Returns 'claude-sonnet-4-5-20250929'

// In client code
import type { AIModel } from '../lib/ai-models';
import { getModelConfig, getDisplayName } from '../lib/ai-models';
```

### Updating Model IDs

When Anthropic releases new models:

1. Check docs: https://platform.claude.com/docs/en/about-claude/models
2. Or use API: `GET https://api.anthropic.com/v1/models` with `x-api-key` header
3. Update ONLY `src/lib/ai-models.ts`
4. Restart server - changes propagate automatically

### Model ID Format Patterns

Anthropic model IDs follow this pattern:
- `claude-{tier}-{version}-{date}` e.g., `claude-sonnet-4-5-20250929`
- Tier: `haiku` (fast), `sonnet` (balanced), `opus` (powerful)
- Version: `4-5` means Claude 4.5 family
- Date: `YYYYMMDD` snapshot date

### API Error Handling

Common errors and solutions:

| Error | Cause | Solution |
|-------|-------|----------|
| `model: not found` | Wrong model ID | Check ai-models.ts has correct ID from docs |
| `authentication_error` | Missing/invalid API key | Check ANTHROPIC_API_KEY in .env |
| `rate_limit_error` | Too many requests | Implement retry with backoff |
| `overloaded_error` | API at capacity | Retry after delay |

### Testing Model Configuration

After any model ID changes, test with:
```bash
curl -s -X POST http://localhost:3001/api/ai-generate \
  -H "Content-Type: application/json" \
  -d '{"model":"claude-sonnet-4.5","systemPrompt":"Say hi","userPrompt":"Hello"}'
```

All three Claude models should return valid responses before deploying.

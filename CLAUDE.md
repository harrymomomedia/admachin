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
- **Deployment**: Vercel

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
npm run deploy       # Save + deploy to Vercel
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

### DataTable (IMPORTANT)

DataTable is the **single source of truth** for all table/list views in the app.

**Rule: Always extend DataTable, never build custom tables.**

When adding table functionality:
- Add new column types to DataTable (e.g., `url`, `priority`, `people`)
- Add new features as DataTable props/options
- Do NOT write custom table code in individual pages

Example: Need a "status" column? Add `type: 'status'` to DataTable's column types, not a custom renderer in the page.

Supported column types:
- `text` - Plain text with inline edit
- `textarea` - Multi-line text
- `select` - Dropdown selection
- `date` - Date picker
- `url` - Clickable link with favicon
- `priority` - Priority indicator (P1-P4)
- `people` - Avatar chips with multi-select
- `id` - ID display
- `thumbnail` - Image/video thumbnail preview
- `filesize` - Formatted file size (bytes to KB/MB)
- `custom` - Escape hatch (avoid if possible)

Built-in features:
- Inline editing
- Row selection & bulk actions
- Multi-column sorting
- Filtering
- Pagination
- Row reordering (drag & drop)
- Gallery view mode for creatives

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

## Environment Variables

Required in `.env.local`:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- Facebook API credentials (if using FB features)

Never commit `.env` files.

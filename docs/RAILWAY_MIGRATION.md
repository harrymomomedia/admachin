# Railway Migration Guide

## Status: ✅ MIGRATION COMPLETE (2025-12-21)

The Express server and all API routes have been converted. See the **Completed Files** section below.

## Overview
Migrate AdMachin from Vercel to Railway for unified hosting of frontend, API, and Playwright automation.

## Current Architecture (Vercel)
```
Vercel
├── Frontend (React/Vite static)
├── API Routes (Serverless functions)
└── Cron Jobs (vercel.json)
```

## Target Architecture (Railway)
```
Railway
├── Frontend (Static serve)
├── API Server (Express.js)
├── Cron Jobs (node-cron)
└── Playwright Automation (headless)
```

---

## Migration Steps

### Step 1: Create Express Server
Create `server.ts` at project root:

```typescript
import express from 'express';
import cors from 'cors';
import path from 'path';
import cron from 'node-cron';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// API Routes (import converted routes)
import videoRoutes from './api-express/video';
import aiRoutes from './api-express/ai';
import authRoutes from './api-express/auth';
import teamRoutes from './api-express/team';
import presetRoutes from './api-express/presets';

app.use('/api/video', videoRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/presets', presetRoutes);

// Serve static frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static('dist'));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

// Cron: Sync video tasks every minute
cron.schedule('* * * * *', async () => {
  // Call sync-tasks logic
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

### Step 2: Convert API Routes

**Pattern: Vercel → Express**

```typescript
// BEFORE: api/video/generate.ts (Vercel)
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { prompt } = req.body;
  // ... logic
  res.json({ success: true, taskId: '...' });
}

// AFTER: api-express/video.ts (Express)
import { Router } from 'express';

const router = Router();

router.post('/generate', async (req, res) => {
  const { prompt } = req.body;
  // ... same logic
  res.json({ success: true, taskId: '...' });
});

export default router;
```

### Step 3: Completed Files

| Vercel File | Express File | Status |
|-------------|--------------|--------|
| `api/video/*` | `server/routes/video.ts` | ✅ Done |
| `api/ai-generate.ts` | `server/routes/ai.ts` | ✅ Done |
| `api/ai/generate.ts` | `server/routes/ai.ts` | ✅ Done |
| `api/presets.ts` | `server/routes/presets.ts` | ✅ Done |
| `api/auth/facebook/*` | `server/routes/auth.ts` | ✅ Done |
| `api/team/*` | `server/routes/team.ts` | ✅ Done |
| `api/services/*` | `server/services/*` | ✅ Done |

### Step 4: Update package.json

```json
{
  "scripts": {
    "dev": "tsx watch server.ts",
    "build": "tsc && vite build",
    "start": "node dist/server.js",
    "sora:generate": "tsx scripts/sora-web-generator.ts"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "node-cron": "^3.0.3"
  }
}
```

### Step 5: Railway Configuration

Create `railway.json`:
```json
{
  "build": {
    "builder": "nixpacks"
  },
  "deploy": {
    "startCommand": "npm run start",
    "healthcheckPath": "/api/health"
  }
}
```

Or use Railway dashboard to set:
- **Build Command**: `npm run build`
- **Start Command**: `npm run start`

### Step 6: Environment Variables

Copy from Vercel to Railway:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `KIE_API_KEY`
- `GEMINI_API_KEY`
- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`
- `FB_APP_ID`
- `FB_APP_SECRET`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

---

## Cron Migration

**Vercel (vercel.json):**
```json
{
  "crons": [{
    "path": "/api/video/sync-tasks",
    "schedule": "* * * * *"
  }]
}
```

**Railway (node-cron in server.ts):**
```typescript
import cron from 'node-cron';
import { syncVideoTasks } from './api-express/video';

// Every minute
cron.schedule('* * * * *', async () => {
  console.log('[Cron] Running video sync...');
  await syncVideoTasks();
});
```

---

## Playwright on Railway

For headless Playwright on Railway:

1. Update `scripts/sora-web-generator.ts`:
```typescript
const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
  headless: process.env.NODE_ENV === 'production', // Headless on server
  // ...
});
```

2. Railway needs Playwright browsers installed. Add to build:
```bash
npx playwright install chromium
```

3. Session persistence:
   - Export cookies from local browser session
   - Store in environment variable or Supabase
   - Inject on server startup

---

## Rollback Plan

Keep Vercel project active during migration:
1. Test Railway deployment thoroughly
2. Update DNS only when confident
3. Vercel project can be reactivated if needed

---

## Estimated Timeline

| Task | Duration |
|------|----------|
| Create Express server | 30 min |
| Convert video API routes | 1 hr |
| Convert AI/preset routes | 1 hr |
| Convert auth/team routes | 1 hr |
| Setup node-cron | 30 min |
| Railway deployment | 30 min |
| Testing & fixes | 1-2 hrs |
| **Total** | **5-6 hours** |

---

## Benefits After Migration

1. **No function timeouts** - Video sync can run 5+ minutes
2. **Single platform** - Easier management
3. **Playwright ready** - Can run browser automation on server
4. **Cost effective** - ~$7-15/mo vs potential Vercel overages
5. **More control** - Full Node.js runtime, not serverless

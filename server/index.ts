/**
 * Express Server for AdMachin
 *
 * Replaces Vercel serverless functions with a single Express server.
 * Can be deployed to Railway or any Node.js hosting.
 */

// Load environment variables first
import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import cron from 'node-cron';

// Import route handlers
import videoRoutes from './routes/video.js';
import aiRoutes from './routes/ai.js';
import presetsRoutes from './routes/presets.js';
import authRoutes from './routes/auth.js';
import teamRoutes from './routes/team.js';
import tiptapRoutes from './routes/tiptap.js';

// Import cron job
import { syncVideoTasks } from './routes/video.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
    origin: process.env.NODE_ENV === 'production'
        ? process.env.FRONTEND_URL
        : ['http://localhost:5173', 'http://localhost:3000'],
    credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging in development
if (process.env.NODE_ENV !== 'production') {
    app.use((req, _res, next) => {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
        next();
    });
}

// Health check endpoint
app.get('/api/health', (_req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        env: process.env.NODE_ENV || 'development',
    });
});

// API Routes
app.use('/api/video', videoRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/ai-generate', aiRoutes); // Legacy endpoint
app.use('/api/presets', presetsRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/tiptap', tiptapRoutes);

// Serve static frontend in production
if (process.env.NODE_ENV === 'production') {
    const distPath = path.join(__dirname, '..', 'dist');
    app.use(express.static(distPath));

    // SPA fallback - serve index.html for all non-API routes
    // Express 5 requires named parameter instead of *
    app.use((req, res, next) => {
        if (!req.path.startsWith('/api')) {
            res.sendFile(path.join(distPath, 'index.html'));
        } else {
            next();
        }
    });
}

// Error handling middleware
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[Server Error]', err);
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
});

// Cron Jobs
// Sync video tasks every minute (was in vercel.json crons)
cron.schedule('* * * * *', async () => {
    console.log('[Cron] Running video sync...');
    try {
        await syncVideoTasks();
        console.log('[Cron] Video sync complete');
    } catch (error) {
        console.error('[Cron] Video sync error:', error);
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════╗
║         AdMachin Server Started            ║
╠════════════════════════════════════════════╣
║  Port: ${String(PORT).padEnd(35)}║
║  Mode: ${(process.env.NODE_ENV || 'development').padEnd(35)}║
║  Time: ${new Date().toISOString().padEnd(35)}║
╚════════════════════════════════════════════╝
    `);
});

export default app;

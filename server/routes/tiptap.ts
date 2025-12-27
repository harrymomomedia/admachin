/**
 * Tiptap Routes - JWT generation for Collaboration and AI
 *
 * Following official Tiptap guide:
 * https://tiptap.dev/docs/collaboration/getting-started/authenticate#integrate-jwt-server-side
 *
 * Secrets are stored server-side and never exposed to the client.
 */

import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

const router = Router();

// Environment variables (server-side only, no VITE_ prefix)
const TIPTAP_COLLAB_APP_ID = process.env.TIPTAP_COLLAB_APP_ID || '0k3drwem';
const TIPTAP_COLLAB_SECRET = process.env.TIPTAP_COLLAB_SECRET || '';
const TIPTAP_AI_APP_ID = process.env.TIPTAP_AI_APP_ID || 'j9yj3v69';
const TIPTAP_AI_SECRET = process.env.TIPTAP_AI_SECRET || '';

/**
 * POST /api/tiptap/collaboration
 * Returns a JWT token for Tiptap Collaboration
 *
 * Based on: https://tiptap.dev/docs/collaboration/getting-started/authenticate
 */
router.post('/collaboration', async (req: Request, res: Response) => {
    try {
        if (!TIPTAP_COLLAB_SECRET) {
            return res.status(500).json({
                error: 'Collaboration secret not configured',
                message: 'Set TIPTAP_COLLAB_SECRET in environment variables'
            });
        }

        // Get user info from request (optional - for access control)
        const userId = req.body?.userId || 'anonymous';
        const allowedDocumentNames = req.body?.allowedDocumentNames;

        // Build payload following Tiptap's guide
        const payload: Record<string, unknown> = {
            sub: userId, // User identifier
        };

        // Optionally restrict document access
        if (allowedDocumentNames && Array.isArray(allowedDocumentNames)) {
            payload.allowedDocumentNames = allowedDocumentNames;
        }

        // Sign with secret (never expose secret to client!)
        const token = jwt.sign(payload, TIPTAP_COLLAB_SECRET);

        res.json({ token });
    } catch (error) {
        console.error('[Tiptap] Collaboration token error:', error);
        res.status(500).json({ error: 'Failed to generate collaboration token' });
    }
});

/**
 * POST /api/tiptap/ai
 * Returns a JWT token for Tiptap AI
 */
router.post('/ai', async (req: Request, res: Response) => {
    try {
        if (!TIPTAP_AI_SECRET) {
            return res.status(500).json({
                error: 'AI secret not configured',
                message: 'Set TIPTAP_AI_SECRET in environment variables'
            });
        }

        const userId = req.body?.userId || 'anonymous';

        const payload = {
            sub: userId,
        };

        const token = jwt.sign(payload, TIPTAP_AI_SECRET);

        res.json({ token });
    } catch (error) {
        console.error('[Tiptap] AI token error:', error);
        res.status(500).json({ error: 'Failed to generate AI token' });
    }
});

/**
 * GET /api/tiptap/config
 * Returns public Tiptap configuration (app IDs only, no secrets)
 */
router.get('/config', (_req: Request, res: Response) => {
    res.json({
        collabAppId: TIPTAP_COLLAB_APP_ID,
        aiAppId: TIPTAP_AI_APP_ID,
        docPrefix: process.env.TIPTAP_COLLAB_DOC_PREFIX || 'admachin-',
    });
});

export default router;

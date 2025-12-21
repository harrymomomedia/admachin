/**
 * Presets API Routes - Express version
 * Converted from Vercel serverless functions
 */

import { Router, Request, Response } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const router = Router();

// Create Supabase client with service role key (server-side only)
function getSupabaseAdmin(): SupabaseClient | null {
    const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceKey) {
        return null;
    }

    return createClient(url, serviceKey);
}

// ============================================
// GET /api/presets - List all presets
// ============================================
router.get('/', async (_req: Request, res: Response) => {
    try {
        const supabase = getSupabaseAdmin();
        if (!supabase) {
            return res.status(500).json({ error: 'Missing Supabase configuration' });
        }

        const { data, error } = await supabase
            .from('ai_copywriting_presets')
            .select('*')
            .order('name', { ascending: true });

        if (error) throw error;
        return res.json(data);
    } catch (error) {
        console.error('Preset API error:', error);
        return res.status(500).json({
            error: error instanceof Error ? error.message : 'Internal server error'
        });
    }
});

// ============================================
// POST /api/presets - Create new preset
// ============================================
router.post('/', async (req: Request, res: Response) => {
    try {
        const supabase = getSupabaseAdmin();
        if (!supabase) {
            return res.status(500).json({ error: 'Missing Supabase configuration' });
        }

        const { data, error } = await supabase
            .from('ai_copywriting_presets')
            .insert(req.body)
            .select()
            .single();

        if (error) throw error;
        return res.status(201).json(data);
    } catch (error) {
        console.error('Preset API error:', error);
        return res.status(500).json({
            error: error instanceof Error ? error.message : 'Internal server error'
        });
    }
});

// ============================================
// PUT /api/presets - Update preset
// ============================================
router.put('/', async (req: Request, res: Response) => {
    try {
        const supabase = getSupabaseAdmin();
        if (!supabase) {
            return res.status(500).json({ error: 'Missing Supabase configuration' });
        }

        const { id, ...updates } = req.body;
        if (!id) {
            return res.status(400).json({ error: 'Missing preset id' });
        }

        const { data, error } = await supabase
            .from('ai_copywriting_presets')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return res.json(data);
    } catch (error) {
        console.error('Preset API error:', error);
        return res.status(500).json({
            error: error instanceof Error ? error.message : 'Internal server error'
        });
    }
});

// ============================================
// DELETE /api/presets - Delete preset
// ============================================
router.delete('/', async (req: Request, res: Response) => {
    try {
        const supabase = getSupabaseAdmin();
        if (!supabase) {
            return res.status(500).json({ error: 'Missing Supabase configuration' });
        }

        const { id } = req.query;
        if (!id || typeof id !== 'string') {
            return res.status(400).json({ error: 'Missing preset id' });
        }

        const { error } = await supabase
            .from('ai_copywriting_presets')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return res.status(204).end();
    } catch (error) {
        console.error('Preset API error:', error);
        return res.status(500).json({
            error: error instanceof Error ? error.message : 'Internal server error'
        });
    }
});

export default router;

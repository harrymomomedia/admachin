import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import * as fs from 'fs';
import * as path from 'path';
import { config as dotenvConfig } from 'dotenv';

// Load .env.local for server middleware (Vite's loadEnv only works for client)
dotenvConfig({ path: '.env.local' });

// Type definitions for API responses
interface KieApiResponse {
  code: number;
  msg?: string;
  data?: {
    taskId?: string;
    status?: string;
    state?: string;
    output?: {
      video_url?: string;
      thumbnail_url?: string;
    };
    videoUrl?: string;
    imageUrl?: string;
    // Old kie.ai format
    videoInfo?: {
      videoUrl?: string;
      imageUrl?: string;
    };
    // Sora 2 format
    resultJson?: string;
    error?: string;
    failMsg?: string;
  };
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  error?: {
    message?: string;
  };
}

// https://vite.dev/config/
export default defineConfig({
  // Proxy API requests to Express server in development
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  plugins: [
    react(),
    process.env.HTTPS ? basicSsl() : undefined,
    // Legacy API middleware - kept as fallback, proxy takes precedence
    {
      name: 'api-middleware',
      configureServer(server) {
        server.middlewares.use('/api/auth/facebook/session', (_req, res) => {
          // Simulation of the serverless function for local dev
          // We must implement the TokenStorage read logic here as well
          const storageFile = path.resolve(process.cwd(), '.auth_store.json');

          let storedSession = null;
          try {
            if (fs.existsSync(storageFile)) {
              storedSession = JSON.parse(fs.readFileSync(storageFile, 'utf-8'));
            }
          } catch (e) { console.error('Simulated session read failed', e); }

          // Fallback to Env
          if (!storedSession) {
            const token = process.env.FB_ACCESS_TOKEN || process.env.VITE_DEFAULT_FB_TOKEN;
            const userName = process.env.FB_USER_NAME || process.env.VITE_DEFAULT_FB_USER_NAME || 'System User';
            if (token) {
              storedSession = {
                accessToken: token,
                tokenExpiry: Date.now() + (365 * 24 * 60 * 60 * 1000),
                userName: userName,
                userId: 'system_env_user'
              };
            }
          }

          if (!storedSession) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ isAuthenticated: false }));
            return;
          }

          const session = {
            isAuthenticated: true,
            teamName: 'Momomedia', // Team Context
            profile: {
              id: storedSession.userId,
              name: storedSession.userName,
              accessToken: storedSession.accessToken,
              tokenExpiry: storedSession.tokenExpiry
            }
          };

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(session));
        });

        // AI API proxy - load the serverless function handler
        server.middlewares.use(async (req, res, next) => {
          if (req.url === '/api/ai-generate' && req.method === 'POST') {
            // Ensure environment variables are available for the handler
            if (!process.env.ANTHROPIC_API_KEY && process.env.VITE_ANTHROPIC_API_KEY) {
              process.env.ANTHROPIC_API_KEY = process.env.VITE_ANTHROPIC_API_KEY;
            }
            if (!process.env.OPENAI_API_KEY && process.env.VITE_OPENAI_API_KEY) {
              process.env.OPENAI_API_KEY = process.env.VITE_OPENAI_API_KEY;
            }
            if (!process.env.GOOGLE_API_KEY && process.env.VITE_GOOGLE_API_KEY) {
              process.env.GOOGLE_API_KEY = process.env.VITE_GOOGLE_API_KEY;
            }

            // Dynamically import the serverless function
            const handler = await import('./api/ai-generate');
            // Convert Node.js req/res to Vercel format
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', async () => {
              const vercelReq = {
                method: req.method,
                body: JSON.parse(body),
                headers: req.headers
              };
              const vercelRes = {
                status: (code: number) => {
                  res.statusCode = code;
                  return vercelRes;
                },
                json: (data: any) => {
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify(data));
                },
                setHeader: (name: string, value: string) => {
                  res.setHeader(name, value);
                },
                end: () => res.end()
              };
              await handler.default(vercelReq as any, vercelRes as any);
            });
          } else {
            next();
          }
        });

        // Video API proxy - handles /api/video/* routes
        server.middlewares.use(async (req, res, next) => {
          if (req.url?.startsWith('/api/video/')) {
            const KIE_API_KEY = process.env.KIE_API_KEY || process.env.VITE_KIE_API_KEY;
            const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
            const KIE_API_BASE = 'https://api.kie.ai/api/v1';

            // CORS headers
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

            if (req.method === 'OPTIONS') {
              res.statusCode = 200;
              res.end();
              return;
            }

            const urlObj = new URL(req.url || '', 'http://localhost');

            // GET /api/video/generate - check if configured
            if (urlObj.pathname === '/api/video/generate' && req.method === 'GET') {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ configured: !!KIE_API_KEY }));
              return;
            }

            // POST /api/video/generate - start video generation (Sora 2 T2V)
            if (urlObj.pathname === '/api/video/generate' && req.method === 'POST') {
              if (!KIE_API_KEY) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: false, error: 'KIE_API_KEY not configured' }));
                return;
              }

              let body = '';
              req.on('data', chunk => { body += chunk; });
              req.on('end', async () => {
                try {
                  const { prompt, model, duration, aspectRatio } = JSON.parse(body);

                  // Use selected model or default to Sora 2
                  const selectedModel = model || 'sora-2-text-to-video';

                  // Text-to-Video request format
                  // n_frames must be string: "10" or "15"
                  const requestBody = {
                    model: selectedModel,
                    input: {
                      prompt: prompt,
                      n_frames: duration === 15 ? '15' : '10', // String without 's'
                      aspect_ratio: aspectRatio === 'portrait' ? 'portrait' : 'landscape',
                    },
                  };

                  console.log(`[Video API] ${selectedModel} - Generating video:`, requestBody);

                  const kieResponse = await fetch(`${KIE_API_BASE}/jobs/createTask`, {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${KIE_API_KEY}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(requestBody),
                  });

                  const data = await kieResponse.json() as KieApiResponse;
                  console.log('[Video API] Response:', data);

                  res.setHeader('Content-Type', 'application/json');
                  if (data.code === 200 && data.data?.taskId) {
                    res.end(JSON.stringify({ success: true, taskId: data.data.taskId }));
                  } else {
                    res.end(JSON.stringify({ success: false, error: data.msg || 'Failed to generate video' }));
                  }
                } catch (error) {
                  console.error('[Video API] Error:', error);
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ success: false, error: String(error) }));
                }
              });
              return;
            }

            // GET /api/video/status - check video status
            if (urlObj.pathname === '/api/video/status' && req.method === 'GET') {
              if (!KIE_API_KEY) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: false, error: 'KIE_API_KEY not configured' }));
                return;
              }

              const taskId = urlObj.searchParams.get('taskId');
              if (!taskId) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: false, error: 'Missing taskId parameter' }));
                return;
              }

              try {
                // Sora 2 status endpoint
                const kieResponse = await fetch(
                  `${KIE_API_BASE}/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`,
                  {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${KIE_API_KEY}` },
                  }
                );

                const data = await kieResponse.json() as KieApiResponse;
                console.log('[Video API] Sora 2 Status:', data);

                res.setHeader('Content-Type', 'application/json');
                if (data.code === 200 && data.data) {
                  // Map Sora 2 response to our format
                  // Sora 2 uses 'state' field, older API uses 'status'
                  // Possible states: waiting, pending, processing, completed, success, failed, fail
                  const rawState = data.data.state || data.data.status || '';
                  const stateMap: Record<string, string> = {
                    'pending': 'queueing',
                    'waiting': 'queueing',
                    'processing': 'generating',
                    'completed': 'success',
                    'success': 'success',
                    'failed': 'fail',
                    'fail': 'fail',
                  };

                  // Handle different video URL locations
                  let videoUrl = data.data.output?.video_url || data.data.videoUrl;
                  let imageUrl = data.data.output?.thumbnail_url || data.data.imageUrl;

                  // Check videoInfo object (old format)
                  if (!videoUrl && data.data.videoInfo?.videoUrl) {
                    videoUrl = data.data.videoInfo.videoUrl;
                  }
                  if (!imageUrl && data.data.videoInfo?.imageUrl) {
                    imageUrl = data.data.videoInfo.imageUrl;
                  }

                  // Check resultJson (Sora 2 format)
                  // Format: {"resultUrls":["https://..."],"resultWaterMarkUrls":["https://..."]}
                  if (!videoUrl && data.data.resultJson) {
                    try {
                      const result = JSON.parse(data.data.resultJson);
                      // resultUrls contains the video URLs (array)
                      if (result.resultUrls && result.resultUrls.length > 0) {
                        videoUrl = result.resultUrls[0];
                      }
                      // resultWaterMarkUrls might have thumbnail
                      if (!imageUrl && result.resultWaterMarkUrls && result.resultWaterMarkUrls.length > 0) {
                        imageUrl = result.resultWaterMarkUrls[0];
                      }
                    } catch {}
                  }

                  console.log(`[Video API] Status result: state=${rawState}, videoUrl=${videoUrl || 'none'}`);

                  res.end(JSON.stringify({
                    success: true,
                    taskId: data.data.taskId,
                    state: stateMap[rawState] || rawState,
                    videoUrl,
                    imageUrl,
                    failMsg: data.data.error || data.data.failMsg,
                  }));
                } else {
                  res.end(JSON.stringify({ success: false, error: data.msg || 'Failed to get status' }));
                }
              } catch (error) {
                console.error('[Video API] Status error:', error);
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: false, error: String(error) }));
              }
              return;
            }

            // POST /api/video/transcript - generate transcript
            if (urlObj.pathname === '/api/video/transcript' && req.method === 'POST') {
              if (!GEMINI_API_KEY) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: false, error: 'GEMINI_API_KEY not configured' }));
                return;
              }

              let body = '';
              req.on('data', chunk => { body += chunk; });
              req.on('end', async () => {
                try {
                  const { videoUrl } = JSON.parse(body);

                  console.log('[Video API] Generating transcript for:', videoUrl);

                  const geminiResponse = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
                    {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        contents: [{
                          parts: [
                            { fileData: { mimeType: 'video/mp4', fileUri: videoUrl } },
                            { text: 'Please transcribe all spoken words in this video. If there is no speech, describe what is happening visually in 2-3 sentences. Return only the transcript or description.' },
                          ],
                        }],
                        generationConfig: { temperature: 0.3, maxOutputTokens: 2000 },
                      }),
                    }
                  );

                  const data = await geminiResponse.json() as GeminiResponse;
                  res.setHeader('Content-Type', 'application/json');

                  if (geminiResponse.ok) {
                    const transcript = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
                    res.end(JSON.stringify({ success: true, transcript: transcript.trim() }));
                  } else {
                    res.end(JSON.stringify({ success: false, error: data.error?.message || 'Transcript generation failed' }));
                  }
                } catch (error) {
                  console.error('[Video API] Transcript error:', error);
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ success: false, error: String(error) }));
                }
              });
              return;
            }

            // GET /api/video/sync-tasks - sync pending tasks (for local testing)
            if (urlObj.pathname === '/api/video/sync-tasks' && (req.method === 'GET' || req.method === 'POST')) {
              const supabaseUrl = process.env.VITE_SUPABASE_URL;
              const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

              if (!supabaseUrl || !supabaseServiceKey) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Supabase not configured' }));
                return;
              }

              // Helper to append a log entry
              interface LogEntry {
                id: number;
                timestamp: string;
                type: 'info' | 'success' | 'error' | 'warning';
                message: string;
              }

              // Format elapsed time
              const formatElapsed = (startTime: Date): string => {
                const elapsed = Math.floor((Date.now() - startTime.getTime()) / 1000);
                const mins = Math.floor(elapsed / 60);
                const secs = elapsed % 60;
                return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
              };

              try {
                const { createClient } = await import('@supabase/supabase-js');
                const supabase = createClient(supabaseUrl, supabaseServiceKey);

                // Get all pending/processing video outputs with logs and created_at
                const { data: pendingTasks, error: fetchError } = await supabase
                  .from('video_output')
                  .select('id, video_generator_id, task_id, task_status, logs, created_at')
                  .in('task_status', ['pending', 'processing']);

                if (fetchError) {
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: 'Failed to fetch pending tasks' }));
                  return;
                }

                if (!pendingTasks || pendingTasks.length === 0) {
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ message: 'No pending tasks', synced: 0 }));
                  return;
                }

                console.log(`[Sync] Found ${pendingTasks.length} pending tasks`);

                let synced = 0, completed = 0, failed = 0;

                for (const task of pendingTasks) {
                  if (!task.task_id) continue;

                  // Skip web-based tasks (handled by Playwright script, not kie.ai)
                  if (task.task_id.startsWith('web-')) {
                    console.log(`[Sync] Skipping web task ${task.task_id} (handled by sora-web-generator)`);
                    continue;
                  }

                  // Get existing logs
                  let logs: LogEntry[] = (task.logs as LogEntry[]) || [];
                  const startTime = new Date(task.created_at);

                  // Helper to append log
                  const appendLog = async (type: LogEntry['type'], message: string, save = true) => {
                    const newLog: LogEntry = {
                      id: logs.length > 0 ? Math.max(...logs.map(l => l.id)) + 1 : 1,
                      timestamp: new Date().toISOString(),
                      type,
                      message,
                    };
                    logs = [...logs, newLog];
                    if (save) {
                      await supabase.from('video_output').update({ logs }).eq('id', task.id);
                    }
                  };

                  try {
                    const kieResponse = await fetch(
                      `${KIE_API_BASE}/jobs/recordInfo?taskId=${encodeURIComponent(task.task_id)}`,
                      { headers: { 'Authorization': `Bearer ${KIE_API_KEY}` } }
                    );
                    const statusData = await kieResponse.json() as KieApiResponse;

                    if (statusData.code !== 200 || !statusData.data) {
                      console.log(`[Sync] Task ${task.task_id}: API error`, statusData);
                      const errorMsg = statusData.msg || 'Unknown';

                      // Count how many API errors we've had for this task
                      const apiErrorCount = logs.filter(l => l.message.includes('API error') || l.message.includes('kie.ai')).length;

                      if (errorMsg.includes('null') || errorMsg.includes('not found')) {
                        await appendLog('warning', `⚠ kie.ai cannot find task (attempt ${apiErrorCount + 1})`);

                        // After 10 failed attempts (~2.5 mins), mark as failed
                        if (apiErrorCount >= 10) {
                          await appendLog('error', '✗ Task not found after multiple attempts - marking as failed');
                          await appendLog('error', 'kie.ai may have failed to create this video. Try generating again.');
                          await supabase.from('video_output').update({
                            task_status: 'failed',
                            task_error: 'Task not found on kie.ai - generation may have failed',
                            logs
                          }).eq('id', task.id);
                          await supabase.from('video_generator').update({ status: 'failed' }).eq('id', task.video_generator_id);
                          failed++;
                          synced++;
                        }
                      } else {
                        await appendLog('warning', `⚠ API error: ${errorMsg}`);
                      }
                      continue;
                    }

                    const state = statusData.data.state || statusData.data.status || 'unknown';
                    const elapsed = formatElapsed(startTime);

                    // Map state to friendly status
                    const stateLabels: Record<string, string> = {
                      'pending': 'Queued',
                      'waiting': 'Queued',
                      'queueing': 'Queued',
                      'processing': 'Generating',
                      'completed': 'Completed',
                      'success': 'Completed',
                      'failed': 'Failed',
                      'fail': 'Failed',
                    };
                    const friendlyState = stateLabels[state] || state;

                    // Always log current status with elapsed time (every 15 seconds)
                    await appendLog('info', `⏳ [${elapsed}] Status: ${friendlyState}`);

                    // Handle different API response formats
                    let videoUrl = statusData.data.output?.video_url || statusData.data.videoUrl;
                    let imageUrl = statusData.data.output?.thumbnail_url || statusData.data.imageUrl;

                    // Check videoInfo object (old kie.ai format)
                    if (!videoUrl && statusData.data.videoInfo?.videoUrl) {
                      videoUrl = statusData.data.videoInfo.videoUrl;
                    }
                    if (!imageUrl && statusData.data.videoInfo?.imageUrl) {
                      imageUrl = statusData.data.videoInfo.imageUrl;
                    }

                    // Check resultJson (Sora 2 format)
                    const resultJson = statusData.data.resultJson;
                    if (!videoUrl && resultJson) {
                      try {
                        const result = JSON.parse(resultJson);
                        if (result.resultUrls && result.resultUrls.length > 0) {
                          videoUrl = result.resultUrls[0];
                        }
                        if (!imageUrl && result.resultWaterMarkUrls && result.resultWaterMarkUrls.length > 0) {
                          imageUrl = result.resultWaterMarkUrls[0];
                        }
                      } catch {}
                    }

                    console.log(`[Sync] Task ${task.task_id}: state=${state}, videoUrl=${videoUrl ? 'yes' : 'no'}`);

                    if (state === 'completed' || state === 'success') {
                      if (videoUrl) {
                        await appendLog('info', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', false);
                        await appendLog('success', `✓ VIDEO GENERATION COMPLETED!`, false);
                        await appendLog('info', `⏱️ Total time: ${elapsed}`, false);
                        await appendLog('info', `🎥 Video URL received`, false);

                        // Generate transcript
                        let transcript = null;
                        if (GEMINI_API_KEY) {
                          await appendLog('info', '→ Generating transcript via Gemini...', false);
                          try {
                            const geminiRes = await fetch(
                              `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
                              {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  contents: [{ parts: [
                                    { fileData: { mimeType: 'video/mp4', fileUri: videoUrl } },
                                    { text: 'Please transcribe all spoken words in this video. If there is no speech, describe what is happening visually in 2-3 sentences.' }
                                  ]}],
                                  generationConfig: { temperature: 0.3, maxOutputTokens: 2000 }
                                })
                              }
                            );
                            const geminiData = await geminiRes.json() as GeminiResponse;
                            if (geminiRes.ok) {
                              transcript = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
                              await appendLog('success', '✓ Transcript generated', false);
                            } else {
                              await appendLog('warning', '⚠ Transcript generation failed', false);
                            }
                          } catch {
                            await appendLog('warning', '⚠ Transcript generation error', false);
                          }
                        }

                        await appendLog('info', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', false);
                        await appendLog('success', '🎉 ALL DONE!', false);

                        // Save all logs at once
                        await supabase.from('video_output').update({
                          task_status: 'completed',
                          final_video_url: videoUrl,
                          transcript,
                          logs
                        }).eq('id', task.id);

                        await supabase.from('video_generator').update({
                          status: 'completed',
                          middle_frame_path: imageUrl || null,
                          transcript
                        }).eq('id', task.video_generator_id);

                        console.log(`[Sync] Task ${task.task_id}: completed`);
                        completed++;
                        synced++;
                      }
                    } else if (state === 'failed' || state === 'fail') {
                      const errorMsg = statusData.data.error || statusData.data.failMsg || 'Unknown error';
                      await appendLog('info', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', false);
                      await appendLog('error', `✗ GENERATION FAILED`, false);
                      await appendLog('error', `Error: ${errorMsg}`, false);
                      await appendLog('info', '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', false);

                      await supabase.from('video_output').update({
                        task_status: 'failed',
                        task_error: errorMsg,
                        logs
                      }).eq('id', task.id);
                      await supabase.from('video_generator').update({ status: 'failed' }).eq('id', task.video_generator_id);
                      console.log(`[Sync] Task ${task.task_id}: failed`);
                      failed++;
                      synced++;
                    }
                  } catch (err) {
                    console.error(`[Sync] Error processing task ${task.task_id}:`, err);
                    await appendLog('error', `✗ Error: ${err}`);
                  }
                }

                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({
                  message: 'Sync complete',
                  total: pendingTasks.length,
                  synced,
                  completed,
                  failed,
                  tasks: pendingTasks.map(t => ({ id: t.id, task_id: t.task_id, status: t.task_status }))
                }));
              } catch (error) {
                console.error('[Sync] Error:', error);
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: String(error) }));
              }
              return;
            }

            next();
          } else {
            next();
          }
        });

        // Presets API proxy
        server.middlewares.use(async (req, res, next) => {
          if (req.url?.startsWith('/api/presets')) {
            const handler = await import('./api/presets');

            // Handle different methods
            if (req.method === 'OPTIONS') {
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
              res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
              res.statusCode = 200;
              res.end();
              return;
            }

            // Parse body for POST/PUT
            let body: any = {};
            if (req.method === 'POST' || req.method === 'PUT') {
              body = await new Promise((resolve) => {
                let data = '';
                req.on('data', chunk => { data += chunk; });
                req.on('end', () => {
                  try {
                    resolve(JSON.parse(data));
                  } catch {
                    resolve({});
                  }
                });
              });
            }

            // Parse query params for DELETE
            const urlObj = new URL(req.url || '', 'http://localhost');
            const query: Record<string, string> = {};
            urlObj.searchParams.forEach((value, key) => {
              query[key] = value;
            });

            const vercelReq = {
              method: req.method,
              body,
              headers: req.headers,
              query
            };
            const vercelRes = {
              status: (code: number) => {
                res.statusCode = code;
                return vercelRes;
              },
              json: (data: any) => {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(data));
              },
              setHeader: (name: string, value: string) => {
                res.setHeader(name, value);
              },
              end: () => res.end()
            };
            await handler.default(vercelReq as any, vercelRes as any);
          } else {
            next();
          }
        });
      }
    }
  ],
})

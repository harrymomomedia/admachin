/**
 * Test watermark removal with the last generated video
 */
import 'dotenv/config';

const KIE_API_KEY = process.env.KIE_API_KEY;
const KIE_API_BASE = 'https://api.kie.ai/api/v1';

// Last generated video URL
const VIDEO_URL = 'https://cqsvjwwznafxjerryawy.supabase.co/storage/v1/object/public/video-generator/videos/3ca4f7cb-7c20-41cc-bde1-4f84f067e643/1766334388078.mp4';

async function testWatermarkRemoval() {
    console.log('🧹 Testing Watermark Removal');
    console.log('━'.repeat(50));
    console.log(`Video URL: ${VIDEO_URL}`);
    console.log('');

    if (!KIE_API_KEY) {
        console.error('❌ KIE_API_KEY not set in environment');
        return;
    }

    // Start watermark removal
    console.log('→ Starting watermark removal task...');

    const createResponse = await fetch(`${KIE_API_BASE}/jobs/createTask`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${KIE_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'sora-watermark-remover',
            input: {
                video_url: VIDEO_URL,
            },
        }),
    });

    const createData = await createResponse.json();
    console.log('Response:', JSON.stringify(createData, null, 2));

    if (createData.code !== 200 || !createData.data?.taskId) {
        console.error(`❌ Failed to start: ${createData.msg}`);
        return;
    }

    const taskId = createData.data.taskId;
    console.log(`✓ Task started: ${taskId}`);
    console.log('');

    // Poll for completion
    console.log('→ Polling for completion...');
    const startTime = Date.now();
    const maxWait = 5 * 60 * 1000; // 5 minutes
    const pollInterval = 5000; // 5 seconds

    while (Date.now() - startTime < maxWait) {
        const elapsed = Math.round((Date.now() - startTime) / 1000);

        const statusResponse = await fetch(
            `${KIE_API_BASE}/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`,
            {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${KIE_API_KEY}` },
            }
        );

        const statusData = await statusResponse.json();

        if (statusData.code !== 200 || !statusData.data) {
            console.log(`[${elapsed}s] ⚠ Status check failed:`, statusData.msg);
            await new Promise(r => setTimeout(r, pollInterval));
            continue;
        }

        const state = statusData.data.state || statusData.data.status;
        const cleanUrl = statusData.data.output?.video_url || statusData.data.videoUrl;

        console.log(`[${elapsed}s] State: ${state}`);

        if (state === 'completed' || state === 'success') {
            console.log('');
            console.log('━'.repeat(50));
            console.log('✓ WATERMARK REMOVAL COMPLETE!');
            console.log('━'.repeat(50));
            console.log(`Clean video URL: ${cleanUrl}`);
            return;
        } else if (state === 'failed' || state === 'fail') {
            console.error(`❌ Failed: ${statusData.data.error || statusData.data.failMsg}`);
            return;
        }

        await new Promise(r => setTimeout(r, pollInterval));
    }

    console.error('❌ Timeout waiting for completion');
}

testWatermarkRemoval().catch(console.error);

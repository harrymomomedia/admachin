/**
 * Video generation model options
 * Used in VideoGenerator, AIVideoGenerated, and other video-related pages
 */

export const VIDEO_MODEL_OPTIONS = [
    { label: 'Sora T2V', value: 'sora-2-text-to-video' },
    { label: 'Sora Web T2V', value: 'sora-2-web-t2v' },
] as const;

export const VIDEO_MODEL_COLOR_MAP: Record<string, string> = {
    'sora-2-text-to-video': 'bg-purple-100 text-purple-700',
    'sora-2-web-t2v': 'bg-cyan-100 text-cyan-700',
};

/** Get display label for a model value */
export function getModelLabel(value: string): string {
    const option = VIDEO_MODEL_OPTIONS.find(o => o.value === value);
    return option?.label || value;
}

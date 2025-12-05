// Shared types for the ad launch flow

import type { TargetingOption } from './facebook';

export interface AudienceData {
    locations?: TargetingOption[];
    ageMin?: number;
    ageMax?: number;
    gender?: number[]; // FB API: 1=male, 2=female, default all
    interests?: TargetingOption[];
    excludedLocations?: TargetingOption[];
}

export interface BudgetData {
    type?: "daily" | "lifetime";
    amount?: string; // Kept as string for input handling, converted to cents for API in backend logic
    startDate?: string;
    endDate?: string;
}

export interface CreativeMedia {
    id: string;
    file: File;
    preview: string;
    type: "image" | "video";
    status: "uploading" | "success" | "error";
    progress: number;
    hash?: string;
    url?: string;
    error?: string;
}

export interface CreativeData {
    media?: CreativeMedia[];
    mediaPreview?: string;
    mediaType?: "image" | "video";
    imageHash?: string;
    primaryText?: string;
    headline?: string;
    description?: string;
    url?: string;
    cta?: string;
}

export interface LaunchAdFormData {
    objective?: string;
    name?: string;
    audience?: AudienceData;
    creative?: CreativeData;
    budget?: BudgetData;
}

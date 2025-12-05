// Shared types for the ad launch flow

export interface AudienceData {
    location?: string;
    ageMin?: string;
    ageMax?: string;
    gender?: "all" | "men" | "women";
    interests?: string;
}

export interface BudgetData {
    type?: "daily" | "lifetime";
    amount?: string;
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

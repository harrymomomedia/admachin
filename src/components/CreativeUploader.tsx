import { useState, useRef, useCallback } from "react";
import {
    Upload,
    X,
    Image as ImageIcon,
    Film,
    AlertCircle,
    CheckCircle,
    Loader2,
} from "lucide-react";
import { uploadCreativeFile, addCreative } from "../lib/supabase-service";
import { supabase } from "../lib/supabase";
import * as fbApi from "../services/facebook/api";

interface UploadedFile {
    id: string;
    file: File;
    preview: string;
    type: "image" | "video";
    status: "uploading" | "success" | "error";
    progress: number;
    hash?: string; // Facebook image hash
    videoId?: string; // Facebook video ID
    url?: string;
    error?: string;
}

interface CreativeUploaderProps {
    onUploadComplete: (files: UploadedFile[]) => void;
    maxFiles?: number;
    acceptedTypes?: "image" | "video" | "both";
}

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];
const MAX_IMAGE_SIZE = 30 * 1024 * 1024; // 30MB
const MAX_VIDEO_SIZE = 4 * 1024 * 1024 * 1024; // 4GB

export function CreativeUploader({
    onUploadComplete,
    maxFiles = 5,
    acceptedTypes = "both",
}: CreativeUploaderProps) {
    const [files, setFiles] = useState<UploadedFile[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const getAcceptedMimeTypes = useCallback(() => {
        if (acceptedTypes === "image") return IMAGE_TYPES.join(",");
        if (acceptedTypes === "video") return VIDEO_TYPES.join(",");
        return [...IMAGE_TYPES, ...VIDEO_TYPES].join(",");
    }, [acceptedTypes]);

    const validateFile = useCallback((file: File): { valid: boolean; error?: string } => {
        const isImage = IMAGE_TYPES.includes(file.type);
        const isVideo = VIDEO_TYPES.includes(file.type);

        if (!isImage && !isVideo) {
            return {
                valid: false,
                error: "Unsupported file type. Please use JPG, PNG, GIF, WebP, MP4, MOV, or WebM.",
            };
        }

        if (acceptedTypes === "image" && !isImage) {
            return { valid: false, error: "Only image files are allowed." };
        }

        if (acceptedTypes === "video" && !isVideo) {
            return { valid: false, error: "Only video files are allowed." };
        }

        if (isImage && file.size > MAX_IMAGE_SIZE) {
            return { valid: false, error: "Image must be under 30MB." };
        }

        if (isVideo && file.size > MAX_VIDEO_SIZE) {
            return { valid: false, error: "Video must be under 4GB." };
        }

        return { valid: true };
    }, [acceptedTypes]);

    const uploadFile = useCallback(async (uploadedFile: UploadedFile) => {
        try {
            // Upload to Supabase Storage
            const result = await uploadCreativeFile(uploadedFile.file, (progress: number) => {
                setFiles((prev) =>
                    prev.map((f) =>
                        f.id === uploadedFile.id ? { ...f, progress: progress * 0.5 } : f // First 50% is Supabase upload
                    )
                );
            });

            // For videos, upload the thumbnail too
            let thumbnailPath = null;
            let fbVideoId: string | null = null;

            if (uploadedFile.type === 'video') {
                // Upload thumbnail
                if (uploadedFile.preview) {
                    try {
                        const response = await fetch(uploadedFile.preview);
                        const blob = await response.blob();
                        const thumbName = `thumbnails/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
                        const { data: thumbData } = await supabase.storage
                            .from('creatives')
                            .upload(thumbName, blob, { contentType: 'image/jpeg' });
                        if (thumbData) {
                            thumbnailPath = thumbData.path;
                        }
                    } catch (thumbErr) {
                        console.warn('[Upload] Failed to save thumbnail:', thumbErr);
                    }
                }

                // Upload video to Facebook
                try {
                    console.log('[Upload] Uploading video to Facebook...');
                    setFiles((prev) =>
                        prev.map((f) =>
                            f.id === uploadedFile.id ? { ...f, progress: 60 } : f
                        )
                    );

                    const fbVideo = await fbApi.uploadVideo(uploadedFile.file, uploadedFile.file.name);
                    fbVideoId = fbVideo.id;
                    console.log('[Upload] Facebook video uploaded, id:', fbVideoId);

                    setFiles((prev) =>
                        prev.map((f) =>
                            f.id === uploadedFile.id ? { ...f, progress: 90, videoId: fbVideoId || undefined } : f
                        )
                    );
                } catch (fbErr) {
                    console.error('[Upload] Failed to upload video to Facebook:', fbErr);
                    // Throw error so user knows video wasn't uploaded to Facebook
                    const errorMessage = fbErr instanceof Error ? fbErr.message : 'Unknown error';
                    throw new Error(
                        `Failed to upload video to Facebook: ${errorMessage}. ` +
                        `Please ensure you're connected to Facebook with proper permissions and try again.`
                    );
                }
            }

            // Save metadata to Supabase
            await addCreative({
                name: uploadedFile.file.name,
                type: uploadedFile.type,
                storage_path: result.path,
                file_size: uploadedFile.file.size,
                dimensions: thumbnailPath ? { thumbnail: thumbnailPath } : null,
                duration: null,
                uploaded_by: 'Harry',
                fb_hash: null,
                fb_video_id: fbVideoId,
            });

            // Update file status
            setFiles((prev) => {
                const updated = prev.map((f) =>
                    f.id === uploadedFile.id
                        ? {
                            ...f,
                            status: "success" as const,
                            url: result.url,
                        }
                        : f
                );

                // Notify parent of completed uploads
                const successFiles = updated.filter((f) => f.status === "success");
                onUploadComplete(successFiles);

                return updated;
            });
        } catch (error) {
            console.error('[Upload] Failed:', error);
            setFiles((prev) =>
                prev.map((f) =>
                    f.id === uploadedFile.id
                        ? {
                            ...f,
                            status: "error" as const,
                            error: error instanceof Error ? error.message : 'Upload failed',
                        }
                        : f
                )
            );
        }
    }, [onUploadComplete]);

    const createVideoThumbnail = (file: File): Promise<string> => {
        return new Promise((resolve) => {
            const video = document.createElement("video");
            video.preload = "metadata";
            video.muted = true;
            video.playsInline = true;

            video.onloadeddata = () => {
                video.currentTime = 1; // Seek to 1 second
            };

            video.onseeked = () => {
                const canvas = document.createElement("canvas");
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext("2d");
                ctx?.drawImage(video, 0, 0);
                resolve(canvas.toDataURL("image/jpeg"));
                URL.revokeObjectURL(video.src);
            };

            video.onerror = () => {
                resolve(""); // Return empty if we can't create thumbnail
            };

            video.src = URL.createObjectURL(file);
        });
    };

    const createFileId = () => `file_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const processFiles = useCallback(async (newFiles: FileList | File[]) => {
        const fileArray = Array.from(newFiles);

        // Check max files limit
        if (files.length + fileArray.length > maxFiles) {
            alert(`You can only upload up to ${maxFiles} files.`);
            return;
        }

        const processedFiles: UploadedFile[] = [];

        for (const file of fileArray) {
            const validation = validateFile(file);
            const isImage = IMAGE_TYPES.includes(file.type);

            const uploadedFile: UploadedFile = {
                id: createFileId(),
                file,
                preview: isImage ? URL.createObjectURL(file) : "",
                type: isImage ? "image" : "video",
                status: validation.valid ? "uploading" : "error",
                progress: 0,
                error: validation.error,
            };

            // Create video thumbnail
            if (!isImage && validation.valid) {
                uploadedFile.preview = await createVideoThumbnail(file);
            }

            processedFiles.push(uploadedFile);
        }

        setFiles((prev) => [...prev, ...processedFiles]);

        // Upload valid files to B2
        for (const file of processedFiles) {
            if (file.status === "uploading") {
                uploadFile(file);
            }
        }
    }, [files.length, maxFiles, validateFile, uploadFile]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            setIsDragging(false);
            processFiles(e.dataTransfer.files);
        },
        [processFiles]
    );

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            processFiles(e.target.files);
        }
    };

    const removeFile = (id: string) => {
        setFiles((prev) => {
            const file = prev.find((f) => f.id === id);
            if (file?.preview) {
                URL.revokeObjectURL(file.preview);
            }
            const updated = prev.filter((f) => f.id !== id);
            onUploadComplete(updated.filter((f) => f.status === "success"));
            return updated;
        });
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    return (
        <div className="space-y-4">
            {/* Drop Zone */}
            <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`
                    relative border-2 border-dashed rounded-xl p-8 
                    flex flex-col items-center justify-center text-center 
                    transition-all duration-200 cursor-pointer
                    ${isDragging
                        ? "border-primary bg-primary/10 scale-[1.02]"
                        : "border-border hover:border-primary/50 hover:bg-muted/50"
                    }
                `}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept={getAcceptedMimeTypes()}
                    onChange={handleFileSelect}
                    className="hidden"
                />

                <div
                    className={`
                        p-4 rounded-full mb-4 transition-all duration-200
                        ${isDragging ? "bg-primary/20 scale-110" : "bg-primary/10"}
                    `}
                >
                    <Upload
                        className={`h-8 w-8 transition-colors ${isDragging ? "text-primary" : "text-muted-foreground"
                            }`}
                    />
                </div>

                <p className="text-sm font-medium mb-1">
                    {isDragging ? "Drop your files here" : "Drag & drop or click to upload"}
                </p>
                <p className="text-xs text-muted-foreground">
                    {acceptedTypes === "image" && "JPG, PNG, GIF, WebP (max 30MB)"}
                    {acceptedTypes === "video" && "MP4, MOV, WebM (max 4GB)"}
                    {acceptedTypes === "both" &&
                        "Images (JPG, PNG, GIF) or Videos (MP4, MOV, WebM)"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                    Up to {maxFiles} file{maxFiles > 1 ? "s" : ""}
                </p>
            </div>

            {/* File List */}
            {files.length > 0 && (
                <div className="space-y-3">
                    {files.map((file) => (
                        <div
                            key={file.id}
                            className={`
                                relative flex items-center gap-4 p-3 rounded-lg border
                                transition-all duration-200
                                ${file.status === "error"
                                    ? "border-red-500/50 bg-red-500/5"
                                    : file.status === "success"
                                        ? "border-green-500/50 bg-green-500/5"
                                        : "border-border bg-muted/30"
                                }
                            `}
                        >
                            {/* Preview */}
                            <div className="relative h-16 w-16 flex-shrink-0 rounded-lg overflow-hidden bg-background">
                                {file.preview ? (
                                    <img
                                        src={file.preview}
                                        alt={file.file.name}
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    <div className="h-full w-full flex items-center justify-center">
                                        {file.type === "image" ? (
                                            <ImageIcon className="h-6 w-6 text-muted-foreground" />
                                        ) : (
                                            <Film className="h-6 w-6 text-muted-foreground" />
                                        )}
                                    </div>
                                )}
                                {file.type === "video" && file.preview && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                        <Film className="h-5 w-5 text-white" />
                                    </div>
                                )}
                            </div>

                            {/* File Info */}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{file.file.name}</p>
                                <p className="text-xs text-muted-foreground">
                                    {formatFileSize(file.file.size)}
                                </p>

                                {/* Progress Bar */}
                                {file.status === "uploading" && (
                                    <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-primary transition-all duration-200 rounded-full"
                                            style={{ width: `${file.progress}%` }}
                                        />
                                    </div>
                                )}

                                {/* Error Message */}
                                {file.error && (
                                    <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                                        <AlertCircle className="h-3 w-3" />
                                        {file.error}
                                    </p>
                                )}
                            </div>

                            {/* Status Icon */}
                            <div className="flex-shrink-0">
                                {file.status === "uploading" && (
                                    <Loader2 className="h-5 w-5 text-primary animate-spin" />
                                )}
                                {file.status === "success" && (
                                    <CheckCircle className="h-5 w-5 text-green-500" />
                                )}
                                {file.status === "error" && (
                                    <AlertCircle className="h-5 w-5 text-red-500" />
                                )}
                            </div>

                            {/* Remove Button */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    removeFile(file.id);
                                }}
                                className="flex-shrink-0 p-1.5 rounded-md hover:bg-muted transition-colors"
                            >
                                <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Tips */}
            <div className="text-xs text-muted-foreground space-y-1 border-t border-border pt-4">
                <p className="font-medium">📌 Tips for best results:</p>
                <ul className="list-disc list-inside space-y-0.5 ml-1">
                    <li>Use 1:1 aspect ratio for feed ads, 9:16 for Stories/Reels</li>
                    <li>Minimum recommended resolution: 1080x1080 pixels</li>
                    <li>Videos should be 15-60 seconds for best engagement</li>
                </ul>
            </div>
        </div>
    );
}

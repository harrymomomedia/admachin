import { useState, useCallback, useRef } from 'react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import { X, Upload, Camera, ZoomIn, ZoomOut } from 'lucide-react';
import { uploadAvatar, deleteOldAvatars } from '../lib/supabase-service';

interface AvatarUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (avatarUrl: string) => void;
    currentAvatarUrl?: string | null;
    userId: string;
    userName?: string;
}

// Helper function to create cropped image
async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<Blob> {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        throw new Error('Could not get canvas context');
    }

    // Set canvas size to the cropped area
    const size = Math.min(pixelCrop.width, pixelCrop.height);
    canvas.width = size;
    canvas.height = size;

    // Draw the cropped image
    ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        size,
        size
    );

    // Convert canvas to blob
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error('Canvas is empty'));
                }
            },
            'image/jpeg',
            0.9
        );
    });
}

function createImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.addEventListener('load', () => resolve(image));
        image.addEventListener('error', (error) => reject(error));
        image.crossOrigin = 'anonymous';
        image.src = url;
    });
}

export function AvatarUploadModal({
    isOpen,
    onClose,
    onSave,
    currentAvatarUrl,
    userId,
    userName
}: AvatarUploadModalProps) {
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const handleFileSelect = useCallback((file: File) => {
        // Validate file type
        const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!validTypes.includes(file.type)) {
            setError('Please select a valid image file (JPEG, PNG, WebP, or GIF)');
            return;
        }

        // Validate file size (5MB max)
        if (file.size > 5 * 1024 * 1024) {
            setError('Image must be less than 5MB');
            return;
        }

        setError(null);
        const reader = new FileReader();
        reader.onload = () => {
            setImageSrc(reader.result as string);
        };
        reader.readAsDataURL(file);
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFileSelect(e.target.files[0]);
        }
    };

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFileSelect(e.dataTransfer.files[0]);
        }
    }, [handleFileSelect]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleSave = async () => {
        if (!imageSrc || !croppedAreaPixels) return;

        setIsUploading(true);
        setError(null);

        try {
            // Create cropped image
            const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels);

            // Upload to Supabase
            const avatarUrl = await uploadAvatar(croppedBlob, userId);

            // Clean up old avatars
            await deleteOldAvatars(userId, avatarUrl);

            // Notify parent
            onSave(avatarUrl);
            handleClose();
        } catch (err) {
            console.error('Error uploading avatar:', err);
            setError(err instanceof Error ? err.message : 'Failed to upload avatar');
        } finally {
            setIsUploading(false);
        }
    };

    const handleClose = () => {
        setImageSrc(null);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
        setCroppedAreaPixels(null);
        setError(null);
        setIsDragging(false);
        onClose();
    };

    const handleRemovePhoto = async () => {
        setIsUploading(true);
        try {
            // Clean up all avatars for this user
            await deleteOldAvatars(userId);
            // Notify parent with empty URL
            onSave('');
            handleClose();
        } catch (err) {
            console.error('Error removing avatar:', err);
            setError('Failed to remove photo');
        } finally {
            setIsUploading(false);
        }
    };

    // Get initials for fallback display
    const getInitials = () => {
        if (!userName) return 'U';
        const parts = userName.split(' ');
        if (parts.length >= 2) {
            return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
        }
        return userName.substring(0, 2).toUpperCase();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl w-full max-w-md shadow-xl overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">Update Profile Photo</h3>
                    <button
                        onClick={handleClose}
                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    {/* Error message */}
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                            {error}
                        </div>
                    )}

                    {!imageSrc ? (
                        /* Drop zone / file picker */
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            className={`
                                relative flex flex-col items-center justify-center
                                border-2 border-dashed rounded-xl p-8 cursor-pointer
                                transition-colors
                                ${isDragging
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                                }
                            `}
                        >
                            {/* Current avatar preview */}
                            <div className="mb-4">
                                {currentAvatarUrl ? (
                                    <img
                                        src={currentAvatarUrl}
                                        alt="Current avatar"
                                        className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-md"
                                    />
                                ) : (
                                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-2xl font-semibold border-4 border-white shadow-md">
                                        {getInitials()}
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center gap-2 text-blue-600 font-medium mb-2">
                                <Upload className="w-5 h-5" />
                                <span>Upload a photo</span>
                            </div>
                            <p className="text-sm text-gray-500 text-center">
                                Drag and drop or click to browse
                                <br />
                                <span className="text-xs">JPEG, PNG, WebP, GIF - Max 5MB</span>
                            </p>

                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp,image/gif"
                                onChange={handleInputChange}
                                className="hidden"
                            />
                        </div>
                    ) : (
                        /* Cropper */
                        <div className="space-y-4">
                            <div className="relative h-64 bg-gray-900 rounded-lg overflow-hidden">
                                <Cropper
                                    image={imageSrc}
                                    crop={crop}
                                    zoom={zoom}
                                    aspect={1}
                                    cropShape="round"
                                    showGrid={false}
                                    onCropChange={setCrop}
                                    onZoomChange={setZoom}
                                    onCropComplete={onCropComplete}
                                />
                            </div>

                            {/* Zoom slider */}
                            <div className="flex items-center gap-3">
                                <ZoomOut className="w-4 h-4 text-gray-400" />
                                <input
                                    type="range"
                                    min={1}
                                    max={3}
                                    step={0.1}
                                    value={zoom}
                                    onChange={(e) => setZoom(Number(e.target.value))}
                                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                />
                                <ZoomIn className="w-4 h-4 text-gray-400" />
                            </div>

                            {/* Change photo button */}
                            <button
                                onClick={() => {
                                    setImageSrc(null);
                                    fileInputRef.current?.click();
                                }}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <Camera className="w-4 h-4" />
                                Choose different photo
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                    <div>
                        {currentAvatarUrl && !imageSrc && (
                            <button
                                onClick={handleRemovePhoto}
                                disabled={isUploading}
                                className="text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
                            >
                                Remove photo
                            </button>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={handleClose}
                            disabled={isUploading}
                            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        {imageSrc && (
                            <button
                                onClick={handleSave}
                                disabled={isUploading || !croppedAreaPixels}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isUploading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Uploading...
                                    </>
                                ) : (
                                    'Save Photo'
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

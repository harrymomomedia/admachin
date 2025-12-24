import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Check } from 'lucide-react';
import { DataTable } from './DataTable';
import type { ColumnDef, ViewPreferences, GalleryConfig, GalleryLookups, AdCopyItem } from './types';

export interface DataTableSelectionModalProps<T> {
    /** Modal title */
    title: string;
    /** Whether the modal is open */
    isOpen: boolean;
    /** Callback when modal is closed (cancel) */
    onClose: () => void;
    /** Callback when selection is confirmed */
    onConfirm: (selectedIds: Set<string>) => void;
    /** Initial selected IDs */
    initialSelectedIds?: Set<string>;
    /** Allow multiple selection (default: true) */
    multiple?: boolean;
    /** Confirm button text */
    confirmText?: string;
    /** Cancel button text */
    cancelText?: string;

    // DataTable props
    columns: ColumnDef<T>[];
    data: T[];
    getRowId: (row: T) => string;
    isLoading?: boolean;
    emptyMessage?: string;
    resizable?: boolean;
    sortable?: boolean;
    viewId?: string;
    userId?: string;
    initialPreferences?: ViewPreferences;
    onPreferencesChange?: (prefs: ViewPreferences) => void;

    // View mode
    viewMode?: 'table' | 'gallery' | 'card';
    onViewModeChange?: (mode: 'table' | 'gallery' | 'card') => void;
    cardColumns?: number;
    galleryConfig?: GalleryConfig;
    galleryLookups?: GalleryLookups;
    adCopies?: AdCopyItem[];
}

export function DataTableSelectionModal<T>({
    title,
    isOpen,
    onClose,
    onConfirm,
    initialSelectedIds = new Set(),
    multiple = true,
    confirmText = 'Confirm Selection',
    cancelText = 'Cancel',
    columns,
    data,
    getRowId,
    isLoading,
    emptyMessage,
    resizable = true,
    sortable = true,
    viewId,
    userId,
    initialPreferences,
    onPreferencesChange,
    viewMode: externalViewMode,
    onViewModeChange: externalOnViewModeChange,
    cardColumns,
    galleryConfig,
    galleryLookups,
    adCopies,
}: DataTableSelectionModalProps<T>) {
    // Local selection state
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(initialSelectedIds));

    // Local view mode state (fallback if not provided externally)
    const [internalViewMode, setInternalViewMode] = useState<'table' | 'gallery' | 'card'>(externalViewMode || 'table');
    const viewMode = externalViewMode ?? internalViewMode;
    const onViewModeChange = externalOnViewModeChange ?? setInternalViewMode;

    // Reset selection when modal opens
    useEffect(() => {
        if (isOpen) {
            setSelectedIds(new Set(initialSelectedIds));
        }
    }, [isOpen, initialSelectedIds]);

    // Handle selection change
    const handleSelectionChange = (ids: Set<string>) => {
        if (!multiple && ids.size > 1) {
            // For single selection, only keep the newly selected item
            const newId = Array.from(ids).find(id => !selectedIds.has(id));
            if (newId) {
                setSelectedIds(new Set([newId]));
            }
        } else {
            setSelectedIds(ids);
        }
    };

    // Handle confirm
    const handleConfirm = () => {
        onConfirm(selectedIds);
        onClose();
    };

    // Handle backdrop click
    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    // Handle escape key
    useEffect(() => {
        if (!isOpen) return;

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    // Prevent body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50"
            onClick={handleBackdropClick}
        >
            <div className="bg-white rounded-xl shadow-2xl w-[90vw] max-w-6xl h-[85vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
                    <div className="flex items-center gap-4">
                        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
                        <span className="px-2.5 py-1 text-sm font-medium bg-blue-100 text-blue-700 rounded-full">
                            {selectedIds.size} selected
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* DataTable Content - uses contained layout to fill modal */}
                <div className="flex-1 overflow-hidden">
                    <DataTable
                        columns={columns}
                        data={data}
                        getRowId={getRowId}
                        isLoading={isLoading}
                        emptyMessage={emptyMessage}
                        selectable={true}
                        selectedIds={selectedIds}
                        onSelectionChange={handleSelectionChange}
                        resizable={resizable}
                        sortable={sortable}
                        layout="contained"
                        viewId={viewId}
                        userId={userId}
                        initialPreferences={initialPreferences}
                        onPreferencesChange={onPreferencesChange}
                        viewMode={viewMode}
                        onViewModeChange={onViewModeChange}
                        cardColumns={cardColumns}
                        galleryConfig={galleryConfig}
                        galleryLookups={galleryLookups}
                        adCopies={adCopies}
                    />
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setSelectedIds(new Set(data.map(getRowId)))}
                            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                            Select All
                        </button>
                        <span className="text-gray-300">|</span>
                        <button
                            onClick={() => setSelectedIds(new Set())}
                            className="text-sm text-gray-500 hover:text-gray-700 font-medium"
                        >
                            Clear
                        </button>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
                        >
                            {cancelText}
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={selectedIds.size === 0}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Check className="w-4 h-4" />
                            {confirmText} ({selectedIds.size})
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}

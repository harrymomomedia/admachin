import { cn } from '../utils/cn';

interface SkeletonProps {
    className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
    return (
        <div
            className={cn(
                "animate-pulse bg-gray-200 rounded",
                className
            )}
        />
    );
}

// Table skeleton for DataTable loading states
interface TableSkeletonProps {
    rows?: number;
    columns?: number;
    showHeader?: boolean;
}

export function TableSkeleton({ rows = 5, columns = 4, showHeader = true }: TableSkeletonProps) {
    return (
        <div className="w-full">
            {showHeader && (
                <div className="flex gap-4 px-4 py-3 border-b border-gray-200 bg-gray-50">
                    {Array.from({ length: columns }).map((_, i) => (
                        <Skeleton key={i} className="h-4 flex-1" />
                    ))}
                </div>
            )}
            {Array.from({ length: rows }).map((_, rowIndex) => (
                <div
                    key={rowIndex}
                    className="flex gap-4 px-4 py-4 border-b border-gray-100"
                >
                    {Array.from({ length: columns }).map((_, colIndex) => (
                        <Skeleton
                            key={colIndex}
                            className={cn(
                                "h-4 flex-1",
                                colIndex === 0 && "max-w-[200px]"
                            )}
                        />
                    ))}
                </div>
            ))}
        </div>
    );
}

// Card skeleton for grid views
export function CardSkeleton() {
    return (
        <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
            <Skeleton className="h-40 w-full rounded-md" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
        </div>
    );
}

// Grid of card skeletons
interface CardGridSkeletonProps {
    count?: number;
    columns?: 2 | 3 | 4;
}

export function CardGridSkeleton({ count = 6, columns = 3 }: CardGridSkeletonProps) {
    const gridCols = {
        2: 'grid-cols-2',
        3: 'grid-cols-3',
        4: 'grid-cols-4',
    };

    return (
        <div className={cn("grid gap-4", gridCols[columns])}>
            {Array.from({ length: count }).map((_, i) => (
                <CardSkeleton key={i} />
            ))}
        </div>
    );
}

// Page header skeleton
export function PageHeaderSkeleton() {
    return (
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <div className="space-y-2">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-4 w-64" />
            </div>
            <div className="flex gap-2">
                <Skeleton className="h-10 w-24 rounded-lg" />
                <Skeleton className="h-10 w-32 rounded-lg" />
            </div>
        </div>
    );
}

// Form skeleton
export function FormSkeleton({ fields = 4 }: { fields?: number }) {
    return (
        <div className="space-y-6 p-6">
            {Array.from({ length: fields }).map((_, i) => (
                <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-10 w-full rounded-lg" />
                </div>
            ))}
            <Skeleton className="h-10 w-32 rounded-lg mt-4" />
        </div>
    );
}

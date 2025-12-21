import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '../utils/cn';

// Route to breadcrumb name mapping
const routeNames: Record<string, string> = {
    '': 'Ad Copy',
    'creatives': 'Creatives',
    'ad-planning': 'Ad Planning',
    'ads': 'Ads',
    'create': 'Create',
    'fb-ad-library': 'FB Ad Library',
    'facebook': 'Facebook',
    'profiles': 'FB Profiles',
    'ad-accounts': 'Ad Accounts',
    'launch': 'Launch Ad',
    'video-generator': 'Video Generator',
    'ai-video-generated': 'Generated Videos',
    'ai-copywriting': 'AI Copywriting',
    'saved-personas': 'Saved Personas',
    'admin': 'Admin',
    'settings': 'Settings',
};

// Routes that should be skipped in breadcrumb (parent groupings)
const skipRoutes = ['facebook'];

interface BreadcrumbItem {
    name: string;
    href: string;
    current: boolean;
}

export function Breadcrumb() {
    const location = useLocation();
    const pathSegments = location.pathname.split('/').filter(Boolean);

    // Don't show breadcrumb on home page
    if (pathSegments.length === 0) {
        return null;
    }

    const breadcrumbs: BreadcrumbItem[] = [
        { name: 'Home', href: '/', current: false },
    ];

    let currentPath = '';
    pathSegments.forEach((segment, index) => {
        currentPath += `/${segment}`;
        const isLast = index === pathSegments.length - 1;
        const name = routeNames[segment] || segment;

        // Skip intermediate routes like 'facebook' but keep the path building
        if (!skipRoutes.includes(segment)) {
            breadcrumbs.push({
                name,
                href: currentPath,
                current: isLast,
            });
        }
    });

    return (
        <nav className="flex items-center gap-1 text-sm" aria-label="Breadcrumb">
            {breadcrumbs.map((item, index) => (
                <div key={item.href} className="flex items-center gap-1">
                    {index > 0 && (
                        <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    )}
                    {item.current ? (
                        <span className="text-gray-900 font-medium">
                            {item.name}
                        </span>
                    ) : (
                        <Link
                            to={item.href}
                            className={cn(
                                "text-gray-500 hover:text-gray-700 transition-colors",
                                index === 0 && "flex items-center gap-1"
                            )}
                        >
                            {index === 0 && <Home className="h-4 w-4" />}
                            {index === 0 ? <span className="sr-only">{item.name}</span> : item.name}
                        </Link>
                    )}
                </div>
            ))}
        </nav>
    );
}

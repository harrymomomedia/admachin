import { useState, useRef, useEffect } from "react";
import { LayoutDashboard, Rocket, BarChart3, Image, Users, ChevronDown, ChevronRight, User, Database, Type, X, Library, Sparkles, FolderOpen, PanelLeftClose, PanelLeft, Pen } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "../utils/cn";

// Facebook icon component
const FacebookIcon = () => (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
);

const mainNavigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Launch Ad", href: "/launch", icon: Rocket },
    { name: "Creatives", href: "/creatives", icon: Image },
    { name: "Ad Text", href: "/ad-copies", icon: Type },
    { name: "Ad Planning", href: "/ad-planning", icon: BarChart3 },
    { name: "FB Ad Library", href: "/fb-ad-library", icon: Library },
];

const copywritingSubNav = [
    { name: "Persona AI Copy", href: "/ai-copywriting", icon: Sparkles },
    { name: "Saved Personas", href: "/saved-personas", icon: FolderOpen },
];

const facebookSubNav = [
    { name: "Profiles", href: "/facebook/profiles", icon: User },
    { name: "Ad Accounts", href: "/facebook/ad-accounts", icon: Database },
];

const bottomNavigation = [
    { name: "Admin", href: "/admin", icon: Users },
];

interface SidebarProps {
    onClose?: () => void;
    isCollapsed?: boolean;
    onToggleCollapse?: () => void;
}

// Flyout Popover Component for collapsed folders
interface FlyoutMenuProps {
    title: string;
    icon: React.ReactNode;
    items: typeof copywritingSubNav;
    isActive: boolean;
    onNavigate: () => void;
}

function FlyoutMenu({ title, icon, items, isActive, onNavigate }: FlyoutMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const flyoutRef = useRef<HTMLDivElement>(null);
    const location = useLocation();

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (flyoutRef.current && !flyoutRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    return (
        <div className="relative" ref={flyoutRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "flex items-center justify-center p-3 rounded-md text-sm font-medium transition-colors w-full",
                    isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                title={title}
            >
                {icon}
            </button>

            {/* Flyout Popover */}
            {isOpen && (
                <div className="absolute left-full top-0 ml-2 z-50 min-w-[180px] bg-card border border-border rounded-lg shadow-lg py-2">
                    {/* Header */}
                    <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground border-b border-border mb-1">
                        {title}
                    </div>
                    {/* Items */}
                    {items.map((item) => {
                        const itemIsActive = location.pathname === item.href;
                        return (
                            <Link
                                key={item.name}
                                to={item.href}
                                onClick={() => { setIsOpen(false); onNavigate(); }}
                                className={cn(
                                    "flex items-center gap-3 px-3 py-2 text-sm font-medium transition-colors",
                                    itemIsActive
                                        ? "bg-primary/10 text-primary"
                                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                )}
                            >
                                <item.icon className="h-4 w-4" />
                                {item.name}
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export function Sidebar({ onClose, isCollapsed = false, onToggleCollapse }: SidebarProps) {
    const location = useLocation();
    const [isCopywritingExpanded, setIsCopywritingExpanded] = useState(
        location.pathname === '/ai-copywriting' || location.pathname === '/saved-personas'
    );
    const [isFacebookExpanded, setIsFacebookExpanded] = useState(
        location.pathname.startsWith('/facebook') || location.pathname === '/ad-accounts'
    );

    const isCopywritingActive = location.pathname === '/ai-copywriting' || location.pathname === '/saved-personas';
    const isFacebookActive = location.pathname.startsWith('/facebook') || location.pathname === '/ad-accounts';

    const handleNavClick = () => {
        // Close sidebar on mobile when navigating
        if (onClose) {
            onClose();
        }
    };

    return (
        <div className={cn(
            "flex h-full flex-col bg-card border-r border-border transition-all duration-300",
            isCollapsed ? "w-16" : "w-64"
        )}>
            <div className={cn(
                "flex h-16 items-center border-b border-border",
                isCollapsed ? "justify-center px-2" : "justify-between px-6"
            )}>
                <div className="flex items-center">
                    <Rocket className="h-6 w-6 text-primary" />
                    {!isCollapsed && (
                        <span className="text-xl font-bold text-foreground ml-2">AdMachin</span>
                    )}
                </div>
                {/* Close button for mobile */}
                {onClose && (
                    <button
                        onClick={onClose}
                        className="md:hidden p-2 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                )}
            </div>
            <div className="flex-1 flex flex-col gap-1 p-2 overflow-y-auto">
                {/* Main Navigation */}
                {mainNavigation.map((item) => {
                    const isActive = location.pathname === item.href;
                    return (
                        <Link
                            key={item.name}
                            to={item.href}
                            onClick={handleNavClick}
                            title={isCollapsed ? item.name : undefined}
                            className={cn(
                                "flex items-center gap-3 rounded-md text-sm font-medium transition-colors",
                                isCollapsed ? "justify-center p-3" : "px-3 py-2",
                                isActive
                                    ? "bg-primary/10 text-primary"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                        >
                            <item.icon className="h-5 w-5 flex-shrink-0" />
                            {!isCollapsed && item.name}
                        </Link>
                    );
                })}

                {/* Copywriting Section */}
                {!isCollapsed ? (
                    <div className="mt-2">
                        <button
                            onClick={() => setIsCopywritingExpanded(!isCopywritingExpanded)}
                            className={cn(
                                "flex w-full items-center justify-between gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                                isCopywritingActive
                                    ? "bg-primary/10 text-primary"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                        >
                            <div className="flex items-center gap-3">
                                <Pen className="h-5 w-5" />
                                Copywriting
                            </div>
                            {isCopywritingExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                            ) : (
                                <ChevronRight className="h-4 w-4" />
                            )}
                        </button>

                        {isCopywritingExpanded && (
                            <div className="ml-4 mt-1 flex flex-col gap-1">
                                {copywritingSubNav.map((item) => {
                                    const isActive = location.pathname === item.href;
                                    return (
                                        <Link
                                            key={item.name}
                                            to={item.href}
                                            onClick={handleNavClick}
                                            className={cn(
                                                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                                                isActive
                                                    ? "bg-primary/10 text-primary"
                                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                            )}
                                        >
                                            <item.icon className="h-4 w-4" />
                                            {item.name}
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                ) : (
                    // Collapsed Copywriting - Flyout Menu
                    <div className="mt-2">
                        <FlyoutMenu
                            title="Copywriting"
                            icon={<Pen className="h-5 w-5" />}
                            items={copywritingSubNav}
                            isActive={isCopywritingActive}
                            onNavigate={handleNavClick}
                        />
                    </div>
                )}

                {/* Facebook Section */}
                {!isCollapsed ? (
                    <div className="mt-2">
                        <button
                            onClick={() => setIsFacebookExpanded(!isFacebookExpanded)}
                            className={cn(
                                "flex w-full items-center justify-between gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                                isFacebookActive
                                    ? "bg-primary/10 text-primary"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                        >
                            <div className="flex items-center gap-3">
                                <FacebookIcon />
                                Facebook
                            </div>
                            {isFacebookExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                            ) : (
                                <ChevronRight className="h-4 w-4" />
                            )}
                        </button>

                        {isFacebookExpanded && (
                            <div className="ml-4 mt-1 flex flex-col gap-1">
                                {facebookSubNav.map((item) => {
                                    const isActive = location.pathname === item.href;
                                    return (
                                        <Link
                                            key={item.name}
                                            to={item.href}
                                            onClick={handleNavClick}
                                            className={cn(
                                                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                                                isActive
                                                    ? "bg-primary/10 text-primary"
                                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                            )}
                                        >
                                            <item.icon className="h-4 w-4" />
                                            {item.name}
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                ) : (
                    // Collapsed Facebook - Flyout Menu
                    <div className="mt-2">
                        <FlyoutMenu
                            title="Facebook"
                            icon={<FacebookIcon />}
                            items={facebookSubNav}
                            isActive={isFacebookActive}
                            onNavigate={handleNavClick}
                        />
                    </div>
                )}

                {/* Bottom Navigation */}
                <div className="mt-auto pt-4 border-t border-border">
                    {bottomNavigation.map((item) => {
                        const isActive = location.pathname === item.href;
                        return (
                            <Link
                                key={item.name}
                                to={item.href}
                                onClick={handleNavClick}
                                title={isCollapsed ? item.name : undefined}
                                className={cn(
                                    "flex items-center gap-3 rounded-md text-sm font-medium transition-colors",
                                    isCollapsed ? "justify-center p-3" : "px-3 py-2",
                                    isActive
                                        ? "bg-primary/10 text-primary"
                                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                )}
                            >
                                <item.icon className="h-5 w-5 flex-shrink-0" />
                                {!isCollapsed && item.name}
                            </Link>
                        );
                    })}
                </div>
            </div>

            {/* Collapse Toggle Button - Only on desktop */}
            {onToggleCollapse && (
                <div className="p-2 border-t border-border">
                    <button
                        onClick={onToggleCollapse}
                        className={cn(
                            "flex items-center gap-3 rounded-md text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors w-full",
                            isCollapsed ? "justify-center p-3" : "px-3 py-2"
                        )}
                        title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                    >
                        {isCollapsed ? (
                            <PanelLeft className="h-5 w-5" />
                        ) : (
                            <>
                                <PanelLeftClose className="h-5 w-5" />
                                Collapse
                            </>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
}

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Rocket, BarChart3, Image, ChevronDown, ChevronRight, User, Database, Type, X, Library, Sparkles, FolderOpen, PanelLeftClose, PanelLeft, Pen, Megaphone, Video } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "../utils/cn";
import { UserProfileDropdown } from "./UserProfileDropdown";

// Facebook icon component
const FacebookIcon = () => (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
);

const adsSubNav = [
    { name: "Ad Copy", href: "/", icon: Type },
    { name: "Creatives", href: "/creatives", icon: Image },
    { name: "Ad Planning", href: "/ad-planning", icon: BarChart3 },
    { name: "Ad Combos", href: "/ad-combos", icon: Megaphone },
];

const aiCopySubNav = [
    { name: "Copy Wizard", href: "/copy-wizard", icon: Sparkles },
    { name: "Copy Library", href: "/copy-library", icon: FolderOpen },
];

const videoSubNav = [
    { name: "Video Generator", href: "/video-generator", icon: Video },
    { name: "Generated Videos", href: "/ai-video-generated", icon: Sparkles },
    { name: "Sora Characters", href: "/sora-characters", icon: User },
];

const facebookSubNav = [
    { name: "FB Profiles", href: "/facebook/profiles", icon: User },
    { name: "Ad Accounts", href: "/facebook/ad-accounts", icon: Database },
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
    items: typeof aiCopySubNav;
    isActive: boolean;
    onNavigate: () => void;
}

function FlyoutMenu({ title, icon, items, isActive, onNavigate }: FlyoutMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const flyoutRef = useRef<HTMLDivElement>(null);
    const location = useLocation();
    const [position, setPosition] = useState({ top: 0, left: 0 });

    // Calculate position when opening
    useEffect(() => {
        if (isOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setPosition({
                top: rect.top,
                left: rect.right + 8 // 8px gap from button
            });
        }
    }, [isOpen]);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            const target = event.target as Node;
            const isInsideButton = buttonRef.current?.contains(target);
            const isInsideFlyout = flyoutRef.current?.contains(target);
            if (!isInsideButton && !isInsideFlyout) {
                setIsOpen(false);
            }
        }
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    return (
        <>
            <button
                ref={buttonRef}
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

            {/* Flyout Popover - rendered via portal */}
            {isOpen && createPortal(
                <div
                    ref={flyoutRef}
                    className="fixed z-[9999] min-w-[180px] bg-card border border-border rounded-lg shadow-xl py-2"
                    style={{ top: position.top, left: position.left }}
                >
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
                </div>,
                document.body
            )}
        </>
    );
}

export function Sidebar({ onClose, isCollapsed = false, onToggleCollapse }: SidebarProps) {
    const location = useLocation();
    const [isAdsExpanded, setIsAdsExpanded] = useState(
        location.pathname === '/' || location.pathname === '/creatives' || location.pathname === '/ad-planning' || location.pathname === '/ad-combos'
    );
    const [isAICopyExpanded, setIsAICopyExpanded] = useState(
        location.pathname === '/copy-wizard' || location.pathname === '/copy-library'
    );
    const [isVideoExpanded, setIsVideoExpanded] = useState(
        location.pathname === '/video-generator' || location.pathname === '/ai-video-generated' || location.pathname === '/sora-characters'
    );
    const [isFacebookExpanded, setIsFacebookExpanded] = useState(
        location.pathname.startsWith('/facebook') || location.pathname === '/ad-accounts'
    );

    const isAdsActive = location.pathname === '/' || location.pathname === '/creatives' || location.pathname === '/ad-planning' || location.pathname === '/ad-combos';
    const isAICopyActive = location.pathname === '/copy-wizard' || location.pathname === '/copy-library';
    const isVideoActive = location.pathname === '/video-generator' || location.pathname === '/ai-video-generated' || location.pathname === '/sora-characters';
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
                "flex flex-col border-b border-border",
                isCollapsed ? "items-center px-2 py-3" : "px-4 py-3"
            )}>
                <div className="flex items-center w-full">
                    <div className="flex items-center">
                        <Rocket className="h-6 w-6 text-primary" />
                        {!isCollapsed && (
                            <span className="text-xl font-bold text-foreground ml-2">AdMachin</span>
                        )}
                    </div>
                    {/* Close button for mobile only */}
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="md:hidden ml-auto p-2 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    )}
                </div>
                {/* MOMOMedia branding */}
                {!isCollapsed && (
                    <a
                        href="https://momomedia.io"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <span>by</span>
                        <img src="/momomedia-logo.svg" alt="MOMOMedia" className="h-3" />
                    </a>
                )}
            </div>
            <div className="flex-1 flex flex-col gap-1 p-2 overflow-y-auto">
                {/* Ads Section */}
                {!isCollapsed ? (
                    <div>
                        <button
                            onClick={() => setIsAdsExpanded(!isAdsExpanded)}
                            className={cn(
                                "flex w-full items-center justify-between gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                                isAdsActive
                                    ? "bg-primary/10 text-primary"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                        >
                            <div className="flex items-center gap-3">
                                <Megaphone className="h-5 w-5" />
                                Ad Combos
                            </div>
                            {isAdsExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                            ) : (
                                <ChevronRight className="h-4 w-4" />
                            )}
                        </button>

                        {isAdsExpanded && (
                            <div className="ml-4 mt-1 flex flex-col gap-1">
                                {adsSubNav.map((item) => {
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
                    // Collapsed Ad Combos - Flyout Menu
                    <div>
                        <FlyoutMenu
                            title="Ad Combos"
                            icon={<Megaphone className="h-5 w-5" />}
                            items={adsSubNav}
                            isActive={isAdsActive}
                            onNavigate={handleNavClick}
                        />
                    </div>
                )}

                {/* AI Copy Section */}
                {!isCollapsed ? (
                    <div className="mt-2">
                        <button
                            onClick={() => setIsAICopyExpanded(!isAICopyExpanded)}
                            className={cn(
                                "flex w-full items-center justify-between gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                                isAICopyActive
                                    ? "bg-primary/10 text-primary"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                        >
                            <div className="flex items-center gap-3">
                                <Pen className="h-5 w-5" />
                                AI Copy
                            </div>
                            {isAICopyExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                            ) : (
                                <ChevronRight className="h-4 w-4" />
                            )}
                        </button>

                        {isAICopyExpanded && (
                            <div className="ml-4 mt-1 flex flex-col gap-1">
                                {aiCopySubNav.map((item) => {
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
                    // Collapsed AI Copy - Flyout Menu
                    <div className="mt-2">
                        <FlyoutMenu
                            title="AI Copy"
                            icon={<Pen className="h-5 w-5" />}
                            items={aiCopySubNav}
                            isActive={isAICopyActive}
                            onNavigate={handleNavClick}
                        />
                    </div>
                )}

                {/* Video Section */}
                {!isCollapsed ? (
                    <div className="mt-2">
                        <button
                            onClick={() => setIsVideoExpanded(!isVideoExpanded)}
                            className={cn(
                                "flex w-full items-center justify-between gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                                isVideoActive
                                    ? "bg-primary/10 text-primary"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                        >
                            <div className="flex items-center gap-3">
                                <Video className="h-5 w-5" />
                                AI Video
                            </div>
                            {isVideoExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                            ) : (
                                <ChevronRight className="h-4 w-4" />
                            )}
                        </button>

                        {isVideoExpanded && (
                            <div className="ml-4 mt-1 flex flex-col gap-1">
                                {videoSubNav.map((item) => {
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
                    // Collapsed Video - Flyout Menu
                    <div className="mt-2">
                        <FlyoutMenu
                            title="AI Video"
                            icon={<Video className="h-5 w-5" />}
                            items={videoSubNav}
                            isActive={isVideoActive}
                            onNavigate={handleNavClick}
                        />
                    </div>
                )}

                {/* Launch Ad - between Video and Facebook */}
                <Link
                    to="/launch"
                    onClick={handleNavClick}
                    title={isCollapsed ? "Launch Ad" : undefined}
                    className={cn(
                        "flex items-center gap-3 rounded-md text-sm font-medium transition-colors mt-2",
                        isCollapsed ? "justify-center p-3" : "px-3 py-2",
                        location.pathname === "/launch"
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                >
                    <Rocket className="h-5 w-5 flex-shrink-0" />
                    {!isCollapsed && "Launch Ad"}
                </Link>

                {/* Integration Section */}
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
                                Integration
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
                    // Collapsed Integration - Flyout Menu
                    <div className="mt-2">
                        <FlyoutMenu
                            title="Integration"
                            icon={<FacebookIcon />}
                            items={facebookSubNav}
                            isActive={isFacebookActive}
                            onNavigate={handleNavClick}
                        />
                    </div>
                )}

                {/* FB Ad Library - at bottom */}
                <Link
                    to="/fb-ad-library"
                    onClick={handleNavClick}
                    title={isCollapsed ? "FB Ad Library" : undefined}
                    className={cn(
                        "flex items-center gap-3 rounded-md text-sm font-medium transition-colors mt-2",
                        isCollapsed ? "justify-center p-3" : "px-3 py-2",
                        location.pathname === "/fb-ad-library"
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                >
                    <Library className="h-5 w-5 flex-shrink-0" />
                    {!isCollapsed && "FB Ad Library"}
                </Link>

            </div>

            {/* Bottom section: User Profile + Collapse toggle */}
            <div className={cn(
                "border-t border-border",
                isCollapsed ? "p-2" : "p-2 flex items-center gap-2"
            )}>
                <div className="flex-1 min-w-0">
                    <UserProfileDropdown isCollapsed={isCollapsed} />
                </div>
                {/* Collapse toggle - Desktop only */}
                {onToggleCollapse && !onClose && !isCollapsed && (
                    <button
                        onClick={onToggleCollapse}
                        className="hidden md:flex p-2 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors flex-shrink-0"
                        title="Collapse sidebar"
                    >
                        <PanelLeftClose className="h-4 w-4" />
                    </button>
                )}
            </div>
            {/* Expand button when collapsed - centered at bottom */}
            {isCollapsed && onToggleCollapse && !onClose && (
                <div className="p-2 border-t border-border flex justify-center">
                    <button
                        onClick={onToggleCollapse}
                        className="hidden md:flex p-2 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        title="Expand sidebar"
                    >
                        <PanelLeft className="h-4 w-4" />
                    </button>
                </div>
            )}
        </div>
    );
}

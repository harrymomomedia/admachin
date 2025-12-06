import { useState } from "react";
import { LayoutDashboard, Rocket, BarChart3, LogOut, Image, Users, ChevronDown, ChevronRight, User, Database } from "lucide-react";
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
    { name: "Campaigns", href: "/campaigns", icon: BarChart3 },
];

const facebookSubNav = [
    { name: "Profiles", href: "/facebook/profiles", icon: User },
    { name: "Ad Accounts", href: "/facebook/ad-accounts", icon: Database },
];

const bottomNavigation = [
    { name: "Team Settings", href: "/team-settings", icon: Users },
];

export function Sidebar() {
    const location = useLocation();
    const [isFacebookExpanded, setIsFacebookExpanded] = useState(
        location.pathname.startsWith('/facebook') || location.pathname === '/ad-accounts'
    );

    const isFacebookActive = location.pathname.startsWith('/facebook') || location.pathname === '/ad-accounts';

    return (
        <div className="flex h-full w-64 flex-col bg-card border-r border-border">
            <div className="flex h-16 items-center px-6 border-b border-border">
                <Rocket className="h-6 w-6 text-primary mr-2" />
                <span className="text-xl font-bold text-foreground">AdMachin</span>
            </div>
            <div className="flex-1 flex flex-col gap-1 p-4 overflow-y-auto">
                {/* Main Navigation */}
                {mainNavigation.map((item) => {
                    const isActive = location.pathname === item.href;
                    return (
                        <Link
                            key={item.name}
                            to={item.href}
                            className={cn(
                                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                                isActive
                                    ? "bg-primary/10 text-primary"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                        >
                            <item.icon className="h-5 w-5" />
                            {item.name}
                        </Link>
                    );
                })}

                {/* Facebook Section */}
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

                {/* Bottom Navigation */}
                <div className="mt-auto pt-4 border-t border-border">
                    {bottomNavigation.map((item) => {
                        const isActive = location.pathname === item.href;
                        return (
                            <Link
                                key={item.name}
                                to={item.href}
                                className={cn(
                                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                                    isActive
                                        ? "bg-primary/10 text-primary"
                                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                )}
                            >
                                <item.icon className="h-5 w-5" />
                                {item.name}
                            </Link>
                        );
                    })}
                </div>
            </div>
            <div className="p-4 border-t border-border">
                <button className="flex w-full items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                    <LogOut className="h-5 w-5" />
                    Logout
                </button>
            </div>
        </div>
    );
}

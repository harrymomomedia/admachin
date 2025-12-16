import { Bell, Search, Menu } from "lucide-react";

interface HeaderProps {
    onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
    return (
        <header className="h-16 border-b border-border bg-card px-4 md:px-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
                {/* Hamburger Menu - Mobile Only */}
                {onMenuClick && (
                    <button
                        onClick={onMenuClick}
                        className="md:hidden p-2 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                        <Menu className="h-5 w-5" />
                    </button>
                )}

                {/* Search - Hidden on small mobile */}
                <div className="relative hidden sm:block w-48 md:w-96">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search campaigns..."
                        className="w-full bg-muted/50 border border-border rounded-md pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                </div>
            </div>
            <div className="flex items-center gap-2 md:gap-4">
                <button className="p-2 text-muted-foreground hover:text-foreground transition-colors relative">
                    <Bell className="h-5 w-5" />
                    <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-red-500 rounded-full"></span>
                </button>
            </div>
        </header>
    );
}

import { Bell, Search } from "lucide-react";
import { useFacebook } from "../contexts/FacebookContext";

export function Header() {
    const { currentUser, teamName } = useFacebook();

    return (
        <header className="h-16 border-b border-border bg-card px-6 flex items-center justify-between">
            <div className="flex items-center gap-4 w-96">
                <div className="relative w-full">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search campaigns..."
                        className="w-full bg-muted/50 border border-border rounded-md pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                </div>
            </div>
            <div className="flex items-center gap-4">
                <button className="p-2 text-muted-foreground hover:text-foreground transition-colors relative">
                    <Bell className="h-5 w-5" />
                    <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-red-500 rounded-full"></span>
                </button>

                {/* Team & User Info */}
                <div className="flex items-center gap-3 pl-4 border-l border-border">
                    <div className="text-right hidden md:block">
                        <div className="text-sm font-semibold text-foreground">
                            {currentUser ? currentUser.name : 'Not Connected'}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center justify-end gap-1">
                            {teamName} <span className="px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">ADMIN</span>
                        </div>
                    </div>
                    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center text-white font-medium shadow-sm">
                        {currentUser ? currentUser.name.charAt(0).toUpperCase() : '?'}
                    </div>
                </div>
            </div>
        </header>
    );
}

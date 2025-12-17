import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Menu } from "lucide-react";
import { Sidebar } from "../components/Sidebar";

const SIDEBAR_COLLAPSED_KEY = 'admachin_sidebar_collapsed';

export function DashboardLayout() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(() => {
        const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
        return stored === 'true';
    });

    const toggleCollapse = () => {
        const newState = !isCollapsed;
        setIsCollapsed(newState);
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(newState));
    };

    return (
        <div className="flex h-screen w-screen bg-background text-foreground overflow-hidden">
            {/* Desktop Sidebar */}
            <div className="hidden md:block">
                <Sidebar isCollapsed={isCollapsed} onToggleCollapse={toggleCollapse} />
            </div>

            {/* Mobile Sidebar Overlay */}
            {isSidebarOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 bg-black/50 z-40 md:hidden"
                        onClick={() => setIsSidebarOpen(false)}
                    />
                    {/* Sidebar */}
                    <div className="fixed inset-y-0 left-0 z-50 md:hidden">
                        <Sidebar onClose={() => setIsSidebarOpen(false)} />
                    </div>
                </>
            )}

            <main className="flex-1 overflow-hidden flex flex-col min-w-0">
                {/* Mobile Header */}
                <div className="md:hidden flex items-center gap-3 px-3 py-2 border-b border-border bg-card flex-shrink-0">
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                        <Menu className="h-5 w-5" />
                    </button>
                    <span className="text-sm font-semibold text-foreground">AdMachin</span>
                </div>

                <div className="flex-1 flex flex-col overflow-hidden min-w-0">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}

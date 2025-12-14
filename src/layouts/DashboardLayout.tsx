import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "../components/Sidebar";
import { Header } from "../components/Header";

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

            <div className="flex-1 flex flex-col overflow-hidden">
                <Header onMenuClick={() => setIsSidebarOpen(true)} />
                <main className="flex-1 overflow-auto p-4 md:p-6">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}

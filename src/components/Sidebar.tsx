import { LayoutDashboard, Rocket, BarChart3, LogOut, Image, Database } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "../utils/cn";

const navigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Launch Ad", href: "/launch", icon: Rocket },
    { name: "Creatives", href: "/creatives", icon: Image },
    { name: "Campaigns", href: "/campaigns", icon: BarChart3 },
    { name: "Ad Accounts", href: "/ad-accounts", icon: Database },
];

export function Sidebar() {
    const location = useLocation();

    return (
        <div className="flex h-full w-64 flex-col bg-card border-r border-border">
            <div className="flex h-16 items-center px-6 border-b border-border">
                <Rocket className="h-6 w-6 text-primary mr-2" />
                <span className="text-xl font-bold text-foreground">AdMachin</span>
            </div>
            <div className="flex-1 flex flex-col gap-1 p-4">
                {navigation.map((item) => {
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
            <div className="p-4 border-t border-border">
                <button className="flex w-full items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                    <LogOut className="h-5 w-5" />
                    Logout
                </button>
            </div>
        </div>
    );
}

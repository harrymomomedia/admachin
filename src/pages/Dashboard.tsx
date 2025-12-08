import { ArrowUpRight, ArrowDownRight, DollarSign, Eye, MousePointer, Percent, X, CheckCircle } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useState, useEffect } from "react";

const stats = [
    {
        name: "Total Spend",
        value: "$12,450",
        change: "+12.5%",
        trend: "up",
        icon: DollarSign,
    },
    {
        name: "Impressions",
        value: "450.2K",
        change: "+8.2%",
        trend: "up",
        icon: Eye,
    },
    {
        name: "Clicks",
        value: "12,890",
        change: "-2.4%",
        trend: "down",
        icon: MousePointer,
    },
    {
        name: "CTR",
        value: "2.85%",
        change: "+4.1%",
        trend: "up",
        icon: Percent,
    },
];

const data = [
    { name: "Mon", value: 4000 },
    { name: "Tue", value: 3000 },
    { name: "Wed", value: 2000 },
    { name: "Thu", value: 2780 },
    { name: "Fri", value: 1890 },
    { name: "Sat", value: 2390 },
    { name: "Sun", value: 3490 },
];

export function Dashboard() {
    const [successMessage, setSuccessMessage] = useState<string | null>(() => {
        const stored = sessionStorage.getItem('launch_success');
        if (stored) {
            try {
                const data = JSON.parse(stored);
                // Only show if message is recent (within 10 seconds)
                if (Date.now() - data.timestamp < 10000) {
                    sessionStorage.removeItem('launch_success');
                    return data.message;
                }
            } catch {
                // Ignore parse errors
            }
            sessionStorage.removeItem('launch_success');
        }
        return null;
    });

    // Auto-dismiss success message
    useEffect(() => {
        if (successMessage) {
            const timer = setTimeout(() => setSuccessMessage(null), 8000);
            return () => clearTimeout(timer);
        }
    }, [successMessage]);

    return (
        <div className="space-y-6">
            {/* Success Notification Banner */}
            {successMessage && (
                <div className="animate-in slide-in-from-top fade-in duration-300 bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-full">
                            <CheckCircle className="h-5 w-5 text-green-600" />
                        </div>
                        <span className="text-green-800 font-medium">{successMessage}</span>
                    </div>
                    <button
                        onClick={() => setSuccessMessage(null)}
                        className="p-1 hover:bg-green-100 rounded-lg transition-colors text-green-600"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            )}

            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Dashboard Overview</h1>
                <div className="flex items-center gap-2">
                    <select className="bg-card border border-border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary">
                        <option>Last 7 days</option>
                        <option>Last 30 days</option>
                        <option>This Month</option>
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat) => (
                    <div key={stat.name} className="bg-card border border-border rounded-xl p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                <stat.icon className="h-5 w-5" />
                            </div>
                            <div className={`flex items-center text-xs font-medium ${stat.trend === 'up' ? 'text-green-500' : 'text-red-500'}`}>
                                {stat.change}
                                {stat.trend === 'up' ? <ArrowUpRight className="h-3 w-3 ml-1" /> : <ArrowDownRight className="h-3 w-3 ml-1" />}
                            </div>
                        </div>
                        <div className="text-2xl font-bold mb-1">{stat.value}</div>
                        <div className="text-xs text-muted-foreground">{stat.name}</div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-card border border-border rounded-xl p-6 shadow-sm">
                    <h2 className="text-lg font-semibold mb-6">Performance Trend</h2>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={data}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                                <XAxis
                                    dataKey="name"
                                    stroke="hsl(var(--muted-foreground))"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    stroke="hsl(var(--muted-foreground))"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(value) => `$${value}`}
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="value"
                                    stroke="hsl(var(--primary))"
                                    strokeWidth={2}
                                    dot={{ r: 4, fill: "hsl(var(--primary))" }}
                                    activeDot={{ r: 6 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                    <h2 className="text-lg font-semibold mb-4">Recent Campaigns</h2>
                    <div className="space-y-4">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="flex items-center justify-between p-3 hover:bg-muted/50 rounded-lg transition-colors cursor-pointer">
                                <div className="flex items-center gap-3">
                                    <div className="h-2 w-2 rounded-full bg-green-500"></div>
                                    <div>
                                        <div className="text-sm font-medium">Summer Sale 2024</div>
                                        <div className="text-xs text-muted-foreground">Active • $450 spent</div>
                                    </div>
                                </div>
                                <div className="text-sm font-medium">$1.24 CPC</div>
                            </div>
                        ))}
                    </div>
                    <button className="w-full mt-4 py-2 text-sm text-primary hover:bg-primary/10 rounded-lg transition-colors">
                        View All Campaigns
                    </button>
                </div>
            </div>
        </div>
    );
}

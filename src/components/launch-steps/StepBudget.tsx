import { Calendar, DollarSign, Clock } from "lucide-react";
import type { LaunchAdFormData, BudgetData } from "../../types/launch";

interface StepBudgetProps {
    data: LaunchAdFormData;
    updateData: (data: LaunchAdFormData) => void;
}

export function StepBudget({ data, updateData }: StepBudgetProps) {
    const budget = data.budget || {};

    const updateBudget = (key: keyof BudgetData, value: string) => {
        updateData({
            ...data,
            budget: { ...budget, [key]: value },
        });
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-semibold">Budget & Schedule</h2>
                <p className="text-muted-foreground">Set your spending limit and campaign duration.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                    <div className="bg-card border border-border rounded-xl p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <DollarSign className="h-5 w-5 text-primary" />
                            <h3 className="font-semibold">Budget</h3>
                        </div>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Budget Type</label>
                                <select
                                    value={budget.type || "daily"}
                                    onChange={(e) => updateBudget("type", e.target.value)}
                                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                >
                                    <option value="daily">Daily Budget</option>
                                    <option value="lifetime">Lifetime Budget</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Amount</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2 text-muted-foreground">$</span>
                                    <input
                                        type="number"
                                        placeholder="20.00"
                                        value={budget.amount || ""}
                                        onChange={(e) => updateBudget("amount", e.target.value)}
                                        className="w-full bg-background border border-border rounded-md pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-card border border-border rounded-xl p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Calendar className="h-5 w-5 text-primary" />
                            <h3 className="font-semibold">Schedule</h3>
                        </div>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Start Date</label>
                                <input
                                    type="date"
                                    min={new Date().toISOString().split('T')[0]}
                                    value={budget.startDate || ""}
                                    onChange={(e) => updateBudget("startDate", e.target.value)}
                                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">End Date (Optional)</label>
                                <input
                                    type="date"
                                    min={budget.startDate || new Date().toISOString().split('T')[0]}
                                    value={budget.endDate || ""}
                                    onChange={(e) => updateBudget("endDate", e.target.value)}
                                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-muted/30 rounded-xl p-6 h-fit">
                    <div className="flex items-center gap-2 mb-4">
                        <Clock className="h-5 w-5 text-primary" />
                        <h3 className="font-semibold">Campaign Summary</h3>
                    </div>
                    <div className="space-y-4 text-sm">
                        <div className="flex justify-between py-2 border-b border-border">
                            <span className="text-muted-foreground">Objective</span>
                            <span className="font-medium capitalize">{data.objective || "Not selected"}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-border">
                            <span className="text-muted-foreground">Audience Location</span>
                            <span className="font-medium">
                                {data.audience?.locations?.length
                                    ? `${data.audience.locations[0].name}${data.audience.locations.length > 1 ? ` +${data.audience.locations.length - 1}` : ''}`
                                    : "Not selected"
                                }
                            </span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-border">
                            <span className="text-muted-foreground">Budget Type</span>
                            <span className="font-medium capitalize">{budget.type || "Daily"}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-border">
                            <span className="text-muted-foreground">Estimated Reach</span>
                            <span className="font-medium">1.2K - 3.4K people per day</span>
                        </div>
                        <div className="pt-2">
                            <div className="flex justify-between items-center mb-1">
                                <span className="font-semibold">Total Budget</span>
                                <span className="text-lg font-bold text-primary">
                                    ${budget.amount || "0.00"}
                                    <span className="text-xs font-normal text-muted-foreground ml-1">
                                        {budget.type === "lifetime" ? "total" : "/ day"}
                                    </span>
                                </span>
                            </div>
                            <p className="text-xs text-muted-foreground italic">
                                * Amount will be converted to cents for Facebook (e.g., $20.00 = 2000 cents)
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

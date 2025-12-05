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
                <h2 className="text-xl font-semibold text-gray-900">Budget & Schedule</h2>
                <p className="text-gray-500">Set your spending limit and campaign duration.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                    <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                            <DollarSign className="h-5 w-5 text-gray-400" />
                            <h3 className="font-semibold text-gray-900">Budget</h3>
                        </div>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Budget Type</label>
                                <select
                                    value={budget.type || "daily"}
                                    onChange={(e) => updateBudget("type", e.target.value)}
                                    className="w-full bg-white border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                >
                                    <option value="daily">Daily Budget</option>
                                    <option value="lifetime">Lifetime Budget</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Amount</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2 text-gray-500">$</span>
                                    <input
                                        type="number"
                                        placeholder="20.00"
                                        value={budget.amount || ""}
                                        onChange={(e) => updateBudget("amount", e.target.value)}
                                        className="w-full bg-white border border-gray-200 rounded-md pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                            <Calendar className="h-5 w-5 text-gray-400" />
                            <h3 className="font-semibold text-gray-900">Schedule</h3>
                        </div>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Start Date</label>
                                <input
                                    type="date"
                                    min={new Date().toISOString().split('T')[0]}
                                    value={budget.startDate || ""}
                                    onChange={(e) => updateBudget("startDate", e.target.value)}
                                    className="w-full bg-white border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">End Date (Optional)</label>
                                <input
                                    type="date"
                                    min={budget.startDate || new Date().toISOString().split('T')[0]}
                                    value={budget.endDate || ""}
                                    onChange={(e) => updateBudget("endDate", e.target.value)}
                                    className="w-full bg-white border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-6 h-fit border border-gray-100">
                    <div className="flex items-center gap-2 mb-4">
                        <Clock className="h-5 w-5 text-gray-400" />
                        <h3 className="font-semibold text-gray-900">Campaign Summary</h3>
                    </div>
                    <div className="space-y-4 text-sm">
                        <div className="flex justify-between py-2 border-b border-gray-200">
                            <span className="text-gray-500">Objective</span>
                            <span className="font-medium capitalize text-gray-900">{data.objective || "Not selected"}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-gray-200">
                            <span className="text-gray-500">Audience Location</span>
                            <div className="text-right">
                                <span className="font-medium text-gray-900 block">
                                    {data.audience?.locations?.length
                                        ? `${data.audience.locations[0].name}${data.audience.locations.length > 1 ? ` +${data.audience.locations.length - 1}` : ''}`
                                        : "Not selected"
                                    }
                                </span>
                                {data.audience?.excludedLocations?.length ? (
                                    <span className="text-xs text-red-500 block">
                                        Excluding {data.audience.excludedLocations.length} locations
                                    </span>
                                ) : null}
                            </div>
                        </div>
                        <div className="flex justify-between py-2 border-b border-gray-200">
                            <span className="text-gray-500">Budget Type</span>
                            <span className="font-medium capitalize text-gray-900">{budget.type || "Daily"}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-gray-200">
                            <span className="text-gray-500">Estimated Reach</span>
                            <span className="font-medium text-gray-900">1.2K - 3.4K people per day</span>
                        </div>
                        <div className="pt-2">
                            <div className="flex justify-between items-center mb-1">
                                <span className="font-semibold text-gray-900">Total Budget</span>
                                <span className="text-lg font-bold text-blue-600">
                                    ${budget.amount || "0.00"}
                                    <span className="text-xs font-normal text-gray-500 ml-1">
                                        {budget.type === "lifetime" ? "total" : "/ day"}
                                    </span>
                                </span>
                            </div>
                            <p className="text-xs text-gray-500 italic">
                                * Amount will be converted to cents for Facebook (e.g., $20.00 = 2000 cents)
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

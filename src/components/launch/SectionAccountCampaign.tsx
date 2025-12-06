import { Settings } from "lucide-react";
import type { LaunchAdFormData } from "../../types/launch";
import type { AdAccount, Campaign, AdSet } from "../../types/facebook";

interface SectionAccountCampaignProps {
    data: LaunchAdFormData;
    updateData: (data: LaunchAdFormData) => void;
    selectedAccount: string;
    allAdAccounts: AdAccount[];
    onAccountChange: (accountId: string) => void;
    existingCampaigns: Campaign[];
    existingAdSets: AdSet[];
    isConnected: boolean;
}

const OBJECTIVES = [
    { value: "OUTCOME_TRAFFIC", label: "Traffic" },
    { value: "OUTCOME_AWARENESS", label: "Awareness" },
    { value: "OUTCOME_LEADS", label: "Leads" },
    { value: "OUTCOME_SALES", label: "Sales" },
    { value: "OUTCOME_ENGAGEMENT", label: "Engagement" },
];

export function SectionAccountCampaign({
    data,
    updateData,
    selectedAccount,
    allAdAccounts,
    onAccountChange,
    existingCampaigns,
    existingAdSets,
    isConnected,
}: SectionAccountCampaignProps) {
    const creationMode = data.creationMode || "new_campaign";

    return (
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-6">
                <Settings className="h-5 w-5 text-gray-400" />
                <h3 className="font-semibold text-gray-900">Account & Campaign</h3>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="space-y-4">
                    {/* Ad Account */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">
                            Ad Account <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={selectedAccount}
                            onChange={(e) => onAccountChange(e.target.value)}
                            disabled={!isConnected || allAdAccounts.length === 0}
                            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <option value="">Select ad account</option>
                            {allAdAccounts.map((account) => (
                                <option key={account.id} value={account.id}>
                                    {account.name} ({account.account_id})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Campaign Name */}
                    {creationMode === "new_campaign" && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">
                                Campaign Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={data.name || ""}
                                onChange={(e) => updateData({ ...data, name: e.target.value })}
                                placeholder="e.g. Summer Sale 2024"
                                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            />
                        </div>
                    )}

                    {/* Existing Campaign Selector (for add_to_campaign mode) */}
                    {creationMode === "add_to_campaign" && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">
                                Select Campaign <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={data.existingCampaignId || ""}
                                onChange={(e) => updateData({ ...data, existingCampaignId: e.target.value })}
                                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            >
                                <option value="">Select existing campaign</option>
                                {existingCampaigns.map((campaign) => (
                                    <option key={campaign.id} value={campaign.id}>
                                        {campaign.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Existing Campaign & Ad Set Selector (for add_to_adset mode) */}
                    {creationMode === "add_to_adset" && (
                        <>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">
                                    Select Campaign <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={data.existingCampaignId || ""}
                                    onChange={(e) => updateData({
                                        ...data,
                                        existingCampaignId: e.target.value,
                                        existingAdSetId: undefined // Reset ad set when campaign changes
                                    })}
                                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                >
                                    <option value="">Select existing campaign</option>
                                    {existingCampaigns.map((campaign) => (
                                        <option key={campaign.id} value={campaign.id}>
                                            {campaign.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">
                                    Select Ad Set <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={data.existingAdSetId || ""}
                                    onChange={(e) => updateData({ ...data, existingAdSetId: e.target.value })}
                                    disabled={!data.existingCampaignId}
                                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <option value="">
                                        {data.existingCampaignId
                                            ? (existingAdSets.length === 0 ? "No ad sets found" : "Select existing ad set")
                                            : "Select a campaign first"
                                        }
                                    </option>
                                    {existingAdSets.map((adSet) => (
                                        <option key={adSet.id} value={adSet.id}>
                                            {adSet.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </>
                    )}

                    {/* Objective */}
                    {creationMode === "new_campaign" && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Objective</label>
                            <select
                                value={data.objective || "OUTCOME_TRAFFIC"}
                                onChange={(e) => updateData({ ...data, objective: e.target.value })}
                                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            >
                                {OBJECTIVES.map((obj) => (
                                    <option key={obj.value} value={obj.value}>
                                        {obj.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Special Ad Categories */}
                    {creationMode === "new_campaign" && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">
                                Special Ad Category <span className="text-gray-400 font-normal">(if applicable)</span>
                            </label>
                            <select
                                value={(data.specialAdCategories || [])[0] || "NONE"}
                                onChange={(e) => updateData({
                                    ...data,
                                    specialAdCategories: e.target.value === "NONE" ? [] : [e.target.value]
                                })}
                                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            >
                                <option value="NONE">None</option>
                                <option value="CREDIT">Credit</option>
                                <option value="HOUSING">Housing</option>
                                <option value="EMPLOYMENT">Employment</option>
                                <option value="ISSUES_ELECTIONS_POLITICS">Social Issues, Elections or Politics</option>
                            </select>
                            <p className="text-xs text-gray-500">Required for ads about credit, housing, jobs, or political topics</p>
                        </div>
                    )}

                    {/* Ad Set Name (optional) */}
                    {(creationMode === "new_campaign" || creationMode === "add_to_campaign") && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">
                                Ad Set Name <span className="text-gray-400 font-normal">(optional)</span>
                            </label>
                            <input
                                type="text"
                                value={data.adSetName || ""}
                                onChange={(e) => updateData({ ...data, adSetName: e.target.value })}
                                placeholder="Leave blank for auto-generated name"
                                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            />
                        </div>
                    )}
                </div>

                {/* Right Column - Budget inline */}
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">
                            Daily Budget (USD) <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-gray-500 text-sm">$</span>
                            <input
                                type="number"
                                min="1"
                                step="1"
                                value={data.budget?.amount || "20"}
                                onChange={(e) =>
                                    updateData({
                                        ...data,
                                        budget: { ...data.budget, amount: e.target.value, type: "daily" },
                                    })
                                }
                                className="w-full bg-white border border-gray-200 rounded-lg pl-7 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            />
                        </div>
                        <p className="text-xs text-gray-500">Minimum daily budget is $1</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

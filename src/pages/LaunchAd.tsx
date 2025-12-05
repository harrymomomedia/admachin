import { useState, useEffect } from "react";
import { ChevronRight, ChevronLeft, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Stepper } from "../components/Stepper";
import { StepObjective } from "../components/launch-steps/StepObjective";
import { StepAudience } from "../components/launch-steps/StepAudience";
import { StepCreative } from "../components/launch-steps/StepCreative";
import { StepBudget } from "../components/launch-steps/StepBudget";
import { useFacebook } from "../contexts/FacebookContext";
import api from "../services/facebook/api";
import { getSelectedAdAccountId, setSelectedAdAccountId } from "../services/facebook/config";
import type { LaunchAdFormData } from "../types/launch";
import type { CreateCampaignParams, CreateAdSetParams, CreateAdParams } from "../types/facebook";

const steps = ["Objective", "Audience", "Creative", "Budget"];

export function LaunchAd() {
    const navigate = useNavigate();
    const { isConnected, allAdAccounts } = useFacebook();
    const [currentStep, setCurrentStep] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [launchError, setLaunchError] = useState<string | null>(null);
    const [selectedAccount, setSelectedAccount] = useState<string>("");

    // Form State
    const [formData, setFormData] = useState<LaunchAdFormData>({
        objective: "",
        name: "",
        audience: {},
        creative: {},
        budget: {},
    });

    // Check for selected account on mount
    useEffect(() => {
        const storedId = getSelectedAdAccountId();
        if (storedId) {
            setSelectedAccount(storedId);
        } else if (allAdAccounts.length > 0) {
            // Auto-select first if none selected
            const firstId = allAdAccounts[0].id;
            setSelectedAccount(firstId);
            setSelectedAdAccountId(firstId);
        }
    }, [allAdAccounts]);

    const handleAccountChange = (accountId: string) => {
        setSelectedAccount(accountId);
        setSelectedAdAccountId(accountId);
    };

    const updateData = (data: LaunchAdFormData) => {
        setFormData(data);
    };

    const nextStep = () => {
        // Validation logic can go here
        if (currentStep === 0 && !formData.name) {
            alert("Please enter a campaign name");
            return;
        }

        if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            handleLaunch();
        }
    };

    const prevStep = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    const handleLaunch = async () => {
        if (!selectedAccount) {
            setLaunchError("Please select an ad account first.");
            return;
        }

        setIsSubmitting(true);
        setLaunchError(null);

        try {
            // Ensure we are using the correct account context
            // Note: The API uses getSelectedAdAccountId() internally, so we just need to ensure it's set
            setSelectedAdAccountId(selectedAccount);

            // 1. Create Campaign
            const campaignParams: CreateCampaignParams = {
                name: formData.name || "New Campaign",
                objective: (formData.objective as any) || "OUTCOME_TRAFFIC",
                status: "PAUSED",
                special_ad_categories: [], // Empty for general ads
            };

            const campaign = await api.createCampaign(campaignParams);
            console.log("Created Campaign:", campaign.id);

            // 2. Upload Media (if needed) & Prepare Creative
            let imageHash: string | undefined;
            let videoId: string | undefined;

            if (formData.creative?.media?.[0]) {
                const file = formData.creative.media[0].file;
                if (file.type.startsWith('video/')) {
                    const video = await api.uploadVideo(file, "Ad Video");
                    videoId = video.id;
                } else {
                    const image = await api.uploadImage(file);
                    imageHash = image.hash;
                }
            }

            // 3. Create Ad Set
            const adSetParams: CreateAdSetParams = {
                name: `${formData.name} - Ad Set`,
                campaign_id: campaign.id,
                status: "PAUSED",
                billing_event: "IMPRESSIONS",
                optimization_goal: "REACH", // Default for Awareness, needs logic map based on objective
                targeting: {
                    geo_locations: {
                        countries: formData.audience?.locations?.filter(l => l.type === 'country').map(l => l.country_code!) || [],
                        cities: formData.audience?.locations?.filter(l => l.type === 'city').map(l => ({ key: l.key!, radius: 25, distance_unit: 'mile' })) || [],
                        regions: formData.audience?.locations?.filter(l => l.type === 'region').map(l => ({ key: l.key! })) || [],
                        // Default to US if nothing selected
                        ...((!formData.audience?.locations?.length) ? { countries: ['US'] } : {})
                    },
                    age_min: formData.audience?.ageMin,
                    age_max: formData.audience?.ageMax,
                    genders: formData.audience?.gender,
                    interests: formData.audience?.interests?.map(i => ({ id: i.id, name: i.name })),
                },
                daily_budget: formData.budget?.type === 'daily' ? parseFloat(formData.budget?.amount || "10") : undefined,
                lifetime_budget: formData.budget?.type === 'lifetime' ? parseFloat(formData.budget?.amount || "100") : undefined,
                start_time: formData.budget?.startDate ? new Date(formData.budget.startDate).toISOString() : undefined,
                end_time: formData.budget?.endDate ? new Date(formData.budget.endDate).toISOString() : undefined,
            };

            // Map Optimization Goal based on Objective
            if (formData.objective === 'OUTCOME_TRAFFIC') {
                adSetParams.optimization_goal = 'LINK_CLICKS';
                adSetParams.billing_event = 'LINK_CLICKS';
            } else if (formData.objective === 'OUTCOME_SALES') {
                adSetParams.optimization_goal = 'OFFSITE_CONVERSIONS';
            }

            const adSet = await api.createAdSet(adSetParams);
            console.log("Created Ad Set:", adSet.id);

            // 4. Create Ad
            const creativeSpec = {
                name: `${formData.name} - Creative`,
                title: formData.creative?.headline || "Headline",
                body: formData.creative?.primaryText || "Primary Text",
                object_story_spec: {
                    page_id: (await api.getPages()).data[0]?.id || "", // Get first page or fail
                    link_data: {
                        link: formData.creative?.url || "https://example.com",
                        message: formData.creative?.primaryText,
                        image_hash: imageHash,
                        call_to_action: {
                            type: (formData.creative?.cta as any) || "LEARN_MORE",
                            value: { link: formData.creative?.url || "https://example.com" }
                        }
                    },
                    ...(videoId ? {
                        video_data: {
                            video_id: videoId,
                            title: formData.creative?.headline,
                            message: formData.creative?.primaryText,
                            call_to_action: {
                                type: (formData.creative?.cta as any) || "LEARN_MORE",
                                value: { link: formData.creative?.url }
                            }
                        }
                    } : {})
                }
            };

            const adParams: CreateAdParams = {
                name: `${formData.name} - Ad`,
                adset_id: adSet.id,
                creative: {
                    name: creativeSpec.name,
                    object_story_spec: creativeSpec.object_story_spec
                },
                status: "PAUSED"
            };

            await api.createAd(adParams);

            setIsSubmitting(false);
            navigate("/"); // Go to Dashboard/Home
        } catch (error: any) {
            console.error("Launch failed:", error);
            setLaunchError(error.message || "Failed to launch campaign. Please check your inputs and valid Ad Account.");
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto pb-20">
            <div className="mb-8">
                <div className="flex justify-between items-start mb-4">
                    <h1 className="text-2xl font-bold">Create New Campaign</h1>

                    {/* Account Selector */}
                    {isConnected && allAdAccounts.length > 0 && (
                        <div className="flex items-center gap-2 bg-card border border-border px-3 py-1.5 rounded-lg shadow-sm">
                            <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Ad Account:</span>
                            <select
                                value={selectedAccount}
                                onChange={(e) => handleAccountChange(e.target.value)}
                                className="text-sm bg-transparent border-none focus:ring-0 cursor-pointer font-medium"
                            >
                                <option value="" disabled>Select Account</option>
                                {allAdAccounts.map(account => (
                                    <option key={account.id} value={account.id}>
                                        {account.name} ({account.account_id})
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
                <Stepper steps={steps} currentStep={currentStep} />
            </div>

            <div className="bg-card border border-border rounded-xl p-8 shadow-sm min-h-[400px]">
                {launchError && (
                    <div className="mb-6 p-4 bg-destructive/10 text-destructive rounded-lg flex items-center gap-2">
                        <AlertCircle className="h-5 w-5" />
                        <p>{launchError}</p>
                    </div>
                )}

                {!isConnected && (
                    <div className="mb-6 p-4 bg-yellow-500/10 text-yellow-600 rounded-lg">
                        Please connect your Facebook account to launch ads.
                    </div>
                )}

                {isConnected && !selectedAccount && (
                    <div className="mb-6 p-4 bg-yellow-500/10 text-yellow-600 rounded-lg">
                        Please select an Ad Account to proceed.
                    </div>
                )}

                {currentStep === 0 && <StepObjective data={formData} updateData={updateData} />}
                {currentStep === 1 && <StepAudience data={formData} updateData={updateData} />}
                {currentStep === 2 && <StepCreative data={formData} updateData={updateData} />}
                {currentStep === 3 && <StepBudget data={formData} updateData={updateData} />}
            </div>

            <div className="fixed bottom-0 left-64 right-0 p-4 bg-card border-t border-border flex justify-between items-center z-10">
                <button
                    onClick={prevStep}
                    disabled={currentStep === 0}
                    className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <ChevronLeft className="h-4 w-4" />
                    Back
                </button>
                <button
                    onClick={nextStep}
                    disabled={isSubmitting || !isConnected || !selectedAccount}
                    className="flex items-center gap-2 px-6 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isSubmitting ? (
                        <>
                            <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            Launching...
                        </>
                    ) : (
                        <>
                            {currentStep === steps.length - 1 ? "Launch Campaign" : "Next Step"}
                            <ChevronRight className="h-4 w-4" />
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}

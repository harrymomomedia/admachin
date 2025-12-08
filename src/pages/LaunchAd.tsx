import { useState, useEffect, useRef } from "react";
import { Plus, FileBox, FilePlus2, AlertCircle, Rocket, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useFacebook } from "../contexts/FacebookContext";
import api from "../services/facebook/api";
import { getSelectedAdAccountId, setSelectedAdAccountId } from "../services/facebook/config";
import { SectionAccountCampaign } from "../components/launch/SectionAccountCampaign";
import { SectionLocationAudience } from "../components/launch/SectionLocationAudience";
import { SectionPlacements } from "../components/launch/SectionPlacements";
import { SectionCreative } from "../components/launch/SectionCreative";
import { SectionConversion } from "../components/launch/SectionConversion";
import type { LaunchAdFormData, CreationMode } from "../types/launch";
import type { CreateCampaignParams, CreateAdSetParams, CreateAdParams, Campaign, AdSet, FacebookPage } from "../types/facebook";

const CREATION_MODES: { id: CreationMode; label: string; description: string; icon: React.ComponentType<{ className?: string }> }[] = [
    {
        id: "new_campaign",
        label: "New Campaign",
        description: "Create a complete new campaign with ad set and ad",
        icon: Plus,
    },
    {
        id: "add_to_campaign",
        label: "Add to Campaign",
        description: "Create a new ad set within an existing campaign",
        icon: FileBox,
    },
    {
        id: "add_to_adset",
        label: "Add to Ad Set",
        description: "Create a new ad within an existing ad set",
        icon: FilePlus2,
    },
];

export function LaunchAd() {
    const navigate = useNavigate();
    const { isConnected, allAdAccounts } = useFacebook();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [launchError, setLaunchError] = useState<string | null>(null);
    const [existingCampaigns, setExistingCampaigns] = useState<Campaign[]>([]);
    const [existingAdSets, setExistingAdSets] = useState<AdSet[]>([]);
    const [pages, setPages] = useState<FacebookPage[]>([]);
    const [validationErrors, setValidationErrors] = useState<string[]>([]);

    // Track if we've set page ID
    const pageIdSet = useRef(false);

    // Track the last campaign ID we fetched ad sets for
    const lastFetchedCampaignId = useRef<string | null>(null);

    // Derive initial account - use stored value or first available
    const getInitialAccount = (): string => {
        const storedId = getSelectedAdAccountId();
        if (storedId) return storedId;
        if (allAdAccounts.length > 0) {
            const firstId = allAdAccounts[0].id;
            setSelectedAdAccountId(firstId);
            return firstId;
        }
        return "";
    };

    // Use the derived initial value
    const [selectedAccountState, setSelectedAccountState] = useState<string>(getInitialAccount);

    // Compute effective selected account - prefer state, fallback to first available
    const selectedAccount = selectedAccountState || (allAdAccounts.length > 0 ? allAdAccounts[0].id : "");

    // Form State
    const [formData, setFormData] = useState<LaunchAdFormData>({
        creationMode: "new_campaign",
        objective: "OUTCOME_TRAFFIC",
        name: "",
        budget: { type: "daily", amount: "20" },
        audience: { ageMin: 18, ageMax: 65 },
        placements: {
            advantagePlus: true,
            platforms: {
                facebook: true,
                instagram: true,
                messenger: true,
                audienceNetwork: true,
            },
        },
        creative: { cta: "LEARN_MORE" },
    });

    // Load existing campaigns and pages when account is selected
    useEffect(() => {
        if (selectedAccount && isConnected) {
            setSelectedAdAccountId(selectedAccount);
            // Load campaigns
            api.getCampaigns(50).then((res) => {
                setExistingCampaigns(res.data);
            }).catch(console.error);
            // Load pages
            api.getPages().then((res) => {
                console.log('[LaunchAd] Loaded pages:', res.data?.length || 0, res.data);
                setPages(res.data);
                // Auto-select first page if available and not already set
                if (res.data.length > 0 && !pageIdSet.current) {
                    pageIdSet.current = true;
                    console.log('[LaunchAd] Auto-selecting first page:', res.data[0].id);
                    setFormData((prev) => ({
                        ...prev,
                        creative: { ...prev.creative, pageId: res.data[0].id },
                    }));
                }
            }).catch((err) => {
                console.error('[LaunchAd] Failed to load pages:', err);
            });
        }
    }, [selectedAccount, isConnected]);

    // Load ad sets when a campaign is selected (for "Add to Ad Set" mode)
    useEffect(() => {
        const campaignId = formData.existingCampaignId;
        const shouldFetch = campaignId && isConnected && formData.creationMode === "add_to_adset";

        if (shouldFetch) {
            // Fetch if campaign changed
            if (campaignId !== lastFetchedCampaignId.current) {
                lastFetchedCampaignId.current = campaignId;
                api.getAdSets(campaignId, 50).then((res) => {
                    setExistingAdSets(res.data);
                }).catch(console.error);
            }
        } else {
            // Clear via async callback to avoid synchronous setState
            lastFetchedCampaignId.current = null;
            Promise.resolve().then(() => {
                setExistingAdSets([]);
            });
        }
    }, [formData.existingCampaignId, formData.creationMode, isConnected]);

    const handleAccountChange = (accountId: string) => {
        setSelectedAccountState(accountId);
        setSelectedAdAccountId(accountId);
    };

    const updateData = (data: LaunchAdFormData) => {
        setFormData(data);
        setValidationErrors([]);
    };

    // Validation
    const validateForm = (): string[] => {
        const errors: string[] = [];
        const mode = formData.creationMode || "new_campaign";

        // Account validation
        if (!selectedAccount) {
            errors.push("Please select an ad account");
        }

        // Campaign validation (new campaign mode)
        if (mode === "new_campaign") {
            if (!formData.name?.trim()) {
                errors.push("Campaign name is required");
            }
        }

        // Existing campaign validation (add to campaign mode)
        if (mode === "add_to_campaign" && !formData.existingCampaignId) {
            errors.push("Please select an existing campaign");
        }

        // Existing ad set validation (add to ad set mode)
        if (mode === "add_to_adset" && !formData.existingAdSetId) {
            errors.push("Please select an existing ad set");
        }

        // Location validation
        if (!formData.audience?.locations?.length) {
            errors.push("At least one location is required");
        }

        // Budget validation
        const budgetAmount = parseFloat(formData.budget?.amount || "0");
        if (budgetAmount < 1) {
            errors.push("Minimum daily budget is $1");
        }

        // Conversion validation
        if (["OUTCOME_LEADS", "OUTCOME_SALES"].includes(formData.objective || "")) {
            if (!formData.conversion?.pixelId) {
                errors.push("Pixel is required for this objective");
            }
        }

        // Creative validation
        if (!formData.creative?.pageId) {
            errors.push("Facebook Page is required");
        }
        if (!formData.creative?.headline?.trim()) {
            errors.push("Headline is required");
        }
        if (!formData.creative?.primaryText?.trim()) {
            errors.push("Primary text is required");
        }

        // URL validation
        const url = formData.creative?.url?.trim();
        if (!url) {
            errors.push("Link URL is required");
        } else if (!url.startsWith("http://") && !url.startsWith("https://")) {
            errors.push("Link URL must start with http:// or https://");
        }

        return errors;
    };

    // Launch Logs
    const [launchLogs, setLaunchLogs] = useState<string[]>([]);

    const addLog = (message: string) => {
        setLaunchLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
    };

    const handleLaunch = async () => {
        if (!selectedAccount) return;
        setIsSubmitting(true);
        setLaunchLogs([]); // Clear previous logs
        addLog("Starting ad launch sequence...");

        const errors = validateForm();
        if (errors.length > 0) {
            setIsSubmitting(false);
            setValidationErrors(errors);
            return;
        }

        setIsSubmitting(true);
        setLaunchError(null);

        try {
            const mode = formData.creationMode || "new_campaign";
            let campaignId = formData.existingCampaignId;
            let adSetId = formData.existingAdSetId;

            console.log("=== LAUNCH AD DEBUG ===");
            console.log("Mode:", mode);
            console.log("Form Data:", JSON.stringify(formData, null, 2));

            // 1. Create Campaign (if new)
            if (mode === "new_campaign") {
                const campaignParams: CreateCampaignParams = {
                    name: formData.name || "New Campaign",
                    objective: (formData.objective as CreateCampaignParams["objective"]) || "OUTCOME_TRAFFIC",
                    status: "PAUSED",
                    special_ad_categories: (formData.specialAdCategories || []) as ("CREDIT" | "HOUSING" | "EMPLOYMENT" | "ISSUES_ELECTIONS_POLITICS")[],
                };
                console.log("Creating Campaign with params:", JSON.stringify(campaignParams, null, 2));
                const campaign = await api.createCampaign(campaignParams);
                campaignId = campaign.id;
                console.log("✓ Created Campaign:", campaignId);
            }

            // 2. Create Ad Set (if new campaign or add to campaign)
            if (mode === "new_campaign" || mode === "add_to_campaign") {
                // Build targeting with placements
                const targeting: CreateAdSetParams["targeting"] = {
                    geo_locations: {
                        countries: formData.audience?.locations
                            ?.filter((l) => l.type === "country")
                            .map((l) => l.country_code!) || [],
                        cities: formData.audience?.locations
                            ?.filter((l) => l.type === "city")
                            .map((l) => ({ key: l.key!, radius: 25, distance_unit: "mile" })) || [],
                        regions: formData.audience?.locations
                            ?.filter((l) => l.type === "region")
                            .map((l) => ({ key: l.key! })) || [],
                    },
                    age_min: formData.audience?.ageMin || 18,
                    age_max: formData.audience?.ageMax || 65,
                    genders: formData.audience?.gender,
                };

                // Default to US if no valid location
                if (
                    !targeting.geo_locations?.countries?.length &&
                    !targeting.geo_locations?.cities?.length &&
                    !targeting.geo_locations?.regions?.length
                ) {
                    targeting.geo_locations = { countries: ["US"] };
                }

                // Add placements if not using Advantage+
                if (!formData.placements?.advantagePlus) {
                    const platforms: ("facebook" | "instagram" | "audience_network" | "messenger")[] = [];
                    if (formData.placements?.platforms.facebook) platforms.push("facebook");
                    if (formData.placements?.platforms.instagram) platforms.push("instagram");
                    if (formData.placements?.platforms.audienceNetwork) platforms.push("audience_network");
                    if (formData.placements?.platforms.messenger) platforms.push("messenger");

                    if (platforms.length > 0) {
                        targeting.publisher_platforms = platforms;
                    }
                }

                // Budget in dollars - api.ts will convert to cents
                const budgetAmount = parseFloat(formData.budget?.amount || "20");

                // Map objective to optimization goal
                type OptGoal = "LINK_CLICKS" | "LEAD_GENERATION" | "REACH" | "OFFSITE_CONVERSIONS" | "POST_ENGAGEMENT";
                const getOptimizationGoal = (objective: string): OptGoal => {
                    const mapping: Record<string, OptGoal> = {
                        "OUTCOME_TRAFFIC": "LINK_CLICKS",
                        "OUTCOME_LEADS": "LEAD_GENERATION",
                        "OUTCOME_AWARENESS": "REACH",
                        "OUTCOME_SALES": "OFFSITE_CONVERSIONS",
                        "OUTCOME_ENGAGEMENT": "POST_ENGAGEMENT",
                    };
                    return mapping[objective] || "LINK_CLICKS";
                };

                const adSetParams: CreateAdSetParams = {
                    name: formData.adSetName || `${formData.name || "Campaign"} - Ad Set`,
                    campaign_id: campaignId!,
                    status: "PAUSED",
                    billing_event: "IMPRESSIONS",
                    optimization_goal: getOptimizationGoal(formData.objective || "OUTCOME_TRAFFIC"),
                    // Use LOWEST_COST_WITHOUT_CAP to avoid requiring bid amounts
                    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
                    targeting,
                    daily_budget: budgetAmount,
                    // Add promoted object for Lead/Sales objectives
                    // Lead campaigns need page_id, Sales/Conversion campaigns need pixel_id
                    ...(formData.objective === "OUTCOME_LEADS" ? {
                        promoted_object: {
                            page_id: formData.creative?.pageId,
                        }
                    } : (["OUTCOME_SALES", "OUTCOME_CONVERSIONS"].includes(formData.objective || "") && formData.conversion?.pixelId ? {
                        promoted_object: {
                            pixel_id: formData.conversion.pixelId,
                            custom_event_type: formData.conversion.customEvent || "PURCHASE"
                        }
                    } : {}))
                };

                addLog(`Creating Ad Set with params: ${JSON.stringify(adSetParams, null, 2)}`);
                const adSet = await api.createAdSet(adSetParams);
                adSetId = adSet.id;
                addLog(`✓ Created Ad Set ID: ${adSetId}`);
            } else {
                addLog(`Using existing Ad Set ID: ${adSetId}`);
            }

            // 3. Create Ad
            addLog("Preparing Ad Creative...");
            // Get the media info from selected creative
            const imageUrl = formData.creative?.mediaPreview || formData.creative?.imageUrl;
            const imageHash = formData.creative?.imageHash;
            const mediaType = formData.creative?.mediaType || "image";
            let videoId = formData.creative?.videoId;
            const videoUrl = formData.creative?.videoUrl;

            addLog(`Creative debug: ${JSON.stringify({ imageUrl, imageHash, mediaType, videoId, videoUrl })}`);
            if (!imageUrl) {
                addLog("⚠️ WARNING: No imageUrl (thumbnail) found for this creative!");
            }

            // For video ads, upload video to Facebook if not already uploaded
            if (mediaType === "video" && !videoId) {
                if (!videoUrl) {
                    throw new Error(
                        "Video URL is missing. Please select a video from your Creatives library."
                    );
                }

                addLog("Uploading video to Facebook (this may take a moment)...");
                addLog(`Fetching video from: ${videoUrl.substring(0, 50)}...`);

                // Fetch video from Supabase storage
                const videoResponse = await fetch(videoUrl);
                if (!videoResponse.ok) {
                    throw new Error("Failed to fetch video file from storage.");
                }
                const videoBlob = await videoResponse.blob();
                addLog(`Downloaded video: ${(videoBlob.size / 1024 / 1024).toFixed(2)} MB`);

                // Create a File object for the Facebook upload
                const videoFileName = videoUrl.split('/').pop() || 'video.mp4';
                const videoFile = new File([videoBlob], videoFileName, { type: videoBlob.type });

                // Upload to Facebook
                addLog("Starting Facebook upload...");
                const fbVideo = await api.uploadVideo(videoFile, videoFileName);
                videoId = fbVideo.id;
                addLog(`✓ Video uploaded to Facebook! ID: ${videoId}`);
            }

            // Build the object_story_spec based on media type
            let objectStorySpec: Record<string, unknown>;

            if (mediaType === "video" && videoId) {
                // Video ad with uploaded video (has Facebook video_id)
                objectStorySpec = {
                    page_id: formData.creative?.pageId || "",
                    video_data: {
                        video_id: videoId,
                        image_url: imageUrl,
                        message: formData.creative?.primaryText || "",
                        title: formData.creative?.headline || "",
                        call_to_action: {
                            type: formData.creative?.cta || "LEARN_MORE",
                            value: { link: formData.creative?.url || "https://example.com" },
                        },
                    },
                };
            } else {
                // Image ad
                objectStorySpec = {
                    page_id: formData.creative?.pageId || "",
                    link_data: {
                        link: formData.creative?.url || "https://example.com",
                        message: formData.creative?.primaryText || "",
                        name: formData.creative?.headline || "",
                        // Use image_hash if available (uploaded to Facebook), otherwise use picture URL
                        ...(imageHash ? { image_hash: imageHash } : (imageUrl ? { picture: imageUrl } : {})),
                        call_to_action: {
                            type: formData.creative?.cta || "LEARN_MORE",
                            value: { link: formData.creative?.url || "https://example.com" },
                        },
                    },
                };
            }

            const creativeSpec = {
                name: `${formData.name || "Ad"} - Creative`,
                object_story_spec: objectStorySpec,
            };

            const adParams: CreateAdParams = {
                name: `${formData.name || "Ad"} - Ad`,
                adset_id: adSetId!,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                creative: creativeSpec as any,
                status: "PAUSED",
            };

            addLog(`Creating Ad with params: ${JSON.stringify(adParams, null, 2)}`);
            const ad = await api.createAd(adParams);
            addLog(`✓ Created Ad ID: ${ad.id}`);
            addLog("🎉 Launch Sequence Complete!");

            // Prepare success message
            let message = "";
            switch (formData.creationMode) {
                case "new_campaign":
                    message = `Successfully launched new campaign "${formData.name}"`;
                    break;
                case "add_to_campaign":
                    message = `Successfully added ad set to campaign`;
                    break;
                case "add_to_adset":
                    message = `Successfully added ad to ad set`;
                    break;
                default:
                    message = "Ad creation successful";
            }

            // Wait a moment so user can see the success log
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Store success message in sessionStorage to display on dashboard
            sessionStorage.setItem('launch_success', JSON.stringify({
                message,
                timestamp: Date.now()
            }));

            // Navigate to dashboard
            navigate("/", {
                state: {
                    launchSuccess: true,
                    message: message
                }
            });
        } catch (err: unknown) {
            console.error("Launch failed:", err);
            const errorMessage = err instanceof Error ? err.message : "Unknown error";
            addLog(`❌ ERROR: ${errorMessage}`);
            // Don't auto-close on error so user can read logs
        }
    };

    const currentMode = formData.creationMode || "new_campaign";

    if (isSubmitting) {
        return (
            <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white w-full max-w-lg rounded-xl border shadow-lg p-6 space-y-4">
                    <div className="flex items-center gap-3">
                        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                        <h3 className="text-xl font-semibold">Launching Campaign...</h3>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4 h-64 overflow-y-auto font-mono text-xs space-y-1 border border-gray-200">
                        {launchLogs.map((log, i) => (
                            <div key={i} className={log.includes("ERROR") ? "text-red-500 font-bold" : log.includes("✓") ? "text-green-600 font-medium" : "text-gray-600"}>
                                {log}
                            </div>
                        ))}
                        {launchLogs.length === 0 && <div className="text-gray-400 italic">Initializing...</div>}
                    </div>

                    <div className="flex justify-end">
                        <button
                            onClick={() => setIsSubmitting(false)}
                            disabled={!launchLogs.some(l => l.includes("ERROR"))}
                            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${launchLogs.some(l => l.includes("ERROR"))
                                ? "border-red-200 text-red-700 hover:bg-red-50"
                                : "border-gray-200 text-gray-400 cursor-not-allowed"
                                }`}
                        >
                            {launchLogs.some(l => l.includes("ERROR")) ? "Close" : "Please wait..."}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto pb-24">
            {/* Header */}
            <div className="mb-8 flex justify-between items-start">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Create New Ad</h1>
                    <p className="text-gray-500 mt-1">Configure your campaign, targeting, and creative</p>
                </div>
                {/* Dev Helper */}
                <button
                    onClick={() => {
                        const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
                        updateData({
                            creationMode: "new_campaign",
                            name: `Test Traffic ${now}`,
                            objective: "OUTCOME_TRAFFIC",
                            specialAdCategories: [],
                            budget: { type: "daily", amount: "1" }, // $1 minimum
                            audience: {
                                locations: [{ id: "US", name: "United States", type: "country", country_code: "US" }],
                                ageMin: 18,
                                ageMax: 65,
                                gender: [1, 2],
                            },
                            placements: {
                                advantagePlus: true,
                                platforms: { facebook: true, instagram: true, messenger: true, audienceNetwork: true }
                            },
                            creative: {
                                pageId: pages[0]?.id || "",
                                headline: "Test Ad Headline",
                                primaryText: "This is a test ad created by AdMachin.",
                                url: "https://example.com",
                                cta: "LEARN_MORE",
                                imageUrl: "https://picsum.photos/seed/test/1200/628", // Sample image
                            }
                        });
                    }}
                    className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-lg font-medium transition-colors"
                    title="Fill with valid test data ($1 budget, Traffic)"
                >
                    🛠️ Dev: Quick Fill
                </button>
            </div>

            {/* Creation Mode Tabs */}
            <div className="flex gap-4 mb-8">
                {CREATION_MODES.map((mode) => {
                    const Icon = mode.icon;
                    const isActive = currentMode === mode.id;
                    return (
                        <button
                            key={mode.id}
                            onClick={() => updateData({ ...formData, creationMode: mode.id })}
                            className={`flex-1 p-4 rounded-xl border-2 transition-all text-left ${isActive
                                ? "border-blue-500 bg-blue-50"
                                : "border-gray-200 bg-white hover:border-gray-300"
                                }`}
                        >
                            <div className="flex items-center gap-3 mb-2">
                                <div
                                    className={`p-2 rounded-lg ${isActive ? "bg-blue-100" : "bg-gray-100"
                                        }`}
                                >
                                    <Icon
                                        className={`h-5 w-5 ${isActive ? "text-blue-600" : "text-gray-500"
                                            }`}
                                    />
                                </div>
                                <span
                                    className={`font-semibold ${isActive ? "text-blue-900" : "text-gray-900"
                                        }`}
                                >
                                    {mode.label}
                                </span>
                            </div>
                            <p
                                className={`text-sm ${isActive ? "text-blue-700" : "text-gray-500"
                                    }`}
                            >
                                {mode.description}
                            </p>
                        </button>
                    );
                })}
            </div>

            {/* Error Messages */}
            {launchError && (
                <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl flex items-center gap-2 border border-red-200">
                    <AlertCircle className="h-5 w-5 flex-shrink-0" />
                    <p>{launchError}</p>
                </div>
            )}

            {validationErrors.length > 0 && (
                <div className="mb-6 p-4 bg-yellow-50 text-yellow-800 rounded-xl border border-yellow-200">
                    <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="h-5 w-5" />
                        <span className="font-medium">Please fix the following errors:</span>
                    </div>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                        {validationErrors.map((error, i) => (
                            <li key={i}>{error}</li>
                        ))}
                    </ul>
                </div>
            )}

            {!isConnected && (
                <div className="mb-6 p-4 bg-yellow-50 text-yellow-700 rounded-xl border border-yellow-200">
                    Please connect your Facebook account to launch ads.
                </div>
            )}

            {/* Form Sections */}
            <div className="space-y-6">
                {/* Account & Campaign + Budget */}
                <SectionAccountCampaign
                    data={formData}
                    updateData={updateData}
                    selectedAccount={selectedAccount}
                    allAdAccounts={allAdAccounts}
                    onAccountChange={handleAccountChange}
                    existingCampaigns={existingCampaigns}
                    existingAdSets={existingAdSets}
                    isConnected={isConnected}
                />

                {/* Conversion Destination (for Leads/Sales) */}
                <SectionConversion
                    data={formData}
                    updateData={updateData}
                    isConnected={isConnected}
                />

                {/* Locations & Audience */}
                <SectionLocationAudience data={formData} updateData={updateData} />

                {/* Placements */}
                <SectionPlacements data={formData} updateData={updateData} />

                {/* Creative */}
                <SectionCreative data={formData} updateData={updateData} pages={pages} />
            </div>

            {/* Launch Button - Fixed Footer */}
            <div className="fixed bottom-0 left-64 right-0 p-4 bg-white border-t border-gray-200 flex justify-end items-center gap-4 z-10">
                <button
                    onClick={() => navigate("/")}
                    className="px-6 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                >
                    Cancel
                </button>
                <button
                    onClick={handleLaunch}
                    disabled={isSubmitting || !isConnected || !selectedAccount}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isSubmitting ? (
                        <>
                            <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            Launching...
                        </>
                    ) : (
                        <>
                            <Rocket className="h-4 w-4" />
                            Launch Campaign
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}

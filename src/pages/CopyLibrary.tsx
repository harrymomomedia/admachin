import { useState, useEffect } from 'react';
import { DataTable, type ColumnDef, type TabConfig } from '../components/datatable';
import {
    getCampaignParameters,
    getCreativeConcepts,
    getAIPersonas,
    getAIAngles,
    getAIGeneratedAds,
    updateCampaignParameter,
    updateCreativeConcept,
    updateAIPersona,
    updateAIAngle,
    updateAIGeneratedAd,
    deleteCampaignParameter,
    deleteCreativeConcept,
    deleteAIPersona,
    deleteAIAngle,
    deleteAIGeneratedAd,
    type CampaignParameter,
    type CreativeConcept,
    type AIPersona,
    type AIAngle,
    type AIGeneratedAd,
} from '../lib/supabase-service';

type TabId = 'campaigns' | 'personas' | 'angles' | 'concepts' | 'ads';

export function CopyLibrary() {
    const [activeTab, setActiveTab] = useState<TabId>('campaigns');
    const [isLoading, setIsLoading] = useState(true);

    // Data for each tab
    const [campaigns, setCampaigns] = useState<CampaignParameter[]>([]);
    const [personas, setPersonas] = useState<AIPersona[]>([]);
    const [angles, setAngles] = useState<AIAngle[]>([]);
    const [concepts, setConcepts] = useState<CreativeConcept[]>([]);
    const [ads, setAds] = useState<AIGeneratedAd[]>([]);

    // Load data for current tab
    useEffect(() => {
        loadData();
    }, [activeTab]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            switch (activeTab) {
                case 'campaigns':
                    setCampaigns(await getCampaignParameters());
                    break;
                case 'personas':
                    setPersonas(await getAIPersonas());
                    break;
                case 'angles':
                    setAngles(await getAIAngles());
                    break;
                case 'concepts':
                    setConcepts(await getCreativeConcepts());
                    break;
                case 'ads':
                    setAds(await getAIGeneratedAds());
                    break;
            }
        } catch (error) {
            console.error('Failed to load data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Load counts for all tabs
    const [counts, setCounts] = useState<Record<TabId, number>>({
        campaigns: 0,
        personas: 0,
        angles: 0,
        concepts: 0,
        ads: 0,
    });

    useEffect(() => {
        loadCounts();
    }, []);

    const loadCounts = async () => {
        try {
            const [campaignsData, personasData, anglesData, conceptsData, adsData] = await Promise.all([
                getCampaignParameters(),
                getAIPersonas(),
                getAIAngles(),
                getCreativeConcepts(),
                getAIGeneratedAds(),
            ]);
            setCounts({
                campaigns: campaignsData.length,
                personas: personasData.length,
                angles: anglesData.length,
                concepts: conceptsData.length,
                ads: adsData.length,
            });
        } catch (error) {
            console.error('Failed to load counts:', error);
        }
    };

    const tabs: TabConfig[] = [
        { id: 'campaigns', label: 'Campaign Params', count: counts.campaigns },
        { id: 'personas', label: 'Personas', count: counts.personas },
        { id: 'angles', label: 'Angles', count: counts.angles },
        { id: 'concepts', label: 'Creative Concepts', count: counts.concepts },
        { id: 'ads', label: 'Ads', count: counts.ads },
    ];

    // Column definitions for each tab
    const campaignColumns: ColumnDef<CampaignParameter>[] = [
        { key: 'name', header: 'Name', editable: true, width: 200 },
        { key: 'description', header: 'Description', editable: true, type: 'longtext', width: 300 },
        { key: 'persona_input', header: 'Persona Input', editable: true, type: 'longtext', width: 200 },
        { key: 'swipe_files', header: 'Swipe Files', editable: true, type: 'longtext', width: 200 },
        { key: 'custom_prompt', header: 'Custom Prompt', editable: true, type: 'longtext', width: 200 },
        { key: 'created_at', header: 'Created', type: 'date', width: 120 },
    ];

    const personaColumns: ColumnDef<AIPersona>[] = [
        { key: 'content', header: 'Content', editable: true, type: 'longtext', width: 500 },
        { key: 'created_at', header: 'Created', type: 'date', width: 120 },
    ];

    const angleColumns: ColumnDef<AIAngle>[] = [
        { key: 'content', header: 'Content', editable: true, type: 'longtext', width: 500 },
        { key: 'created_at', header: 'Created', type: 'date', width: 120 },
    ];

    const conceptColumns: ColumnDef<CreativeConcept>[] = [
        { key: 'name', header: 'Name', editable: true, width: 150 },
        { key: 'description', header: 'Description', editable: true, type: 'longtext', width: 300 },
        { key: 'example', header: 'Example', editable: true, type: 'longtext', width: 300 },
    ];

    const adColumns: ColumnDef<AIGeneratedAd>[] = [
        { key: 'content', header: 'Content', editable: true, type: 'longtext', width: 400 },
        { key: 'ad_type', header: 'Type', editable: true, width: 150 },
        { key: 'created_at', header: 'Created', type: 'date', width: 120 },
    ];

    // Update handlers
    const handleCampaignUpdate = async (id: string, field: string, value: unknown) => {
        await updateCampaignParameter(id, { [field]: value });
        setCampaigns(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
    };

    const handlePersonaUpdate = async (id: string, field: string, value: unknown) => {
        await updateAIPersona(id, { [field]: value });
        setPersonas(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
    };

    const handleAngleUpdate = async (id: string, field: string, value: unknown) => {
        await updateAIAngle(id, { [field]: value });
        setAngles(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a));
    };

    const handleConceptUpdate = async (id: string, field: string, value: unknown) => {
        await updateCreativeConcept(id, { [field]: value });
        setConcepts(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
    };

    const handleAdUpdate = async (id: string, field: string, value: unknown) => {
        await updateAIGeneratedAd(id, { [field]: value });
        setAds(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a));
    };

    // Delete handlers
    const handleCampaignDelete = async (id: string) => {
        await deleteCampaignParameter(id);
        setCampaigns(prev => prev.filter(c => c.id !== id));
        setCounts(prev => ({ ...prev, campaigns: prev.campaigns - 1 }));
    };

    const handlePersonaDelete = async (id: string) => {
        await deleteAIPersona(id);
        setPersonas(prev => prev.filter(p => p.id !== id));
        setCounts(prev => ({ ...prev, personas: prev.personas - 1 }));
    };

    const handleAngleDelete = async (id: string) => {
        await deleteAIAngle(id);
        setAngles(prev => prev.filter(a => a.id !== id));
        setCounts(prev => ({ ...prev, angles: prev.angles - 1 }));
    };

    const handleConceptDelete = async (id: string) => {
        await deleteCreativeConcept(id);
        setConcepts(prev => prev.filter(c => c.id !== id));
        setCounts(prev => ({ ...prev, concepts: prev.concepts - 1 }));
    };

    const handleAdDelete = async (id: string) => {
        await deleteAIGeneratedAd(id);
        setAds(prev => prev.filter(a => a.id !== id));
        setCounts(prev => ({ ...prev, ads: prev.ads - 1 }));
    };

    // Render the appropriate DataTable based on active tab
    const renderTable = () => {
        switch (activeTab) {
            case 'campaigns':
                return (
                    <DataTable
                        columns={campaignColumns}
                        data={campaigns}
                        isLoading={isLoading}
                        emptyMessage="No campaign parameters saved yet. Use the Copy Wizard to create some!"
                        getRowId={(row) => row.id}
                        onUpdate={handleCampaignUpdate}
                        onDelete={handleCampaignDelete}
                        tabs={tabs}
                        activeTab={activeTab}
                        onTabChange={(id) => setActiveTab(id as TabId)}
                        showRowActions={true}
                        fullscreen={true}
                    />
                );
            case 'personas':
                return (
                    <DataTable
                        columns={personaColumns}
                        data={personas}
                        isLoading={isLoading}
                        emptyMessage="No personas saved yet. Use the Copy Wizard to generate some!"
                        getRowId={(row) => row.id}
                        onUpdate={handlePersonaUpdate}
                        onDelete={handlePersonaDelete}
                        tabs={tabs}
                        activeTab={activeTab}
                        onTabChange={(id) => setActiveTab(id as TabId)}
                        showRowActions={true}
                        fullscreen={true}
                    />
                );
            case 'angles':
                return (
                    <DataTable
                        columns={angleColumns}
                        data={angles}
                        isLoading={isLoading}
                        emptyMessage="No angles saved yet. Use the Copy Wizard to generate some!"
                        getRowId={(row) => row.id}
                        onUpdate={handleAngleUpdate}
                        onDelete={handleAngleDelete}
                        tabs={tabs}
                        activeTab={activeTab}
                        onTabChange={(id) => setActiveTab(id as TabId)}
                        showRowActions={true}
                        fullscreen={true}
                    />
                );
            case 'concepts':
                return (
                    <DataTable
                        columns={conceptColumns}
                        data={concepts}
                        isLoading={isLoading}
                        emptyMessage="No creative concepts found."
                        getRowId={(row) => row.id}
                        onUpdate={handleConceptUpdate}
                        onDelete={handleConceptDelete}
                        tabs={tabs}
                        activeTab={activeTab}
                        onTabChange={(id) => setActiveTab(id as TabId)}
                        showRowActions={true}
                        fullscreen={true}
                    />
                );
            case 'ads':
                return (
                    <DataTable
                        columns={adColumns}
                        data={ads}
                        isLoading={isLoading}
                        emptyMessage="No generated ads saved yet. Use the Copy Wizard to create some!"
                        getRowId={(row) => row.id}
                        onUpdate={handleAdUpdate}
                        onDelete={handleAdDelete}
                        tabs={tabs}
                        activeTab={activeTab}
                        onTabChange={(id) => setActiveTab(id as TabId)}
                        showRowActions={true}
                        fullscreen={true}
                    />
                );
        }
    };

    return (
        <div className="flex flex-col h-full">
            {renderTable()}
        </div>
    );
}

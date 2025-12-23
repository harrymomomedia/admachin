import { useState, useEffect, useMemo } from 'react';
import { DataTable, type ColumnDef } from '../components/datatable';
import { DataTablePageLayout } from '../components/DataTablePageLayout';
import {
    generateColorMap,
    createIdColumn,
    createProjectColumn,
    createSubprojectColumn,
    createUserColumn,
    DEFAULT_DATATABLE_PROPS,
    DEFAULT_QUICK_FILTERS,
} from '../lib/datatable-defaults';
import {
    getPersonaFrameworks,
    getProjects,
    getSubprojects,
    getUsers,
    createPersonaFramework,
    updatePersonaFramework,
    deletePersonaFramework,
    type PersonaFramework,
    type Project,
    type Subproject,
    type User,
} from '../lib/supabase-service';
import { getCurrentUser } from '../lib/supabase';

export function PersonaFrameworks() {
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<PersonaFramework[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [subprojects, setSubprojects] = useState<Subproject[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    const projectColorMap = useMemo(() => generateColorMap(projects), [projects]);
    const subprojectColorMap = useMemo(() => generateColorMap(subprojects), [subprojects]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const user = await getCurrentUser();
            const harryUserId = '807f4cb3-fd03-4e02-8828-44436a6d00e5';
            setCurrentUserId(user?.id || harryUserId);

            const [dataResult, projectsResult, subprojectsResult, usersResult] = await Promise.all([
                getPersonaFrameworks(),
                getProjects(),
                getSubprojects(),
                getUsers(),
            ]);
            setData(dataResult);
            setProjects(projectsResult);
            setSubprojects(subprojectsResult);
            setUsers(usersResult);
        } catch (error) {
            console.error('Failed to load data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const columns: ColumnDef<PersonaFramework>[] = [
        createIdColumn<PersonaFramework>(),
        { key: 'title', header: 'Title', editable: true, width: 200 },
        { key: 'content', header: 'Persona Framework', editable: true, type: 'longtext', width: 400 },
        createProjectColumn<PersonaFramework>({ projects, subprojects, projectColorMap }),
        createSubprojectColumn<PersonaFramework>({ projects, subprojects, subprojectColorMap }),
        createUserColumn<PersonaFramework>(users, { key: 'created_by', editable: false }),
        { key: 'created_at', header: 'Created', type: 'date', width: 120 },
    ];

    const handleUpdate = async (id: string, field: string, value: unknown) => {
        await updatePersonaFramework(id, { [field]: value });
        setData(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
    };

    const handleDelete = async (id: string) => {
        await deletePersonaFramework(id);
        setData(prev => prev.filter(item => item.id !== id));
    };

    const handleCreate = async (defaults?: Record<string, unknown>): Promise<PersonaFramework> => {
        const newFramework = await createPersonaFramework({
            title: 'New Framework',
            content: null,
            project_id: (defaults?.project_id as string) || null,
            subproject_id: (defaults?.subproject_id as string) || null,
            created_by: currentUserId,
        });
        setData(prev => [newFramework, ...prev]);
        return newFramework;
    };

    return (
        <DataTablePageLayout>
            <DataTable
                columns={columns}
                data={data}
                isLoading={isLoading}
                title="Persona Frameworks"
                emptyMessage="No persona frameworks found. Click + to create one."
                getRowId={(row) => row.id}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                onCreateRow={handleCreate}
                quickFilters={[...DEFAULT_QUICK_FILTERS]}
                viewId="persona-frameworks"
                {...DEFAULT_DATATABLE_PROPS}
            />
        </DataTablePageLayout>
    );
}

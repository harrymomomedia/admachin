import { useState, useEffect, useMemo } from 'react';
import { DataTable, type ColumnDef } from '../components/datatable';
import { DataTablePageLayout } from '../components/DataTablePageLayout';
import {
    createIdColumn,
    createProjectColumn,
    createSubprojectColumn,
    createUserColumn,
    createRowHandler,
    createUpdateHandler,
    createDeleteHandler,
    DEFAULT_DATATABLE_PROPS,
    DEFAULT_QUICK_FILTERS,
} from '../lib/datatable-defaults';
import { useDataTableConfig } from '../hooks/useDataTableConfig';
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

    // Global colors from hook
    const {
        projectColorMap,
        subprojectColorMap,
        handleColumnConfigChange,
    } = useDataTableConfig({
        viewId: 'persona-frameworks',
        userId: currentUserId,
        projects,
        subprojects,
        users,
    });

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

    const handleUpdate = useMemo(() => createUpdateHandler<PersonaFramework>({
        updateFn: updatePersonaFramework,
        setData,
    }), []);

    const handleDelete = useMemo(() => createDeleteHandler<PersonaFramework>({
        deleteFn: deletePersonaFramework,
        setData,
        confirmMessage: false,
    }), []);

    const handleCreateRow = useMemo(() => createRowHandler<PersonaFramework>({
        createFn: createPersonaFramework,
        setData,
        currentUserId,
        userIdField: 'created_by',
    }), [currentUserId]);

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
                onCreateRow={handleCreateRow}
                onColumnConfigChange={handleColumnConfigChange}
                quickFilters={[...DEFAULT_QUICK_FILTERS]}
                viewId="persona-frameworks"
                {...DEFAULT_DATATABLE_PROPS}
            />
        </DataTablePageLayout>
    );
}

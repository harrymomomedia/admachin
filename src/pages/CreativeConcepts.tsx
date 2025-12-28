import { useState, useEffect, useMemo } from 'react';
import { DataTable, type ColumnDef } from '../components/datatable';
import { DataTablePageLayout } from '../components/DataTablePageLayout';
import {
    generateColorMap,
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
import {
    getCreativeConcepts,
    getProjects,
    getSubprojects,
    getUsers,
    createCreativeConcept,
    updateCreativeConcept,
    deleteCreativeConcept,
    type CreativeConcept,
    type Project,
    type Subproject,
    type User,
} from '../lib/supabase-service';
import { getCurrentUser } from '../lib/supabase';

export function CreativeConcepts() {
    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<CreativeConcept[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [subprojects, setSubprojects] = useState<Subproject[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    const projectColorMap = useMemo(() => generateColorMap(projects), [projects]);
    const subprojectColorMap = useMemo(() => generateColorMap(subprojects), [subprojects]);

    useEffect(() => {
        loadData();
        getCurrentUser().then(user => setCurrentUserId(user?.id || null));
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [dataResult, projectsResult, subprojectsResult, usersResult] = await Promise.all([
                getCreativeConcepts(),
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

    const columns: ColumnDef<CreativeConcept>[] = [
        createIdColumn<CreativeConcept>(),
        { key: 'name', header: 'Name', editable: true, width: 150 },
        { key: 'description', header: 'Description', editable: true, type: 'longtext', width: 300 },
        { key: 'example', header: 'Example', editable: true, type: 'longtext', width: 300 },
        createProjectColumn<CreativeConcept>({ projects, subprojects, projectColorMap }),
        createSubprojectColumn<CreativeConcept>({ projects, subprojects, subprojectColorMap }),
        { key: 'rich_text', header: 'Rich Text', editable: true, type: 'blocknoteeditor', width: 300, minWidth: 200 },
        createUserColumn<CreativeConcept>(users, { key: 'created_by', editable: false }),
    ];

    const handleUpdate = useMemo(() => createUpdateHandler<CreativeConcept>({
        updateFn: updateCreativeConcept,
        setData,
    }), []);

    const handleDelete = useMemo(() => createDeleteHandler<CreativeConcept>({
        deleteFn: deleteCreativeConcept,
        setData,
        confirmMessage: false,
    }), []);

    const handleCreateRow = useMemo(() => createRowHandler<CreativeConcept>({
        createFn: createCreativeConcept,
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
                title="Creative Concepts"
                emptyMessage="No creative concepts found. Click + to create one!"
                getRowId={(row) => row.id}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                onCreateRow={handleCreateRow}
                quickFilters={[...DEFAULT_QUICK_FILTERS]}
                viewId="creative-concepts"
                {...DEFAULT_DATATABLE_PROPS}
            />
        </DataTablePageLayout>
    );
}

import { useAuth } from "../contexts/AuthContext";
import { Loader2 } from "lucide-react";

interface AccessGateProps {
    children: React.ReactNode;
}

export function AccessGate({ children }: AccessGateProps) {
    const { user, loading } = useAuth();

    // Show loading spinner while checking auth
    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
                    <p className="text-gray-500">Loading...</p>
                </div>
            </div>
        );
    }

    // If authenticated, show children (the app)
    if (user) {
        return <>{children}</>;
    }

    // If not authenticated, return null - the router will handle showing Login
    return null;
}

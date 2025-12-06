import { useState, useEffect } from "react";
import { Lock, ArrowRight } from "lucide-react";

interface AccessGateProps {
    children: React.ReactNode;
}

const PASSCODE = "demo2024"; // Simple hardcoded passcode
const STORAGE_KEY = "admachin_access_unlocked";

export function AccessGate({ children }: AccessGateProps) {
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [input, setInput] = useState("");
    const [error, setError] = useState(false);

    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored === "true") {
            setIsUnlocked(true);
        }
    }, []);

    const handleUnlock = (e: React.FormEvent) => {
        e.preventDefault();
        if (input === PASSCODE) {
            localStorage.setItem(STORAGE_KEY, "true");
            setIsUnlocked(true);
            setError(false);
        } else {
            setError(true);
            setInput("");
        }
    };

    if (isUnlocked) {
        return <>{children}</>;
    }

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
                <div className="text-center mb-8">
                    <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                        <Lock className="h-8 w-8 text-blue-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">AdMachin Access</h1>
                    <p className="text-gray-500 mt-2">Please enter the access code to continue.</p>
                </div>

                <form onSubmit={handleUnlock} className="space-y-4">
                    <div>
                        <input
                            type="password"
                            value={input}
                            onChange={(e) => {
                                setInput(e.target.value);
                                setError(false);
                            }}
                            placeholder="Enter passcode"
                            className={`w-full px-4 py-3 rounded-xl border ${error ? "border-red-300 focus:ring-red-200" : "border-gray-200 focus:ring-blue-200"
                                } focus:outline-none focus:ring-4 transition-all`}
                            autoFocus
                        />
                        {error && (
                            <p className="text-red-500 text-sm mt-2 ml-1">Incorrect passcode. Please try again.</p>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={!input}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <span>Unlock App</span>
                        <ArrowRight className="h-5 w-5" />
                    </button>

                    <p className="text-center text-xs text-gray-400 mt-4">
                        Passcode: demo2024
                    </p>
                </form>
            </div>
        </div>
    );
}

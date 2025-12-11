import { Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { useEffect, useState } from 'react';

export interface ProgressStep {
    label: string;
    status: 'pending' | 'loading' | 'complete' | 'error';
}

interface AIProgressToastProps {
    message: string;
    status: 'loading' | 'success' | 'error';
    steps?: ProgressStep[];
    liveOutput?: string; // Real-time AI response text
    onClose?: () => void;
}

export function AIProgressToast({ message, status, steps, liveOutput, onClose }: AIProgressToastProps) {
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        if (status === 'success') {
            const timer = setTimeout(() => {
                setIsVisible(false);
                if (onClose) {
                    setTimeout(onClose, 300); // Wait for fade out animation
                }
            }, 3000);
            return () => clearTimeout(timer);
        }
        // Don't auto-close on error - let user manually close to see the error
    }, [status, onClose]);

    if (!isVisible) {
        return null;
    }

    const getMainIcon = () => {
        switch (status) {
            case 'loading':
                return <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />;
            case 'success':
                return <CheckCircle2 className="w-5 h-5 text-green-600" />;
            case 'error':
                return <XCircle className="w-5 h-5 text-red-600" />;
        }
    };

    const getStepIcon = (stepStatus: ProgressStep['status']) => {
        switch (stepStatus) {
            case 'pending':
                return <Clock className="w-4 h-4 text-gray-400" />;
            case 'loading':
                return <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />;
            case 'complete':
                return <CheckCircle2 className="w-4 h-4 text-green-600" />;
            case 'error':
                return <XCircle className="w-4 h-4 text-red-600" />;
        }
    };

    const getBgColor = () => {
        switch (status) {
            case 'loading':
                return 'bg-white border-blue-200';
            case 'success':
                return 'bg-green-50 border-green-200';
            case 'error':
                return 'bg-red-50 border-red-200';
        }
    };

    const getTextColor = () => {
        switch (status) {
            case 'loading':
                return 'text-gray-900';
            case 'success':
                return 'text-green-900';
            case 'error':
                return 'text-red-900';
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 duration-300">
            <div className={`rounded-lg border shadow-lg ${getBgColor()} min-w-[380px] max-w-md`}>
                {/* Header */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
                    {getMainIcon()}
                    <div className="flex-1">
                        <p className={`text-sm font-semibold ${getTextColor()}`}>{message}</p>
                    </div>
                    {(status === 'success' || status === 'error') && (
                        <button
                            onClick={() => {
                                setIsVisible(false);
                                onClose?.();
                            }}
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <XCircle className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* Live AI Output */}
                {liveOutput && (
                    <div className="px-4 py-3 bg-gray-50/50 max-h-96 overflow-y-auto">
                        <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap break-words">
                            {liveOutput}
                        </pre>
                    </div>
                )}

                {/* Progress Steps (fallback if no live output) */}
                {!liveOutput && steps && steps.length > 0 && (
                    <div className="px-4 py-3 space-y-2 bg-gray-50/50">
                        {steps.map((step, index) => (
                            <div key={index} className="flex items-center gap-2.5">
                                {getStepIcon(step.status)}
                                <span className={`text-xs font-mono ${
                                    step.status === 'complete' ? 'text-green-700' :
                                    step.status === 'loading' ? 'text-blue-700 font-medium' :
                                    step.status === 'error' ? 'text-red-700' :
                                    'text-gray-500'
                                }`}>
                                    {step.label}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

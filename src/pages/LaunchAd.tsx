import { useState } from "react";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Stepper } from "../components/Stepper";
import { StepObjective } from "../components/launch-steps/StepObjective";
import { StepAudience } from "../components/launch-steps/StepAudience";
import { StepCreative } from "../components/launch-steps/StepCreative";
import { StepBudget } from "../components/launch-steps/StepBudget";
import type { LaunchAdFormData } from "../types/launch";

const steps = ["Objective", "Audience", "Creative", "Budget"];

export function LaunchAd() {
    const navigate = useNavigate();
    const [currentStep, setCurrentStep] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState<LaunchAdFormData>({
        objective: "",
        name: "",
        audience: {},
        creative: {},
        budget: {},
    });

    const updateData = (data: LaunchAdFormData) => {
        setFormData(data);
    };

    const nextStep = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            handleLaunch();
        }
    };

    const handleLaunch = () => {
        setIsSubmitting(true);
        // Simulate API call
        setTimeout(() => {
            setIsSubmitting(false);
            navigate("/");
        }, 2000);
    };

    const prevStep = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    return (
        <div className="max-w-4xl mx-auto pb-20">
            <div className="mb-8">
                <h1 className="text-2xl font-bold mb-2">Create New Campaign</h1>
                <Stepper steps={steps} currentStep={currentStep} />
            </div>

            <div className="bg-card border border-border rounded-xl p-8 shadow-sm min-h-[400px]">
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
                    disabled={isSubmitting}
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

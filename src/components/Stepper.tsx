import { Check } from "lucide-react";
import { cn } from "../utils/cn";

interface StepperProps {
    steps: string[];
    currentStep: number;
}

export function Stepper({ steps, currentStep }: StepperProps) {
    return (
        <div className="w-full py-4">
            <div className="flex items-center justify-between relative">
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-muted -z-10"></div>
                <div
                    className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-primary -z-10 transition-all duration-300"
                    style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
                ></div>

                {steps.map((step, index) => {
                    const isCompleted = index < currentStep;
                    const isCurrent = index === currentStep;

                    return (
                        <div key={step} className="flex flex-col items-center gap-2 bg-background px-2">
                            <div
                                className={cn(
                                    "h-8 w-8 rounded-full flex items-center justify-center border-2 transition-colors duration-300",
                                    isCompleted
                                        ? "bg-primary border-primary text-primary-foreground"
                                        : isCurrent
                                            ? "border-primary text-primary"
                                            : "border-muted-foreground text-muted-foreground bg-background"
                                )}
                            >
                                {isCompleted ? <Check className="h-4 w-4" /> : <span>{index + 1}</span>}
                            </div>
                            <span
                                className={cn(
                                    "text-xs font-medium absolute -bottom-6 w-32 text-center",
                                    isCurrent ? "text-primary" : "text-muted-foreground"
                                )}
                            >
                                {step}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

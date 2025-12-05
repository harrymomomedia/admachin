import { Target, MousePointer2, Users, ShoppingBag } from "lucide-react";
import { cn } from "../../utils/cn";
import type { LaunchAdFormData } from "../../types/launch";

interface StepObjectiveProps {
    data: LaunchAdFormData;
    updateData: (data: LaunchAdFormData) => void;
}

const objectives = [
    {
        id: "awareness",
        title: "Awareness",
        description: "Show your ads to people who are most likely to remember them.",
        icon: Target,
    },
    {
        id: "traffic",
        title: "Traffic",
        description: "Send people to a destination, like your website, app or Facebook event.",
        icon: MousePointer2,
    },
    {
        id: "leads",
        title: "Leads",
        description: "Collect leads for your business or brand.",
        icon: Users,
    },
    {
        id: "sales",
        title: "Sales",
        description: "Find people likely to purchase your product or service.",
        icon: ShoppingBag,
    },
];

export function StepObjective({ data, updateData }: StepObjectiveProps) {
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-semibold">Choose a Campaign Objective</h2>
                <p className="text-muted-foreground">Select the goal that best fits your advertising needs.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {objectives.map((obj) => (
                    <div
                        key={obj.id}
                        onClick={() => updateData({ ...data, objective: obj.id })}
                        className={cn(
                            "p-6 border rounded-xl cursor-pointer transition-all hover:border-primary/50 hover:bg-primary/5",
                            data.objective === obj.id
                                ? "border-primary bg-primary/10 ring-1 ring-primary"
                                : "border-border bg-card"
                        )}
                    >
                        <div className="p-3 bg-background rounded-lg w-fit mb-4 border border-border">
                            <obj.icon className="h-6 w-6 text-primary" />
                        </div>
                        <h3 className="font-semibold mb-2">{obj.title}</h3>
                        <p className="text-sm text-muted-foreground">{obj.description}</p>
                    </div>
                ))}
            </div>

            <div className="space-y-4 pt-4">
                <div>
                    <label className="block text-sm font-medium mb-1">Campaign Name</label>
                    <input
                        type="text"
                        value={data.name || ""}
                        onChange={(e) => updateData({ ...data, name: e.target.value })}
                        placeholder="e.g. Summer Sale 2024"
                        className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                </div>
            </div>
        </div>
    );
}

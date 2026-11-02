import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
export const workflowNames: Record<string, string> = {
  collections: "Collections",
  approvals: "Approvals & Corrections",
  floorplan: "Booth Floor Plan",
  profitability: "Exhibition Profitability",
  imports: "Client Import",
  audit: "Audit History",
  reminders: "Reminders",
  access: "Teams & Access",
  security: "Account Security",
};
export function canUseWorkflow(key: string, role: string) {
  return (
    role === "super_admin" ||
    ["security", "reminders"].includes(key) ||
    (role === "management" && key !== "access") ||
    (["collections", "profitability"].includes(key) && role === "finance") ||
    (key === "approvals" && ["sales", "finance"].includes(role)) ||
    (key === "floorplan" && ["sales", "operations"].includes(role)) ||
    (key === "imports" && role === "sales")
  );
}
export function WorkflowLinks({
  sections = Object.keys(workflowNames),
}: {
  sections?: string[];
}) {
  const { user } = useAuth();
  return (
    <div className="flex flex-wrap gap-2">
      {sections
        .filter((key) => canUseWorkflow(key, user?.role || ""))
        .map((key) => (
          <Button key={key} variant="outline" size="sm" asChild>
            <Link to={"/workspace?section=" + key}>{workflowNames[key]}</Link>
          </Button>
        ))}
    </div>
  );
}

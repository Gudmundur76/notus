import { useAtom } from "jotai";
import { activeVerificationAtom, pendingVerificationsAtom } from "@/atoms/ideAtoms";
import { eventBus } from "@/lib/eventBus";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, Shield, ShieldAlert, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const RISK_CONFIG = {
  low:      { icon: ShieldCheck, label: "Low Risk",      className: "verification-risk-low" },
  medium:   { icon: Shield,      label: "Medium Risk",   className: "verification-risk-medium" },
  high:     { icon: ShieldAlert, label: "High Risk",     className: "verification-risk-high" },
  critical: { icon: AlertTriangle, label: "Critical",    className: "verification-risk-critical" },
};

export function VerificationDialog() {
  const [activeVerification, setActiveVerification] = useAtom(activeVerificationAtom);
  const [, setPendingVerifications] = useAtom(pendingVerificationsAtom);

  const reviewMutation = trpc.agent.reviewVerification.useMutation();

  if (!activeVerification) return null;

  const { icon: RiskIcon, label: riskLabel, className: riskClass } =
    RISK_CONFIG[activeVerification.riskLevel] ?? RISK_CONFIG.medium;

  const dismiss = () => {
    setActiveVerification(null);
    setPendingVerifications((prev) => prev.filter((v) => v.id !== activeVerification.id));
  };

  const handleDecision = async (approved: boolean) => {
    try {
      await reviewMutation.mutateAsync({ id: activeVerification.id, approved });
      eventBus.emit("verification:resolved", { id: activeVerification.id, approved });
    } catch {
      // best-effort
    }
    dismiss();
  };

  const timeLeft = Math.max(0, Math.floor((activeVerification.expiresAt - Date.now()) / 1000));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <RiskIcon size={18} className={riskClass} />
            <span className="font-semibold text-sm text-foreground">Human Approval Required</span>
          </div>
          <button onClick={dismiss} className="text-muted-foreground hover:text-foreground">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-mono font-medium ${riskClass}`}>{riskLabel}</span>
            <span className="text-muted-foreground text-xs">·</span>
            <span className="text-xs font-mono text-muted-foreground">
              Tool: <span className="text-foreground">{activeVerification.toolName}</span>
            </span>
          </div>

          <div className="bg-muted rounded-lg p-3 text-sm text-foreground font-mono leading-relaxed">
            {activeVerification.description}
          </div>

          {timeLeft > 0 && (
            <p className="text-xs text-muted-foreground">
              Auto-expires in <span className="text-ide-yellow font-mono">{timeLeft}s</span>
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-5 pb-5">
          <Button
            variant="destructive"
            className="flex-1"
            onClick={() => handleDecision(false)}
            disabled={reviewMutation.isPending}
          >
            Reject
          </Button>
          <Button
            className="flex-1 bg-ide-green text-background hover:opacity-90"
            onClick={() => handleDecision(true)}
            disabled={reviewMutation.isPending}
          >
            Approve
          </Button>
        </div>
      </div>
    </div>
  );
}

import { GitBranch, Wifi, WifiOff, Zap } from "lucide-react";
import { useAtom } from "jotai";
import { terminalConnectedAtom, localAgentStateAtom } from "@/atoms/ideAtoms";
import type { WorkspaceSession } from "@/stores/workspaceStore";

interface StatusBarProps {
  session?: WorkspaceSession;
}

const STATE_LABELS: Record<string, string> = {
  Idle: "Idle",
  ReceivingMessage: "Receiving…",
  Planning: "Planning…",
  ExecutingTool: "Running tool…",
  WaitingForHuman: "Waiting for approval",
  Completed: "Done",
  Error: "Error",
};

export function StatusBar({ session }: StatusBarProps) {
  const [terminalConnected] = useAtom(terminalConnectedAtom);
  const [agentState] = useAtom(localAgentStateAtom);

  return (
    <div className="ide-status-bar">
      <span className="flex items-center gap-1">
        <GitBranch size={12} />
        main
      </span>
      <span className="opacity-60">|</span>
      <span className="flex items-center gap-1">
        <Zap size={12} />
        {STATE_LABELS[agentState] ?? agentState}
      </span>
      <span className="opacity-60">|</span>
      <span className="flex items-center gap-1">
        {terminalConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
        {terminalConnected ? "Terminal connected" : "Terminal disconnected"}
      </span>
      <div className="flex-1" />
      <span className="opacity-70">{session?.model ?? "gpt-4o"}</span>
      <span className="opacity-60">|</span>
      <span className="opacity-70">Notus</span>
    </div>
  );
}

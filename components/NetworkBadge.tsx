"use client";

import { useConnection, useSwitchChain } from "wagmi";
import { skillGateSepolia } from "@/lib/sepolia";
import { getSkillGateAddress } from "@/lib/skillgate";
import { shortAddress } from "@/lib/format";

// Sidebar network indicator. Shows the connected wallet's actual chain (not the
// contract's) and flags a wrong-network state with a switch action.
export function NetworkBadge() {
  const connection = useConnection();
  const switchChain = useSwitchChain();
  const contract = getSkillGateAddress();

  const connected = connection.status === "connected";
  const onSepolia = connected && connection.chainId === skillGateSepolia.id;

  let state: "off" | "ok" | "warn" = "off";
  let label = "Not connected";
  if (connected && onSepolia) {
    state = "ok";
    label = process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_LOCAL_VALIDATION === "1"
      ? "Local validation" : "Sepolia";
  } else if (connected) {
    state = "warn";
    label = "Wrong network";
  }

  return (
    <div className={`net ${state}`}>
      <div className="net-row">
        <span className="net-dot" />
        <span className="net-name">{label}</span>
        {state === "warn" ? (
          <button
            className="net-switch"
            disabled={switchChain.isPending}
            onClick={() => switchChain.mutate({ chainId: skillGateSepolia.id })}
          >
            {switchChain.isPending ? "Switching" : "Switch"}
          </button>
        ) : null}
      </div>
      {contract ? (
        <span className="net-contract mono" title="SkillGate contract">
          {shortAddress(contract)}
        </span>
      ) : null}
    </div>
  );
}

"use client";

import { useEffect } from "react";
import { useConnection, useSwitchChain } from "wagmi";
import { skillGateSepolia } from "@/lib/sepolia";

// Keeps the connected wallet on Sepolia by requesting a switch whenever it lands
// on another chain. The per-page banner is the manual fallback if the user declines.
export function NetworkGuard() {
  const connection = useConnection();
  const { switchChain } = useSwitchChain();

  useEffect(() => {
    if (connection.status === "connected" && connection.chainId !== skillGateSepolia.id) {
      switchChain({ chainId: skillGateSepolia.id });
    }
  }, [connection.status, connection.chainId, switchChain]);

  return null;
}

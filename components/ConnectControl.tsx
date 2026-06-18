"use client";

import { useConnect, useConnection, useDisconnect, useSwitchChain } from "wagmi";
import { skillGateSepolia } from "@/lib/sepolia";
import { AUTO_ROUTE_KEY } from "@/lib/role-route";

function errorText(error: unknown) {
  if (!error || typeof error !== "object") return "";
  if ("shortMessage" in error && typeof error.shortMessage === "string") return error.shortMessage;
  if ("message" in error && typeof error.message === "string") return error.message;
  return "Wallet request failed.";
}

export function ConnectControl({ compact = false, autoRoute = false }: { compact?: boolean; autoRoute?: boolean }) {
  const connection = useConnection();
  const connect = useConnect();
  const disconnect = useDisconnect();
  const switchChain = useSwitchChain();

  if (connection.status === "connected") {
    if (connection.chainId !== skillGateSepolia.id) {
      return (
        <span className="wallet-control">
          <button
            className={compact ? "btn ghost sm" : "btn ghost"}
            disabled={switchChain.isPending}
            onClick={() => switchChain.mutate({ chainId: skillGateSepolia.id })}
            title="Switch to Sepolia"
          >
            {switchChain.isPending ? "Switching" : "Use Sepolia"}
          </button>
          {switchChain.error ? <span className="wallet-error">{errorText(switchChain.error)}</span> : null}
        </span>
      );
    }

    return (
      <span className="wallet-control">
        <button
          className={compact ? "btn ghost sm" : "btn ghost"}
          disabled={disconnect.isPending}
          onClick={() => disconnect.mutate({ connector: connection.connector })}
          title="Disconnect wallet"
        >
          {disconnect.isPending ? "Disconnecting" : "Disconnect"}
        </button>
        {disconnect.error ? <span className="wallet-error">{errorText(disconnect.error)}</span> : null}
      </span>
    );
  }

  const connector = connect.connectors[0];

  function onConnect() {
    if (!connector) return;
    // Only the public verifier opts into auto-routing, so a connected wallet that
    // returns to the verifier later is never bounced away from it.
    if (autoRoute && typeof window !== "undefined") {
      window.sessionStorage.setItem(AUTO_ROUTE_KEY, "1");
    }
    connect.mutate({ connector });
  }

  return (
    <span className="wallet-control">
      <button
        className={compact ? "btn sm" : "btn"}
        disabled={!connector || connect.isPending}
        onClick={onConnect}
        title="Connect MetaMask"
      >
        {!connector ? "MetaMask unavailable" : connect.isPending ? "Connecting" : "Connect wallet"}
      </button>
      {connect.error ? <span className="wallet-error">{errorText(connect.error)}</span> : null}
    </span>
  );
}

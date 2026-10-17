"use client";

import { useEffect, useRef, useState } from "react";
import { useConnect, useConnection, useDisconnect, useSwitchChain } from "wagmi";
import { skillGateSepolia } from "@/lib/sepolia";
import { AUTO_ROUTE_KEY } from "@/lib/role-route";

function errorText(error: unknown) {
  if (!error || typeof error !== "object") return "";
  if ("shortMessage" in error && typeof error.shortMessage === "string") return error.shortMessage;
  if ("message" in error && typeof error.message === "string") return error.message;
  return "Wallet request failed.";
}

export function ConnectControl({ compact = false, autoRoute = false, opening = false }: { compact?: boolean; autoRoute?: boolean; opening?: boolean }) {
  const connection = useConnection();
  const connect = useConnect();
  const disconnect = useDisconnect();
  const switchChain = useSwitchChain();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLSpanElement>(null);

  // Close the wallet menu on an outside click or Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  if (connection.status === "connected" && opening) {
    return (
      <span className="wallet-control">
        <button className={compact ? "btn sm" : "btn"} disabled>
          Opening console
        </button>
      </span>
    );
  }

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
  const localWallets = connect.connectors.length > 1 && connect.connectors.every((item) => item.type === "mock");

  function onConnect(target = connector) {
    if (!target) return;
    setMenuOpen(false);
    // Only the public verifier opts into auto-routing, so a connected wallet that
    // returns to the verifier later is never bounced away from it.
    if (autoRoute && typeof window !== "undefined") {
      window.sessionStorage.setItem(AUTO_ROUTE_KEY, "1");
    }
    // Ask for Sepolia as part of connecting, so the wallet switches in the same step.
    connect.mutate({ connector: target, chainId: skillGateSepolia.id }, {
      onError: () => { if (autoRoute) window.sessionStorage.removeItem(AUTO_ROUTE_KEY); }
    });
  }

  return (
    <span className="wallet-control" ref={menuRef}>
      <button
        className={compact ? "btn sm" : "btn"}
        disabled={!connector || connect.isPending}
        onClick={() => (localWallets ? setMenuOpen((open) => !open) : onConnect())}
        aria-haspopup={localWallets ? "menu" : undefined}
        aria-expanded={localWallets ? menuOpen : undefined}
        title={localWallets ? "Choose a local test wallet" : "Connect MetaMask"}
      >
        {!connector ? "MetaMask unavailable" : connect.isPending ? "Connecting" : "Connect wallet"}
      </button>
      {localWallets && menuOpen ? (
        // Local validation only: the Hardhat test wallets, listed in the page so a switch is visible.
        <span className="wallet-menu" role="menu" aria-label="Test wallet">
          <span className="menu-k">Local test wallets</span>
          {connect.connectors.map((item) => (
            <button key={item.uid} type="button" role="menuitem" className="menu-item" onClick={() => onConnect(item)}>
              {item.name}
            </button>
          ))}
        </span>
      ) : null}
      {connect.error ? <span className="wallet-error">{errorText(connect.error)}</span> : null}
    </span>
  );
}

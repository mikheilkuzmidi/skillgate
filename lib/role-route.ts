import { useEffect } from "react";

export type ConsolePath = "/admin" | "/worker" | "/not-registered";

// Where a connected wallet belongs based on its on-chain role.
export function consolePath(gate: { isAdmin: boolean; isEmployee: boolean }): ConsolePath {
  if (gate.isAdmin) return "/admin";
  if (gate.isEmployee) return "/worker";
  return "/not-registered";
}

// Set on connect from the public page so the wallet routes to its console once.
// A wallet that later returns to the verifier carries no flag, so it stays put.
export const AUTO_ROUTE_KEY = "sg:autoroute";

// A console clears the flag once the wallet has arrived, so a later visit to the verifier stays put.
export function useArrivedFromVerifier() {
  useEffect(() => {
    window.sessionStorage.removeItem(AUTO_ROUTE_KEY);
  }, []);
}

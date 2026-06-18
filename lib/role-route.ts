export type ConsolePath = "/admin" | "/worker" | "/not-registered";

// Where a connected wallet belongs based on its on-chain role.
export function consolePath(gate: { isAdmin: boolean; isEmployee: boolean }): ConsolePath {
  if (gate.isAdmin) return "/admin";
  if (gate.isEmployee) return "/worker";
  return "/not-registered";
}

// Set when a wallet connects from the public page so we route it to its console
// once — without trapping a connected wallet that navigates back to the verifier.
export const AUTO_ROUTE_KEY = "sg:autoroute";

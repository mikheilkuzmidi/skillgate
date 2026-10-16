import { mock } from "wagmi";

// Public Hardhat fixtures, available only in an explicitly enabled local dev run.
// Production builds always use the injected wallet connector.
export function localValidationConnectors() {
  if (process.env.NODE_ENV !== "development" || process.env.NEXT_PUBLIC_LOCAL_VALIDATION !== "1") return [];
  const url = new URL(process.env.NEXT_PUBLIC_ALCHEMY_SEPOLIA_RPC_URL || "https://invalid.example");
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname)) return [];
  const wallets = [
    ["admin", "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"],
    ["engineer", "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"],
    ["operator", "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"],
    ["unregistered", "0x90F79bf6EB2c4f870365E785982E1f101E93b906"]
  ] as const;
  return wallets.map(([role, address]) => {
    const factory = mock({ accounts: [address] });
    return (config: Parameters<typeof factory>[0]) => ({ ...factory(config), id: `local-${role}`, name: `Local ${role}` });
  });
}

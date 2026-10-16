"use client";

import { QueryClient } from "@tanstack/react-query";
import { createConfig, createStorage, http, injected, noopStorage } from "wagmi";
import { skillGateSepolia } from "@/lib/sepolia";
import { getRpcUrl } from "@/lib/skillgate";
import { localValidationConnectors } from "@/lib/local-validation";

const localConnectors = localValidationConnectors();

export const wagmiConfig = createConfig({
  chains: [skillGateSepolia],
  connectors: localConnectors.length ? localConnectors : [injected({ target: "metaMask" })],
  multiInjectedProviderDiscovery: localConnectors.length === 0,
  ssr: true,
  storage: createStorage({
    storage: typeof window === "undefined" ? noopStorage : window.localStorage
  }),
  transports: {
    [skillGateSepolia.id]: http(getRpcUrl())
  }
});

export const queryClient = new QueryClient();

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}

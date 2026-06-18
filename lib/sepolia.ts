import type { Chain } from "viem";
import { getRpcUrl } from "@/lib/skillgate";

export const skillGateSepolia = {
  id: 11155111,
  name: "Sepolia",
  nativeCurrency: {
    decimals: 18,
    name: "Sepolia Ether",
    symbol: "ETH"
  },
  rpcUrls: {
    default: {
      http: [getRpcUrl()]
    }
  },
  blockExplorers: {
    default: {
      name: "Etherscan",
      url: "https://sepolia.etherscan.io"
    }
  },
  testnet: true
} as const satisfies Chain;

import { createPublicClient, http } from "viem";
import { skillGateSepolia } from "@/lib/sepolia";
import { getRpcUrl } from "@/lib/skillgate";

export const publicClient = createPublicClient({
  chain: skillGateSepolia,
  transport: http(getRpcUrl())
});

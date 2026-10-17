"use client";

import { useRef, useState } from "react";
import { BaseError, ContractFunctionRevertedError, type Hex } from "viem";
import { publicClient } from "@/lib/public-client";

// Shown in the console header's status row while the wallet is on another chain; the header's
// "Use Sepolia" button switches it.
export const WRONG_NETWORK = "Your wallet is on another network. Use Sepolia to continue.";

function friendlyError(error: unknown): string {
  if (error instanceof BaseError) {
    const reverted = error.walk((cause) => cause instanceof ContractFunctionRevertedError);
    if (reverted instanceof ContractFunctionRevertedError && reverted.data?.errorName === "ClaimRevoked") {
      return "This certificate was revoked. Ask an issuer to restore it.";
    }
    // Full RPC errors may include the configured endpoint. Keep those out of the UI.
    return error.shortMessage.replace(/https?:\/\/[^\s]+/g, "RPC endpoint");
  }
  return "Transaction was not completed. Check your wallet and try again.";
}

export async function confirmTransaction(hash: Hex) {
  const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
  if (receipt.status !== "success") throw new Error("Transaction reverted");
  return receipt;
}

export function useTransactionFeedback(setMessage: (message: string) => void) {
  const locked = useRef(false);
  const [pending, setPending] = useState(false);

  async function run(action: () => Promise<unknown>) {
    if (locked.current) return;
    locked.current = true;
    setPending(true);
    setMessage("");
    try {
      await action();
    } catch (error) {
      setMessage(friendlyError(error));
    } finally {
      locked.current = false;
      setPending(false);
    }
  }

  return { pending, run };
}

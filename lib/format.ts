import { getAddress, isAddress } from "viem";

export function shortAddress(address: string | undefined, size = 4) {
  if (!address || !isAddress(address)) {
    return "Not connected";
  }
  const checked = getAddress(address);
  return `${checked.slice(0, 6)}...${checked.slice(-size)}`;
}

export function daysFromSeconds(seconds: bigint) {
  return Number(seconds / 86_400n);
}

export function expiryLabel(expiresAt: bigint | undefined) {
  if (!expiresAt || expiresAt === 0n) {
    return "-";
  }
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (now >= expiresAt) {
    return "expired";
  }
  const days = (expiresAt - now) / 86_400n;
  if (days <= 0n) {
    return "today";
  }
  return `in ${days.toString()} days`;
}

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
  const remaining = expiresAt - now;
  if (remaining < 86_400n) {
    return "today";
  }
  // Round to the nearest day: a fresh 180-day certificate reads "in 180 days" even when
  // block time and the browser clock differ by a few seconds in either direction.
  const days = (remaining + 43_200n) / 86_400n;
  return days === 1n ? "in 1 day" : `in ${days.toString()} days`;
}

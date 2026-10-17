import type { ReactNode } from "react";

// Colour follows meaning: green valid, red revoked, amber expired or changed.
const TONE: Record<string, string> = {
  Valid: "ok",
  Certified: "ok",
  Started: "ok",
  Revoked: "bad",
  Expired: "warn",
  "Role changed": "warn"
};

export function Status({ on, label, tip }: { on: boolean; label: string; tip?: string }) {
  const tone = TONE[label] ?? (on ? "ok" : "");
  return (
    <span className={`stat ${tone}`} title={tip}>
      <span className="sq" />
      {label}
    </span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function Notice({ children }: { children: ReactNode }) {
  return <div className="notice" role="status">{children}</div>;
}

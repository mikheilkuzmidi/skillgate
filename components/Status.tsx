import type { ReactNode } from "react";

export function Status({ on, label, tip }: { on: boolean; label: string; tip?: string }) {
  return (
    <span className={`stat ${on ? "on" : "off"}`} title={tip}>
      <span className="sq" />
      {label}
    </span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function Notice({ children }: { children: ReactNode }) {
  return <div className="notice">{children}</div>;
}

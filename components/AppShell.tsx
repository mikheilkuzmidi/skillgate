"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { WORKSPACE_NAME } from "@/lib/skillgate";
import { shortAddress } from "@/lib/format";
import { ConnectControl } from "@/components/ConnectControl";
import { NetworkBadge } from "@/components/NetworkBadge";

// Each console has its own label, so the screens cannot be mistaken for one another.
export type Tone = "admin" | "worker" | "public";
const TONE_LABEL: Record<Tone, string> = {
  admin: "Admin",
  worker: "Worker",
  public: "Public verifier"
};

export function AppShell({
  title,
  role,
  connected,
  publicHeader,
  status,
  tone = "public",
  subtitle,
  opening = false,
  children
}: {
  title: string;
  role: string;
  connected?: string;
  publicHeader?: boolean;
  // Transaction feedback lives in the header so content below never shifts.
  status?: string;
  tone?: Tone;
  subtitle?: string;
  // The public page is handing a just-connected wallet to its console.
  opening?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="sg" data-tone={tone}>
      <div className="shell">
        <div className="rail">
          <Link href="/" className="vbrand" title="SkillGate verifier">
            SkillGate
          </Link>
        </div>
        <aside className="side">
          <div className="ws">
            <span className="lbl">Workspace</span>
            <span className="nm">{WORKSPACE_NAME}</span>
          </div>

          <div className="side-role">
            <span className="k">Current role</span>
            <span className="v">{role}</span>
          </div>

          <div className="side-foot">
            <span className="k">Network</span>
            <NetworkBadge />
          </div>
        </aside>
        <main className="main">
          <div className="mhead">
            <div className="mtitle">
              <div className="mtitle-row">
                <span className="role-pill">{TONE_LABEL[tone]}</span>
                <h1>{title}</h1>
              </div>
              {subtitle ? <p className="msub">{subtitle}</p> : null}
            </div>
            {publicHeader ? null : (
              <div className="hstatus" role="status" aria-live="polite" title={status || undefined}>
                {status ? <span>{status}</span> : null}
              </div>
            )}
            {publicHeader ? (
              <div className="conn">
                <span className="powered">
                  Powered by <b>SkillGate</b>
                </span>
                <ConnectControl compact autoRoute opening={opening} />
              </div>
            ) : (
              <div className="conn">
                <Link href="/" className="btn ghost sm">
                  Public page
                </Link>
                {connected ? (
                  <>
                    <span className="cl">Connected</span>
                    <span className="mono">{shortAddress(connected)}</span>
                  </>
                ) : null}
                <ConnectControl compact />
              </div>
            )}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}

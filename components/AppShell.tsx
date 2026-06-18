"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { WORKSPACE_NAME } from "@/lib/skillgate";
import { shortAddress } from "@/lib/format";
import { ConnectControl } from "@/components/ConnectControl";
import { NetworkBadge } from "@/components/NetworkBadge";

export function AppShell({
  title,
  role,
  connected,
  publicHeader,
  children
}: {
  title: string;
  role: string;
  connected?: string;
  publicHeader?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="sg">
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
            <div>
              <h1>{title}</h1>
            </div>
            {publicHeader ? (
              <div className="conn">
                <span className="powered">
                  Powered by <b>SkillGate</b>
                </span>
                <ConnectControl compact autoRoute />
              </div>
            ) : (
              <div className="conn">
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
          <div className="rule" />
          {children}
        </main>
      </div>
    </div>
  );
}

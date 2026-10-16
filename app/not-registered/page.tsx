"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { ReadError } from "@/components/ReadError";
import { Empty, Notice } from "@/components/Status";
import { useWalletGate } from "@/lib/use-skillgate";

export default function NotRegisteredPage() {
  const router = useRouter();
  const gate = useWalletGate();

  useEffect(() => {
    if (gate.connected && !gate.loading && !gate.error) {
      if (gate.isAdmin) router.replace("/admin");
      if (gate.isEmployee) router.replace("/worker");
    }
  }, [gate.connected, gate.loading, gate.error, gate.isAdmin, gate.isEmployee, router]);

  if (gate.error) {
    return <AppShell title="Access unavailable" role="Public" connected={gate.address}><ReadError retry={gate.refetch} /></AppShell>;
  }

  return (
    <AppShell title="Wallet not registered" role="Not registered" connected={gate.address}>
      <section className="sec">
        <div className="sechead">
          <h2>Access</h2>
        </div>
        {gate.loading ? (
          <Empty>Checking wallet access.</Empty>
        ) : !gate.connected ? (
          <Empty>Workspace wallet required.</Empty>
        ) : (
          <Notice>Wallet not registered.</Notice>
        )}
      </section>
      <section className="sec">
        <Empty>
          <Link href="/">Public page.</Link>
        </Empty>
      </section>
    </AppShell>
  );
}

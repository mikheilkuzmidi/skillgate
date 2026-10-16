"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getAddress, isAddress, type Address } from "viem";
import { certificateStatus } from "@/lib/certificate-status";
import { useNow } from "@/lib/use-now";
import { AppShell } from "@/components/AppShell";
import { ReadError } from "@/components/ReadError";
import { Empty, Notice, Status } from "@/components/Status";
import { expiryLabel, shortAddress } from "@/lib/format";
import { AUTO_ROUTE_KEY, consolePath } from "@/lib/role-route";
import { usePublicEvents, useSkillGateData, useWalletGate } from "@/lib/use-skillgate";

export default function PublicPage() {
  const router = useRouter();
  const gate = useWalletGate();
  const data = useSkillGateData();
  const now = useNow();
  const audit = usePublicEvents(data.typeById, data.taskById);
  const [query, setQuery] = useState("");
  const [checked, setChecked] = useState<Address | undefined>();
  const [inputError, setInputError] = useState("");

  // Route to the role console once, right after connecting from this page.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.sessionStorage.getItem(AUTO_ROUTE_KEY) !== "1") return;
    if (!gate.connected || gate.loading || gate.error) return;
    window.sessionStorage.removeItem(AUTO_ROUTE_KEY);
    router.replace(consolePath({ isAdmin: gate.isAdmin, isEmployee: gate.isEmployee }));
  }, [gate.connected, gate.loading, gate.error, gate.isAdmin, gate.isEmployee, router]);

  const checkedCerts = useMemo(() => {
    if (!checked) return [];
    return data.certificates.filter((cert) => getAddress(cert.holder) === checked);
  }, [checked, data.certificates]);

  const validCount = checkedCerts.filter((cert) => certificateStatus(cert, data.typeById.get(cert.typeId.toString()), data.employees.find((employee) => employee.address === cert.holder), now).ok).length;

  const consoleLink = gate.connected && !gate.loading && !gate.error
    ? gate.isAdmin
      ? { href: "/admin", label: "Open admin console" }
      : gate.isEmployee
        ? { href: "/worker", label: "Open worker console" }
        : null
    : null;

  const role = gate.connected && !gate.loading && !gate.error ? gate.roleName : "Public";

  function check() {
    const value = query.trim();
    if (!isAddress(value)) {
      setInputError("Enter a valid wallet address.");
      setChecked(undefined);
      return;
    }
    setInputError("");
    setChecked(getAddress(value));
  }

  if (data.error) {
    return <AppShell title="Granary Foods" role="Public" publicHeader><ReadError retry={data.refetchAll} /></AppShell>;
  }

  return (
    <AppShell title="Granary Foods" role={role} publicHeader>
      {!data.configured && (
        <section className="sec">
          <Notice>Set `NEXT_PUBLIC_SKILLGATE_ADDRESS` and the Alchemy Sepolia RPC URL to read the live workspace.</Notice>
        </section>
      )}

      {gate.connected && !gate.loading && !gate.error && (
        <section className="sec">
          <div className="banner">
            <span>
              Connected as <b>{gate.roleName}</b>.
            </span>
            {consoleLink ? (
              <Link href={consoleLink.href} className="btn sm">
                {consoleLink.label}
              </Link>
            ) : (
              <span className="banner-muted">This wallet is not registered for this workspace.</span>
            )}
          </div>
        </section>
      )}

      <section className="sec">
        <div className="sechead">
          <h2>Verify a worker</h2>
        </div>
        <div className="verify">
          <input
            aria-label="Worker wallet address"
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="0x..."
            className="mono"
          />
          <button className="btn sm" onClick={check}>
            Check
          </button>
        </div>
        {inputError && <div className="empty" style={{ marginTop: 14 }}>{inputError}</div>}
        {!checked && !inputError ? (
          <div className="empty" style={{ marginTop: 14 }}>Enter a wallet address.</div>
        ) : checked && data.loading ? (
          <Empty>Reading credentials.</Empty>
        ) : checked && checkedCerts.length === 0 ? (
          <div className="empty" style={{ marginTop: 14 }}>No credentials found.</div>
        ) : checked ? (
          <div>
            <div className="vhead">
              <b>{shortAddress(checked)}</b> holds <b>{validCount}</b> valid credential
              {validCount === 1 ? "" : "s"}.
            </div>
            {checkedCerts.map((cert) => {
              const certType = data.typeById.get(cert.typeId.toString());
              const status = certificateStatus(cert, data.typeById.get(cert.typeId.toString()), data.employees.find((employee) => employee.address === cert.holder), now);
              return (
                <div className="cred" key={`${cert.holder}-${cert.typeId.toString()}`}>
                  <div>
                    <div className="c-name">{certType?.name ?? `Certificate ${cert.typeId.toString()}`}</div>
                    <div className="c-meta mono">{status.ok ? expiryLabel(cert.expiresAt) : status.label.toLowerCase()}</div>
                  </div>
                  <Status on={status.ok} label={status.ok ? "Valid" : status.label} />
                </div>
              );
            })}
          </div>
        ) : null}
      </section>

      <section className="sec">
        <div className="sechead">
          <h2>Recent activity</h2>
          <span className="mono">Last 100 blocks</span>
        </div>
        {audit.error && <Notice>Activity could not be refreshed. Any displayed events are from the previous successful read.</Notice>}
        {audit.events.length === 0 ? (
          <Empty>{audit.loading ? "Reading activity." : audit.error ? "Activity unavailable." : "No activity in the last 100 blocks."}</Empty>
        ) : (
          <div className="audit">
            {audit.events.map((event) => (
              <div className="line mono" key={`${event.transactionHash}-${event.name}-${event.logIndex}`}>
                <span className="ev">
                  <b>{event.name}</b>
                </span>
                <span className="meta">{event.meta}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}

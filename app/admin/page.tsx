"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useConnection, useSwitchChain, useWriteContract } from "wagmi";
import { getAddress, isAddress, type Address, type Hex } from "viem";
import { certificateStatus } from "@/lib/certificate-status";
import { useNow } from "@/lib/use-now";
import { AppShell } from "@/components/AppShell";
import { ReadError } from "@/components/ReadError";
import { Empty, Notice, Status } from "@/components/Status";
import { daysFromSeconds, expiryLabel, shortAddress } from "@/lib/format";
import { ENGINEER_ROLE, OPERATOR_ROLE, ROLE_LABELS, roleLabel, skillGateAbi } from "@/lib/skillgate";
import { skillGateSepolia } from "@/lib/sepolia";
import { ZERO_HASH } from "@/lib/quizzes";
import { confirmTransaction, useTransactionFeedback } from "@/lib/use-transaction-feedback";
import { useSkillGateData, useWalletGate } from "@/lib/use-skillgate";

const ROLE_OPTIONS = [
  { label: ROLE_LABELS.operator, value: OPERATOR_ROLE },
  { label: ROLE_LABELS.engineer, value: ENGINEER_ROLE }
];

export default function AdminPage() {
  const connection = useConnection();
  return <AdminConsole key={connection.address ?? "disconnected"} />;
}

function AdminConsole() {
  const router = useRouter();
  const gate = useWalletGate();
  const data = useSkillGateData();
  const now = useNow();
  const write = useWriteContract();
  const switchChain = useSwitchChain();
  const [message, setMessage] = useState("");
  const transaction = useTransactionFeedback(setMessage);

  const [showType, setShowType] = useState(false);
  const [typeName, setTypeName] = useState("");
  const [typeDays, setTypeDays] = useState("180");
  const [typeRole, setTypeRole] = useState<Hex>(ENGINEER_ROLE);

  const [showTask, setShowTask] = useState(false);
  const [taskName, setTaskName] = useState("");
  const [taskRequired, setTaskRequired] = useState("1");

  const [showWorker, setShowWorker] = useState(false);
  const [workerAddr, setWorkerAddr] = useState("");
  const [workerRole, setWorkerRole] = useState<Hex>(OPERATOR_ROLE);

  const [selectedWorker, setSelectedWorker] = useState<Address | "">("");
  const activeWorker = selectedWorker || data.employees[0]?.address || "";
  const selectedEmployee = data.employees.find((employee) => employee.address === activeWorker);
  const eligibleTypes = useMemo(() => {
    if (!selectedEmployee) return [];
    return data.certificateTypes.filter((type) => type.active && type.role === selectedEmployee.role);
  }, [data.certificateTypes, selectedEmployee]);
  const [issueType, setIssueType] = useState("");
  const activeIssueType = eligibleTypes.some((type) => type.id.toString() === issueType)
    ? issueType
    : eligibleTypes[0]?.id.toString() ?? "";

  useEffect(() => {
    if (gate.connected && !gate.loading && !gate.error && !gate.isAdmin) {
      router.replace(gate.isEmployee ? "/worker" : "/not-registered");
    }
  }, [gate.connected, gate.loading, gate.error, gate.isAdmin, gate.isEmployee, router]);

  async function wait(hash: `0x${string}`) {
    setMessage("Waiting for transaction confirmation.");
    await confirmTransaction(hash);
    await data.refetchAll();
    await gate.refetch();
  }

  function requireSepolia() {
    if (gate.onSepolia) return true;
    setMessage("Switch your wallet to the Sepolia network first.");
    return false;
  }

  async function createType() {
    if (!gate.contractAddress || !typeName.trim()) return;
    if (!requireSepolia()) return;
    if (!/^[1-9]\d*$/.test(typeDays)) {
      setMessage("Enter a whole number of days greater than zero.");
      return;
    }
    const days = BigInt(typeDays);
    if (days > ((1n << 256n) - 1n) / 86_400n) {
      setMessage("The validity period is too large.");
      return;
    }
    const hash = await write.mutateAsync({
      address: gate.contractAddress,
      abi: skillGateAbi,
      functionName: "createCertificateType",
      args: [typeName.trim(), days * 86_400n, typeRole, ZERO_HASH],
      chainId: skillGateSepolia.id,
      account: gate.address
    });
    await wait(hash);
    setTypeName("");
    setTypeDays("180");
    setShowType(false);
    setMessage("Certificate type created.");
  }

  async function createTask() {
    if (!gate.contractAddress || !taskName.trim() || !taskRequired) return;
    if (!requireSepolia()) return;
    const hash = await write.mutateAsync({
      address: gate.contractAddress,
      abi: skillGateAbi,
      functionName: "createTask",
      args: [taskName.trim(), BigInt(taskRequired)],
      chainId: skillGateSepolia.id,
      account: gate.address
    });
    await wait(hash);
    setTaskName("");
    setShowTask(false);
    setMessage("Task created.");
  }

  async function registerWorker() {
    if (!gate.contractAddress) return;
    if (!requireSepolia()) return;
    const addr = workerAddr.trim();
    if (!isAddress(addr)) {
      setMessage("Enter a valid wallet address.");
      return;
    }
    const hash = await write.mutateAsync({
      address: gate.contractAddress,
      abi: skillGateAbi,
      functionName: "registerEmployee",
      args: [getAddress(addr), workerRole],
      chainId: skillGateSepolia.id,
      account: gate.address
    });
    await wait(hash);
    setWorkerAddr("");
    setShowWorker(false);
    setMessage("Worker registered.");
  }

  async function issueCertificate() {
    if (!gate.contractAddress || !activeWorker || !activeIssueType) return;
    if (!requireSepolia()) return;
    const hash = await write.mutateAsync({
      address: gate.contractAddress,
      abi: skillGateAbi,
      functionName: "issueCertificate",
      args: [activeWorker, BigInt(activeIssueType)],
      chainId: skillGateSepolia.id,
      account: gate.address
    });
    await wait(hash);
    setMessage("Certificate issued.");
  }

  async function revokeCertificate(holder: Address, typeId: bigint) {
    if (!gate.contractAddress) return;
    if (!requireSepolia()) return;
    const hash = await write.mutateAsync({
      address: gate.contractAddress,
      abi: skillGateAbi,
      functionName: "revokeCertificate",
      args: [holder, typeId],
      chainId: skillGateSepolia.id,
      account: gate.address
    });
    await wait(hash);
    setMessage("Certificate revoked.");
  }

  if (!gate.configured) {
    return (
      <AppShell title="Admin console" role="Admin" connected={gate.address}>
        <section className="sec">
          <Notice>Set the SkillGate contract address and Alchemy Sepolia RPC URL before using Admin.</Notice>
        </section>
      </AppShell>
    );
  }

  if (gate.error || data.error) {
    return <AppShell title="Admin console" role="Access unavailable" connected={gate.address}><ReadError retry={() => Promise.all([gate.refetch(), data.refetchAll()])} /></AppShell>;
  }

  if (!gate.connected) {
    return (
      <AppShell title="Admin console" role="Admin" connected={gate.address}>
        <section className="sec">
          <div className="sechead">
            <h2>Wallet</h2>
          </div>
          <Empty>Admin wallet required.</Empty>
        </section>
      </AppShell>
    );
  }

  if (gate.loading || !gate.isAdmin) {
    return (
      <AppShell title="Admin console" role={gate.roleName} connected={gate.address}>
        <section className="sec">
          <Empty>Checking wallet access.</Empty>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell title="Admin console" role="Admin" connected={gate.address}>
      {message && (
        <section className="sec">
          <Notice>{message}</Notice>
        </section>
      )}

      {gate.connected && !gate.onSepolia && (
        <section className="sec">
          <div className="banner">
            <span>
              Your wallet is on the wrong network. SkillGate runs on the <b>Sepolia</b> test network (free test ETH, no real fees).
            </span>
            <button
              className="btn sm"
              disabled={switchChain.isPending}
              onClick={() => switchChain.mutate({ chainId: skillGateSepolia.id })}
            >
              {switchChain.isPending ? "Switching" : "Switch to Sepolia"}
            </button>
          </div>
        </section>
      )}

      <section className="sec">
        <div className="sechead">
          <h2>Certificate types</h2>
          <div className="grow" />
          <button className="btn ghost sm" onClick={() => setShowType((value) => !value)}>
            Add
          </button>
        </div>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Validity</th>
              <th>Role</th>
              <th>Issuer</th>
            </tr>
          </thead>
          <tbody>
            {data.certificateTypes.map((type) => (
              <tr key={type.id.toString()}>
                <td className="name">{type.name}</td>
                <td className="mono">{daysFromSeconds(type.validityPeriod)} days</td>
                <td>{roleLabel(type.role)}</td>
                <td className="mono" style={{ color: "var(--muted)" }}>{shortAddress(type.issuer)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {showType && (
          <div className="issue" style={{ marginTop: 10 }}>
            <span className="field">
              <label htmlFor="certificate-name">Name</label>
              <input id="certificate-name" type="text" value={typeName} onChange={(event) => setTypeName(event.target.value)} placeholder="Solidity and Ethereum" />
            </span>
            <span className="field">
              <label htmlFor="certificate-days">Days</label>
              <input id="certificate-days" type="number" min="1" step="1" value={typeDays} onChange={(event) => setTypeDays(event.target.value)} style={{ width: 90 }} />
            </span>
            <span className="field">
              <label htmlFor="certificate-role">Role</label>
              <select id="certificate-role" value={typeRole} onChange={(event) => setTypeRole(event.target.value as Hex)}>
                {ROLE_OPTIONS.map((role) => (
                  <option key={role.value} value={role.value}>{role.label}</option>
                ))}
              </select>
            </span>
            <button className="btn sm" onClick={() => transaction.run(createType)} disabled={transaction.pending || write.isPending || !gate.onSepolia}>Create type</button>
          </div>
        )}
      </section>

      <section className="sec">
        <div className="sechead">
          <h2>Tasks</h2>
          <div className="grow" />
          <button className="btn ghost sm" onClick={() => setShowTask((value) => !value)}>
            Add
          </button>
        </div>
        <table>
          <thead>
            <tr>
              <th>Task</th>
              <th>Required certificate</th>
            </tr>
          </thead>
          <tbody>
            {data.tasks.map((task) => (
              <tr key={task.id.toString()}>
                <td className="name">{task.name}</td>
                <td>{data.typeById.get(task.requiredTypeId.toString())?.name ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {showTask && (
          <div className="issue" style={{ marginTop: 10 }}>
            <span className="field">
              <label htmlFor="task-name">Task</label>
              <input id="task-name" type="text" value={taskName} onChange={(event) => setTaskName(event.target.value)} placeholder="Ship crypto payroll bridge" />
            </span>
            <span className="field">
              <label htmlFor="task-required">Requires</label>
              <select id="task-required" value={taskRequired} onChange={(event) => setTaskRequired(event.target.value)}>
                {data.certificateTypes.map((type) => (
                  <option key={type.id.toString()} value={type.id.toString()}>{type.name}</option>
                ))}
              </select>
            </span>
            <button className="btn sm" onClick={() => transaction.run(createTask)} disabled={transaction.pending || write.isPending || !gate.onSepolia}>Create task</button>
          </div>
        )}
      </section>

      <section className="sec">
        <div className="sechead">
          <h2>Workers</h2>
          <div className="grow" />
          <button className="btn ghost sm" onClick={() => setShowWorker((value) => !value)}>
            Add
          </button>
        </div>
        {data.employees.length === 0 ? (
          <Empty>No workers registered yet.</Empty>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Wallet</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {data.employees.map((employee) => (
                <tr key={employee.address}>
                  <td className="mono">{shortAddress(employee.address)}</td>
                  <td>{employee.roleName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {showWorker && (
          <div className="issue" style={{ marginTop: 10 }}>
            <span className="field" style={{ flex: 1, minWidth: 240 }}>
              <label htmlFor="worker-address">Wallet address</label>
              <input
                id="worker-address"
                type="text"
                className="mono"
                value={workerAddr}
                onChange={(event) => setWorkerAddr(event.target.value)}
                placeholder="0x..."
              />
            </span>
            <span className="field">
              <label htmlFor="worker-role">Role</label>
              <select id="worker-role" value={workerRole} onChange={(event) => setWorkerRole(event.target.value as Hex)}>
                {ROLE_OPTIONS.map((role) => (
                  <option key={role.value} value={role.value}>{role.label}</option>
                ))}
              </select>
            </span>
            <button className="btn sm" onClick={() => transaction.run(registerWorker)} disabled={transaction.pending || write.isPending || !gate.onSepolia}>
              Register worker
            </button>
          </div>
        )}
      </section>

      <section className="sec">
        <div className="sechead">
          <h2>Issue</h2>
        </div>
        <div className="issue">
          <span className="field">
            <label htmlFor="issue-worker">Worker</label>
            <select
              id="issue-worker"
              value={activeWorker}
              onChange={(event) => {
                setSelectedWorker(event.target.value as Address);
                setIssueType("");
              }}
            >
              {data.employees.map((employee) => (
                <option key={employee.address} value={employee.address}>
                  {employee.roleName} / {shortAddress(employee.address)}
                </option>
              ))}
            </select>
          </span>
          <span className="field">
            <label htmlFor="issue-type">Certificate</label>
            <select id="issue-type" value={activeIssueType} onChange={(event) => setIssueType(event.target.value)} disabled={eligibleTypes.length === 0}>
              {eligibleTypes.map((type) => (
                <option key={type.id.toString()} value={type.id.toString()}>{type.name}</option>
              ))}
            </select>
          </span>
          <button className="btn sm" onClick={() => transaction.run(issueCertificate)} disabled={!activeIssueType || transaction.pending || write.isPending || !gate.onSepolia}>
            Issue certificate
          </button>
        </div>
      </section>

      <section className="sec">
        <div className="sechead">
          <h2>Issued</h2>
        </div>
        {data.certificates.length === 0 ? (
          <Empty>No certificates issued.</Empty>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Worker</th>
                <th>Certificate</th>
                <th>Expires</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.certificates.map((cert) => {
                const status = certificateStatus(cert, data.typeById.get(cert.typeId.toString()), data.employees.find((employee) => employee.address === cert.holder), now);
                return (
                  <tr key={`${cert.holder}-${cert.typeId.toString()}`}>
                    <td className="mono">{shortAddress(cert.holder)}</td>
                    <td className="name">{data.typeById.get(cert.typeId.toString())?.name ?? "-"}</td>
                    <td className="mono" style={{ color: "var(--muted)" }}>{expiryLabel(cert.expiresAt)}</td>
                    <td>
                      <Status on={status.ok} label={status.label} />
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {!cert.revoked && (
                        <button
                          className="btn ghost sm"
                          onClick={() => transaction.run(() => revokeCertificate(cert.holder, cert.typeId))}
                          disabled={transaction.pending || write.isPending || !gate.onSepolia}
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </AppShell>
  );
}

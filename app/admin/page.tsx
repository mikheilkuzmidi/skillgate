"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSwitchChain, useWriteContract } from "wagmi";
import { getAddress, isAddress, type Address, type Hex } from "viem";
import { AppShell } from "@/components/AppShell";
import { Empty, Notice, Status } from "@/components/Status";
import { daysFromSeconds, expiryLabel, shortAddress } from "@/lib/format";
import { ENGINEER_ROLE, OPERATOR_ROLE, ROLE_LABELS, roleLabel, skillGateAbi } from "@/lib/skillgate";
import { skillGateSepolia } from "@/lib/sepolia";
import { ZERO_HASH } from "@/lib/quizzes";
import { publicClient } from "@/lib/public-client";
import { useSkillGateData, useWalletGate } from "@/lib/use-skillgate";

const ROLE_OPTIONS = [
  { label: ROLE_LABELS.operator, value: OPERATOR_ROLE },
  { label: ROLE_LABELS.engineer, value: ENGINEER_ROLE }
];

function certStatus(cert: { expiresAt: bigint; revoked: boolean }) {
  const expired = BigInt(Math.floor(Date.now() / 1000)) >= cert.expiresAt;
  return {
    ok: !cert.revoked && !expired,
    label: cert.revoked ? "Revoked" : expired ? "Expired" : "Active"
  };
}

export default function AdminPage() {
  const router = useRouter();
  const gate = useWalletGate();
  const data = useSkillGateData();
  const write = useWriteContract();
  const switchChain = useSwitchChain();
  const [message, setMessage] = useState("");

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
    if (gate.connected && !gate.loading && !gate.isAdmin) {
      router.replace(gate.isEmployee ? "/worker" : "/not-registered");
    }
  }, [gate.connected, gate.loading, gate.isAdmin, gate.isEmployee, router]);

  async function wait(hash: `0x${string}`) {
    await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
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
    const days = BigInt(Number(typeDays || "0"));
    if (days <= 0n) {
      setMessage("Enter a validity period greater than zero.");
      return;
    }
    const hash = await write.mutateAsync({
      address: gate.contractAddress,
      abi: skillGateAbi,
      functionName: "createCertificateType",
      args: [typeName.trim(), days * 86_400n, typeRole, ZERO_HASH],
      chainId: skillGateSepolia.id
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
      chainId: skillGateSepolia.id
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
      chainId: skillGateSepolia.id
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
      chainId: skillGateSepolia.id
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
      chainId: skillGateSepolia.id
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
              <label>Name</label>
              <input type="text" value={typeName} onChange={(event) => setTypeName(event.target.value)} placeholder="Solidity and Ethereum" />
            </span>
            <span className="field">
              <label>Days</label>
              <input type="number" value={typeDays} onChange={(event) => setTypeDays(event.target.value)} style={{ width: 90 }} />
            </span>
            <span className="field">
              <label>Role</label>
              <select value={typeRole} onChange={(event) => setTypeRole(event.target.value as Hex)}>
                {ROLE_OPTIONS.map((role) => (
                  <option key={role.value} value={role.value}>{role.label}</option>
                ))}
              </select>
            </span>
            <button className="btn sm" onClick={createType} disabled={write.isPending}>Create type</button>
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
              <label>Task</label>
              <input type="text" value={taskName} onChange={(event) => setTaskName(event.target.value)} placeholder="Ship crypto payroll bridge" />
            </span>
            <span className="field">
              <label>Requires</label>
              <select value={taskRequired} onChange={(event) => setTaskRequired(event.target.value)}>
                {data.certificateTypes.map((type) => (
                  <option key={type.id.toString()} value={type.id.toString()}>{type.name}</option>
                ))}
              </select>
            </span>
            <button className="btn sm" onClick={createTask} disabled={write.isPending}>Create task</button>
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
              <label>Wallet address</label>
              <input
                type="text"
                className="mono"
                value={workerAddr}
                onChange={(event) => setWorkerAddr(event.target.value)}
                placeholder="0x..."
              />
            </span>
            <span className="field">
              <label>Role</label>
              <select value={workerRole} onChange={(event) => setWorkerRole(event.target.value as Hex)}>
                {ROLE_OPTIONS.map((role) => (
                  <option key={role.value} value={role.value}>{role.label}</option>
                ))}
              </select>
            </span>
            <button className="btn sm" onClick={registerWorker} disabled={write.isPending}>
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
            <label>Worker</label>
            <select
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
            <label>Certificate</label>
            <select value={activeIssueType} onChange={(event) => setIssueType(event.target.value)} disabled={eligibleTypes.length === 0}>
              {eligibleTypes.map((type) => (
                <option key={type.id.toString()} value={type.id.toString()}>{type.name}</option>
              ))}
            </select>
          </span>
          <button className="btn sm" onClick={issueCertificate} disabled={!activeIssueType || write.isPending}>
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
                const status = certStatus(cert);
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
                          onClick={() => revokeCertificate(cert.holder, cert.typeId)}
                          disabled={write.isPending}
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

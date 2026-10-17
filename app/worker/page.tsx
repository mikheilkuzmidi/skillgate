"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useConnection, useWriteContract } from "wagmi";
import { certificateStatus } from "@/lib/certificate-status";
import { useNow } from "@/lib/use-now";
import { useArrivedFromVerifier } from "@/lib/role-route";
import { AppShell } from "@/components/AppShell";
import { ReadError } from "@/components/ReadError";
import { LockIcon, Tick } from "@/components/GateIcons";
import { Empty, Notice, Status } from "@/components/Status";
import { expiryLabel } from "@/lib/format";
import { roleLabel, skillGateAbi } from "@/lib/skillgate";
import { skillGateSepolia } from "@/lib/sepolia";
import { QUIZZES, answerKey } from "@/lib/quizzes";
import { WRONG_NETWORK, confirmTransaction, useTransactionFeedback } from "@/lib/use-transaction-feedback";
import { useSkillGateData, useTaskGate, useWalletGate, type CertificateTypeView } from "@/lib/use-skillgate";

export default function WorkerPage() {
  const connection = useConnection();
  return <WorkerConsole key={connection.address ?? "disconnected"} />;
}

function WorkerConsole() {
  const router = useRouter();
  const gate = useWalletGate();
  useArrivedFromVerifier();
  const data = useSkillGateData();
  const now = useNow();
  const write = useWriteContract();
  const [openQuiz, setOpenQuiz] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, number[]>>({});
  const [message, setMessage] = useState("");
  const [started, setStarted] = useState<string[]>([]);
  const transaction = useTransactionFeedback(setMessage);

  const myCerts = useMemo(() => {
    if (!gate.address) return [];
    return data.certificates.filter((cert) => cert.holder === gate.address);
  }, [data.certificates, gate.address]);

  const roleTypes = useMemo(() => {
    if (!gate.role) return [];
    return data.certificateTypes.filter((type) => type.active && type.role === gate.role);
  }, [data.certificateTypes, gate.role]);

  // "valid" and "revoked" cards show their state instead of the quiz.
  const heldState = (typeId: bigint): "valid" | "revoked" | null => {
    const cert = myCerts.find((item) => item.typeId === typeId);
    if (!cert) return null;
    if (cert.revoked) return "revoked";
    return certificateStatus(cert, data.typeById.get(cert.typeId.toString()), data.employees.find((employee) => employee.address === cert.holder), now).ok ? "valid" : null;
  };

  const myTasks = useMemo(() => {
    if (!gate.role) return [];
    return data.tasks.filter((task) => {
      const requiredType = data.typeById.get(task.requiredTypeId.toString());
      return requiredType?.role === gate.role;
    });
  }, [data.tasks, data.typeById, gate.role]);

  const taskGate = useTaskGate(gate.address, myTasks.map((task) => task.id));

  useEffect(() => {
    if (gate.connected && !gate.loading && !gate.error) {
      if (gate.isAdmin) router.replace("/admin");
      else if (!gate.isEmployee) router.replace("/not-registered");
    }
  }, [gate.connected, gate.loading, gate.error, gate.isAdmin, gate.isEmployee, router]);

  function pick(typeId: string, questionIndex: number, optionIndex: number) {
    setAnswers((current) => {
      const next = (current[typeId] ?? []).slice();
      next[questionIndex] = optionIndex;
      return { ...current, [typeId]: next };
    });
  }

  async function claim(type: CertificateTypeView) {
    if (!gate.contractAddress) return;
    if (!gate.onSepolia) {
      setMessage("Switch your wallet to the Sepolia network first.");
      return;
    }
    const quiz = QUIZZES[type.id.toString()];
    let answer = "";

    if (quiz) {
      const selected = answers[type.id.toString()] ?? [];
      if (!quiz.questions.every((_, index) => typeof selected[index] === "number")) {
        setMessage("Answer every question first.");
        return;
      }
      const submitted = quiz.questions.map((_, index) => selected[index]).join("-");
      if (submitted !== answerKey(quiz)) {
        setMessage("Some answers are incorrect. Review and try again.");
        return;
      }
      answer = submitted;
    }

    setMessage("");
    const hash = await write.mutateAsync({
      address: gate.contractAddress,
      abi: skillGateAbi,
      functionName: "claimCertificate",
      args: [type.id, answer],
      chainId: skillGateSepolia.id,
      account: gate.address
    });
    setMessage("Waiting for transaction confirmation.");
    await confirmTransaction(hash);
    setOpenQuiz(null);
    setAnswers((current) => {
      const next = { ...current };
      delete next[type.id.toString()];
      return next;
    });
    await data.refetchAll();
    await taskGate.refetch();
    setMessage("Certificate issued on-chain.");
  }

  async function startTask(taskId: bigint) {
    if (!gate.contractAddress) return;
    if (!gate.onSepolia) {
      setMessage("Switch your wallet to the Sepolia network first.");
      return;
    }
    const hash = await write.mutateAsync({
      address: gate.contractAddress,
      abi: skillGateAbi,
      functionName: "startTask",
      args: [taskId],
      chainId: skillGateSepolia.id,
      account: gate.address
    });
    setMessage("Waiting for transaction confirmation.");
    await confirmTransaction(hash);
    await data.refetchAll();
    await taskGate.refetch();
    setStarted((current) => (current.includes(taskId.toString()) ? current : [...current, taskId.toString()]));
    setMessage("Task started.");
  }

  if (!gate.configured) {
    return (
      <AppShell title="Worker console" role="Worker" connected={gate.address} tone="worker" subtitle="Earn the certificate your role needs, then start your tasks.">
        <section className="sec">
          <Notice>Set the SkillGate contract address and Alchemy Sepolia RPC URL before using Worker.</Notice>
        </section>
      </AppShell>
    );
  }

  if (gate.error || data.error || taskGate.error) {
    return <AppShell title="Worker console" role="Access unavailable" connected={gate.address} tone="worker" subtitle="Earn the certificate your role needs, then start your tasks."><ReadError retry={() => Promise.all([gate.refetch(), data.refetchAll(), taskGate.refetch()])} /></AppShell>;
  }

  if (!gate.connected) {
    return (
      <AppShell title="Worker console" role="Not connected" connected={gate.address} tone="worker" subtitle="Earn the certificate your role needs, then start your tasks.">
        <section className="sec">
          <div className="sechead">
            <h2>Wallet</h2>
          </div>
          <Empty>Worker wallet required.</Empty>
        </section>
      </AppShell>
    );
  }

  if (gate.loading || !gate.isEmployee || gate.isAdmin) {
    return (
      <AppShell title="Worker console" role="Checking wallet" connected={gate.address} tone="worker" subtitle="Earn the certificate your role needs, then start your tasks.">
        <section className="sec">
          <div className="sechead">
            <h2>Wallet</h2>
          </div>
          <Empty>Checking wallet access.</Empty>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell title="Worker console" role={gate.roleName} connected={gate.address} status={gate.connected && !gate.onSepolia ? WRONG_NETWORK : message} tone="worker" subtitle="Earn the certificate your role needs, then start your tasks.">


      <section className="sec">
        <div className="sechead">
          <h2>Get certified</h2>
        </div>
        {roleTypes.length === 0 ? (
          <Empty>No training for this role right now.</Empty>
        ) : (
          roleTypes.map((type) => {
            const tid = type.id.toString();
            const quiz = QUIZZES[tid];
            const held = heldState(type.id);
            const open = openQuiz === tid && !held;
            const selected = answers[tid] ?? [];
            const allAnswered = quiz ? quiz.questions.every((_, index) => typeof selected[index] === "number") : true;
            return (
              <div className="train-card" key={tid}>
                <div className="train">
                  <div>
                    <div className="t-name">{type.name}</div>
                    <div className="t-meta mono">
                      valid {Number(type.validityPeriod / 86_400n)} days /{" "}
                      {quiz ? `${quiz.questions.length}-question quiz` : "no quiz required"}
                    </div>
                  </div>
                  <div className="t-right">
                    {held === "valid" ? (
                      <Status on label="Certified" tip="You hold a valid certificate of this type." />
                    ) : held === "revoked" ? (
                      <>
                        <span className="t-meta">Ask an issuer to restore it.</span>
                        <Status on={false} label="Revoked" />
                      </>
                    ) : quiz ? (
                      !open && (
                        <button className="btn sm" onClick={() => setOpenQuiz(tid)}>
                          Take quiz
                        </button>
                      )
                    ) : (
                      <button className="btn sm" onClick={() => transaction.run(() => claim(type))} disabled={transaction.pending || write.isPending || !gate.onSepolia}>
                        {write.isPending ? "Submitting" : "Claim certificate"}
                      </button>
                    )}
                  </div>
                </div>
                {quiz ? (
                  <div className={`quiz-wrap ${open ? "open" : ""}`} aria-hidden={!open}>
                    <div className="quiz-inner">
                      <div className="quiz">
                        {quiz.questions.map((question, questionIndex) => (
                          <div className="q" key={questionIndex}>
                            <div className="q-prompt">
                              {questionIndex + 1}. {question.prompt}
                            </div>
                            <div className="q-opts">
                              {question.options.map((option, optionIndex) => (
                                <label
                                  className={`q-opt ${selected[questionIndex] === optionIndex ? "sel" : ""}`}
                                  key={optionIndex}
                                >
                                  <input
                                    type="radio"
                                    name={`${tid}-${questionIndex}`}
                                    checked={selected[questionIndex] === optionIndex}
                                    onChange={() => pick(tid, questionIndex, optionIndex)}
                                    tabIndex={open ? 0 : -1}
                                  />
                                  {option}
                                </label>
                              ))}
                            </div>
                          </div>
                        ))}
                        <div className="quiz-foot">
                          <button
                            className="btn ghost sm"
                            tabIndex={open ? 0 : -1}
                            onClick={() => {
                              setOpenQuiz(null);
                              setMessage("");
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            className="btn sm claim-btn"
                            tabIndex={open ? 0 : -1}
                            onClick={() => transaction.run(() => claim(type))}
                            disabled={!allAnswered || transaction.pending || write.isPending || !gate.onSepolia}
                          >
                            {write.isPending ? "Submitting" : "Get certificate"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </section>

      <section className="sec">
        <div className="sechead">
          <h2>My certificates</h2>
        </div>
        {myCerts.length === 0 ? (
          <Empty>No certificates yet.</Empty>
        ) : (
          myCerts.map((cert) => {
            const status = certificateStatus(cert, data.typeById.get(cert.typeId.toString()), data.employees.find((employee) => employee.address === cert.holder), now);
            const certType = data.typeById.get(cert.typeId.toString());
            return (
              <div className="cred" key={`${cert.holder}-${cert.typeId.toString()}`}>
                <div>
                  <div className="c-name">{certType?.name ?? `Certificate ${cert.typeId.toString()}`}</div>
                  <div className="c-meta mono">
                    {status.ok ? `expires ${expiryLabel(cert.expiresAt)}` : status.label.toLowerCase()} / non-transferable
                  </div>
                </div>
                <Status on={status.ok} label={status.ok ? "Valid" : status.label} />
              </div>
            );
          })
        )}
      </section>

      <section className="sec">
        <div className="sechead">
          <h2>Tasks</h2>
        </div>
        {myTasks.length === 0 ? (
          <Empty>No tasks for {roleLabel(gate.role)}.</Empty>
        ) : (
          myTasks.map((task) => {
            const requiredType = data.typeById.get(task.requiredTypeId.toString());
            const valid = Boolean(taskGate.gates.get(task.id.toString()));
            return (
              <div className={`gate ${valid ? "open" : "shut"}`} key={task.id.toString()}>
                <div className="lead">
                  <div className="t">{task.name}</div>
                  <div className="req">
                    Requires <b>{requiredType?.name ?? `Certificate ${task.requiredTypeId.toString()}`}</b>
                  </div>
                </div>
                <div className="checks">
                  <div className="check pass">
                    <span className="dot">
                      <Tick />
                    </span>
                    Registered
                  </div>
                  <div className={`check ${valid ? "pass" : ""}`}>
                    <span className="dot">{valid ? <Tick /> : null}</span>
                    Valid certificate
                  </div>
                  <div className={`check ${valid ? "pass" : ""}`}>
                    <span className="dot">{valid ? <Tick /> : null}</span>
                    Task open
                  </div>
                </div>
                {valid ? (
                  <div className="verdict">
                    {started.includes(task.id.toString()) ? (
                      <Status on label="Started" tip="Started in this session." />
                    ) : (
                      <button className="btn sm" onClick={() => transaction.run(() => startTask(task.id))} disabled={transaction.pending || write.isPending || !gate.onSepolia}>
                        Start task
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="verdict">
                    <LockIcon />
                    <span className="locked-chip">Locked</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </section>
    </AppShell>
  );
}

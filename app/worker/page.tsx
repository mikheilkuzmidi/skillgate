"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useWriteContract } from "wagmi";
import { AppShell } from "@/components/AppShell";
import { LockIcon, Tick } from "@/components/GateIcons";
import { Empty, Notice, Status } from "@/components/Status";
import { expiryLabel } from "@/lib/format";
import { roleLabel, skillGateAbi } from "@/lib/skillgate";
import { QUIZZES, answerKey } from "@/lib/quizzes";
import { publicClient } from "@/lib/public-client";
import { useSkillGateData, useTaskGate, useWalletGate, type CertificateTypeView } from "@/lib/use-skillgate";

function certStatus(cert: { expiresAt: bigint; revoked: boolean }) {
  const expired = BigInt(Math.floor(Date.now() / 1000)) >= cert.expiresAt;
  return {
    ok: !cert.revoked && !expired,
    label: cert.revoked ? "Revoked" : expired ? "Expired" : "Active"
  };
}

export default function WorkerPage() {
  const router = useRouter();
  const gate = useWalletGate();
  const data = useSkillGateData();
  const write = useWriteContract();
  const [openQuiz, setOpenQuiz] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, number[]>>({});
  const [message, setMessage] = useState("");

  const myCerts = useMemo(() => {
    if (!gate.address) return [];
    return data.certificates.filter((cert) => cert.holder === gate.address);
  }, [data.certificates, gate.address]);

  const availableTraining = useMemo(() => {
    if (!gate.role) return [];
    return data.certificateTypes.filter((type) => {
      if (!type.active || type.role !== gate.role) return false;
      return !myCerts.some((cert) => cert.typeId === type.id && certStatus(cert).ok);
    });
  }, [data.certificateTypes, gate.role, myCerts]);

  const myTasks = useMemo(() => {
    if (!gate.role) return [];
    return data.tasks.filter((task) => {
      const requiredType = data.typeById.get(task.requiredTypeId.toString());
      return requiredType?.role === gate.role;
    });
  }, [data.tasks, data.typeById, gate.role]);

  const taskGate = useTaskGate(gate.address, myTasks.map((task) => task.id));

  useEffect(() => {
    if (gate.connected && !gate.loading) {
      if (gate.isAdmin) router.replace("/admin");
      else if (!gate.isEmployee) router.replace("/not-registered");
    }
  }, [gate.connected, gate.loading, gate.isAdmin, gate.isEmployee, router]);

  function pick(typeId: string, questionIndex: number, optionIndex: number) {
    setAnswers((current) => {
      const next = (current[typeId] ?? []).slice();
      next[questionIndex] = optionIndex;
      return { ...current, [typeId]: next };
    });
  }

  async function claim(type: CertificateTypeView) {
    if (!gate.contractAddress) return;
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
      args: [type.id, answer]
    });
    await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
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
    const hash = await write.mutateAsync({
      address: gate.contractAddress,
      abi: skillGateAbi,
      functionName: "startTask",
      args: [taskId]
    });
    await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
    await data.refetchAll();
    await taskGate.refetch();
    setMessage("Task started.");
  }

  if (!gate.configured) {
    return (
      <AppShell title="Worker console" role="Worker" connected={gate.address}>
        <section className="sec">
          <Notice>Set the SkillGate contract address and Alchemy Sepolia RPC URL before using Worker.</Notice>
        </section>
      </AppShell>
    );
  }

  if (!gate.connected) {
    return (
      <AppShell title="Worker console" role="Worker" connected={gate.address}>
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
      <AppShell title="Worker console" role={gate.roleName} connected={gate.address}>
        <section className="sec">
          <Empty>Checking wallet access.</Empty>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell title="Worker console" role={gate.roleName} connected={gate.address}>
      {message && (
        <section className="sec">
          <Notice>{message}</Notice>
        </section>
      )}

      <section className="sec">
        <div className="sechead">
          <h2>Wallet</h2>
        </div>
        <div className="row">
          <span className="mono" style={{ fontSize: 13 }} title="Connected wallet">
            {gate.address}
          </span>
          <Status on label={gate.roleName} tip="This wallet is registered to the workspace." />
        </div>
      </section>

      <section className="sec">
        <div className="sechead">
          <h2>Get certified</h2>
        </div>
        {availableTraining.length === 0 ? (
          <Empty>No training for this role right now.</Empty>
        ) : (
          availableTraining.map((type) => {
            const tid = type.id.toString();
            const quiz = QUIZZES[tid];
            const open = openQuiz === tid;
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
                    {quiz ? (
                      !open && (
                        <button className="btn sm" onClick={() => setOpenQuiz(tid)}>
                          Take quiz
                        </button>
                      )
                    ) : (
                      <button className="btn sm" onClick={() => claim(type)} disabled={write.isPending}>
                        {write.isPending ? "Submitting" : "Claim certificate"}
                      </button>
                    )}
                  </div>
                </div>
                {quiz && open && (
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
                        onClick={() => {
                          setOpenQuiz(null);
                          setMessage("");
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        className="btn sm"
                        onClick={() => claim(type)}
                        disabled={!allAnswered || write.isPending}
                      >
                        {write.isPending ? "Submitting" : "Get certificate"}
                      </button>
                    </div>
                  </div>
                )}
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
            const status = certStatus(cert);
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
              <div className="gate" key={task.id.toString()}>
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
                    {valid ? "Unlocked" : "Locked"}
                  </div>
                </div>
                {valid ? (
                  <button className="btn sm" onClick={() => startTask(task.id)} disabled={write.isPending}>
                    Start task
                  </button>
                ) : (
                  <div className="verdict">
                    <LockIcon />
                    <button className="btn sm" disabled>
                      Locked
                    </button>
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

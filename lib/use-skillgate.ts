"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { decodeEventLog, getAddress, type Address, type Hex, type Log } from "viem";
import { useConnection, useReadContract, useReadContracts } from "wagmi";
import {
  getDeployBlock,
  getSkillGateAddress,
  roleLabel,
  skillGateAbi,
  SEPOLIA_CHAIN_ID
} from "@/lib/skillgate";
import { publicClient } from "@/lib/public-client";

export type CertificateTypeView = {
  id: bigint;
  name: string;
  validityPeriod: bigint;
  role: Hex;
  issuer: Address;
  active: boolean;
  quizHash: Hex;
};

export type TaskView = {
  id: bigint;
  name: string;
  requiredTypeId: bigint;
  active: boolean;
};

export type EmployeeView = {
  address: Address;
  role: Hex;
  roleName: string;
};

export type CertificateView = {
  holder: Address;
  typeId: bigint;
  issuedAt: bigint;
  expiresAt: bigint;
  revoked: boolean;
};

export type AuditEventView = {
  name: string;
  blockNumber: bigint;
  transactionHash: Hex;
  logIndex: number;
  meta: string;
};

const contractAddress = getSkillGateAddress();
const enabled = Boolean(contractAddress);

export function useWalletGate() {
  const connection = useConnection();
  const address = connection.address ? getAddress(connection.address) : undefined;

  const ownerRead = useReadContract({
    address: contractAddress,
    abi: skillGateAbi,
    chainId: SEPOLIA_CHAIN_ID as typeof SEPOLIA_CHAIN_ID,
    functionName: "owner",
    query: { enabled, refetchInterval: 12_000, retry: 1 }
  });

  const employeeRead = useReadContract({
    address: contractAddress,
    abi: skillGateAbi,
    chainId: SEPOLIA_CHAIN_ID as typeof SEPOLIA_CHAIN_ID,
    functionName: "isEmployee",
    args: address ? [address] : undefined,
    query: { enabled: enabled && Boolean(address), refetchInterval: 12_000, retry: 1 }
  });

  const roleRead = useReadContract({
    address: contractAddress,
    abi: skillGateAbi,
    chainId: SEPOLIA_CHAIN_ID as typeof SEPOLIA_CHAIN_ID,
    functionName: "employeeRole",
    args: address ? [address] : undefined,
    query: { enabled: enabled && Boolean(address), refetchInterval: 12_000, retry: 1 }
  });

  const owner = ownerRead.data ? getAddress(ownerRead.data) : undefined;
  const isAdmin = Boolean(address && owner && getAddress(address) === owner);
  const isEmployee = Boolean(employeeRead.data);
  const role = roleRead.data as Hex | undefined;
  const connected = connection.status === "connected";
  const onSepolia = connected && connection.chainId === SEPOLIA_CHAIN_ID;
  const error = Boolean(ownerRead.error || (connected && (employeeRead.error || roleRead.error)));

  return {
    address,
    contractAddress,
    configured: enabled,
    connected,
    connectionStatus: connection.status,
    chainId: connection.chainId,
    onSepolia,
    owner,
    error,
    isAdmin,
    isEmployee,
    role,
    roleName: isAdmin ? "Admin" : roleLabel(role),
    loading: ownerRead.isLoading || employeeRead.isLoading || roleRead.isLoading,
    refetch: async () => {
      await Promise.all([ownerRead.refetch(), employeeRead.refetch(), roleRead.refetch()]);
    }
  };
}

export function useSkillGateData() {
  const baseRead = useReadContracts({
    contracts: [
      { address: contractAddress, abi: skillGateAbi, chainId: SEPOLIA_CHAIN_ID, functionName: "certificateTypeCount" },
      { address: contractAddress, abi: skillGateAbi, chainId: SEPOLIA_CHAIN_ID, functionName: "taskCount" },
      { address: contractAddress, abi: skillGateAbi, chainId: SEPOLIA_CHAIN_ID, functionName: "getEmployees" },
      { address: contractAddress, abi: skillGateAbi, chainId: SEPOLIA_CHAIN_ID, functionName: "getIssuedCertificateRefs" }
    ],
    query: { enabled, refetchInterval: 12_000, retry: 1 }
  });

  const typeCount = (baseRead.data?.[0]?.result as bigint | undefined) ?? 0n;
  const taskCount = (baseRead.data?.[1]?.result as bigint | undefined) ?? 0n;
  const employeeAddresses = useMemo(
    () => (baseRead.data?.[2]?.result as readonly Address[] | undefined) ?? [],
    [baseRead.data]
  );
  const issuedRefs = useMemo(
    () => (baseRead.data?.[3]?.result as readonly { holder: Address; typeId: bigint }[] | undefined) ?? [],
    [baseRead.data]
  );

  const typeIds = useMemo(
    () => Array.from({ length: Number(typeCount) }, (_, index) => BigInt(index + 1)),
    [typeCount]
  );
  const taskIds = useMemo(
    () => Array.from({ length: Number(taskCount) }, (_, index) => BigInt(index + 1)),
    [taskCount]
  );

  const typesRead = useReadContracts({
    contracts: typeIds.map((id) => ({
      address: contractAddress,
      abi: skillGateAbi,
      chainId: SEPOLIA_CHAIN_ID as typeof SEPOLIA_CHAIN_ID,
      functionName: "certificateTypes",
      args: [id]
    })),
    query: { enabled: enabled && typeIds.length > 0, refetchInterval: 12_000, retry: 1 }
  });

  const tasksRead = useReadContracts({
    contracts: taskIds.map((id) => ({
      address: contractAddress,
      abi: skillGateAbi,
      chainId: SEPOLIA_CHAIN_ID as typeof SEPOLIA_CHAIN_ID,
      functionName: "tasks",
      args: [id]
    })),
    query: { enabled: enabled && taskIds.length > 0, refetchInterval: 12_000, retry: 1 }
  });

  const employeesRead = useReadContracts({
    contracts: employeeAddresses.map((employee) => ({
      address: contractAddress,
      abi: skillGateAbi,
      chainId: SEPOLIA_CHAIN_ID as typeof SEPOLIA_CHAIN_ID,
      functionName: "employeeRole",
      args: [employee]
    })),
    query: { enabled: enabled && employeeAddresses.length > 0, refetchInterval: 12_000, retry: 1 }
  });

  const certsRead = useReadContracts({
    contracts: issuedRefs.map((ref) => ({
      address: contractAddress,
      abi: skillGateAbi,
      chainId: SEPOLIA_CHAIN_ID as typeof SEPOLIA_CHAIN_ID,
      functionName: "certificates",
      args: [ref.holder, ref.typeId]
    })),
    query: { enabled: enabled && issuedRefs.length > 0, refetchInterval: 12_000, retry: 1 }
  });

  const certificateTypes = useMemo<CertificateTypeView[]>(() => {
    return typeIds.flatMap((id, index) => {
      const result = typesRead.data?.[index]?.result as
        | readonly [string, bigint, Hex, Address, boolean, Hex]
        | undefined;
      if (!result) return [];
      return [
        {
          id,
          name: result[0],
          validityPeriod: result[1],
          role: result[2],
          issuer: result[3],
          active: result[4],
          quizHash: result[5]
        }
      ];
    });
  }, [typeIds, typesRead.data]);

  const tasks = useMemo<TaskView[]>(() => {
    return taskIds.flatMap((id, index) => {
      const result = tasksRead.data?.[index]?.result as readonly [string, bigint, boolean] | undefined;
      if (!result) return [];
      return [{ id, name: result[0], requiredTypeId: result[1], active: result[2] }];
    });
  }, [taskIds, tasksRead.data]);

  const employees = useMemo<EmployeeView[]>(() => {
    return employeeAddresses.map((employee, index) => {
      const role = (employeesRead.data?.[index]?.result as Hex | undefined) ?? "0x";
      return { address: getAddress(employee), role, roleName: roleLabel(role) };
    });
  }, [employeeAddresses, employeesRead.data]);

  const certificates = useMemo<CertificateView[]>(() => {
    return issuedRefs.flatMap((ref, index) => {
      const result = certsRead.data?.[index]?.result as
        | readonly [bigint, Address, bigint, bigint, boolean]
        | undefined;
      if (!result || result[2] === 0n) return [];
      return [
        {
          holder: getAddress(result[1]),
          typeId: result[0],
          issuedAt: result[2],
          expiresAt: result[3],
          revoked: result[4]
        }
      ];
    });
  }, [issuedRefs, certsRead.data]);

  const typeById = useMemo(
    () => new Map(certificateTypes.map((type) => [type.id.toString(), type])),
    [certificateTypes]
  );

  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id.toString(), task])), [tasks]);

  const refetchAll = useCallback(async () => {
    await Promise.all([
      baseRead.refetch(),
      typesRead.refetch(),
      tasksRead.refetch(),
      employeesRead.refetch(),
      certsRead.refetch()
    ]);
  }, [baseRead, typesRead, tasksRead, employeesRead, certsRead]);

  return {
    configured: enabled,
    contractAddress,
    certificateTypes,
    tasks,
    employees,
    certificates,
    typeById,
    taskById,
    loading:
      baseRead.isLoading ||
      typesRead.isLoading ||
      tasksRead.isLoading ||
      employeesRead.isLoading ||
      certsRead.isLoading,
    error: [baseRead, typesRead, tasksRead, employeesRead, certsRead].some(
      (read) => Boolean(read.error) || Boolean(read.data?.some((result) => result.status === "failure"))
    ),
    refetchAll
  };
}

export function useTaskGate(employee: Address | undefined, taskIds: bigint[]) {
  const reads = useReadContracts({
    contracts: taskIds.map((taskId) => ({
      address: contractAddress,
      abi: skillGateAbi,
      chainId: SEPOLIA_CHAIN_ID as typeof SEPOLIA_CHAIN_ID,
      functionName: "canStartTask",
      args: [employee as Address, taskId]
    })),
    query: { enabled: enabled && Boolean(employee) && taskIds.length > 0, refetchInterval: 12_000, retry: 1 }
  });

  return {
    gates: new Map(taskIds.map((id, index) => [id.toString(), Boolean(reads.data?.[index]?.result)])),
    error: Boolean(reads.error) || Boolean(reads.data?.some((result) => result.status === "failure")),
    refetch: reads.refetch
  };
}

export function usePublicEvents(typeById: Map<string, CertificateTypeView>, taskById: Map<string, TaskView>) {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!contractAddress) return;
    let cancelled = false;
    let timer: number | undefined;
    let cursor: bigint | undefined;
    let cached: Log[] = [];

    async function load() {
      setLoading(true);
      try {
        const latest = await publicClient.getBlockNumber({ cacheTime: 0 });
        const floor = latest > 99n ? latest - 99n : 0n;
        const deployed = getDeployBlock();
        const windowStart = deployed > floor ? deployed : floor;
        // Re-read two recent blocks for short reorgs; prune the visible 100-block window.
        const overlap = cursor && cursor <= latest && cursor > 1n ? cursor - 1n : windowStart;
        const from = overlap > windowStart ? overlap : windowStart;
        const fresh: Log[] = [];
        for (let start = from; start <= latest; start += 10n) {
          if (cancelled) return;
          const toBlock = start + 9n > latest ? latest : start + 9n;
          fresh.push(...await publicClient.getLogs({ address: contractAddress, fromBlock: start, toBlock }));
        }
        cached = [...cached.filter((log) => log.blockNumber !== null && log.blockNumber >= windowStart && log.blockNumber <= latest && log.blockNumber < from), ...fresh];
        cursor = latest;
        if (!cancelled) { setLogs(cached); setError(false); }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) {
          setLoading(false);
          // Schedule after completion so a slow RPC cannot overlap the next poll.
          timer = window.setTimeout(load, 12_000);
        }
      }
    }
    void load();
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, []);

  const events = useMemo<AuditEventView[]>(() => {
    return logs.flatMap((log) => {
          try {
            const event = decodeEventLog({
              abi: skillGateAbi,
              data: log.data,
              topics: log.topics
            });
            const args = event.args as Record<string, unknown>;
            let meta = "";
            if (event.eventName === "CertificateIssued" || event.eventName === "CertificateRevoked") {
              const holder = args.holder as Address;
              const typeId = args.typeId as bigint;
              meta = `${holder.slice(0, 6)}...${holder.slice(-4)} / ${
                typeById.get(typeId.toString())?.name ?? `Certificate ${typeId.toString()}`
              }`;
            } else if (event.eventName === "TaskStarted") {
              const employee = args.employee as Address;
              const taskId = args.taskId as bigint;
              meta = `${employee.slice(0, 6)}...${employee.slice(-4)} / ${
                taskById.get(taskId.toString())?.name ?? `Task ${taskId.toString()}`
              }`;
            } else if (event.eventName === "TaskCreated") {
              meta = `${args.name as string}`;
            } else if (event.eventName === "CertificateTypeCreated") {
              meta = `${args.name as string}`;
            } else if (event.eventName === "EmployeeRegistered") {
              const worker = args.worker as Address;
              meta = `${worker.slice(0, 6)}...${worker.slice(-4)} / ${roleLabel(args.role as Hex)}`;
            } else if (event.eventName === "IssuerAuthorized" || event.eventName === "IssuerRevoked") {
              const issuer = args.issuer as Address;
              meta = `${issuer.slice(0, 6)}...${issuer.slice(-4)} / ${event.eventName === "IssuerAuthorized" ? "issuer" : "issuer removed"}`;
            }
            return [
              {
                name: event.eventName,
                blockNumber: log.blockNumber ?? 0n,
                transactionHash: log.transactionHash ?? "0x",
                logIndex: log.logIndex ?? 0,
                meta
              }
            ];
          } catch {
            return [];
          }
        })
      .sort((a, b) => Number(b.blockNumber - a.blockNumber) || b.logIndex - a.logIndex);
  }, [logs, typeById, taskById]);
  return { events, loading, error };
}

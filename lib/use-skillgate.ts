"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { decodeEventLog, getAddress, type Address, type Hex } from "viem";
import { useConnection, useReadContract, useReadContracts } from "wagmi";
import {
  getDeployBlock,
  getSkillGateAddress,
  roleLabel,
  skillGateAbi
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
    functionName: "owner",
    query: { enabled }
  });

  const employeeRead = useReadContract({
    address: contractAddress,
    abi: skillGateAbi,
    functionName: "isEmployee",
    args: address ? [address] : undefined,
    query: { enabled: enabled && Boolean(address) }
  });

  const roleRead = useReadContract({
    address: contractAddress,
    abi: skillGateAbi,
    functionName: "employeeRole",
    args: address ? [address] : undefined,
    query: { enabled: enabled && Boolean(address) }
  });

  const owner = ownerRead.data ? getAddress(ownerRead.data) : undefined;
  const isAdmin = Boolean(address && owner && getAddress(address) === owner);
  const isEmployee = Boolean(employeeRead.data);
  const role = roleRead.data as Hex | undefined;

  return {
    address,
    contractAddress,
    configured: enabled,
    connected: connection.status === "connected",
    connectionStatus: connection.status,
    owner,
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
      { address: contractAddress, abi: skillGateAbi, functionName: "certificateTypeCount" },
      { address: contractAddress, abi: skillGateAbi, functionName: "taskCount" },
      { address: contractAddress, abi: skillGateAbi, functionName: "getEmployees" },
      { address: contractAddress, abi: skillGateAbi, functionName: "getIssuedCertificateRefs" }
    ],
    query: { enabled }
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
      functionName: "certificateTypes",
      args: [id]
    })),
    query: { enabled: enabled && typeIds.length > 0 }
  });

  const tasksRead = useReadContracts({
    contracts: taskIds.map((id) => ({
      address: contractAddress,
      abi: skillGateAbi,
      functionName: "tasks",
      args: [id]
    })),
    query: { enabled: enabled && taskIds.length > 0 }
  });

  const employeesRead = useReadContracts({
    contracts: employeeAddresses.map((employee) => ({
      address: contractAddress,
      abi: skillGateAbi,
      functionName: "employeeRole",
      args: [employee]
    })),
    query: { enabled: enabled && employeeAddresses.length > 0 }
  });

  const certsRead = useReadContracts({
    contracts: issuedRefs.map((ref) => ({
      address: contractAddress,
      abi: skillGateAbi,
      functionName: "certificates",
      args: [ref.holder, ref.typeId]
    })),
    query: { enabled: enabled && issuedRefs.length > 0 }
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
    refetchAll
  };
}

export function useTaskGate(employee: Address | undefined, taskIds: bigint[]) {
  const reads = useReadContracts({
    contracts: taskIds.map((taskId) => ({
      address: contractAddress,
      abi: skillGateAbi,
      functionName: "canStartTask",
      args: [employee as Address, taskId]
    })),
    query: { enabled: enabled && Boolean(employee) && taskIds.length > 0 }
  });

  return {
    gates: new Map(taskIds.map((id, index) => [id.toString(), Boolean(reads.data?.[index]?.result)])),
    refetch: reads.refetch
  };
}

export function usePublicEvents(typeById: Map<string, CertificateTypeView>, taskById: Map<string, TaskView>) {
  const [events, setEvents] = useState<AuditEventView[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function getLogs() {
      const latest = await publicClient.getBlockNumber();
      let fromBlock = getDeployBlock();
      if (fromBlock === 0n) {
        fromBlock = latest > 9n ? latest - 9n : 0n;
      }
      const logs = [];
      for (let start = fromBlock; start <= latest; start += 10n) {
        const toBlock = start + 9n > latest ? latest : start + 9n;
        logs.push(
          ...(await publicClient.getLogs({
            address: contractAddress,
            fromBlock: start,
            toBlock
          }))
        );
      }
      return logs;
    }

    async function load() {
      if (!contractAddress) return;
      setLoading(true);
      try {
        const logs = await getLogs();
        const decoded = logs.flatMap((log) => {
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
            } else if (event.eventName === "IssuerAuthorized") {
              const issuer = args.issuer as Address;
              meta = issuer;
            }
            return [
              {
                name: event.eventName,
                blockNumber: log.blockNumber ?? 0n,
                transactionHash: log.transactionHash ?? "0x",
                meta
              }
            ];
          } catch {
            return [];
          }
        });

        decoded.sort((a, b) => Number(b.blockNumber - a.blockNumber));
        if (!cancelled) setEvents(decoded);
      } catch {
        if (!cancelled) setEvents([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const id = window.setInterval(load, 12_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [typeById, taskById]);

  return { events, loading };
}

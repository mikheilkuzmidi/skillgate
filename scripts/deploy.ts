import "dotenv/config";
import hre from "hardhat";
import { getAddress, keccak256, parseGwei, toBytes } from "viem";
import { quizHashForId } from "../lib/quizzes";

const DAY = 24n * 60n * 60n;
const OPERATOR_ROLE = keccak256(toBytes("Silo forklift operator"));
const ENGINEER_ROLE = keccak256(toBytes("Blockchain engineer"));

function requireEnv(name: string): `0x${string}` {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return getAddress(value) as `0x${string}`;
}

// Optional priority fee for cheap testnet deploys (e.g. MAX_PRIORITY_FEE_GWEI=0.01); otherwise the
// RPC's suggestion is used.
const fees = process.env.MAX_PRIORITY_FEE_GWEI
  ? { maxPriorityFeePerGas: parseGwei(process.env.MAX_PRIORITY_FEE_GWEI) }
  : {};

const { viem, networkName } = await hre.network.create();
const publicClient = await viem.getPublicClient();
const [deployer] = await viem.getWalletClients();

const operator = requireEnv("OPERATOR_ADDRESS");
const engineer = requireEnv("ENGINEER_ADDRESS");

console.log(`Deploying SkillGate to ${networkName}`);
console.log(`Admin ${deployer.account.address}`);
console.log(`Operator ${operator}`);
console.log(`Engineer ${engineer}`);

const { contract: skillGate, deploymentTransaction } = await viem.sendDeploymentTransaction(
  "SkillGate",
  [deployer.account.address],
  fees
);
const deploymentReceipt = await publicClient.waitForTransactionReceipt({
  hash: deploymentTransaction.hash,
  confirmations: 1
});

// Register the demo workers.
await publicClient.waitForTransactionReceipt({
  hash: await skillGate.write.registerEmployee([operator, OPERATOR_ROLE], fees),
  confirmations: 1
});
await publicClient.waitForTransactionReceipt({
  hash: await skillGate.write.registerEmployee([engineer, ENGINEER_ROLE], fees),
  confirmations: 1
});

// Certificate types carry an on-chain quiz hash (workers self-claim by passing the quiz).
await publicClient.waitForTransactionReceipt({
  hash: await skillGate.write.createCertificateType(["Forklift Safety L2", 365n * DAY, OPERATOR_ROLE, quizHashForId("1")], fees),
  confirmations: 1
});
await publicClient.waitForTransactionReceipt({
  hash: await skillGate.write.createCertificateType(["Solidity and Ethereum", 180n * DAY, ENGINEER_ROLE, quizHashForId("2")], fees),
  confirmations: 1
});
await publicClient.waitForTransactionReceipt({
  hash: await skillGate.write.createTask(["Operate silo forklift", 1n], fees),
  confirmations: 1
});
await publicClient.waitForTransactionReceipt({
  hash: await skillGate.write.createTask(["Ship crypto payroll bridge", 2n], fees),
  confirmations: 1
});

// Seed the operator credential via the admin issuer path so one role starts unlocked
// (the engineer demonstrates the self-claim + quiz path).
await publicClient.waitForTransactionReceipt({
  hash: await skillGate.write.issueCertificate([operator, 1n], fees),
  confirmations: 1
});

// Optional handover: the deploying key gives the workspace to the real admin and keeps no rights.
const newAdmin = process.env.NEW_ADMIN_ADDRESS ? requireEnv("NEW_ADMIN_ADDRESS") : undefined;
if (newAdmin && newAdmin !== getAddress(deployer.account.address)) {
  await publicClient.waitForTransactionReceipt({
    hash: await skillGate.write.authorizeIssuer([newAdmin], fees),
    confirmations: 1
  });
  await publicClient.waitForTransactionReceipt({
    hash: await skillGate.write.revokeIssuer([deployer.account.address], fees),
    confirmations: 1
  });
  await publicClient.waitForTransactionReceipt({
    hash: await skillGate.write.transferOwnership([newAdmin], fees),
    confirmations: 1
  });
  console.log(`Admin handed over to ${newAdmin}`);
}

console.log("SkillGate deployed");
console.log(`Contract address: ${skillGate.address}`);
console.log(`Deploy block: ${deploymentReceipt.blockNumber}`);
console.log("Frontend env:");
console.log(`NEXT_PUBLIC_SKILLGATE_ADDRESS=${skillGate.address}`);
console.log(`NEXT_PUBLIC_SKILLGATE_DEPLOY_BLOCK=${deploymentReceipt.blockNumber}`);

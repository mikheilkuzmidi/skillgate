import fs from "node:fs/promises";
import hre from "hardhat";
import { keccak256, toBytes } from "viem";
import { quizHashForId } from "../lib/quizzes";

const { viem, networkName } = await hre.network.create();
if (networkName !== "localRpc") throw new Error("Use --network localRpc; this script never deploys publicly");
const client = await viem.getPublicClient();
if (await client.getChainId() !== 11155111) throw new Error("Local rehearsal chain mismatch");
const [admin, engineer, operator] = await viem.getWalletClients();
const {contract, deploymentTransaction} = await viem.sendDeploymentTransaction("SkillGate", [admin.account.address]);
const receipt = await client.waitForTransactionReceipt({hash: deploymentTransaction.hash});
const operatorRole = keccak256(toBytes("Silo forklift operator"));
const engineerRole = keccak256(toBytes("Blockchain engineer"));
for (const hash of [
  await contract.write.registerEmployee([operator.account.address, operatorRole]),
  await contract.write.registerEmployee([engineer.account.address, engineerRole]),
  await contract.write.createCertificateType(["Forklift Safety L2", 365n * 86400n, operatorRole, quizHashForId("1")]),
  await contract.write.createCertificateType(["Solidity and Ethereum", 180n * 86400n, engineerRole, quizHashForId("2")]),
  await contract.write.createTask(["Operate silo forklift", 1n]),
  await contract.write.createTask(["Ship crypto payroll bridge", 2n]),
  await contract.write.issueCertificate([operator.account.address, 1n])
]) await client.waitForTransactionReceipt({hash});
const marker = "# Generated local SkillGate validation";
try {
  const old = await fs.readFile(".env.local", "utf8");
  if (!old.startsWith(marker)) throw new Error("Preserve existing .env.local; move it before generating fixtures");
} catch (error) {
  if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
}
await fs.writeFile(".env.local", `${marker}\nNEXT_PUBLIC_LOCAL_VALIDATION=1\nNEXT_PUBLIC_ALCHEMY_SEPOLIA_RPC_URL=http://127.0.0.1:3151\nNEXT_PUBLIC_SKILLGATE_ADDRESS=${contract.address}\nNEXT_PUBLIC_SKILLGATE_DEPLOY_BLOCK=${receipt.blockNumber}\n`, {mode:0o600});
await fs.mkdir(".qa", {recursive:true});
await fs.writeFile(".qa/fixture.json", JSON.stringify({network:"local only",rpc:"http://127.0.0.1:3151",chainId:11155111,address:contract.address,admin:admin.account.address,engineer:engineer.account.address,operator:operator.account.address,deployBlock:receipt.blockNumber.toString()},null,2)+"\n");
console.log("Local fixture deployed and .env.local written; no personal keys or public transactions used.");

import { NextRequest, NextResponse } from "next/server";
import {
  createPublicClient,
  createWalletClient,
  getAddress,
  http,
  isAddress,
  verifyMessage,
  type Address
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { skillGateSepolia } from "@/lib/sepolia";
import { claimMessage, getSkillGateAddress, skillGateAbi } from "@/lib/skillgate";

function rpcUrl() {
  return process.env.SEPOLIA_RPC_URL || process.env.NEXT_PUBLIC_ALCHEMY_SEPOLIA_RPC_URL;
}

export async function POST(request: NextRequest) {
  try {
    const contractAddress = getSkillGateAddress();
    const trainerKey = process.env.TRAINER_PRIVATE_KEY as `0x${string}` | undefined;
    const rpc = rpcUrl();

    if (!contractAddress || !trainerKey || !rpc) {
      return NextResponse.json({ error: "Server issuance is not configured." }, { status: 500 });
    }

    const body = (await request.json()) as {
      address?: string;
      typeId?: string;
      signature?: `0x${string}`;
    };

    if (!body.address || !isAddress(body.address) || !body.typeId || !body.signature) {
      return NextResponse.json({ error: "Address, certificate type, and signature are required." }, { status: 400 });
    }

    const worker = getAddress(body.address) as Address;
    const typeId = BigInt(body.typeId);
    const message = claimMessage(worker, typeId);
    const signedByWorker = await verifyMessage({
      address: worker,
      message,
      signature: body.signature
    });

    if (!signedByWorker) {
      return NextResponse.json({ error: "Signature does not match this worker wallet." }, { status: 401 });
    }

    const publicClient = createPublicClient({
      chain: skillGateSepolia,
      transport: http(rpc)
    });
    const account = privateKeyToAccount(trainerKey);
    const walletClient = createWalletClient({
      account,
      chain: skillGateSepolia,
      transport: http(rpc)
    });

    const [isEmployee, workerRole, certType, issuerAllowed] = await Promise.all([
      publicClient.readContract({
        address: contractAddress,
        abi: skillGateAbi,
        functionName: "isEmployee",
        args: [worker]
      }),
      publicClient.readContract({
        address: contractAddress,
        abi: skillGateAbi,
        functionName: "employeeRole",
        args: [worker]
      }),
      publicClient.readContract({
        address: contractAddress,
        abi: skillGateAbi,
        functionName: "certificateTypes",
        args: [typeId]
      }),
      publicClient.readContract({
        address: contractAddress,
        abi: skillGateAbi,
        functionName: "isIssuer",
        args: [account.address]
      })
    ]);

    if (!issuerAllowed) {
      return NextResponse.json({ error: "Trainer wallet is not authorized as issuer." }, { status: 403 });
    }

    if (!isEmployee) {
      return NextResponse.json({ error: "This wallet is not registered for this workspace." }, { status: 403 });
    }

    if (!certType[4] || workerRole !== certType[2]) {
      return NextResponse.json({ error: "This credential does not match the worker role." }, { status: 403 });
    }

    const hash = await walletClient.writeContract({
      address: contractAddress,
      abi: skillGateAbi,
      functionName: "issueCertificate",
      args: [worker, typeId]
    });

    return NextResponse.json({ hash });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Certificate claim failed." }, { status: 500 });
  }
}

import { getAddress, isAddress, keccak256, toBytes, zeroAddress, type Address } from "viem";

export const WORKSPACE_NAME = "Granary Foods";
export const CONTRACT_NAME = "SkillGate";
export const SEPOLIA_CHAIN_ID = 11155111;

export const ROLE_LABELS = {
  operator: "Silo forklift operator",
  engineer: "Blockchain engineer",
  admin: "Admin",
  public: "Public",
  unregistered: "Not registered"
} as const;

export const OPERATOR_ROLE = keccak256(toBytes(ROLE_LABELS.operator));
export const ENGINEER_ROLE = keccak256(toBytes(ROLE_LABELS.engineer));

export const ROLE_NAMES_BY_HASH: Record<string, string> = {
  [OPERATOR_ROLE]: ROLE_LABELS.operator,
  [ENGINEER_ROLE]: ROLE_LABELS.engineer
};

export const DEFAULT_RPC_URL = "https://eth-sepolia.g.alchemy.com/v2/demo";

export function getSkillGateAddress(): Address | undefined {
  const value = process.env.NEXT_PUBLIC_SKILLGATE_ADDRESS;
  if (!value || !isAddress(value) || getAddress(value) === zeroAddress) {
    return undefined;
  }
  return getAddress(value);
}

export function getDeployBlock(): bigint {
  const raw = process.env.NEXT_PUBLIC_SKILLGATE_DEPLOY_BLOCK;
  if (!raw) {
    return 0n;
  }
  try {
    return BigInt(raw);
  } catch {
    return 0n;
  }
}

export function getRpcUrl(): string {
  return process.env.NEXT_PUBLIC_ALCHEMY_SEPOLIA_RPC_URL || DEFAULT_RPC_URL;
}

export function roleLabel(role: string | undefined): string {
  if (!role || role === "0x0000000000000000000000000000000000000000000000000000000000000000") {
    return ROLE_LABELS.unregistered;
  }
  return ROLE_NAMES_BY_HASH[role] ?? role;
}

export const skillGateAbi = [
  {
    type: "constructor",
    inputs: [{ name: "initialOwner", type: "address", internalType: "address" }],
    stateMutability: "nonpayable"
  },
  { type: "error", name: "CertificateMissing", inputs: [{ name: "holder", type: "address" }, { name: "typeId", type: "uint256" }] },
  { type: "error", name: "EmptyName", inputs: [] },
  { type: "error", name: "EmptyRole", inputs: [] },
  { type: "error", name: "GateFailed", inputs: [{ name: "employee", type: "address" }, { name: "taskId", type: "uint256" }] },
  { type: "error", name: "InvalidCertificateType", inputs: [{ name: "typeId", type: "uint256" }] },
  { type: "error", name: "InvalidTask", inputs: [{ name: "taskId", type: "uint256" }] },
  { type: "error", name: "InvalidValidityPeriod", inputs: [] },
  { type: "error", name: "NotAdmin", inputs: [{ name: "caller", type: "address" }] },
  { type: "error", name: "NotEmployee", inputs: [{ name: "worker", type: "address" }] },
  { type: "error", name: "NotIssuer", inputs: [{ name: "caller", type: "address" }] },
  { type: "error", name: "QuizFailed", inputs: [{ name: "worker", type: "address" }, { name: "typeId", type: "uint256" }] },
  { type: "error", name: "ClaimRevoked", inputs: [{ name: "worker", type: "address" }, { name: "typeId", type: "uint256" }] },
  {
    type: "error",
    name: "RoleMismatch",
    inputs: [
      { name: "worker", type: "address" },
      { name: "workerRole", type: "bytes32" },
      { name: "credentialRole", type: "bytes32" }
    ]
  },
  { type: "error", name: "ZeroAddress", inputs: [] },
  {
    type: "event",
    name: "CertificateIssued",
    inputs: [
      { name: "holder", type: "address", indexed: true },
      { name: "typeId", type: "uint256", indexed: true },
      { name: "expiresAt", type: "uint256", indexed: false }
    ],
    anonymous: false
  },
  {
    type: "event",
    name: "CertificateRevoked",
    inputs: [
      { name: "holder", type: "address", indexed: true },
      { name: "typeId", type: "uint256", indexed: true }
    ],
    anonymous: false
  },
  {
    type: "event",
    name: "CertificateTypeCreated",
    inputs: [
      { name: "typeId", type: "uint256", indexed: true },
      { name: "name", type: "string", indexed: false },
      { name: "validityPeriod", type: "uint256", indexed: false }
    ],
    anonymous: false
  },
  {
    type: "event",
    name: "EmployeeRegistered",
    inputs: [
      { name: "worker", type: "address", indexed: true },
      { name: "role", type: "bytes32", indexed: true }
    ],
    anonymous: false
  },
  {
    type: "event",
    name: "IssuerAuthorized",
    inputs: [{ name: "issuer", type: "address", indexed: true }],
    anonymous: false
  },
  {
    type: "event",
    name: "TaskCreated",
    inputs: [
      { name: "taskId", type: "uint256", indexed: true },
      { name: "name", type: "string", indexed: false },
      { name: "requiredTypeId", type: "uint256", indexed: false }
    ],
    anonymous: false
  },
  {
    type: "event",
    name: "TaskStarted",
    inputs: [
      { name: "employee", type: "address", indexed: true },
      { name: "taskId", type: "uint256", indexed: true }
    ],
    anonymous: false
  },
  {
    type: "function",
    name: "authorizeIssuer",
    inputs: [{ name: "issuer", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "canStartTask",
    inputs: [
      { name: "employee", type: "address" },
      { name: "taskId", type: "uint256" }
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "certificateTypeCount",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "certificateTypes",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "name", type: "string" },
      { name: "validityPeriod", type: "uint256" },
      { name: "role", type: "bytes32" },
      { name: "issuer", type: "address" },
      { name: "active", type: "bool" },
      { name: "quizHash", type: "bytes32" }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "certificates",
    inputs: [
      { name: "", type: "address" },
      { name: "", type: "uint256" }
    ],
    outputs: [
      { name: "typeId", type: "uint256" },
      { name: "holder", type: "address" },
      { name: "issuedAt", type: "uint256" },
      { name: "expiresAt", type: "uint256" },
      { name: "revoked", type: "bool" }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "createCertificateType",
    inputs: [
      { name: "name", type: "string" },
      { name: "validityPeriod", type: "uint256" },
      { name: "role", type: "bytes32" },
      { name: "quizHash", type: "bytes32" }
    ],
    outputs: [{ name: "typeId", type: "uint256" }],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "createTask",
    inputs: [
      { name: "name", type: "string" },
      { name: "requiredTypeId", type: "uint256" }
    ],
    outputs: [{ name: "taskId", type: "uint256" }],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "employeeRole",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "getCertificateStatus",
    inputs: [
      { name: "holder", type: "address" },
      { name: "typeId", type: "uint256" }
    ],
    outputs: [
      { name: "exists", type: "bool" },
      { name: "valid", type: "bool" },
      { name: "expired", type: "bool" },
      { name: "revoked", type: "bool" }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "getEmployees",
    inputs: [],
    outputs: [{ name: "", type: "address[]" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "getIssuedCertificateRefs",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "holder", type: "address" },
          { name: "typeId", type: "uint256" }
        ]
      }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "hasValidCertificate",
    inputs: [
      { name: "holder", type: "address" },
      { name: "typeId", type: "uint256" }
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "isEmployee",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "isIssuer",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "owner",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "registerEmployee",
    inputs: [
      { name: "worker", type: "address" },
      { name: "role", type: "bytes32" }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "issueCertificate",
    inputs: [
      { name: "holder", type: "address" },
      { name: "typeId", type: "uint256" }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "claimCertificate",
    inputs: [
      { name: "typeId", type: "uint256" },
      { name: "answer", type: "string" }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "revokeCertificate",
    inputs: [
      { name: "holder", type: "address" },
      { name: "typeId", type: "uint256" }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "startTask",
    inputs: [{ name: "taskId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "taskCount",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "tasks",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "name", type: "string" },
      { name: "requiredTypeId", type: "uint256" },
      { name: "active", type: "bool" }
    ],
    stateMutability: "view"
  }
] as const;

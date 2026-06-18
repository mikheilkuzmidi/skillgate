# SkillGate

SkillGate is a Sepolia dApp for role-scoped workforce certificates. A company deploys one contract, registers workers, defines certificate types, issues non-transferable credentials, and gates work behind valid credentials.

This project is built as an Alchemy Ethereum Bootcamp capstone-style product: Solidity contract logic, wallet-based writes, Alchemy Sepolia RPC, event-backed public reads, and a complete frontend.

## Product

- Public page at `/` verifies any worker wallet and shows recent on-chain activity read from contract events.
- Admin console at `/admin` registers workers, creates certificate types, creates gated tasks, issues certificates, and revokes certificates.
- Worker console at `/worker` lets registered workers pass a short on-chain quiz, self-claim a certificate by sending their own transaction, and start unlocked tasks.

Connecting a wallet from the public page routes you to the right console automatically based on your on-chain role (admin, worker, or not registered). The public verifier stays open to everyone. The app runs on Sepolia and prompts you to switch networks if your wallet is on another chain.

Certificates are self-claimed by the worker: the quiz answer is verified on-chain (the contract stores a keccak256 hash of the correct answers), so issuance needs no trusted server and the frontend holds no private key.

The default workspace is Granary Foods:

- Operator role: `Silo forklift operator`
- Engineer role: `Blockchain engineer`
- Operator certificate: `Forklift Safety L2`
- Engineer certificate: `Solidity and Ethereum`

## Deployed

- Network: Ethereum Sepolia
- Contract: `0x36e7F8138427f46b56F2Edd26c684D32c770D527` ([Etherscan](https://sepolia.etherscan.io/address/0x36e7F8138427f46b56F2Edd26c684D32c770D527))
- Deploy block: `11086829`
- Live demo: https://skillgate.pages.dev

## Stack

- Next.js 16, React 19, wagmi, viem
- Solidity 0.8.35, OpenZeppelin, Hardhat 3
- Alchemy Ethereum Sepolia RPC
- MetaMask injected wallet connection

## Wallets

Use three MetaMask accounts from the same wallet:

- A4: deployer, admin, issuer
- A3: engineer worker
- A5: operator worker

A4 needs enough Sepolia ETH to deploy the contract and seed the workspace. A3 and A5 each need a little Sepolia ETH to self-claim their certificate and to start tasks (both are real transactions sent from the worker's own wallet).

## Alchemy

Install and authenticate the Alchemy CLI:

```bash
pnpm dlx @alchemy/cli@latest auth login
```

List existing apps:

```bash
pnpm dlx @alchemy/cli@latest app list --all --json
```

Create the Sepolia app:

```bash
pnpm dlx @alchemy/cli@latest app create --name "SkillGate Sepolia" --networks ETH_SEPOLIA --description "SkillGate certification capstone"
```

If the CLI reports a different Sepolia network id, check the available ids:

```bash
pnpm dlx @alchemy/cli@latest app chains --json
```

Use the app's Ethereum Sepolia HTTP endpoint as:

```bash
https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_KEY
```

## Environment

Create `.env`:

```bash
cp .env.example .env
```

Set:

```bash
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_KEY
NEXT_PUBLIC_ALCHEMY_SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_KEY

SEPOLIA_PRIVATE_KEY=0xA4_PRIVATE_KEY

OPERATOR_ADDRESS=0xA5_OPERATOR_ADDRESS
ENGINEER_ADDRESS=0xA3_ENGINEER_ADDRESS

NEXT_PUBLIC_SKILLGATE_ADDRESS=0x0000000000000000000000000000000000000000
NEXT_PUBLIC_SKILLGATE_DEPLOY_BLOCK=0
```

After deployment, replace `NEXT_PUBLIC_SKILLGATE_ADDRESS` and `NEXT_PUBLIC_SKILLGATE_DEPLOY_BLOCK` with the values printed by the deploy script.

## Run

Install dependencies:

```bash
pnpm install
```

Run checks:

```bash
pnpm test
pnpm lint
pnpm build
```

Deploy to Sepolia:

```bash
pnpm deploy:sepolia
```

Start locally:

```bash
pnpm dev
```

Open the printed localhost URL.

## Deploy the demo (Cloudflare Pages)

The app is a static export (`output: "export"`), so it ships as plain files with no server and no keys in the bundle.

```bash
pnpm build                 # outputs ./out
pnpm deploy:cloudflare     # wrangler pages deploy out
```

The first deploy prompts a one-time `wrangler login` and returns a `*.pages.dev` URL (no custom domain needed). Rebuild and redeploy after changing `.env`, since `NEXT_PUBLIC_*` values are baked in at build time.

## Demo Flow

1. Connect A4 at `/` and you are routed to `/admin`; confirm the seeded certificate types, workers, tasks, and operator certificate.
2. Connect A3 at `/`; you land on `/worker`. Take the `Solidity and Ethereum` quiz, self-claim the certificate (a real transaction sent from A3), then start `Ship crypto payroll bridge`.
3. Connect A5 at `/worker` and confirm `Forklift Safety L2` already unlocks `Operate silo forklift` (seeded via the admin issuer path).
4. Open `/`, paste A4 or A3, and verify that the verifier result and activity feed reflect the live contract state.
5. Return to `/admin`, revoke a certificate, and confirm the public and worker pages show the revoked state.

## Contract Checks

The test suite covers:

- only authorized issuers can issue certificates
- role-mismatched issuance reverts
- expired certificates fail the gate
- revoked certificates fail the gate
- non-registered wallets fail the gate
- a worker with a valid certificate can start the gated task
- a worker can self-claim a certificate by passing the on-chain quiz
- a wrong quiz answer reverts the self-claim
- role-mismatched and unregistered self-claims revert

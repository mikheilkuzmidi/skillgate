# Dependency and compiler security

Next and its ESLint configuration use 16.4.3. The tested package-manager pin is PNPM 10.34.7. Frozen installation used a private store with copy imports, current public CA replacement, no lifecycle scripts, and the retained one-day publication-age policy. No global package-manager policy or shared cache was changed. The unused Alchemy SDK dependency is removed; the existing Alchemy RPC settings and Viem wallet flows remain.

Hardhat and its Viem toolbox/verification plugins use compatible fixed releases. Solidity is pinned to 0.8.38, explicitly preserving Osaka, the legacy pipeline (`viaIR=false`), and optimizer 200. The official known security-bug index lists no entries for 0.8.38 as of this review; this is not a general compiler-correctness guarantee or an assessment of deployed contracts.

Legacy Zod remains canonical 3.25.76 with the genuine licensed bounded-container backport. Modern exports use fixed official 4.6.7. The raw PNPM report retains that single version-matched advisory; the actual installed 842-file payload and runtime contracts are verified before build/compile/test. No advisory is suppressed.

Validation passed: actual 0.8.38 compiler output, all 16 existing contract tests on an explicit simulated local network, lint, route type generation, full TypeScript, six-page production static export, and the public unconnected browser view. Compiler/test process trees stayed below the measured 512-MiB budget; public compiler execution used a SHA-verified official binary through a temporary supported path override. The official test-cache override and disabled telemetry kept all tool state private. No machine-specific compiler path or test override is committed.

Contract source, deployed addresses, UI, and existing static-export architecture are retained. No wallet was connected, public transaction or contract deployment made, personal private key used, model downloaded, database/email action performed, or GitHub Actions job dispatched. [Official compiler security index](https://docs.soliditylang.org/en/latest/bugs.html).

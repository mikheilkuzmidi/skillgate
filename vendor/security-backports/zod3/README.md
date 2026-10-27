# Zod 3 security backport

This is a locally reviewed MIT security variant, not an official Zod release. It retains canonical name/version 3.25.76 and its root API. It combines official fixed 4.6.7 v4/mini/core exports with the original 3.25.76 root entrypoints and early-abort size guards backported into bounded v3 arrays, sets and fixed tuples. Unbounded schemas keep the upstream behavior.

The raw [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) match remains visible because the vendor version is unchanged. Do not suppress it or replace all Zod 3 consumers with Zod 4. Run `pnpm run security:verify-backports` after installation; the verifier checks every installed legacy package against the trusted 842-file manifest and probes both legacy and modern bound checks. Patch source, source archive integrities and license are retained in the artifact and manifest.

Archive SHA256: `5fd4001c44dc88775a5350f14a67bf75f84eb18f720b6d72e257a982bb35e1da`.

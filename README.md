# RegLedger

A reproducible evidence packet for lawyers reviewing stablecoin integrations: Federal Register publication metadata alongside the exact operational state of Ethereum USDC at one finalized block. The CRE workflow coordinates the API fetch, fixed-block contract read, block-hash recheck, normalization and content hash.

The repository root contains `project.yaml`; run all project-root commands from that directory. [Public source](https://github.com/bro789/regledger-cre) and [the free static workbench](https://bro789.github.io/regledger-cre/) let reviewers inspect the project and captured packet. This site displays the real captured example; it does not run a CRE workflow in the browser.

**Current checkpoint:** 11 tests and TypeScript type checking pass. The real SDK compilation produced a valid 2,690,738-byte WASM workflow. Public data capture, independent Python SHA-256 verification, and browser import/export/tamper rejection succeeded. The actual official CRE CLI simulation command exited with `NOT_LOGGED_IN`; its logs are in `evidence/checks/`. Nothing has been submitted to DoraHacks yet.

## What the packet preserves

- Actual document number, title, document type, publication date, source URL and official `govinfo.gov` PDF link. Proposed rules stay proposed rules.
- Ethereum chain selector, Circle-listed USDC address, finalized block number, block hash, block timestamp, `paused()` return value and observation time.
- A deterministic SHA-256 of the packet, useful for detecting changed exports during legal review.

USDC's operational state does not establish legal compliance. FederalRegister.gov is a government API but its rendition is informational; verify its linked official PDF. A local capture or single-node CRE simulation is not a DON attestation, notarization or proof of Ethereum consensus.

## Run the checks

Use Bun 1.2.21+ (tested here with 1.4.2) and the official CRE CLI (1.36.0).

```sh
cd notice-workflow
bun install --frozen-lockfile
bun test
bun run typecheck
bun run compile
```

The original core/UI code is MIT. The CRE SDK and its compiler plugin are **BUSL-1.1** with a non-production use grant; their licenses remain in the packages, and `licenses/` retains the relevant copies. The compiled workflow contains upstream components and is not presented as MIT-only. This checkpoint is a non-production hackathon prototype.

## Actual CRE simulation

Create or log into your own account at [the official CRE platform](https://app.chain.link/cre/discover), complete your email and two-factor authentication, then run `cre login`. Credentials stay in the official local credential store; do not paste them into project files or chat.

From the project root, after installing the dependencies:

```sh
cre workflow simulate notice-workflow --target staging-settings --non-interactive --trigger-index 0
```

The workflow only calls `HTTPClient.sendRequest`, `EVMClient.headerByNumber` and `EVMClient.callContract`. No private key, funded wallet, write capability or `--broadcast` is configured. The `private` registry setting does not deploy a workflow; simulation remains local. Upstream getting-started documentation contains an older blanket private-key instruction, whereas the current simulation prerequisites limit it to onchain writes. If the actual CLI still requires one, stop and record the requirement instead of inventing or requesting a real wallet key.

Use `python tools/run_check.py simulation` for a bounded run with recorded output. A successful log must contain the real CLI execution result and `REGLEDGER_DOSSIER=`. Until then, `replay.ts` is only a replay of real captured sources, not a substitute for the bounty's required CLI simulation.

`run_check.py` finds normal official `bun` and `cre` installations on `PATH`; project-local binaries are optional and are not distributed. Run `python tools/run_check.py --preflight` to check the installed tools and project-relative configuration paths without executing a workflow. Its timeout cleanup targets only the child process tree it created, on Windows or POSIX systems.

## Capture and review without a CRE account

```sh
python tools/fetch_live_sources.py
cd notice-workflow
bun replay.ts
```

`evidence/` contains captured public API responses and the replay packet. Serve `web/` with a static server and open its workbench; load the captured packet or import an export. Its browser-side SHA-256 calculation verifies integrity before rendering source rows.

## Bounty and remaining steps

[Best workflow with CRE](https://dorahacks.io/hackathon/bounty/1362) advertises two awards valued at $1,000 each. [BLI Legal Tech Hackathon 2](https://dorahacks.io/hackathon/legal-hack-2026/detail) displays a November 1, 2026, 09:01 China-time deadline. Prizes may change or be withdrawn. China eligibility and payout currency are not established by the public text inspected.

Before formal entry: complete the official CRE login and real simulation, and complete any actual required DoraHacks fields or agreements. The reviewed source and static workbench have been published on GitHub/Pages. No organizer message, competition registration/submission, CRE network deployment or transaction has been made by this project.

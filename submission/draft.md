# RegLedger — reproducible legal review evidence for stablecoin integrations

Target: BLI Legal Tech Hackathon 2 / Best workflow with CRE (two $1,000-value awards).

Submission state: **draft; not submitted; official CRE CLI simulation pending account login**.

## Vision

Help legal and integration teams preserve what a regulatory source actually published and what a token contract actually returned, without converting an API summary into a legal compliance verdict.

## Problem and solution

A stablecoin integration review can lose provenance when a dashboard merges proposed rules, final rules and current token behavior into one green compliance label. RegLedger creates a review packet that keeps these meanings separate while binding their observed content together.

One Chainlink CRE cron workflow fetches public Federal Register metadata, reads Ethereum USDC's `paused()` function at an exact finalized block, rechecks that block's hash, normalizes the sources and emits a portable SHA-256-addressed JSON dossier. A small browser workbench recalculates its hash and shows the original document IDs, types, publication dates, government links, block identity and operational status.

## Why CRE belongs in the workflow

CRE is the orchestration layer: HTTP and EVM capabilities connect the government publication source with the fixed-block contract read, and the fetch uses an identical-result aggregation strategy. This prototype needs no onchain writes or paid external APIs. Simulation runs locally on one node, so we do not claim that the exported artifact has production DON consensus or attestation.

## Evidence at this checkpoint

- Eleven provenance, schema, stale-block, spoofed-source and integrity tests pass.
- TypeScript type checking passes.
- The actual official SDK compiled the workflow into 2,690,738-byte WASM (82.469 seconds). This establishes compilation, not runtime simulation success.
- Real public capture: Federal Register documents `2026-19899` (Proposed Rule), `2026-19966` (Rule), `2026-20371` (Proposed Rule); Ethereum finalized block `26123831`, USDC `paused() = false`.
- Captured packet hash independently reproduced with Python: `18d86a0d72ba48b3aad2b0ed0b75186a586867c278f7c337e3e8292501a9048d`.
- **Actual CRE CLI simulation attempt: exited 1, `NOT_LOGGED_IN`.** Account login is pending; direct capture/replay is not presented as meeting that requirement.

## Public entry fields

- Repository: https://github.com/bro789/regledger-cre
- Demo: https://bro789.github.io/regledger-cre/
- Builder profile: https://github.com/bro789
- Logo: `assets/logo.png` — original MIT project mark, RGB PNG, 480×480; SVG source included.
- Successful simulation log and workflow output: pending actual official CLI run.
- Team, email and other identity fields: only actual authorized account information.

Original code is MIT; CRE SDK/compiler components retain BUSL-1.1 and this entry uses them as a non-production prototype. No private datasets, credentials or wallet keys belong in the submission.

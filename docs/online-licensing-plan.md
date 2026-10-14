# Licensing decisions and current implementation

> **V2 planning notice (2026-10-14):** This document records the **currently implemented legacy 1.1.0** behavior, not the approved future licensing policy. The previous release has not been commercially launched and the V2 design does **not** require protocol/data backwards compatibility. **V2 is not implemented.** Follow the [V2 specification](YARIZAN-TECHNICAL-SPEC-V2.md), [data model](YARIZAN-DATA-MODEL-V2.md), [API contracts](YARIZAN-API-CONTRACTS-V2.md), and [roadmap](YARIZAN-IMPLEMENTATION-ROADMAP-V2.md) for the planned Nuxt/NestJS/PostgreSQL offline-first platform. Current code still requires online authorization for both paid and trial; V2 paid use will be offline and V2 trial will require internet **only for session start**.

The early perpetual-offline proposal was superseded before publication. The implemented policy requires internet for paid/trial access so the official app honors removal and serial replacement. Deployment/API details: [hosting guide](../web/licensing/README.md).

## Implemented

- Shared-host PHP 8.2+/MySQL at `https://yarizan.osameh.dev`; private code/config outside public root.
- HWID/PC registration without consumption; two explicit trial entries in MySQL.
- Signed P-256 trial grants and fresh paid/trial checks binding device, nonce, mode and credential hash.
- Saved paid activation for automatic online retry/restart; no repeated serial entry after outages.
- Database current serial enforcement; regeneration replaces it.
- Removed-device blocked record prevents automatic recreation; admin issuance restores it.
- Searchable admin table, closable metadata editor, serial copy, reset/delete/regeneration and Persian calendar/digits.
- Checks before protected entry, every launch and every 60 seconds; failures stop owned games and show Lock.
- Public-only certificate-pinned FTPS CI; manual private setup/code upload.

## Decisions

Cover always appears first. OS reinstalls reuse the current serial only when HWID matches; reinstall/local deletion cannot reset server trials. Regeneration exhausts trials/revokes grants; trial reset is a separate action and preserves paid serial.

Initial setup supports idempotent schema creation with `auto_install_schema=true`; updates use schema version marker or CLI migration. Deploy compatible public/private code. FTP success and runtime readiness are separate.

## Future improvements

Device-key proof, verified customer/evaluation-code registration, admin MFA and a different game-key delivery model are not implemented. HWIDs can be spoofed; modified binaries can bypass checks/extract the game key. See [limitations](security.md#limitations).

This build has no fully offline entitlement or reliable remote revocation of older offline binaries. Do not expect old clients to enforce current panel policy.

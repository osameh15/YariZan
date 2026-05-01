# Security model

## Goals

1. A serial sold to one customer must not unlock another machine.
2. Mini‑games shipped with the launcher must not be trivially extractable as runnable `.exe` files.
3. Forging a serial must require breaking either ECDSA‑P256 or stealing the seller's private key.
4. Cracking the launcher binary alone should not be enough to unlock games for an arbitrary HWID.
5. The 2‑launch trial cannot be reset by deleting a single file or registry value.

## Honest non‑goal

> **Local Windows DRM is never absolute.** A determined attacker with admin rights on their own PC can always observe a launched mini‑game in the temp directory and copy it. The protections here defeat *casual* extraction (file managers, archive tools, hex editors), not nation‑state reverse engineers. This is the same ceiling every commercial DRM hits.

---

## Primitives

| Concern | Choice | Why |
|---------|--------|-----|
| Hardware fingerprint | SHA‑256 of (BaseBoard SN ‖ Processor ID ‖ BIOS SN ‖ Disk0 SN), versioned | Stable across reboots, unique per box, no dependency on changeable Windows installs (no MAC). |
| Serial signing | ECDSA‑P256 over `"YariZan-Serial-v1\|" + HWID` | Asymmetric → only the **public** key ships in the app. ~64 byte sigs → ~103 Base32 chars. |
| Game encryption | AES‑256‑GCM, random nonce per file | Authenticated; integrity check rejects tampering before launch. |
| Activation file key | PBKDF2‑SHA256(HWID, "YariZan‑Activation‑v1", 100k) → 32 bytes | Binds activation file to the same machine that produced the HWID. |

## File format

### Encrypted game (`games_encrypted/<grade>/g<grade>_<hash>.dat`)
```
0      4              16              32              N
+------+--------------+--------------+----------------+
| YZG1 | nonce (12 B) |  tag (16 B)  |    ciphertext  |
+------+--------------+--------------+----------------+
```

### Activation store (`%LocalAppData%\YariZan\activation.dat`)
```
0      4              16              32              N
+------+--------------+--------------+----------------+
| YZA1 | nonce (12 B) |  tag (16 B)  |    ciphertext  |
+------+--------------+--------------+----------------+
ciphertext = AES-GCM(JSON {hwid, serial})
```

### Trial store (mirrored)

Two identical encrypted blobs, written together on every increment:

| Location | Why |
|----------|-----|
| `%LocalAppData%\YariZan\trial.dat` | Primary, easy to reach for `reset-trial` |
| `HKCU\Software\YariZan\State` value `T` (`REG_BINARY`) | Survives `LocalAppData` wipes / portable‑mode tricks |

Per‑blob format:
```
0      4              16              32              N
+------+--------------+--------------+----------------+
| YZT1 | nonce (12 B) |  tag (16 B)  |    ciphertext  |
+------+--------------+--------------+----------------+
ciphertext = AES-GCM(JSON {hwid, count, firstLaunchUtc})
key       = PBKDF2(HWID, "YariZan-Trial-v1", 100k iterations)
```

**Read rule**: if both stores are present, the higher `count` wins. Deleting one mirror to "roll back" the count therefore does nothing — the surviving copy holds the line.

**HWID binding**: copying `trial.dat` from a friend's PC does nothing — the AES‑GCM authentication tag fails because the friend's HWID was used to derive their key.

## Attack scenarios

| Scenario | Outcome |
|----------|---------|
| User shares their serial with a friend | Friend's HWID won't match → ECDSA verify fails → lock screen rejects. |
| User copies their `activation.dat` to another PC | Friend's HWID won't decrypt the file (PBKDF2 key mismatch) → app behaves as if not activated. |
| User deletes `%LocalAppData%\YariZan\trial.dat` to get a fresh trial | Registry mirror at `HKCU\Software\YariZan\State` still has the latest count. App reads MAX(file, registry) → no rollback. |
| User deletes the registry value | File still holds the count. Same protection in reverse. |
| User deletes both, hoping for a fresh trial | This works — fresh state. The two‑mirror design protects against accidental wipes (e.g. cleaner tools); a deliberate user with admin rights *can* zero out both. Defeating that would require a third anchor in `HKLM` or a TPM, both of which complicate distribution. |
| User copies their pre‑trial `trial.dat` over a post‑trial one | The `count` in the file would be lower, but the registry mirror still has the higher count → MAX rule wins. |
| Attacker patches the binary to skip signature verification | They can dismiss the lock screen, but the master AES key is still needed. Today the master key is embedded in the binary, so this attack does succeed at exposing the games. **See "Known weakness" below.** |
| Attacker pulls a `.dat` and tries to run it directly | Won't run — it's encrypted ciphertext, not a PE. |
| Attacker runs a game and copies the temp `.exe` while it's running | Possible. Temp file has an ACL granting only the current user read access; admin can override. **This is the irreducible local‑DRM ceiling.** |
| Attacker steals `secrets/master.key` from the dev's machine | Total compromise of all shipped game packages. Treat `secrets/` as you would a code‑signing key. |

## Known weakness

**The master AES key is embedded in the launcher binary.** Anyone willing to reverse engineer the assembly can find it and decrypt the `*.dat` blobs offline. This is a pragmatic trade‑off: per‑customer rewrapping of the master key is possible (sign a per‑machine `key‑wrap` blob alongside the serial), but doubles operational complexity.

Mitigations available *without* changing the architecture:
- Run [ConfuserEx](https://github.com/mkaring/ConfuserEx) on the published `YariZan.exe` (string encryption + control flow + anti‑debug).
- Single‑file publish with `PublishReadyToRun=false` + `IncludeAllContentForSelfExtract=true` so the binary is self‑contained and the master key isn't sitting on disk as a managed resource of an unobfuscated DLL.
- Strip PDBs from the release output.

Mitigations that require an architectural change (deferred):
- Switch to a per‑machine wrapped master key. Seller's `sign` command would output `serial || encrypt_for(KDF(hwid), master_key)`; app would unwrap on activation.

## Operational hygiene

- `secrets/private.pem` and `secrets/master.key` are `.gitignored`. **Never commit them.** If they leak, regenerate (which invalidates every existing serial and game pack).
- Keep an offline backup of `secrets/`. Without `private.pem` you cannot issue new serials. Without `master.key` you cannot rebuild the encrypted bundle (you'd have to re‑encrypt all games against a new key and re‑ship).
- Mark `private.pem` and `master.key` read‑only on disk (the `init` command does this automatically).

## What I deliberately did *not* add

- Online activation server — adds a runtime dependency that hurts UX and creates a service to maintain. Local HWID‑bound serials cover the threat model the user described.
- Time‑limited / floating licenses — out of scope.
- Anti‑VM / anti‑sandbox detection — false‑positive risk on legitimate users.

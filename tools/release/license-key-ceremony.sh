#!/usr/bin/env bash
# Production license-signing key ceremony (G1 signing custody). Run by the owner, interactively, in
# Git Bash on the release workstation. It needs openssl and gpg (both ship with Git for Windows).
#
#   bash tools/release/license-key-ceremony.sh --kid yarizan-license-2026-01 \
#        --backup-a /e/yarizan-key-A.gpg --backup-b /f/yarizan-key-B.gpg
#
# What it does:
#   1. Generates a new P-256 key in a private temporary directory (never in the repository).
#   2. Writes two independent encrypted backups (gpg AES-256, a strong passphrase you type twice per
#      backup; use two different storage devices kept in different places).
#   3. Restore test: decrypts each backup separately, checks that it yields the same public key, and
#      signs and verifies a test message with the restored key.
#   4. Writes only public material: secrets/v2-license-public-keys.json (embedded in the Windows build)
#      and docs/evidence/license-key-ceremony-<kid>.json (fingerprints and results, no secret).
#   5. Destroys the plaintext private key. The only remaining copies are the two encrypted backups.
# The server key file is created later on the VPS by decrypting backup A there (docs/YARIZAN-LICENSE-SIGNING-CUSTODY.md).
set -euo pipefail
umask 077
kid="" a="" b=""
while [ $# -gt 0 ]; do
  case $1 in
    --kid) kid=$2; shift 2 ;;
    --backup-a) a=$2; shift 2 ;;
    --backup-b) b=$2; shift 2 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done
[[ "$kid" =~ ^yarizan-license-[a-z0-9-]{1,40}$ ]] || { echo "--kid must match yarizan-license-<name>" >&2; exit 2; }
if [[ "$kid" =~ test|fixture|disposable|development|demo ]]; then echo "a production kid cannot contain test words" >&2; exit 2; fi
[ -n "$a" ] && [ -n "$b" ] || { echo "--backup-a and --backup-b are required" >&2; exit 2; }
[ "$(dirname "$(realpath -m "$a")")" != "$(dirname "$(realpath -m "$b")")" ] || { echo "the two backups must be on different storage" >&2; exit 2; }
for f in "$a" "$b"; do [ ! -e "$f" ] || { echo "refusing to overwrite $f" >&2; exit 2; }; done
repo=$(cd "$(dirname "$0")/../.." && pwd)
roots=$repo/secrets/v2-license-public-keys.json
record=$repo/docs/evidence/license-key-ceremony-$kid.json
[ ! -e "$roots" ] || { echo "refusing to overwrite $roots (a root already exists; rotation is a separate procedure)" >&2; exit 2; }

work=$(mktemp -d)
cleanup() {
  # Overwrite then remove every plaintext file.
  find "$work" -type f -exec sh -c 'dd if=/dev/urandom of="$1" bs=1k count=4 conv=notrunc status=none 2>/dev/null; rm -f "$1"' _ {} \;
  rm -rf "$work"
}
trap cleanup EXIT

fingerprint() { openssl pkey -in "$1" -pubout -outform DER 2>/dev/null | openssl dgst -sha256 -r | cut -c1-64 | tr a-f A-F; }
sign_verify() { # sign_verify KEY PUBLIC
  printf 'YariZan-Key-Ceremony-Check\n%s\n' "$kid" > "$work/msg"
  openssl dgst -sha256 -sign "$1" -out "$work/sig" "$work/msg" &&
    openssl dgst -sha256 -verify "$2" -signature "$work/sig" "$work/msg" >/dev/null
}

echo "== 1/4 generating a new P-256 key"
openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-256 -out "$work/key.pem"
openssl pkey -in "$work/key.pem" -pubout -out "$work/public.pem"
fp=$(fingerprint "$work/key.pem")
echo "public fingerprint $fp"

echo "== 2/4 encrypted backups (you will be asked for a passphrase for each)"
for f in "$a" "$b"; do
  gpg --batch=false --symmetric --cipher-algo AES256 --s2k-digest-algo SHA512 --s2k-mode 3 --s2k-count 65011712 \
      --no-symkey-cache --output "$f" "$work/key.pem"
done

echo "== 3/4 restore test (decrypt each backup independently)"
results=()
for f in "$a" "$b"; do
  gpg --no-symkey-cache --quiet --decrypt --output "$work/restored.pem" "$f"
  [ "$(fingerprint "$work/restored.pem")" = "$fp" ] || { echo "restore test FAILED for $f" >&2; exit 1; }
  sign_verify "$work/restored.pem" "$work/public.pem" || { echo "sign/verify FAILED for $f" >&2; exit 1; }
  results+=("$(sha256sum "$f" | cut -c1-64)")
  rm -f "$work/restored.pem"
  echo "restore test passed: $(basename "$f")"
done

echo "== 4/4 public outputs"
mkdir -p "$repo/secrets" "$repo/docs/evidence"
! grep -q PRIVATE "$work/public.pem" || { echo "public output contains private material" >&2; exit 1; }
# JSON with the PEM's line breaks escaped as \n (the PEM alphabet needs no other escaping).
printf '{\n  "%s": "%s"\n}\n' "$kid" "$(awk '{printf "%s\\n", $0}' "$work/public.pem")" > "$roots"
cat > "$record" <<EOF
{
  "kind": "yarizan-license-key-ceremony",
  "kid": "$kid",
  "algorithm": "ECDSA P-256 (ES256, IEEE P1363 signatures)",
  "public_key_sha256": "$fp",
  "generated_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "backups": [
    { "label": "A", "encryption": "gpg symmetric AES-256, S2K SHA-512", "file_sha256": "${results[0]}", "restore_test": "passed" },
    { "label": "B", "encryption": "gpg symmetric AES-256, S2K SHA-512", "file_sha256": "${results[1]}", "restore_test": "passed" }
  ],
  "plaintext_private_key_remaining": false
}
EOF
cat <<EOF

Done. No plaintext private key remains on this workstation.
  Public root:        $roots   (git-ignored; embedded in the Windows build)
  Ceremony record:    $record  (commit it; it holds no secret)
  Approval entry for release/v2-approved-public-roots.json (reviewed PR):
    "$kid": "$fp"
  Backend settings (server api.env, no secret):
    LICENSE_SIGNING_KID=$kid
    LICENSE_SIGNING_KEY_SHA256=$fp
    LICENSE_SIGNING_KEY_FILE=/run/secrets/yarizan-license-signing.pem
Store backup A and backup B on separate devices in separate places, and the passphrase separately.
EOF

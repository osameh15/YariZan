#!/usr/bin/env bash
# Self-test for license-key-ceremony.sh in a throwaway copy: a test passphrase is supplied through a
# gpg wrapper (the real ceremony prompts). Proves both backups restore to the same key, the public
# outputs hold no private material, refusals work, and no plaintext key is left behind.
set -euo pipefail
src=$(cd "$(dirname "$0")" && pwd)/license-key-ceremony.sh
t=$(mktemp -d); trap 'rm -rf "$t"' EXIT
mkdir -p "$t/repo/tools/release" "$t/bin" "$t/a" "$t/b" "$t/gh"; chmod 700 "$t/gh" 2>/dev/null || true
cp "$src" "$t/repo/tools/release/"
echo "synthetic-ceremony-test" > "$t/pass"
real=$(command -v gpg)
printf '#!/bin/sh\nexec %s --homedir %s/gh --batch --pinentry-mode loopback --passphrase-file %s/pass "$@"\n' "$real" "$t" "$t" > "$t/bin/gpg"
chmod +x "$t/bin/gpg"
run() { (cd "$t/repo" && PATH="$t/bin:$PATH" bash tools/release/license-key-ceremony.sh "$@"); }
pass=0; ok() { pass=$((pass+1)); echo "PASS $*"; }
run --kid yarizan-license-ci-check --backup-a "$t/a/k.gpg" --backup-b "$t/b/k.gpg" > "$t/out" 2>&1
grep -c "restore test passed" "$t/out" | grep -qx 2 && ok "both backups restore and sign/verify"
rec=$t/repo/docs/evidence/license-key-ceremony-yarizan-license-ci-check.json
fp=$(sed -nE 's/.*"public_key_sha256": "([^"]+)".*/\1/p' "$rec")
# The public root must be valid JSON whose PEM yields the same fingerprint as the record.
node -e '
const [file, kid] = process.argv.slice(1);
const pem = JSON.parse(require("fs").readFileSync(file, "utf8"))[kid];
const c = require("crypto");
const fp = c.createHash("sha256").update(c.createPublicKey(pem).export({ type: "spki", format: "der" })).digest("hex").toUpperCase();
process.stdout.write(fp);' "$t/repo/secrets/v2-license-public-keys.json" yarizan-license-ci-check > "$t/rootfp"
[ "$(cat "$t/rootfp")" = "$fp" ] && ok "public root JSON parses and matches the recorded fingerprint"
[[ "$fp" =~ ^[0-9A-F]{64}$ ]] && ok "record carries the uppercase SPKI SHA-256"
! grep -q PRIVATE "$t/repo/secrets/v2-license-public-keys.json" && ! grep -q PRIVATE "$rec" && ok "public outputs hold no private key"
! find "$t/repo" -name '*.pem' | grep -q . && ok "no plaintext key file left"
for args in "--kid yarizan-license-development --backup-a $t/a/x --backup-b $t/b/x" \
            "--kid other-name --backup-a $t/a/x --backup-b $t/b/x" \
            "--kid yarizan-license-ok --backup-a $t/a/x --backup-b $t/a/y" \
            "--kid yarizan-license-ok2 --backup-a $t/a/k.gpg --backup-b $t/b/z"; do
  # shellcheck disable=SC2086
  if run $args >/dev/null 2>&1; then echo "FAIL accepted: $args"; exit 1; fi
done
ok "refuses test kids, bad names, same-device backups and overwrites"
echo "RESULT $pass passed"

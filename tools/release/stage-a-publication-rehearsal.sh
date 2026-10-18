#!/usr/bin/env bash
# Rehearses the Stage A publication sequence of .github/workflows/release-images.yml without GHCR:
#   build+push to a disposable candidate registry -> Trivy scan of that digest -> policy gate ->
#   OCI archive -> copy with preserved digests to a second disposable registry standing in for
#   GHCR -> digest equality -> local manifest validation.
# It also proves that a synthetic HIGH or CRITICAL scan stops the sequence before publication.
# Usage: tools/release/stage-a-publication-rehearsal.sh <evidence-dir>
# Needs docker with buildx. SKOPEO_IMAGE runs skopeo in a container when it is not installed.
set -euo pipefail
out=${1:?evidence directory}
mkdir -p "$out"
out=$(cd "$out" && pwd)
# Git Bash on Windows: use a C:/ path that bash, node and docker all accept.
if command -v cygpath >/dev/null 2>&1; then out=$(cygpath -m "$out"); fi
id=$(date +%s)-$$
candidate_port=5001
publish_port=5000
names=("yz-sa-candidate-$id" "yz-sa-publish-$id")
builder="yz-sa-builder-$id"
REGISTRY_IMAGE='registry:2@sha256:a3d8aaa63ed8681a604f1dea0aa03f100d5895b6a58ace528858a7b332415373'
TRIVY_IMAGE=${TRIVY_IMAGE:-aquasec/trivy:0.76.0@sha256:2416d1f74045b57274df1a340eee6b510cacd73c66a6ccb8da092b117eb7d222}
SKOPEO_IMAGE=${SKOPEO_IMAGE:-quay.io/skopeo/stable:v1.20.0}
cleanup() {
  # Remove only what this rehearsal created.
  docker rm -f "${names[@]}" >/dev/null 2>&1 || true
  docker buildx rm "$builder" >/dev/null 2>&1 || true
}
trap cleanup EXIT
# Docker on Windows (Git Bash) needs native paths for files and bind mounts.
native() { if command -v cygpath >/dev/null 2>&1; then cygpath -w "$1"; else echo "$1"; fi; }
skopeo_run() {
  if command -v skopeo >/dev/null 2>&1; then
    (cd "$out" && skopeo "$@")
  else
    docker run --rm --network host -v "$(native "$out"):/work" -w /work "$SKOPEO_IMAGE" "$@"
  fi
}
digest_of() { skopeo_run inspect --raw --tls-verify=false "docker://$1" | sha256sum | cut -d' ' -f1; }

docker run -d --name "${names[0]}" -p "127.0.0.1:$candidate_port:5000" "$REGISTRY_IMAGE" >/dev/null
docker run -d --name "${names[1]}" -p "127.0.0.1:$publish_port:5000" "$REGISTRY_IMAGE" >/dev/null
docker buildx create --name "$builder" --driver docker-container --driver-opt network=host >/dev/null

commit=$(git rev-parse HEAD)
tag="brochure-${commit:0:12}"
candidate="localhost:$candidate_port/yarizan-web"
docker buildx build --builder "$builder" -f apps/web/Dockerfile \
  --build-arg YARIZAN_BUILD_PROFILE=brochure --build-arg SOURCE_COMMIT="$commit" \
  --provenance mode=max --sbom true --push -t "$candidate:$tag" \
  --metadata-file "$(native "$out/build-metadata.json")" . > "$out/build.log" 2>&1 || { tail -30 "$out/build.log"; exit 1; }
digest=$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'))['containerimage.digest'])" "$out/build-metadata.json")
[[ "$digest" =~ ^sha256:[0-9a-f]{64}$ ]]
echo "Candidate built and pushed only to the disposable candidate registry: $digest"

docker run --rm --network host -e TRIVY_INSECURE=true "$TRIVY_IMAGE" image --quiet --scanners vuln \
  --format json --platform linux/amd64 "$candidate@$digest" > "$out/trivy.json"
node tools/release/check-scan.mjs "$out/trivy.json" "$candidate@$digest" "$out/scan-summary.json"

# Negative gates: the same report with one synthetic HIGH or CRITICAL finding must stop publication.
for severity in HIGH CRITICAL; do
  node -e "const f=require('fs'),r=JSON.parse(f.readFileSync(process.argv[1],'utf8'));r.Results=r.Results||[];
    (r.Results[0]??=({Target:'synthetic'})).Vulnerabilities=[...(r.Results[0].Vulnerabilities||[]),
    {VulnerabilityID:'SYNTHETIC-$severity',PkgName:'synthetic',Severity:'$severity'}];
    f.writeFileSync(process.argv[2],JSON.stringify(r))" "$out/trivy.json" "$out/trivy-synthetic-$severity.json"
  if node tools/release/check-scan.mjs "$out/trivy-synthetic-$severity.json" "$candidate@$digest" \
    "$out/scan-summary-synthetic-$severity.json" >/dev/null 2>&1; then
    echo "Synthetic $severity finding was not rejected"; exit 1
  fi
  echo "Synthetic $severity finding rejected before publication"
done
catalog=$(curl -fsS "http://127.0.0.1:$publish_port/v2/_catalog")
[[ "$catalog" == '{"repositories":[]}' ]] || { echo "Publication registry is not empty: $catalog"; exit 1; }
echo "Publication registry still empty after the rejected scans"

skopeo_run copy --all --preserve-digests --src-tls-verify=false "docker://$candidate@$digest" \
  "oci-archive:candidate.oci.tar" >/dev/null
skopeo_run copy --all --preserve-digests --dest-tls-verify=false "oci-archive:candidate.oci.tar" \
  "docker://localhost:$publish_port/yarizan-web:$tag" >/dev/null
published="sha256:$(digest_of "localhost:$publish_port/yarizan-web:$tag")"
[[ "$published" == "$digest" ]] || { echo "Published $published differs from scanned $digest"; exit 1; }
echo "Published digest equals the scanned candidate digest: $published"

node -e "
const f=require('fs'),s=JSON.parse(f.readFileSync(process.argv[1],'utf8'));
const [digest,tag,commit,out]=process.argv.slice(2);
const migrations=Number(f.readFileSync('backend/src/database/schema-version.ts','utf8').match(/SCHEMA_MIGRATION_COUNT = (\d+)/)[1]);
f.writeFileSync(out,JSON.stringify({schema:'yarizan-release-manifest/v1',release_scope:'stage-a-brochure',
 source_commit:commit,ci_run_url:'local-rehearsal',built_at:new Date().toISOString().replace(/\.\d+Z$/,'Z'),
 migrations,environment_changes:[],route_changes:[],images:[{name:'yarizan-web',profile:'brochure',tag,digest,
 reference:'localhost:5000/yarizan-web@'+digest,eligibility:'stage-a-brochure-candidate',
 scan:{tool:'trivy 0.76.0',policy:s.policy,artifact_digest:digest,critical:s.critical,high:s.high,medium:s.medium,low:s.low}}]},null,2)+'\n');
" "$out/scan-summary.json" "$digest" "$tag" "$commit" "$out/stage-a-manifest.json"
node tools/release/validate-manifest.mjs "$out/stage-a-manifest.json" --local
rm -f "$out/candidate.oci.tar"
echo "Stage A publication rehearsal passed"

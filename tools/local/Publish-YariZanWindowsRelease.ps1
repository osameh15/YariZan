<#
.SYNOPSIS
  Uploads an approved, locally built Windows installer straight from this workstation to the OAR NOVA
  VPS and prepares its publication with the server's reviewed yarizan-release-publish.sh.

.DESCRIPTION
  The private game payload never passes through CI, GitHub Actions, GHCR or any third-party host.

  Stage 'upload' (default):
    1. Accepts only Grade 1 / version 2.0.0 for this first V2 release, with the exact file name
       YariZan-G1-Setup-v2.0.0.exe.
    2. Checks the installer metadata (tools/release/Test-WindowsBinary.ps1) and a valid Authenticode
       signature, and refuses an unsigned or invalid installer.
    3. Reads the approval record (-Approval) and refuses unless it names this exact SHA-256 and size
       and records signature, malware scan and physical acceptance W1-W14 as passed.
    4. Uploads with scp to a private staging directory as a .part file. SSH verifies the server's host
       key against known_hosts (StrictHostKeyChecking=yes) and uses your normal ~/.ssh/config.
    5. Recomputes SHA-256 and size on the server, then renames the .part file only when both match.
    6. Prints the exact privileged publish command for the owner (sudo is a permission boundary) and
       the rollback command, and writes a sanitized release record next to the installer.
  Stage 'verify': after the owner ran the publish command, checks the public URLs through the CDN:
    GET, HEAD, Range, Content-Length, Content-Disposition, the latest redirect and the full SHA-256.

.EXAMPLE
  .\tools\local\Publish-YariZanWindowsRelease.ps1 -Installer publish\YariZan-G1-Setup-v2.0.0.exe `
     -Grade 1 -ReleaseVersion 2.0.0 -Approval docs\evidence\windows-release-G1-2.0.0.json
  .\tools\local\Publish-YariZanWindowsRelease.ps1 -Stage verify -Installer publish\YariZan-G1-Setup-v2.0.0.exe -Grade 1 -ReleaseVersion 2.0.0
#>
param(
  [Parameter(Mandatory)][string]$Installer,
  [Parameter(Mandatory)][int]$Grade,
  # Not "-Version": powershell.exe would treat that as its own engine-version switch.
  [Parameter(Mandatory)][string]$ReleaseVersion,
  [string]$Approval,
  [ValidateSet('upload', 'verify')][string]$Stage = 'upload',
  [string]$SshTarget = 'oarnova@82.115.18.101',
  [string]$SshKey = (Join-Path $HOME '.ssh\oarnova_laptop_ed25519'),
  [string]$PublicBase = 'https://yarizan.oarnova.games'
)
$ErrorActionPreference = 'Stop'
$repo = Resolve-Path (Join-Path $PSScriptRoot '..\..')
function Fail($m) { Write-Host "[REFUSED] $m"; exit 1 }

# First V2 release: exactly Grade 1, version 2.0.0, exact file name.
if ($Grade -ne 1 -or $ReleaseVersion -ne '2.0.0') { Fail 'This first V2 release accepts only -Grade 1 -ReleaseVersion 2.0.0.' }
$file = Get-Item -LiteralPath $Installer
$name = "YariZan-G$Grade-Setup-v$ReleaseVersion.exe"
if ($file.Name -ne $name) { Fail "The installer must be named $name." }
$sha = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
$size = $file.Length
$versionUrl = "$PublicBase/downloads/windows/grade-$Grade/$ReleaseVersion/$name"
$latestUrl = "$PublicBase/downloads/windows/grade-$Grade/latest"

if ($Stage -eq 'verify') {
  $problems = @()
  $head = & curl.exe -sS -I --noproxy '*' -m 60 $versionUrl
  if (-not ($head -match '^HTTP/\S+ 200')) { $problems += "HEAD $versionUrl did not answer 200" }
  if (-not ($head -match "(?i)^content-length: $size\s*$")) { $problems += "Content-Length is not $size" }
  if (-not ($head -match '(?i)^content-disposition: attachment')) { $problems += 'Content-Disposition is not attachment' }
  if (-not ($head -match '(?i)^accept-ranges: bytes')) { $problems += 'Range is not advertised' }
  $range = & curl.exe -sS --noproxy '*' -m 60 -r 0-1023 -o NUL -w '%{http_code} %{size_download}' $versionUrl
  if ($range -ne '206 1024') { $problems += "Range request answered '$range' instead of '206 1024'" }
  $latest = & curl.exe -sS -I --noproxy '*' -m 60 $latestUrl
  if (-not ($latest -match "(?i)^location: \S*/downloads/windows/grade-$Grade/$ReleaseVersion/$([regex]::Escape($name))\s*$")) { $problems += 'latest does not point to this version' }
  $tmp = Join-Path ([IO.Path]::GetTempPath()) ("yz-verify-" + [Guid]::NewGuid().ToString('N'))
  & curl.exe -sS --noproxy '*' -m 3600 -o $tmp $versionUrl
  $got = if (Test-Path $tmp) { (Get-FileHash -LiteralPath $tmp -Algorithm SHA256).Hash.ToLowerInvariant() } else { 'none' }
  Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
  if ($got -ne $sha) { $problems += "downloaded SHA-256 $got differs from $sha" }
  if ($problems) { $problems | ForEach-Object { Write-Host "[FAIL] $_" }; exit 1 }
  Write-Host "[OK] $versionUrl serves $size bytes, SHA-256 $sha; Range and latest verified."
  exit 0
}

# Release checks: version metadata, Authenticode, approval evidence.
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $repo 'tools\release\Test-WindowsBinary.ps1') -Path $file.FullName -Version $ReleaseVersion -Kind installer
if ($LASTEXITCODE -ne 0) { Fail 'Installer metadata check failed.' }
$sig = Get-AuthenticodeSignature -LiteralPath $file.FullName
if ($sig.Status -ne 'Valid') { Fail "Authenticode signature is '$($sig.Status)'. An unsigned installer is never published." }
if (-not $Approval) { Fail '-Approval (the release approval record) is required.' }
$a = Get-Content -LiteralPath $Approval -Raw -Encoding UTF8 | ConvertFrom-Json
$checks = [ordered]@{
  grade = ($a.grade -eq $Grade); version = ($a.version -eq $ReleaseVersion); file = ($a.file -eq $name)
  sha256 = ($a.sha256 -eq $sha); size = ([int64]$a.size -eq $size)
  signature = ($a.signature -eq 'valid'); malware_scan = ($a.malware_scan -eq 'clean')
  physical_acceptance = ($a.physical_acceptance -eq 'W1-W14 passed'); owner_approved = ($a.owner_approved -eq $true)
}
$bad = @($checks.Keys | Where-Object { -not $checks[$_] })
if ($bad) { Fail "Approval record does not match or is incomplete: $($bad -join ', ')" }

# Upload: host key verified, private staging, .part until the server digest matches.
$ssh = @('-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', '-o', 'ConnectTimeout=20', '-i', $SshKey)
$stage = 'yarizan-release-staging'
& ssh.exe @ssh $SshTarget "umask 077; mkdir -p ~/$stage && chmod 700 ~/$stage"
if ($LASTEXITCODE -ne 0) { Fail 'Could not prepare the private staging directory (check SSH, host key and network).' }
& scp.exe @ssh $file.FullName "${SshTarget}:$stage/$name.part"
if ($LASTEXITCODE -ne 0) { Fail 'Upload failed; nothing was published.' }
$remote = ("$(& ssh.exe @ssh $SshTarget "sha256sum ~/$stage/$name.part | cut -c1-64; stat -c %s ~/$stage/$name.part")").Trim() -split '\s+'
if ($remote[0] -ne $sha -or [int64]$remote[1] -ne $size) {
  & ssh.exe @ssh $SshTarget "rm -f ~/$stage/$name.part"
  Fail "Server copy mismatch (sha $($remote[0]), size $($remote[1])); removed it. Nothing was published."
}
& ssh.exe @ssh $SshTarget "mv -f ~/$stage/$name.part ~/$stage/$name && chmod 400 ~/$stage/$name"
$remoteHome = ("$(& ssh.exe @ssh $SshTarget 'printf %s "$HOME"')").Trim()

$record = [ordered]@{
  kind = 'yarizan-windows-release'; grade = $Grade; version = $ReleaseVersion; file = $name; sha256 = $sha; size = $size
  signature = [ordered]@{ status = "$($sig.Status)"; signer = $sig.SignerCertificate.Subject; thumbprint = $sig.SignerCertificate.Thumbprint }
  source_commit = (git -C $repo rev-parse HEAD).Trim(); uploaded_at = (Get-Date).ToUniversalTime().ToString('o')
  staged = "$remoteHome/$stage/$name"; version_url = $versionUrl; latest_url = $latestUrl
}
$out = "$($file.FullName).release.json"
$record | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $out -Encoding utf8
$publish = '/opt/oarnova/infrastructure/apps/yarizan/host/yarizan-release-publish.sh'
Write-Host "[OK] Uploaded and verified on the server: $name ($size bytes, SHA-256 $sha)."
Write-Host "Release record: $out"
Write-Host ''
Write-Host 'Owner step on the VPS (privileged; uses the reviewed infrastructure script):'
Write-Host "  sudo bash $publish publish --grade $Grade --version $ReleaseVersion --file $remoteHome/$stage/$name --sha256 $sha"
Write-Host 'Then verify from here:'
Write-Host "  .\tools\local\Publish-YariZanWindowsRelease.ps1 -Stage verify -Installer `"$($file.FullName)`" -Grade $Grade -ReleaseVersion $ReleaseVersion"
Write-Host 'Rollback (returns latest to the previous release):'
Write-Host "  sudo bash $publish rollback --grade $Grade"

<#
.SYNOPSIS
  Release check for a built Windows binary (the published app or the installer).

.DESCRIPTION
  Fails unless the file reports exactly the expected version in FileVersion and ProductVersion and,
  for the installer, has the expected file name. For the app it also fails if the binary carries the
  local acceptance API or does not carry the production API. It changes nothing.
  -Candidate checks a physical acceptance candidate instead: version <Version>-acceptance-candidate and
  the candidate file name. Without it, a candidate is refused, so it can never pass as a release.
#>
param(
  [Parameter(Mandatory)][string]$Path,
  [Parameter(Mandatory)][ValidatePattern('^\d+\.\d+\.\d+$')][string]$Version,
  [Parameter(Mandatory)][ValidateSet('app', 'installer')][string]$Kind,
  [switch]$Candidate
)
$ErrorActionPreference = 'Stop'
$file = Get-Item -LiteralPath $Path
$info = $file.VersionInfo
$problems = @()
if ($info.FileVersion -notin @($Version, "$Version.0")) { $problems += "FileVersion '$($info.FileVersion)' is not $Version" }
$suffix = if ($Candidate) { '-acceptance-candidate' } else { '' }
$product = ($info.ProductVersion -split '\+')[0]
if ($Candidate) { if ($product -ne "$Version$suffix") { $problems += "ProductVersion '$($info.ProductVersion)' is not $Version$suffix" } }
elseif ($product -notin @($Version, "$Version.0")) { $problems += "ProductVersion '$($info.ProductVersion)' is not $Version" }
if ($Kind -eq 'installer') {
  if ($file.Name -notmatch "^YariZan-G[1-6]-Setup-v$([regex]::Escape($Version + $suffix))\.exe$") { $problems += "unexpected installer name $($file.Name)" }
} else {
  # .NET string literals are UTF-16 in the binary; check both byte alignments.
  $bytes = [IO.File]::ReadAllBytes($file.FullName)
  $text = [Text.Encoding]::Unicode.GetString($bytes) + [Text.Encoding]::Unicode.GetString($bytes, 1, $bytes.Length - 1)
  if ($text.Contains('127.0.0.1:3100/api/v2/')) { $problems += 'carries the local acceptance API' }
  if ($text.Contains('LOCAL ACCEPTANCE BUILD')) { $problems += 'carries the local acceptance marker' }
  if (-not $text.Contains('https://yarizan.oarnova.games/api/v2/')) { $problems += 'does not carry the production API' }
  if (-not $Candidate -and $text.Contains('ACCEPTANCE CANDIDATE')) { $problems += 'is an acceptance candidate, not a release' }
}
if ($problems) { $problems | ForEach-Object { Write-Host "[FAIL] $_" }; exit 1 }
Write-Host "[OK] $($file.Name): version $Version$suffix$(if ($Kind -eq 'app') { ', production API, no local acceptance build' })"

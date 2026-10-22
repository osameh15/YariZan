<#
.SYNOPSIS
  Builds the packaged Windows launcher for workstation acceptance against the local stack.

.DESCRIPTION
  1. Exports the local API's disposable development signing root (public key only) from the running
     container into the git-ignored secrets/v2-local-acceptance-roots.json.
  2. Publishes the launcher exactly like the installer does (self-contained, single file, win-x64,
     with the private Grade 1 bundle and game key already on this machine), but with
     -p:LocalAcceptanceBuild=true instead of -p:CommercialRelease=true.

  The resulting build talks only to http://127.0.0.1:3100/api/v2/ and opens
  http://localhost:3200/connect (fixed at compile time), shows "LOCAL ACCEPTANCE BUILD" in its title,
  trusts only the disposable development root, and cannot be produced together with CommercialRelease.
  Output: publish/YariZan-G<grade>-local-acceptance/ (git-ignored). Never distribute it.
#>
param([string]$Container = 'yarizan-v2-local-api-1')
$ErrorActionPreference = 'Stop'
$repo = Resolve-Path (Join-Path $PSScriptRoot '..\..')
Push-Location $repo
try {
  $script = "const {DevelopmentKeyManager}=require('./dist/src/signing/signing.js');" +
    "const k=new DevelopmentKeyManager();process.stdout.write(JSON.stringify({[k.kid]:k.publicKey}))"
  $roots = docker exec $Container node -e $script
  if ($LASTEXITCODE -ne 0 -or -not $roots) { throw 'Could not read the local development root. Is the local stack running?' }
  $parsed = $roots | ConvertFrom-Json
  $kid = @($parsed.PSObject.Properties.Name)
  if ($kid.Count -ne 1 -or $kid[0] -notmatch '^disposable-development-') { throw 'Unexpected root: only a disposable development root is accepted.' }
  if ($parsed.($kid[0]) -match 'PRIVATE') { throw 'Refusing: the export contains private key material.' }
  [IO.File]::WriteAllText((Join-Path $repo 'secrets\v2-local-acceptance-roots.json'), $roots, [Text.UTF8Encoding]::new($false))
  Write-Host "Local development root: $($kid[0])"

  $grade = [int](Get-Content (Join-Path $repo 'games_encrypted\manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json).SelectedGrade
  if ($grade -lt 1 -or $grade -gt 6) { throw 'games_encrypted/manifest.json has no selected grade; run the packer first.' }
  $out = Join-Path $repo "publish\YariZan-G$grade-local-acceptance"
  dotnet publish src\YariZan.App\YariZan.App.csproj -c Release -r win-x64 --self-contained true `
    -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -p:PublishReadyToRun=false `
    -p:LocalAcceptanceBuild=true "-p:AssemblyTitle=YariZan G$grade (local acceptance)" `
    -p:DebugType=none -p:DebugSymbols=false -o $out
  if ($LASTEXITCODE -ne 0) { throw 'Publish failed.' }
  # Prove the published binary carries the loopback endpoints and not the production API.
  $bytes = [IO.File]::ReadAllBytes("$out\YariZan.exe")
  $text = [Text.Encoding]::Unicode.GetString($bytes, 1, $bytes.Length - 1) + [Text.Encoding]::Unicode.GetString($bytes)
  if (-not $text.Contains('127.0.0.1:3100/api/v2/') -or $text.Contains('yarizan.oarnova.games/api/v2/')) {
    throw 'The published launcher does not carry the local acceptance endpoints; it was not built correctly.'
  }
  # Leave no local-acceptance intermediates behind for later ordinary builds.
  dotnet clean src\YariZan.App\YariZan.App.csproj -c Release -r win-x64 -p:LocalAcceptanceBuild=true -v:q | Out-Null
  Write-Host "Local acceptance launcher: $out\YariZan.exe"
}
finally { Pop-Location }

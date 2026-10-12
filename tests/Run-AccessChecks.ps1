$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$testId = [Guid]::NewGuid().ToString('N')
$testDir = Join-Path ([IO.Path]::GetTempPath()) "YariZan-access-$testId"
New-Item -ItemType Directory -Path $testDir | Out-Null
foreach ($name in 'SerialCodec', 'ActivationStore', 'TrialStore', 'AccessSession', 'TrialGrant') {
    $source = Get-Content -Raw -Encoding UTF8 (Join-Path $repo "src/YariZan.Core/$name.cs")
    # Redirect state to disposable locations; use temporary keys and a fixed test HWID.
    $source = $source.Replace('Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData)', 'AppContext.BaseDirectory')
    $source = $source.Replace('Software\YariZan\State', "Software\YariZan-AccessTests\$testId")
    Set-Content -Encoding UTF8 (Join-Path $testDir "$name.cs") $source
}
Copy-Item (Join-Path $PSScriptRoot 'AccessChecks.cs') (Join-Path $testDir 'Program.cs')
Set-Content -Encoding UTF8 (Join-Path $testDir 'Checks.csproj') @'
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType><TargetFramework>net9.0-windows</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings><Nullable>enable</Nullable>
  </PropertyGroup>
</Project>
'@
dotnet run --project (Join-Path $testDir 'Checks.csproj')
if ($LASTEXITCODE -ne 0) { throw 'Access checks failed.' }


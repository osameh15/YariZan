$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$fixture = Join-Path ([IO.Path]::GetTempPath()) ('YariZan-grade-' + [Guid]::NewGuid().ToString('N'))
$project = Join-Path $fixture 'src/YariZan.Packer'
New-Item -ItemType Directory -Path $project, (Join-Path $fixture 'tools'), (Join-Path $fixture 'secrets'), (Join-Path $fixture 'miniApps/2') -Force | Out-Null
Copy-Item (Join-Path $repo 'src/YariZan.Packer/Program.cs') $project
foreach ($name in 'GameManifest', 'GameCrypto', 'GameNameComparer', 'PersianPageNumber') {
    Copy-Item (Join-Path $repo "src/YariZan.Core/$name.cs") $project
}
Copy-Item (Join-Path $repo 'tools/Get-GameGrade.ps1') (Join-Path $fixture 'tools')
Set-Content -Encoding UTF8 (Join-Path $project 'Checks.csproj') @'
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net9.0-windows</TargetFramework><ImplicitUsings>enable</ImplicitUsings><Nullable>enable</Nullable></PropertyGroup>
</Project>
'@
[IO.File]::WriteAllBytes((Join-Path $fixture 'secrets/master.key'), [byte[]](1..32))
[IO.File]::WriteAllBytes((Join-Path $fixture 'miniApps/2/page7.exe'), [byte[]](1..50))
dotnet build (Join-Path $project 'Checks.csproj') -c Release --nologo
if ($LASTEXITCODE -ne 0) { throw 'Fixture build failed.' }
$dll = Join-Path $project 'bin/Release/net9.0-windows/Checks.dll'
dotnet $dll
if ($LASTEXITCODE -ne 0) { throw 'Automatic pack failed.' }
$manifestPath = Join-Path $fixture 'games_encrypted/manifest.json'
$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
if ($manifest.SelectedGrade -ne 2 -or $manifest.Grades.Count -ne 1 -or $manifest.Grades[0].Games[0].Name -ne 'page7') { throw 'Wrong catalog.' }
Write-Output 'PASS auto-detect grade 2 and pack only its games'
$detected = & (Join-Path $fixture 'tools/Get-GameGrade.ps1')
if ($detected -ne '2') { throw 'Installer grade detection differs.' }
Write-Output 'PASS installer grade matches packer'
$hash = (Get-FileHash $manifestPath).Hash
New-Item -ItemType Directory -Path (Join-Path $fixture 'miniApps/1') | Out-Null
[IO.File]::WriteAllBytes((Join-Path $fixture 'miniApps/1/page1.exe'), [byte[]](1..10))
dotnet $dll
if ($LASTEXITCODE -eq 0 -or (Get-FileHash $manifestPath).Hash -ne $hash) { throw 'Ambiguous grades changed output.' }
Write-Output 'PASS ambiguous grades rejected before changing output'
foreach ($arguments in @(@('--grade', '6'), @('--grade', '9'), @('--grade'))) {
    dotnet $dll @arguments
    if ($LASTEXITCODE -eq 0 -or (Get-FileHash $manifestPath).Hash -ne $hash) { throw 'Invalid selection changed output.' }
}
Write-Output 'PASS empty, invalid and missing grade rejected before changing output'
dotnet $dll --grade 1
if ($LASTEXITCODE -ne 0) { throw 'Explicit pack failed.' }
$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
if ($manifest.SelectedGrade -ne 1 -or (Test-Path (Join-Path $fixture 'games_encrypted/2'))) { throw 'Other grade leaked into output.' }
Write-Output 'PASS explicit grade replaces old generated grade'

$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$testDir = Join-Path ([IO.Path]::GetTempPath()) ('YariZan-book-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $testDir | Out-Null
Copy-Item (Join-Path $PSScriptRoot 'BookChecks.cs') (Join-Path $testDir 'Program.cs')
$projectPath = [System.Security.SecurityElement]::Escape((Join-Path $repo 'src/YariZan.App/YariZan.App.csproj'))
Set-Content -Encoding UTF8 (Join-Path $testDir 'Checks.csproj') @"
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType><TargetFramework>net9.0-windows</TargetFramework>
    <UseWPF>true</UseWPF><ImplicitUsings>enable</ImplicitUsings><Nullable>enable</Nullable>
  </PropertyGroup>
  <ItemGroup><ProjectReference Include="$projectPath" /></ItemGroup>
</Project>
"@
$preview = Join-Path $repo 'publish/book-preview.png'
$portrait = Get-ChildItem -LiteralPath (Join-Path $repo 'miniApps/1') -Filter '*.jpg' -File | Select-Object -First 1 -ExpandProperty FullName
dotnet run --project (Join-Path $testDir 'Checks.csproj') -p:IncludeGameBundle=false -- $portrait $preview
if ($LASTEXITCODE -ne 0) { throw 'Book checks failed.' }

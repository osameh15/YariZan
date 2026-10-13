$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$projectDir = Join-Path ([IO.Path]::GetTempPath()) ('YariZan-screenshots-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $projectDir | Out-Null
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'Capture-AppScreenshots.cs') -Destination (Join-Path $projectDir 'Program.cs')
$reference = [Security.SecurityElement]::Escape((Join-Path $repo 'src/YariZan.App/YariZan.App.csproj'))
Set-Content -LiteralPath (Join-Path $projectDir 'Screenshots.csproj') -Encoding UTF8 -Value @"
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net9.0-windows</TargetFramework><UseWPF>true</UseWPF><ImplicitUsings>enable</ImplicitUsings><Nullable>enable</Nullable></PropertyGroup>
  <ItemGroup><ProjectReference Include="$reference" /></ItemGroup>
</Project>
"@
dotnet run --project (Join-Path $projectDir 'Screenshots.csproj') -p:IncludeGameBundle=false -- $repo
if ($LASTEXITCODE -ne 0) { throw 'App screenshot capture failed.' }

$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$root = Join-Path ([IO.Path]::GetTempPath()) ('YariZan-launch-' + [Guid]::NewGuid().ToString('N'))
$game = Join-Path $root 'Game'
$checks = Join-Path $root 'Checks'
New-Item -ItemType Directory -Path $game, $checks | Out-Null
Set-Content -LiteralPath (Join-Path $game 'Game.csproj') -Encoding UTF8 -Value @'
<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>WinExe</OutputType><TargetFramework>net9.0-windows</TargetFramework><UseWPF>true</UseWPF><ImplicitUsings>enable</ImplicitUsings></PropertyGroup></Project>
'@
Set-Content -LiteralPath (Join-Path $game 'Program.cs') -Encoding UTF8 -Value @'
using System.Windows;
internal static class Program {
  [STAThread] static void Main() {
    new Application().Run(new Window { Width=100, Height=100, Left=-32000, Top=-32000, Opacity=0, ShowInTaskbar=false });
  }
}
'@
dotnet publish (Join-Path $game 'Game.csproj') -c Release -r win-x64 --self-contained false -p:PublishSingleFile=true -p:DebugType=none -p:DebugSymbols=false -o (Join-Path $root 'Published')
if ($LASTEXITCODE -ne 0) { throw 'Synthetic game build failed.' }
foreach ($name in 'GameLauncher', 'GameCrypto') {
    Copy-Item -LiteralPath (Join-Path $repo "src/YariZan.Core/$name.cs") -Destination $checks
}
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'LauncherChecks.cs') -Destination (Join-Path $checks 'Program.cs')
Set-Content -LiteralPath (Join-Path $checks 'Checks.csproj') -Encoding UTF8 -Value @'
<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net9.0-windows</TargetFramework><ImplicitUsings>enable</ImplicitUsings><Nullable>enable</Nullable></PropertyGroup></Project>
'@
dotnet run --project (Join-Path $checks 'Checks.csproj') -- (Join-Path $root 'Published/Game.exe') (Join-Path $root 'Data')
if ($LASTEXITCODE -ne 0) { throw 'Launcher checks failed.' }

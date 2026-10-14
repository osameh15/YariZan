$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
dotnet build (Join-Path $repo 'src/YariZan.ReleaseCheck/YariZan.ReleaseCheck.csproj') -c Release --nologo
if ($LASTEXITCODE -ne 0) { throw 'Release validator build failed.' }
$fixture = Join-Path ([IO.Path]::GetTempPath()) ('YariZan-v2-game-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $fixture | Out-Null
Set-Content -LiteralPath (Join-Path $fixture 'Game.csproj') -Encoding UTF8 -Value @'
<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>WinExe</OutputType><TargetFramework>net9.0-windows</TargetFramework><UseWPF>true</UseWPF><ImplicitUsings>enable</ImplicitUsings></PropertyGroup></Project>
'@
Set-Content -LiteralPath (Join-Path $fixture 'Program.cs') -Encoding UTF8 -Value @'
using System.Windows;
internal static class Program {
  [STAThread] static void Main() {
    new Application().Run(new Window { Width=100, Height=100, Left=-32000, Top=-32000, Opacity=0, ShowInTaskbar=false });
  }
}
'@
dotnet publish (Join-Path $fixture 'Game.csproj') -c Release -r win-x64 --self-contained false -p:PublishSingleFile=true -p:DebugType=none -p:DebugSymbols=false -o (Join-Path $fixture 'Published')
if ($LASTEXITCODE -ne 0) { throw 'V2 synthetic game build failed.' }
dotnet run --project (Join-Path $PSScriptRoot 'V2Checks/V2Checks.csproj') -c Release -p:IncludeGameBundle=false -p:IncludeGameKey=false -- (Join-Path $repo 'publish/v2-checks') (Join-Path $fixture 'Published/Game.exe')
if ($LASTEXITCODE -ne 0) { throw 'V2 checks failed.' }

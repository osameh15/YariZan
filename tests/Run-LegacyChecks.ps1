$ErrorActionPreference = 'Stop'
$repoPath = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Push-Location $repoPath
try {
    $work = Join-Path $repoPath ('.local/legacy-checks-' + [Guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $work | Out-Null
    $fixture = Join-Path $work 'interop.json'
    node tools/legacy/interop-fixture.mjs generate $fixture
    if ($LASTEXITCODE) { throw 'Legacy interoperability fixture generation failed.' }
    foreach ($architecture in @('x64', 'x86')) {
        dotnet build tests/LegacyChecks -c Release -p:LegacyWindows=true -p:FixtureOnlyBuild=true `
            -p:IncludeGameBundle=false -p:IncludeGameKey=false "-p:PlatformTarget=$architecture"
        if ($LASTEXITCODE) { throw "Legacy checks build failed for $architecture" }
        $output = Join-Path $work "cng-$architecture.json"
        & "tests/LegacyChecks/bin/legacy/$architecture/Release/net48/LegacyChecks.exe" $fixture $output $architecture
        if ($LASTEXITCODE) { throw "Legacy checks failed for $architecture" }
        node tools/legacy/interop-fixture.mjs verify $output
        if ($LASTEXITCODE) { throw "Independent CNG signature verification failed for $architecture" }
    }
} finally { Pop-Location }

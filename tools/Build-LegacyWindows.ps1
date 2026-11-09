param(
    [ValidateSet('combination-land', 'number-builder', 'bundle-builder', 'grade-1')]
    [string]$Product = 'combination-land',
    [Parameter(Mandatory = $true)][string]$GameBundleRoot,
    [string]$CompilerPath
)
$ErrorActionPreference = 'Stop'
$repoPath = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$bundlePath = (Resolve-Path -LiteralPath $GameBundleRoot).Path
$manifest = Get-Content -Raw -LiteralPath (Join-Path $bundlePath 'manifest.json') | ConvertFrom-Json
$catalog = @{
    'combination-land' = @{ Name = 'YariZan-CombinationLand'; Sku = 'YARIZAN-S-COMBINATION-LAND'; Version = '1.0.0' }
    'number-builder' = @{ Name = 'YariZan-NumberBuilder'; Sku = 'YARIZAN-S-NUMBER-BUILDER'; Version = '1.0.0' }
    'bundle-builder' = @{ Name = 'YariZan-BundleBuilder'; Sku = 'YARIZAN-S-BUNDLE-BUILDER'; Version = '1.0.0' }
    'grade-1' = @{ Name = 'YariZan-G1'; Sku = ''; Version = '' }
}
$entry = $catalog[$Product]
if ($entry.Sku) {
    if ($manifest.ProductSku -ne $entry.Sku -or $manifest.SelectedGrade -ne 0) { throw 'Bundle belongs to another product.' }
} else {
    if ($manifest.ProductSku -or $manifest.SelectedGrade -ne 1) { throw 'Expected the G1 grade bundle.' }
    [xml]$project = Get-Content -Raw -LiteralPath (Join-Path $repoPath 'src/YariZan.App/YariZan.App.csproj')
    $entry.Version = @($project.Project.PropertyGroup.Version | Where-Object { $_ })[0]
}
foreach ($game in @($manifest.Grades | ForEach-Object { $_.Games })) {
    $gamePath = [IO.Path]::GetFullPath((Join-Path $bundlePath $game.EncryptedFile))
    if (-not $gamePath.StartsWith($bundlePath.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $gamePath -PathType Leaf)) {
        throw 'Bundle contains a missing or unsafe game path.'
    }
}
if (-not $CompilerPath) {
    $CompilerPath = @('C:/Program Files/Inno Setup 7/ISCC.exe', 'C:/Program Files (x86)/Inno Setup 6/ISCC.exe') |
        Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
}
if (-not $CompilerPath -or -not (Test-Path -LiteralPath $CompilerPath)) { throw 'Inno Setup compiler is required.' }
$candidateRoot = Join-Path $repoPath ('.local/legacy-candidates/' + $Product + '-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $candidateRoot | Out-Null
Push-Location $repoPath
try {
    # Uses reviewed production PUBLIC roots and the existing production API. Never generates,
    # reads or embeds a signing private key. AcceptanceCandidate is not CommercialRelease.
    dotnet run --project src/YariZan.ReleaseCheck -c Release -- --acceptance-candidate $repoPath
    if ($LASTEXITCODE) { throw 'Acceptance candidate input validation failed.' }
    foreach ($architecture in @('x64', 'x86')) {
        $outputPath = Join-Path $candidateRoot ($entry.Name + '-Legacy-win-' + $architecture)
        $buildArguments = @('build', 'src/YariZan.App/YariZan.App.csproj', '-c', 'Release', '-m:1',
            '-p:LegacyWindows=true', '-p:AcceptanceCandidate=true', "-p:PlatformTarget=$architecture",
            "-p:GameBundleRoot=$bundlePath", "-p:Version=$($entry.Version)", "-p:AssemblyVersion=$($entry.Version).0",
            "-p:FileVersion=$($entry.Version).0", '-p:DebugType=none', '-p:DebugSymbols=false', '-o', $outputPath)
        if ($entry.Sku) { $buildArguments += "-p:StandaloneProductSku=$($entry.Sku)" }
        & dotnet @buildArguments
        if ($LASTEXITCODE) { throw "Legacy build failed for $architecture" }
        $machine = [Reflection.AssemblyName]::GetAssemblyName((Join-Path $outputPath 'YariZan.exe')).ProcessorArchitecture.ToString()
        $expectedMachine = if ($architecture -eq 'x64') { 'Amd64' } else { 'X86' }
        if ($machine -ne $expectedMachine) { throw "Legacy binary architecture mismatch: expected $expectedMachine, found $machine" }
        $versionInfo = [Diagnostics.FileVersionInfo]::GetVersionInfo((Join-Path $outputPath 'YariZan.exe'))
        if ($versionInfo.ProductVersion -notlike '*legacy-acceptance-candidate*') { throw 'Legacy candidate marker missing.' }
        [IO.File]::WriteAllText((Join-Path $outputPath 'LEGACY-CANDIDATE.txt'),
            "Acceptance candidate only. Requires .NET Framework 4.8 and updated Windows 7 SP1 or Windows 8.1. Real-OS acceptance is pending. Do not upload as a public release.`r`n")
    }
    & $CompilerPath "/DFileStem=$($entry.Name)" "/DMyAppVersion=$($entry.Version)" `
        "/DMyPublishDir=$candidateRoot/$($entry.Name)-Legacy-win-x64" `
        "/DMyPublishDirX86=$candidateRoot/$($entry.Name)-Legacy-win-x86" `
        "/DOutputRoot=$candidateRoot" 'YariZan-Legacy-Setup.iss'
    if ($LASTEXITCODE) { throw 'Legacy installer compilation failed.' }
    $installer = Join-Path $candidateRoot "$($entry.Name)-Legacy-Setup-v$($entry.Version)-candidate.exe"
    $digest = (Get-FileHash -Algorithm SHA256 -LiteralPath $installer).Hash.ToLowerInvariant()
    [IO.File]::WriteAllText($installer + '.sha256', "$digest  $([IO.Path]::GetFileName($installer))`n", (New-Object Text.UTF8Encoding $false))
    Write-Output "Legacy acceptance candidate: $candidateRoot"
} finally { Pop-Location }

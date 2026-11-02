param([ValidateSet('number-builder')][string]$Product = 'number-builder')
$ErrorActionPreference = 'Stop'
$repoPath = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Push-Location $repoPath
try {
    $version = '1.0.0'
    $name = 'YariZan-NumberBuilder'
    $stageRoot = Join-Path $repoPath ('publish/.standalone-build-' + [Guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $stageRoot | Out-Null
    $bundle = Join-Path $repoPath 'publish/bundles/number-builder'
    $compiler = @('C:/Program Files/Inno Setup 7/ISCC.exe','C:/Program Files (x86)/Inno Setup 6/ISCC.exe') | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
    if (-not $compiler) { throw 'Inno Setup 6 or 7 is required.' }
    dotnet run --project src/YariZan.ReleaseCheck -c Release -p:NuGetAudit=false -- --commercial $repoPath
    if ($LASTEXITCODE) { throw 'Commercial release input check failed.' }
    dotnet run --project src/YariZan.Packer -c Release -p:NuGetAudit=false -- --product $Product
    if ($LASTEXITCODE) { throw 'Standalone packing failed.' }
    foreach ($rid in @('win-x64','win-x86')) {
        $outputPath = Join-Path $stageRoot "$name-$rid"
        dotnet publish src/YariZan.App/YariZan.App.csproj -c Release -r $rid --self-contained true -m:1 -p:NuGetAudit=false -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -p:PublishReadyToRun=false -p:CommercialRelease=true -p:StandaloneProductSku=YARIZAN-S-NUMBER-BUILDER "-p:GameBundleRoot=$bundle" "-p:Version=$version" "-p:AssemblyVersion=$version.0" "-p:FileVersion=$version.0" "-p:InformationalVersion=$version" '-p:Product=YariZan Number Builder' -p:DebugType=none -p:DebugSymbols=false -o $outputPath
        if ($LASTEXITCODE) { throw "Publish failed for $rid" }
        Rename-Item -LiteralPath (Join-Path $outputPath 'YariZan.exe') -NewName "$name.exe"
        & "$PSScriptRoot/release/Test-WindowsBinary.ps1" -Path (Join-Path $outputPath "$name.exe") -Version $version -Kind app
        if ($LASTEXITCODE) { throw "Binary check failed for $rid" }
    }
    & $compiler "/DMyAppVersion=$version" "/DMyPublishDir=$stageRoot/$name-win-x64" "/DMyPublishDirX86=$stageRoot/$name-win-x86" "/DOutputRoot=$stageRoot" 'YariZan-Standalone-Setup.iss'
    if ($LASTEXITCODE) { throw 'Installer compilation failed.' }
    $installer = Join-Path $stageRoot "$name-Setup-v$version.exe"
    & "$PSScriptRoot/release/Test-WindowsBinary.ps1" -Path $installer -Version $version -Kind installer
    if ($LASTEXITCODE) { throw 'Installer binary check failed.' }
    $digest = (Get-FileHash -Algorithm SHA256 -LiteralPath $installer).Hash.ToLowerInvariant()
    [IO.File]::WriteAllText($installer + '.sha256', "$digest  $([IO.Path]::GetFileName($installer))`n", (New-Object Text.UTF8Encoding $false))
    $backupRoot = Join-Path ([IO.Path]::GetTempPath()) ('YariZan-NumberBuilder-build-' + [Guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $backupRoot | Out-Null
    foreach ($artifact in Get-ChildItem -LiteralPath $stageRoot) {
        $destination = [IO.Path]::GetFullPath((Join-Path $repoPath ('publish/' + $artifact.Name)))
        if (-not $destination.StartsWith($repoPath + '\publish\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid artifact path' }
        if (Test-Path -LiteralPath $destination) { Move-Item -LiteralPath $destination -Destination (Join-Path $backupRoot $artifact.Name) }
        Move-Item -LiteralPath $artifact.FullName -Destination $destination
    }
    Move-Item -LiteralPath $stageRoot -Destination (Join-Path $backupRoot 'empty-build-directory')
    Write-Output "Built x86, x64 and installer in publish/. Previous builds preserved in $backupRoot"
} finally { Pop-Location }

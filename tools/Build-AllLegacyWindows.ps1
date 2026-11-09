param(
    [Parameter(Mandatory = $true)][string]$ModernPublishRoot,
    [string]$CompilerPath,
    [switch]$Experimental
)
$ErrorActionPreference = 'Stop'
$modernRoot = (Resolve-Path -LiteralPath $ModernPublishRoot).Path
$products = [ordered]@{
    'grade-1' = 'YariZan-G1'
    'number-builder' = 'YariZan-NumberBuilder'
    'bundle-builder' = 'YariZan-BundleBuilder'
    'combination-land' = 'YariZan-CombinationLand'
}
# Check the complete input set before starting any candidate build.
foreach ($product in $products.Keys) {
    $manifest = Join-Path $modernRoot ($products[$product] + '-win-x64/games_encrypted/manifest.json')
    if (-not (Test-Path -LiteralPath $manifest -PathType Leaf)) { throw "Missing existing bundle for $product" }
}
foreach ($product in $products.Keys) {
    $bundle = Join-Path $modernRoot ($products[$product] + '-win-x64/games_encrypted')
    $parameters = @{ Product = $product; GameBundleRoot = $bundle }
    if ($Experimental) { $parameters.Experimental = $true }
    if ($CompilerPath) { $parameters.CompilerPath = $CompilerPath }
    & "$PSScriptRoot/Build-LegacyWindows.ps1" @parameters
    if ($LASTEXITCODE) { throw "Legacy candidate build failed for $product" }
}
Write-Output 'Built legacy x86/x64 launchers and installers for all four released products. Real-OS acceptance remains pending.'

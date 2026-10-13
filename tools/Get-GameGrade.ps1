param([string]$Grade = '', [string]$OutputPath = '')
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
if ($Grade) {
    if ($Grade -notmatch '^[1-6]$') { throw 'Grade must be 1 through 6.' }
} else {
    $populated = @(1..6 | Where-Object {
        $folder = Join-Path $repo "miniApps/$_"
        (Test-Path -LiteralPath $folder) -and @(Get-ChildItem -LiteralPath $folder -Filter '*.exe' -File).Count -gt 0
    })
    if ($populated.Count -ne 1) { throw 'Exactly one grade folder must contain games. Use --grade 1..6 when several grades have games.' }
    $Grade = [string]$populated[0]
}
if ($OutputPath) {
    $parent = Split-Path $OutputPath -Parent
    if ($parent) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
    Set-Content -LiteralPath $OutputPath -Value $Grade -Encoding ASCII
} else { Write-Output $Grade }

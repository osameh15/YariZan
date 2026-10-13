param([int]$Grade = 1, [int]$ExpectedFiles = 213, [switch]$UseExistingPlan)
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$sourceDir = [IO.Path]::GetFullPath((Join-Path $repo "miniApps/$Grade"))
function Get-Ordinal([int]$n) {
    $small = @('', 'اول', 'دوم', 'سوم', 'چهارم', 'پنجم', 'ششم', 'هفتم', 'هشتم', 'نهم', 'دهم', 'یازدهم', 'دوازدهم', 'سیزدهم', 'چهاردهم', 'پانزدهم', 'شانزدهم', 'هفدهم', 'هجدهم', 'نوزدهم')
    $tens = @('', '', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود')
    $round = @('', '', 'بیستم', 'سی‌ام', 'چهلم', 'پنجاهم', 'شصتم', 'هفتادم', 'هشتادم', 'نودم')
    $hundreds = @('', 'صد', 'دویست', 'سیصد', 'چهارصد', 'پانصد', 'ششصد', 'هفتصد', 'هشتصد', 'نهصد')
    if ($n -lt 1 -or $n -gt 999) { throw 'Page number outside 1..999.' }
    if ($n -lt 20) { return $small[$n] }
    if ($n -lt 100) {
        $ten = [int][Math]::Floor($n / 10)
        if ($n % 10 -eq 0) { return $round[$ten] }
        $unit = if ($n % 10 -eq 1) { 'یکم' } else { $small[$n % 10] }
        return $tens[$ten] + ' و ' + $unit
    }
    $hundred = [int][Math]::Floor($n / 100)
    if ($n % 100 -eq 0) { return $hundreds[$hundred] + 'م' }
    $tail = if ($n % 100 -eq 1) { 'یکم' } else { Get-Ordinal ($n % 100) }
    return $hundreds[$hundred] + ' و ' + $tail
}
$planPath = Join-Path $repo 'publish/math-page-renames.json'
if ((Test-Path -LiteralPath $planPath) -and -not $UseExistingPlan) { throw 'An earlier rename plan exists. Preserve it before running again.' }
if (-not $UseExistingPlan) {
$plan = @(Get-ChildItem -LiteralPath $sourceDir -Filter '*.exe' -File | Where-Object BaseName -match '^page[0-9]+$' | ForEach-Object {
    $page = [int]($_.BaseName.Substring(4))
    $title = 'صفحه ' + (Get-Ordinal $page) + ' کتاب ریاضی'
    foreach ($extension in '.exe', '.jpg', '.txt') {
        $oldName = 'page' + $page + $extension
        $oldPath = Join-Path $sourceDir $oldName
        [PSCustomObject]@{ Page=$page; OldName=$oldName; NewName=$title + $extension; Title=$title;
            Hash=(Get-FileHash -LiteralPath $oldPath -Algorithm SHA256).Hash;
            OriginalDescription= if ($extension -eq '.txt') { [IO.File]::ReadAllText($oldPath) } else { $null } }
    }
    Write-Host ('Checked page ' + $page)
})
$plan | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath $planPath -Encoding UTF8
}
$plan = Get-Content -LiteralPath $planPath -Raw -Encoding UTF8 | ConvertFrom-Json
if ($plan.Count -ne $ExpectedFiles) { throw "Expected $ExpectedFiles files, found $($plan.Count). Source files were not changed." }
foreach ($item in $plan) {
    $oldPath = [IO.Path]::GetFullPath((Join-Path $sourceDir $item.OldName))
    $newPath = [IO.Path]::GetFullPath((Join-Path $sourceDir $item.NewName))
    if (-not $oldPath.StartsWith($sourceDir + [IO.Path]::DirectorySeparatorChar) -or
        -not $newPath.StartsWith($sourceDir + [IO.Path]::DirectorySeparatorChar) -or
        -not (Test-Path -LiteralPath $oldPath) -or (Test-Path -LiteralPath $newPath)) {
        throw 'Invalid paths or destination conflict. Source files were not changed.'
    }
}
foreach ($item in $plan) {
    Rename-Item -LiteralPath (Join-Path $sourceDir $item.OldName) -NewName $item.NewName
    $newPath = Join-Path $sourceDir $item.NewName
    if ($item.NewName.EndsWith('.txt')) {
        $body = $item.OriginalDescription -replace '^\s*\u0635\u0641\u062d\u0647[^\r\n]*(?:\r?\n|$)', ''
        [IO.File]::WriteAllText($newPath, $body.Trim() + "`r`n", [Text.UTF8Encoding]::new($false))
    } elseif ((Get-FileHash -LiteralPath $newPath -Algorithm SHA256).Hash -ne $item.Hash) {
        throw "Content changed unexpectedly: $newPath"
    }
}
Write-Output "Renamed $($plan.Count) files. EXE/JPG hashes unchanged; descriptions contain instructions only. Backup mapping: $planPath"

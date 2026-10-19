param([int]$Grade = 1, [switch]$Apply)
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$root = [IO.Path]::GetFullPath((Join-Path $repo "miniApps/$Grade"))
$separator = [IO.Path]::DirectorySeparatorChar
function Assert-WithinRoot([string]$path) {
    if (-not [IO.Path]::GetFullPath($path).StartsWith($root + $separator, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Path is outside source folder: $path"
    }
}
$plan = @()
foreach ($folder in Get-ChildItem -LiteralPath $root -Directory) {
    if ($folder.Name -notmatch '^page([0-9]+)(?:-(jam|tafriq))?$') { throw "Unrecognized update folder: $($folder.Name)" }
    $page = [int]$Matches[1]
    $kind = $Matches[2]
    if ($page -eq 81) { throw 'Page 81 updates must explicitly identify which of its two games is replaced.' }
    if (($page -eq 119) -ne ($kind -in @('jam','tafriq'))) { throw 'Page 119 requires jam/tafriq folder suffixes; other pages must have no suffix.' }
    $title = "صفحه $page کتاب ریاضی"
    if ($kind -eq 'jam') { $title += ' - جمع با محور' }
    if ($kind -eq 'tafriq') { $title += ' - تفریق با محور' }
    $files = @(Get-ChildItem -LiteralPath $folder.FullName -File)
    if (@(Get-ChildItem -LiteralPath $folder.FullName -Directory).Count -or $files.Count -ne 3) { throw "Expected one EXE/JPG/TXT set: $($folder.Name)" }
    foreach ($extension in '.exe','.jpg','.txt') {
        $source = Join-Path $folder.FullName ("page$page" + $extension)
        if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw "Missing update: $source" }
        $destination = Join-Path $root ($title + $extension)
        Assert-WithinRoot $source
        Assert-WithinRoot $destination
        $plan += [PSCustomObject]@{ Page=$page; Source=$source; Destination=$destination; Folder=$folder.FullName }
    }
}
if (-not $plan.Count) { Write-Output 'No update folders.'; return }
if (@($plan | Group-Object Destination | Where-Object Count -gt 1).Count) { throw 'Duplicate update destinations.' }
$oldFiles = @()
foreach ($page in @($plan.Page | Sort-Object -Unique)) {
    if ($page -eq 119) {
        foreach ($destination in @($plan | Where-Object Page -eq 119 | ForEach-Object Destination)) {
            if (Test-Path -LiteralPath $destination) { $oldFiles += Get-Item -LiteralPath $destination }
        }
    } else {
        $pattern = '^صفحه ' + $page + ' کتاب ریاضی(?: - .+)?\.(exe|jpg|png|txt)$'
        $oldFiles += Get-ChildItem -LiteralPath $root -File | Where-Object Name -match $pattern
    }
}
foreach ($file in $oldFiles) { Assert-WithinRoot $file.FullName }
Write-Output ("Import {0} updated files; remove {1} superseded files." -f $plan.Count, $oldFiles.Count)
if (-not $Apply) { $plan | Select-Object Source,Destination; return }
$record = Join-Path $repo ('publish/math-folder-import-' + [Guid]::NewGuid().ToString('N') + '.json')
[IO.Directory]::CreateDirectory((Split-Path $record -Parent)) | Out-Null
@{ Imported=$plan; Removed=@($oldFiles.FullName) } | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $record -Encoding UTF8
foreach ($file in $oldFiles) { Remove-Item -LiteralPath $file.FullName }
foreach ($item in $plan) { Move-Item -LiteralPath $item.Source -Destination $item.Destination }
foreach ($folder in @($plan.Folder | Sort-Object -Unique)) {
    Assert-WithinRoot $folder
    Remove-Item -LiteralPath $folder
}
Write-Output 'Updated file sets imported; older versions and empty update folders removed.'

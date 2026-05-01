#Requires -Version 5.1
<#
.SYNOPSIS
    Converts a PNG into a proper multi-resolution Windows .ico file.

.DESCRIPTION
    Used by build-installer.bat to produce src\YariZan.App\Resources\icon.ico from
    icon.png. Inno Setup's SetupIconFile must be a true .ico — pointing at a PNG
    won't work. The output ICO contains 16 / 32 / 48 / 64 / 128 / 256 px entries,
    each stored as PNG inside the ICO container (Vista+ format), so it looks crisp
    in Add/Remove Programs, the installer wizard, and the taskbar.

.PARAMETER PngPath
    Path to the source PNG.

.PARAMETER IcoPath
    Output ICO path. Will be overwritten.

.EXAMPLE
    .\tools\Convert-PngToIco.ps1 `
        -PngPath src\YariZan.App\Resources\icon.png `
        -IcoPath src\YariZan.App\Resources\icon.ico
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)] [string] $PngPath,
    [Parameter(Mandatory)] [string] $IcoPath
)

if (-not (Test-Path -LiteralPath $PngPath)) {
    throw "PNG not found: $PngPath"
}

Add-Type -AssemblyName System.Drawing

$sizes = @(16, 32, 48, 64, 128, 256)
$source = [System.Drawing.Image]::FromFile((Resolve-Path -LiteralPath $PngPath).Path)

try {
    $entries = @()
    foreach ($size in $sizes) {
        $bmp = New-Object System.Drawing.Bitmap $size, $size
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        $g.InterpolationMode  = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.SmoothingMode      = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $g.PixelOffsetMode    = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $g.Clear([System.Drawing.Color]::Transparent)
        $g.DrawImage($source, 0, 0, $size, $size)
        $g.Dispose()

        $ms = New-Object System.IO.MemoryStream
        $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
        $bmp.Dispose()

        $entries += [pscustomobject]@{ Size = $size; Bytes = $ms.ToArray() }
        $ms.Dispose()
    }

    $out = New-Object System.IO.MemoryStream
    $w   = New-Object System.IO.BinaryWriter $out

    # ICONDIR header — 6 bytes
    $w.Write([UInt16]0)               # reserved
    $w.Write([UInt16]1)               # type 1 = ICO
    $w.Write([UInt16]$entries.Count)  # number of images

    # Directory entries — 16 bytes each
    $offset = 6 + ($entries.Count * 16)
    foreach ($e in $entries) {
        $dim = if ($e.Size -ge 256) { 0 } else { [byte]$e.Size }
        $w.Write([byte]$dim)          # width  (256 stored as 0)
        $w.Write([byte]$dim)          # height (256 stored as 0)
        $w.Write([byte]0)             # palette colour count
        $w.Write([byte]0)             # reserved
        $w.Write([UInt16]1)           # colour planes
        $w.Write([UInt16]32)          # bits per pixel
        $w.Write([UInt32]$e.Bytes.Length)
        $w.Write([UInt32]$offset)
        $offset += $e.Bytes.Length
    }

    # Image data — PNG-encoded, in declared order.
    foreach ($e in $entries) { $w.Write($e.Bytes) }
    $w.Flush()

    $dir = Split-Path -Parent $IcoPath
    if ($dir -and -not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    [System.IO.File]::WriteAllBytes($IcoPath, $out.ToArray())

    Write-Host "Wrote $IcoPath  ($([Math]::Round((Get-Item -LiteralPath $IcoPath).Length / 1KB)) KB, $($entries.Count) sizes)"
}
finally {
    if ($w)      { $w.Dispose() }
    if ($out)    { $out.Dispose() }
    if ($source) { $source.Dispose() }
}

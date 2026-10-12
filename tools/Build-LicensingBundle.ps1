$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$source = Join-Path $repo 'web/licensing'
$stage = Join-Path ([IO.Path]::GetTempPath()) ('yarizan-panel-bundle-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $stage | Out-Null
Get-ChildItem -LiteralPath (Join-Path $source 'public') -Force | Copy-Item -Destination $stage -Recurse
$files = Get-ChildItem -LiteralPath $stage -File -Recurse -Force
if ($files | Where-Object { $_.Extension -in '.pem', '.key' -or $_.Name -eq 'config.php' }) {
    throw 'A private key or configuration file was found in the deployment bundle.'
}
$publish = Join-Path $repo 'publish'
New-Item -ItemType Directory -Path $publish -Force | Out-Null
$output = Join-Path $publish 'YariZan-licensing-panel.zip'
Add-Type -AssemblyName System.IO.Compression
$stream = [IO.File]::Open($output, [IO.FileMode]::Create)
$archive = [IO.Compression.ZipArchive]::new($stream, [IO.Compression.ZipArchiveMode]::Create)
try {
    foreach ($file in $files) {
        $relative = $file.FullName.Substring($stage.Length + 1).Replace('\', '/')
        $entry = $archive.CreateEntry($relative)
        $destination = $entry.Open()
        $input = [IO.File]::OpenRead($file.FullName)
        try { $input.CopyTo($destination) } finally { $input.Dispose(); $destination.Dispose() }
    }
} finally { $archive.Dispose(); $stream.Dispose() }
Write-Output "Ready to upload: $output"

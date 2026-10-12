$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$source = Join-Path $repo 'web/licensing'
$private = Join-Path $source 'private'
$stage = Join-Path ([IO.Path]::GetTempPath()) ('yarizan-private-bundle-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $stage | Out-Null
foreach ($name in 'config.php', 'admin.php', 'admin-credentials.txt', 'private.pem') {
    $file = Join-Path $private $name
    if (!(Test-Path -LiteralPath $file -PathType Leaf)) { throw "Missing private setup file: $name" }
    Copy-Item -LiteralPath $file -Destination $stage
}
foreach ($name in 'app', 'bin', 'database') {
    Copy-Item -LiteralPath (Join-Path $source $name) -Destination $stage -Recurse
}
$publish = Join-Path $repo 'publish'
New-Item -ItemType Directory -Path $publish -Force | Out-Null
$output = Join-Path $publish 'YariZan-private-setup.zip'
Add-Type -AssemblyName System.IO.Compression
$stream = [IO.File]::Open($output, [IO.FileMode]::Create)
$archive = [IO.Compression.ZipArchive]::new($stream, [IO.Compression.ZipArchiveMode]::Create)
try {
    foreach ($file in Get-ChildItem -LiteralPath $stage -Recurse -File -Force) {
        $entry = $archive.CreateEntry($file.FullName.Substring($stage.Length + 1).Replace('\', '/'))
        $destination = $entry.Open()
        $input = [IO.File]::OpenRead($file.FullName)
        try { $input.CopyTo($destination) } finally { $input.Dispose(); $destination.Dispose() }
    }
} finally { $archive.Dispose(); $stream.Dispose() }
Write-Output "Private manual-upload bundle: $output"
Write-Output 'Extract only into domains/osameh.dev/subdomains/private/yarizan/ (700).'

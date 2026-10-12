$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$source = [IO.File]::ReadAllText((Join-Path $repo 'src/YariZan.App/Views/GamesBookPage.xaml.cs'))
$match = [regex]::Match($source, 'private const string AboutText = @"((?:[^"]|"")*)";')
if (!$match.Success) { throw 'The app About text was not found.' }
$text = $match.Groups[1].Value.Replace('""', '"').Trim()
$rtf = [Text.StringBuilder]::new()
[void]$rtf.Append('{\rtf1\ansi\ansicpg1256\uc1\deff0{\fonttbl{\f0\fnil\fcharset178 Tahoma;}}\viewkind4\pard\rtlpar\qr\f0\fs22 ')
foreach ($line in ($text -split '\r?\n')) {
    foreach ($character in $line.ToCharArray()) {
        $value = [int]$character
        if ($character -in '\', '{', '}') { [void]$rtf.Append('\').Append($character) }
        elseif ($value -gt 127) {
            if ($value -gt 32767) { $value -= 65536 }
            [void]$rtf.Append('\u').Append($value).Append('?')
        } else { [void]$rtf.Append($character) }
    }
    [void]$rtf.Append("\par`r`n")
}
[void]$rtf.Append('}')
$publish = Join-Path $repo 'publish'
New-Item -ItemType Directory -Path $publish -Force | Out-Null
[IO.File]::WriteAllText((Join-Path $publish 'installer-about.rtf'), $rtf.ToString(), [Text.Encoding]::ASCII)
Write-Output 'Installer About page generated from the app text (Persian RTL).'

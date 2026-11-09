param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][ValidateSet('x64','x86')][string]$Architecture,
    [string]$Sku = '',
    [Parameter(Mandatory = $true)][string]$Marker
)
$ErrorActionPreference = 'Stop'
# A fresh Framework process avoids assembly-identity caching between products.
# Reflection-only inspection never executes the app or opens its activation flow.
[void][Reflection.Assembly]::ReflectionOnlyLoad('PresentationFramework, Version=4.0.0.0, Culture=neutral, PublicKeyToken=31bf3856ad364e35')
[void][Reflection.Assembly]::ReflectionOnlyLoad('System, Version=4.0.0.0, Culture=neutral, PublicKeyToken=b77a5c561934e089')
$binary = (Resolve-Path -LiteralPath $Path).Path
$machine = [Reflection.AssemblyName]::GetAssemblyName($binary).ProcessorArchitecture.ToString()
$expectedMachine = if ($Architecture -eq 'x64') { 'Amd64' } else { 'X86' }
if ($machine -ne $expectedMachine) { throw 'Legacy binary architecture mismatch.' }
$assembly = [Reflection.Assembly]::ReflectionOnlyLoadFrom($binary)
$attributes = [Reflection.CustomAttributeData]::GetCustomAttributes($assembly)
$framework = $attributes | Where-Object { $_.AttributeType.Name -eq 'TargetFrameworkAttribute' }
if ($framework.ConstructorArguments[0].Value -ne '.NETFramework,Version=v4.8') { throw 'Legacy binary does not target Framework 4.8.' }
$identity = $attributes | Where-Object { $_.AttributeType.Name -eq 'AssemblyMetadataAttribute' -and $_.ConstructorArguments[0].Value -eq 'YariZanStandaloneProduct' }
if ($Sku) {
    if (-not $identity -or $identity.ConstructorArguments[1].Value -ne $Sku) { throw 'Legacy executable belongs to another product.' }
} elseif ($identity) { throw 'Grade build contains a standalone identity.' }
$info = $attributes | Where-Object { $_.AttributeType.Name -eq 'AssemblyInformationalVersionAttribute' }
if ($info.ConstructorArguments[0].Value -notlike "*$Marker*") { throw 'Legacy release-channel marker missing.' }
Write-Output "PASS legacy binary: $Architecture $Sku $Marker"

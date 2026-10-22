<#
.SYNOPSIS
  Local-only owner Admin enrollment against the workstation stack (backend/compose.yaml).

.DESCRIPTION
  Runs backend/tools/admin-enroll.mjs on the host with the private, git-ignored backend/.env, pointed
  at the local PostgreSQL on 127.0.0.1:55432. SMS stays on the fake provider: codes are written,
  encrypted, to backend/.local/ and read back with the 'code' command. No chargeable SMS is sent.
  The payment worker is not started (COMMERCE_MODE=disabled for this process only), so the local
  sandbox orders are never touched. Nothing is printed from .env and no value is passed as an argument.

  Commands:
    provision   create the two pending owners (hidden prompts for passwords and mobiles)
    verify      activate one pending owner with the code sent to its own (fake) phone
    code        show the latest unused synthetic code from the host fake outbox
    report      sanitized readiness report

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File tools\local\Invoke-LocalAdminEnrollment.ps1 provision
#>
param([Parameter(Mandatory)][ValidateSet('provision', 'verify', 'code', 'report')][string]$Command)
$ErrorActionPreference = 'Stop'
$backend = Join-Path $PSScriptRoot '..\..\backend' | Resolve-Path
$envFile = Join-Path $backend '.env'
if (-not (Test-Path $envFile)) { throw 'backend/.env is missing; follow docs/YARIZAN-LOCAL-RUNBOOK.md first.' }

$values = @{}
foreach ($line in Get-Content $envFile) {
  if ($line -match '^\s*([A-Z0-9_]+)=(.*)$') { $values[$Matches[1]] = $Matches[2] }
}
if ($values['SMS_PROVIDER'] -ne 'fake') {
  throw 'Local enrollment requires SMS_PROVIDER=fake in backend/.env. Real SMS needs separate authorization.'
}
foreach ($k in $values.Keys) { Set-Item -Path "Env:$k" -Value $values[$k] }
# Process-local overrides: local database from the host, development mode, no payment worker.
$env:NODE_ENV = 'development'
$env:DATABASE_URL = 'postgresql://yarizan:local-disposable@127.0.0.1:55432/yarizan'
$env:COMMERCE_MODE = 'disabled'
Remove-Item Env:LOCAL_TEST_PRICE_G1_IRR, Env:MELIPAYAMAK_API_TOKEN -ErrorAction SilentlyContinue
$env:SMS_ALLOW_LIVE = 'false'
$env:NO_PROXY = '*'

Push-Location $backend
try {
  if (-not (Test-Path 'dist/src/admin/enrollment.js')) { npm run -s build }
  if ($Command -eq 'code') {
    if (Test-Path $env:SMS_FAKE_OUTBOX) { node dist/src/accounts/read-fake-sms.js }
    else { 'No synthetic SMS has been written by this tool yet. Start "verify" first.' }
  }
  else { node tools/admin-enroll.mjs $Command }
}
finally { Pop-Location }

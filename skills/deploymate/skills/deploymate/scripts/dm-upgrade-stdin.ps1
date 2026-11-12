# dm-upgrade-stdin.ps1 — DM-213 repair, step 1 of 2 (run ON the box). Normally fed by dm-repair-dm213.sh with the owner's revealed DB
# login (DBA role); the SYS login from the operator's own terminal is only the fallback (SKILL.md § 6a).
# Reads the DBA connect string from STDIN only (one line, never stored on disk, never an argument), gives INSTALLER a per-run
# throwaway password (as the p4-db-baseline role does before every bootstrap-app run) and runs boostrap-app's upgrade step for
# the P4 module labels whose role-migration changesets DeployMate's baseline never ran (DM-213).
# Usage (deploymate SKILL.md § 6a): dm-repair-dm213.sh copies this file to D:\TempPOLYPOINT\liquibase\ on the box and pipes the
# revealed DB login on stdin. Fallback only (INSTALLER_RESET_FAILED with that login): the OPERATOR pipes the SYS connect string from
# a terminal of their own (not through Claude Code, not with the `!` prefix: no stdin)
#   read -s LOGIN; printf '%s\n' "$LOGIN" | ssh -i ~/.ssh/deploymate pp-01@<id>-host.deploymate.polypoint.dev \
#     'powershell -NoProfile -ExecutionPolicy RemoteSigned -File D:\TempPOLYPOINT\liquibase\dm-upgrade-stdin.ps1'; unset LOGIN
# Connect string shapes (EZConnect; fresh boxes have no tnsnames.ora, the bare alias fails with ORA-12154):
#   revealed login  VINCULUM_FLEET[ECBERN]/<password>@127.0.0.1:1521/POLYP01             (DBA role: enough for ALTER USER)
#   SYS fallback    <sys user>/<password>@127.0.0.1:1521/POLYP01 as sysdba
# Output: INSTALLER_RESET_OK, UPGRADE_EXIT <code>, filtered Liquibase lines (log: D:\TempPOLYPOINT\liquibase\dm-upgrade.log).
# appointment-planning (when the box has its job file): its label `api-appointement-planning` (product spelling) joins the upgrade,
# and a second run applies its api-baseline, which DeployMate skipped on purpose since DM-154, plus the label again (grants on the new
# objects) -> AP_BASELINE_EXIT <code> (log dm-baseline-ap.log). AP_BASELINE_SKIPPED <reason> when the module is not deployed here or
# the jar predates SAAS-846 (pp-services 2026-08-26, cross-schema grants; without them the baseline fails with ORA-00942).
# INSTALLER_RESET_FAILED / NO_LOGIN_ON_STDIN = nothing changed.
# Recovered from the 2026-10-14 repair session (final version, reused in the 10-15 and 10-16 repairs); jar name as on the box.
$ErrorActionPreference = 'Continue'
$env:PATH = "D:\oracle\ora19\bin;" + $env:PATH
# The DBA connect string arrives on STDIN only (never stored on disk); used once to give INSTALLER a per-run throwaway password,
# exactly as roles/deploymate/p4-db-baseline does before every bootstrap-app run.
$login = [Console]::In.ReadLine()
if (-not $login) { Write-Output "NO_LOGIN_ON_STDIN"; exit 2 }
$chars = [char[]]((48..57) + (65..90) + (97..122))
$pw = "Dm" + (-join (1..22 | ForEach-Object { $chars | Get-Random })) + "1"
# sqlplus starts with /nolog and gets CONNECT on stdin: the login never appears on a command line (process list).
# A failed CONNECT leaves sqlplus unconnected; the ALTER USER then prints SP2-0640, caught by the check below.
$sql = @"
WHENEVER OSERROR EXIT FAILURE
WHENEVER SQLERROR EXIT FAILURE
CONNECT $login
ALTER USER INSTALLER IDENTIFIED BY "$pw" ACCOUNT UNLOCK;
EXIT;
"@
$out = $sql | & sqlplus -S /nolog
if ($LASTEXITCODE -ne 0 -or ("$out" -match 'ORA-|SP2-')) { Write-Output "INSTALLER_RESET_FAILED"; Write-Output "$out"; exit 1 }
Write-Output "INSTALLER_RESET_OK"
$env:SPRING_DATASOURCE_URL = "jdbc:oracle:thin:@//localhost:1521/POLYP01"
$env:SPRING_DATASOURCE_USERNAME = "INSTALLER"
$env:SPRING_DATASOURCE_PASSWORD = $pw
$java = "D:\POLYPOINT_SRV\java\jdk21\bin\java.exe"
$jar = "D:\TempPOLYPOINT\liquibase\boostrap-app.jar"
$filter = "Upgrade default scope|label|API baseline|UPDATE SUMMARY|Run:|Previously run|Filtered out|MARK_RAN|ran successfully|ERROR|Exception|completed|failed"
$labels = "api-personnel-planning,api-patient-case,api-id-administration-service,api-gateway"
$ap = Test-Path "D:\TempPOLYPOINT\nomad-job-definitions\api-ap-appointment-planning.nomad"
if ($ap) { $labels += ",api-appointement-planning" }
$env:BOOTSTRAP_UPGRADE_RUN_ON_STARTUP = "true"
$env:BOOTSTRAP_UPGRADE_LABELS = $labels
& $java -jar $jar *> "D:\TempPOLYPOINT\liquibase\dm-upgrade.log"
$rc = $LASTEXITCODE
Write-Output "UPGRADE_EXIT $rc"
Get-Content "D:\TempPOLYPOINT\liquibase\dm-upgrade.log" | Select-String -Pattern $filter | ForEach-Object { $_.Line }
if (-not $ap) { Write-Output "AP_BASELINE_SKIPPED not deployed on this box"; exit 0 }
if ($rc -ne 0) { Write-Output "AP_BASELINE_SKIPPED upgrade failed"; exit 0 }
# Does the jar's pp-baseline-appointment-planning carry SAAS-846's cross-schema grants (the same probe as the p4-db-baseline role)?
Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem
$ok = $false
$zip = [System.IO.Compression.ZipFile]::OpenRead($jar)
try {
  $lib = $zip.Entries | Where-Object { $_.FullName -like 'BOOT-INF/lib/pp-baseline-appointment-planning-*.jar' } | Select-Object -First 1
  if ($lib) {
    $ms = New-Object System.IO.MemoryStream
    $s = $lib.Open(); try { $s.CopyTo($ms) } finally { $s.Dispose() }
    $inner = New-Object System.IO.Compression.ZipArchive($ms)
    try { $ok = $null -ne $inner.GetEntry('db/oracle/APIAPDBA/change-sets/02b-cross-schema-grants.xml') } finally { $inner.Dispose() }
  }
} finally { $zip.Dispose() }
if (-not $ok) { Write-Output "AP_BASELINE_SKIPPED jar predates SAAS-846"; exit 0 }
# Second run, as in the 2026-11-12 hand fix on e2e-pilot-av: the module baseline (idempotent: Liquibase skips what ran), then the
# label again, so the grants that failed before the APIAPDBA objects existed (failOnError=false, never recorded) are applied.
$env:BOOTSTRAP_MODULES = "appointment-planning"
$env:BOOTSTRAP_API_BASELINE_RUN_ON_STARTUP = "true"
$env:BOOTSTRAP_UPGRADE_LABELS = "api-appointement-planning"
& $java -jar $jar *> "D:\TempPOLYPOINT\liquibase\dm-baseline-ap.log"
Write-Output "AP_BASELINE_EXIT $LASTEXITCODE"
Get-Content "D:\TempPOLYPOINT\liquibase\dm-baseline-ap.log" | Select-String -Pattern $filter | ForEach-Object { $_.Line }

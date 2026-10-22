# dm-upgrade-stdin.ps1 — DM-213 repair, step 1 of 2 (run ON the box, fed by the operator's own terminal).
# Reads the SYS connect string from STDIN only (one line, never stored on disk, never an argument), gives INSTALLER a per-run
# throwaway password (as the p4-db-baseline role does before every bootstrap-app run) and runs boostrap-app's upgrade step for
# the P4 module labels whose role-migration changesets DeployMate's baseline never ran (DM-213).
# Usage (deploymate SKILL.md, Troubleshooting "DM-213 repair"): copy this file to D:\TempPOLYPOINT\liquibase\ on the box, then
# the OPERATOR pipes the connect string from a terminal of their own (not through Claude Code, not with the `!` prefix: no stdin)
#   read -s LOGIN; printf '%s\n' "$LOGIN" | ssh -i ~/.ssh/deploymate pp-01@<id>-host.deploymate.polypoint.dev \
#     'powershell -NoProfile -ExecutionPolicy RemoteSigned -File D:\TempPOLYPOINT\liquibase\dm-upgrade-stdin.ps1'; unset LOGIN
# Connect string shape: <user>/<password>@127.0.0.1:1521/POLYP01 as sysdba (EZConnect; fresh boxes have no tnsnames.ora, the bare
# alias fails with ORA-12154). Output: INSTALLER_RESET_OK, UPGRADE_EXIT <code>, filtered Liquibase lines (log:
# D:\TempPOLYPOINT\liquibase\dm-upgrade.log). INSTALLER_RESET_FAILED / NO_LOGIN_ON_STDIN = nothing changed.
# Recovered from the 2026-10-14 repair session (final version, reused in the 10-15 and 10-16 repairs); jar name as on the box.
$ErrorActionPreference = 'Continue'
$env:PATH = "D:\oracle\ora19\bin;" + $env:PATH
# The SYS connect string arrives on STDIN only (never stored on disk); used once to give INSTALLER a per-run throwaway password,
# exactly as roles/deploymate/p4-db-baseline does before every bootstrap-app run.
$login = [Console]::In.ReadLine()
if (-not $login) { Write-Output "NO_LOGIN_ON_STDIN"; exit 2 }
$chars = [char[]]((48..57) + (65..90) + (97..122))
$pw = "Dm" + (-join (1..22 | ForEach-Object { $chars | Get-Random })) + "1"
$sql = @"
WHENEVER SQLERROR EXIT FAILURE
ALTER USER INSTALLER IDENTIFIED BY "$pw" ACCOUNT UNLOCK;
EXIT;
"@
$out = $sql | & sqlplus -L -S "$login"
if ($LASTEXITCODE -ne 0 -or ("$out" -match 'ORA-|SP2-')) { Write-Output "INSTALLER_RESET_FAILED"; Write-Output "$out"; exit 1 }
Write-Output "INSTALLER_RESET_OK"
$env:SPRING_DATASOURCE_URL = "jdbc:oracle:thin:@//localhost:1521/POLYP01"
$env:SPRING_DATASOURCE_USERNAME = "INSTALLER"
$env:SPRING_DATASOURCE_PASSWORD = $pw
$env:BOOTSTRAP_UPGRADE_RUN_ON_STARTUP = "true"
$env:BOOTSTRAP_UPGRADE_LABELS = "api-personnel-planning,api-patient-case,api-id-administration-service,api-gateway"
& "D:\POLYPOINT_SRV\java\jdk21\bin\java.exe" -jar "D:\TempPOLYPOINT\liquibase\boostrap-app.jar" *> "D:\TempPOLYPOINT\liquibase\dm-upgrade.log"
Write-Output "UPGRADE_EXIT $LASTEXITCODE"
Get-Content "D:\TempPOLYPOINT\liquibase\dm-upgrade.log" | Select-String -Pattern "Upgrade default scope|label|UPDATE SUMMARY|Run:|Previously run|Filtered out|MARK_RAN|ran successfully|ERROR|Exception|completed|failed" | ForEach-Object { $_.Line }

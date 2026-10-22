# dm-rerun-jobs.ps1 — DM-213 repair, step 2 of 2 (run ON the box as pp-01; no credentials involved).
# Re-registers P4 Nomad jobs from their rendered job files (stop -purge, then run -detach; idempotent), e.g. after the upgrade of
# dm-upgrade-stdin.ps1 printed UPGRADE_EXIT 0:
#   ssh -i ~/.ssh/deploymate pp-01@<id>-host.deploymate.polypoint.dev 'powershell -NoProfile -ExecutionPolicy RemoteSigned -File
#     D:\TempPOLYPOINT\liquibase\dm-rerun-jobs.ps1 api-pp-personnel-planning api-pc-patient-case id-administration-service
#     api-gateway poly-time-connect'
# Prints "RUN <job> -> <evaluation id | error>" per job, "MISSING <file>" for an unknown job name.
# Optional diagnostics (not part of the DM-213 repair; tried on the PR 12910 gateway classpath regression, did not fix it):
#   gateway-nodocs  run api-gateway from a patched COPY of its job file (pp-01 cannot edit the rendered one) with springdoc api-docs off
#   gateway-noscan  together with gateway-nodocs: also disable the Hibernate archive scanner in that copy
# Recovered from the 2026-10-14 repair session (final version).
$ErrorActionPreference = 'Continue'
# Re-register P4 jobs from their rendered job files (idempotent; -detach so the call does not block on the deployment monitor).
# Usage: dm-rerun-jobs.ps1 [gateway-nodocs] <job> [<job> ...]
# "gateway-nodocs": run api-gateway from a patched COPY of its job file (pp-01 may not edit the rendered one) with springdoc api-docs off.
$nomad = "D:\POLYPOINT_SRV\POLYPOINT_nomad-home_POLYP01\nomad.exe"
$dir = "D:\TempPOLYPOINT\nomad-job-definitions"
$work = "D:\TempPOLYPOINT\liquibase"
$jobs = @($args)
$files = @{}
if ($jobs -contains "gateway-nodocs") {
  $jobs = @($jobs | Where-Object { $_ -ne "gateway-nodocs" -and $_ -ne "gateway-noscan" })
  $c = Get-Content (Join-Path $dir "api-gateway.nomad") -Raw
  $flag = '"-Dspringdoc.api-docs.enabled=false",'
  if ($c -notmatch [regex]::Escape($flag)) {
    $c = $c -replace '("-Dspring\.profiles\.active=[^"]*",)', ('$1' + "`r`n            " + $flag)
  }
  if ($args -contains "gateway-noscan") {
    $scan = '"-Dspring.jpa.properties.hibernate.archive.scanner=org.hibernate.boot.archive.scan.internal.DisabledScanner",'
    if ($c -notmatch [regex]::Escape($scan)) {
      $c = $c -replace '("-Dspring\.profiles\.active=[^"]*",)', ('$1' + "`r`n            " + $scan)
    }
  }
  $copy = Join-Path $work "api-gateway.nomad"
  Set-Content -Path $copy -Value $c -NoNewline
  Write-Output ("COPY api-gateway.nomad patched: " + ((Select-String -Path $copy -Pattern 'api-docs.enabled=false' | Measure-Object).Count -gt 0))
  $files["api-gateway"] = $copy
  $jobs += "api-gateway"
}
foreach ($j in $jobs) {
  $f = if ($files.ContainsKey($j)) { $files[$j] } else { Join-Path $dir "$j.nomad" }
  if (-not (Test-Path $f)) { Write-Output "MISSING $f"; continue }
  $null = & $nomad job stop -purge $j 2>&1
  $out = & $nomad job run -detach $f 2>&1 | ForEach-Object { "$_" }
  $r = ($out | Select-String -Pattern "Evaluation ID|rror" | ForEach-Object { $_.Line.Trim() }) -join " | "
  Write-Output "RUN $j -> $r"
}

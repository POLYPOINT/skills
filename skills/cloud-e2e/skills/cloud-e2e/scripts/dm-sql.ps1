$ErrorActionPreference = 'Continue'
$env:PATH = "D:\oracle\ora19\bin;" + $env:PATH
$env:NLS_LANG = "AMERICAN_AMERICA.AL32UTF8"
# stdin: line 1 = connect string (never stored), rest = SQL script. Output = sqlplus stdout.
$login = [Console]::In.ReadLine()
if (-not $login) { Write-Output "NO_LOGIN_ON_STDIN"; exit 2 }
$sql = [Console]::In.ReadToEnd()
$pre = "SET PAGESIZE 5000 LINESIZE 32767 TRIMSPOOL ON TAB OFF FEEDBACK OFF HEADING ON COLSEP '|' WRAP OFF`nWHENEVER SQLERROR CONTINUE`nALTER SESSION SET NLS_DATE_FORMAT='YYYY-MM-DD HH24:MI:SS';`n"
$out = ($pre + $sql + "`nEXIT;`n") | & sqlplus -L -S "$login"
$out | ForEach-Object { "$_" }

# Registers a Windows Scheduled Task that backs up the LIFEQUEST production
# database even when the app is not running. Runs as the current user only
# (no admin rights, no elevated privileges).
#
# Usage (from the project folder, in PowerShell):
#   .\scripts\windows\register-backup-task.ps1            # every 6 hours, honours LIFEQUEST_BACKUP_INTERVAL_HOURS
#   .\scripts\windows\register-backup-task.ps1 -Remove    # unregister
param(
  [int]$EveryHours = 6,
  [switch]$Remove
)

$TaskName = "LIFEQUEST automatic backup"

if ($Remove) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
  Write-Host "Removed scheduled task '$TaskName'."
  return
}

$ProjectDir = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$Npm = (Get-Command npm.cmd -ErrorAction Stop).Source

# `auto-backup` only creates a backup when the newest one is older than the
# configured interval, so running the task often is cheap and safe.
$Action = New-ScheduledTaskAction -Execute $Npm -Argument "run db -- auto-backup --env=production" -WorkingDirectory $ProjectDir
$Trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(5) -RepetitionInterval (New-TimeSpan -Hours $EveryHours)
$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopIfGoingOnBatteries -AllowStartIfOnBatteries
$Principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Principal $Principal -Force | Out-Null
Write-Host "Registered '$TaskName' (checks every $EveryHours h, runs as $env:USERNAME, limited privileges)."

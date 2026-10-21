# Registers (or updates) the "Panier Crawl" scheduled task: every night at 02:30, plus a 06:00 retry pass.
# crawl.py itself decides which stores are due (new rebate week started, or 7+ days old).
#   - StartWhenAvailable: if the PC was off/asleep at 02:30, it runs as soon as it can.
#   - WakeToRun: wakes the PC from sleep for the crawl (needs wake timers allowed in the power plan).
#     Remove "-WakeToRun" below and re-run this script to keep the PC asleep.
$root     = Split-Path -Parent $PSScriptRoot
$action   = New-ScheduledTaskAction -Execute (Join-Path $root "scripts\crawl.cmd") -WorkingDirectory $root
# 02:30 = main run (stores whose new flyer week started); 06:00 = a second pass that continues any
# crawl stopped early that night (crawl.py resumes from its checkpoints, so nothing is re-fetched).
$trigger  = @((New-ScheduledTaskTrigger -Daily -At 2:30am), (New-ScheduledTaskTrigger -Daily -At 6:00am))
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -WakeToRun -ExecutionTimeLimit (New-TimeSpan -Hours 6) `
            -DontStopIfGoingOnBatteries -AllowStartIfOnBatteries -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName "Panier Crawl" -Action $action -Trigger $trigger -Settings $settings `
    -Description "Panier: nightly grocery catalogue crawl (only stores whose new flyer week started)." -Force | Out-Null
Get-ScheduledTask -TaskName "Panier Crawl" | Get-ScheduledTaskInfo | Select-Object TaskName, NextRunTime

<#
.SYNOPSIS
  Runs the WorldWatcher FastAPI backend under a supervisor that restarts it.

.DESCRIPTION
  The backend "randomly stopping" was never random. It had three causes, and this
  script removes all three:

  1. IT DIED WITH WHATEVER STARTED IT. Started from a terminal or an agent session,
     uvicorn is a child of that shell; when the shell, the window or the session goes
     away, so does the backend. -Detached re-launches this supervisor as its own
     process so nothing upstream owns it.
  2. NOTHING BROUGHT IT BACK. app.main's lifespan opens a DB connection at startup, so
     if Postgres is not up yet (a reboot, a service restart) the app fails to start and
     uvicorn EXITS - it does not retry. The loop below retries, with backoff.
  3. THE PORT DRIFTED FROM THE CLIENT. Ports moved 8000 -> 8006 over time and
     Server/.env still disagreed. This reads the port out of Client/.env, which is the
     one file that decides where the browser actually sends requests, so the two cannot
     disagree again.

.EXAMPLE
  ./scripts/dev-backend.ps1 -Detached      # start it and get your prompt back
  ./scripts/dev-backend.ps1                # run in the foreground, Ctrl-C to stop
  ./scripts/dev-backend.ps1 -Stop          # stop the supervisor and the server
  ./scripts/dev-backend.ps1 -Install       # also start it at every logon (scheduled task)
  ./scripts/dev-backend.ps1 -Status        # is it up, on which port, since when
#>
[CmdletBinding()]
param(
  # Run as an independent background process instead of holding this terminal.
  [switch]$Detached,
  # Stop a running supervisor (and the uvicorn it is watching).
  [switch]$Stop,
  # Report whether the backend is listening and answering /health.
  [switch]$Status,
  # Register a per-user scheduled task so the backend is up after every logon.
  [switch]$Install,
  # Remove that scheduled task.
  [switch]$Uninstall,
  # Pass --reload so server edits are picked up (the normal dev setting).
  [bool]$Reload = $true
)

$ErrorActionPreference = 'Stop'
$Root     = Split-Path -Parent $PSScriptRoot
$ServerDir = Join-Path $Root 'Server'
$Python   = Join-Path $ServerDir '.venv\Scripts\python.exe'
$LogDir   = Join-Path $ServerDir 'logs'
$LogFile  = Join-Path $LogDir 'backend.log'
$PidFile  = Join-Path $LogDir 'backend.supervisor.pid'
$TaskName = 'WorldWatcher Backend'

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

function Write-Log {
  param([string]$Message, [string]$Level = 'INFO')
  $line = '{0} [{1}] {2}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Level, $Message
  Write-Host $line
  try { Add-Content -Path $LogFile -Value $line -Encoding utf8 } catch { }
}

# The port the BROWSER will use. Client/.env is the source of truth: there is no Vite dev
# proxy, so the client calls this absolute URL, and a mismatch fails every request while
# looking exactly like a dead backend.
function Get-ClientApiPort {
  $envFile = Join-Path $Root 'Client\.env'
  if (Test-Path $envFile) {
    $match = Select-String -Path $envFile -Pattern 'VITE_API_BASE_URL\s*=\s*\S*?:(\d+)' | Select-Object -First 1
    if ($match) { return [int]$match.Matches[0].Groups[1].Value }
  }
  Write-Log 'Client/.env has no VITE_API_BASE_URL port; falling back to 8006.' 'WARN'
  return 8006
}

function Get-PortOwner {
  param([int]$Port)
  Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue |
    Select-Object -First 1 -ExpandProperty OwningProcess
}

# ---------------------------------------------------------------- scheduled task

if ($Uninstall) {
  if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Log "Removed scheduled task '$TaskName'."
  } else {
    Write-Log "No scheduled task '$TaskName' is registered."
  }
  return
}

if ($Install) {
  # Per-user task, interactive logon: no elevation needed, and it runs under the Task
  # Scheduler service rather than under any terminal - which is the whole point.
  $action = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument ('-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "{0}"' -f $PSCommandPath)
  $trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
  $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings `
    -Description 'Keeps the WorldWatcher FastAPI backend running for local development.' -Force | Out-Null
  Write-Log "Registered scheduled task '$TaskName' (runs at logon). Starting it now."
  Start-ScheduledTask -TaskName $TaskName
  return
}

# ---------------------------------------------------------------- status

if ($Status) {
  $port = Get-ClientApiPort
  $owner = Get-PortOwner $port
  if (-not $owner) {
    Write-Log "Nothing is listening on port $port. Start it with: ./scripts/dev-backend.ps1 -Detached" 'WARN'
    return
  }
  $proc = Get-Process -Id $owner -ErrorAction SilentlyContinue
  Write-Log "Port $port is served by $($proc.ProcessName) (pid $owner), up since $($proc.StartTime)."
  try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:$port/health" -TimeoutSec 5
    Write-Log "GET /health -> $($health.status)"
  } catch {
    Write-Log "GET /health failed: $($_.Exception.Message) - the process is up but the DB may not be." 'ERROR'
  }
  return
}

# ---------------------------------------------------------------- stop

if ($Stop) {
  $port = Get-ClientApiPort
  if (Test-Path $PidFile) {
    $supervisorPid = (Get-Content $PidFile | Select-Object -First 1)
    Stop-Process -Id $supervisorPid -Force -ErrorAction SilentlyContinue
    Remove-Item $PidFile -ErrorAction SilentlyContinue
    Write-Log "Stopped supervisor pid $supervisorPid."
  }
  $owner = Get-PortOwner $port
  if ($owner) {
    Stop-Process -Id $owner -Force -ErrorAction SilentlyContinue
    Write-Log "Stopped the process listening on $port (pid $owner)."
  }
  return
}

# ---------------------------------------------------------------- detach

if ($Detached) {
  # The script path contains spaces ("Dungenons and Dragons books"), and -ArgumentList joins
  # an array with plain spaces - so the path has to carry its own quotes or powershell.exe
  # silently receives four garbage arguments and exits.
  $childArgs = @('-NoProfile', '-WindowStyle', 'Hidden', '-ExecutionPolicy', 'Bypass', '-File', ('"{0}"' -f $PSCommandPath))
  if (-not $Reload) { $childArgs += @('-Reload', '$false') }
  $proc = Start-Process -FilePath 'powershell.exe' -ArgumentList $childArgs -WindowStyle Hidden -PassThru
  Write-Log "Supervisor detached as pid $($proc.Id). Log: $LogFile"
  return
}

# ---------------------------------------------------------------- supervise

$port = Get-ClientApiPort
$PID | Set-Content -Path $PidFile -Encoding ascii

if (-not (Test-Path $Python)) {
  Write-Log "Missing $Python - create the venv first. A bare 'uvicorn' would run under the pyenv global Python instead and fail on imports." 'ERROR'
  exit 1
}

$owner = Get-PortOwner $port
if ($owner -and $owner -ne $PID) {
  Write-Log "Port $port is already served by pid $owner; stopping it so this supervisor owns the port." 'WARN'
  Stop-Process -Id $owner -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 1
  if (Get-PortOwner $port) {
    Write-Log "pid $owner will not die and still holds $port. Move BOTH Client/.env and this to a new port, or reboot." 'ERROR'
    exit 1
  }
}

Write-Log "Supervising uvicorn on port $port (reload=$Reload). Repo: $Root"

$uvicornArgs = @('-m', 'uvicorn', 'app.main:app', '--host', '0.0.0.0', '--port', "$port")
if ($Reload) { $uvicornArgs += '--reload' }

$backoff = 2
while ($true) {
  $startedAt = Get-Date
  Write-Log "Starting: $Python $($uvicornArgs -join ' ')"
  # uvicorn's own output goes to files next to the supervisor log, so a crash leaves its
  # traceback behind instead of vanishing with the terminal it happened in.
  $proc = Start-Process -FilePath $Python -ArgumentList $uvicornArgs -WorkingDirectory $ServerDir `
    -RedirectStandardOutput (Join-Path $LogDir 'uvicorn.out.log') `
    -RedirectStandardError (Join-Path $LogDir 'uvicorn.err.log') `
    -NoNewWindow -PassThru
  $proc.WaitForExit()
  $ranFor = (Get-Date) - $startedAt
  # -PassThru does not always populate ExitCode until the object is refreshed.
  try { $proc.Refresh() } catch { }
  $exit = if ($null -ne $proc.ExitCode) { $proc.ExitCode } else { 'unknown' }

  if ($ranFor.TotalSeconds -ge 30) {
    # It was healthy for a while, so this is a one-off: come back fast.
    $backoff = 2
    Write-Log "uvicorn exited (code $exit) after $([int]$ranFor.TotalSeconds)s. Restarting." 'WARN'
  } else {
    # Dying immediately usually means Postgres is not up (the lifespan opens a connection
    # before serving) or the port went away. Back off so the log stays readable.
    Write-Log ("uvicorn exited (code $exit) after $([int]$ranFor.TotalSeconds)s - see logs/uvicorn.err.log. " +
               "Postgres down? Retrying in ${backoff}s.") 'ERROR'
    Start-Sleep -Seconds $backoff
    $backoff = [Math]::Min($backoff * 2, 60)
  }
}

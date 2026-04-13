$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$relayOut = Join-Path $root '.dev-relay.out.log'
$relayErr = Join-Path $root '.dev-relay.err.log'
$cloudflaredOut = Join-Path $root '.dev-cloudflared.out.log'
$cloudflaredErr = Join-Path $root '.dev-cloudflared.err.log'

foreach ($log in @($relayOut, $relayErr, $cloudflaredOut, $cloudflaredErr)) {
  if (Test-Path $log) {
    try {
      Remove-Item -LiteralPath $log -Force -ErrorAction Stop
    }
    catch {
      try {
        Clear-Content -LiteralPath $log -Force -ErrorAction Stop
      }
      catch {
        Write-Warning "Could not reset log file '$log'. Continuing."
      }
    }
  }
}

$existingRelayPids = @()
try {
  $existingRelayPids = @(Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique)
} catch {}

$webDistIndex = Join-Path $root 'apps\web\dist\index.html'
if (-not (Test-Path $webDistIndex)) {
  Write-Host 'Web client not built. Building it for relay/mobile access...'
  & pnpm.cmd --filter @remote-terminal/web build
  $webBuildExitCode = $LASTEXITCODE
  if ($webBuildExitCode -ne 0) {
    Write-Host 'Web client build failed. Aborting startup.'
    exit $webBuildExitCode
  }
  Write-Host 'Web client build complete.'
  Write-Host ''
}

if ($existingRelayPids.Count -gt 0) {
  $healthyExistingRelay = $false
  try {
    $health = Invoke-RestMethod -Uri 'http://127.0.0.1:3001/health' -TimeoutSec 1
    if ($health.status -eq 'ok') {
      $healthyExistingRelay = $true
    }
  } catch {}

  if ($healthyExistingRelay) {
    Write-Host "Stopping existing relay on port 3001 (PID(s): $($existingRelayPids -join ', ')) so this run starts clean."
    foreach ($procId in $existingRelayPids) {
      try {
        Stop-Process -Id $procId -Force -ErrorAction Stop
      } catch {
        Write-Warning "Could not stop relay PID $procId. Continuing."
      }
    }
    Start-Sleep -Milliseconds 750
  } else {
    Write-Host "Port 3001 is already in use by PID(s): $($existingRelayPids -join ', ')"
    Write-Host "The process on 3001 is not a healthy Remote Terminal relay."
    Write-Host "Stop that process or run the desktop and relay separately."
    exit 1
  }
}

$relay = $null
$relay = Start-Process -FilePath 'pnpm.cmd' `
  -ArgumentList '--filter', '@remote-terminal/relay', 'dev' `
  -WorkingDirectory $root `
  -RedirectStandardOutput $relayOut `
  -RedirectStandardError $relayErr `
  -WindowStyle Hidden `
  -PassThru

try {
  $healthy = $false
  for ($i = 0; $i -lt 60; $i++) {
    try {
      $health = Invoke-RestMethod -Uri 'http://127.0.0.1:3001/health' -TimeoutSec 1
      if ($health.status -eq 'ok') {
        $healthy = $true
        break
      }
    } catch {}
    Start-Sleep -Milliseconds 500
  }

  if (-not $healthy) {
    $relayStdout = if (Test-Path $relayOut) { Get-Content $relayOut -Raw } else { '' }
    $relayStderr = if (Test-Path $relayErr) { Get-Content $relayErr -Raw } else { '' }
    Write-Host 'Relay failed to start.'
    if ($relayStdout) {
      Write-Host ''
      Write-Host '[relay stdout]'
      Write-Host $relayStdout
    }
    if ($relayStderr) {
      Write-Host ''
      Write-Host '[relay stderr]'
      Write-Host $relayStderr
    }
    exit 1
  }

  Write-Host 'Relay is running on http://127.0.0.1:3001'

  # ── Cloudflare Tunnel (optional — remote access from phone anywhere) ──
  $cloudflaredProc = $null
  $cloudflaredExe = $null
  $knownPath = 'C:\Program Files (x86)\cloudflared\cloudflared.exe'
  if (Get-Command cloudflared -ErrorAction SilentlyContinue) {
    $cloudflaredExe = 'cloudflared'
  } elseif (Test-Path $knownPath) {
    $cloudflaredExe = $knownPath
  }

  if ($cloudflaredExe) {
    Write-Host ''
    Write-Host 'Starting Cloudflare Tunnel for remote mobile access...'
    $cloudflaredProc = Start-Process -FilePath $cloudflaredExe `
      -ArgumentList 'tunnel', '--url', 'http://localhost:3001', '--protocol', 'http2', '--no-autoupdate' `
      -RedirectStandardOutput $cloudflaredOut `
      -RedirectStandardError $cloudflaredErr `
      -WindowStyle Hidden `
      -PassThru

    $tunnelUrl = $null
    for ($i = 0; $i -lt 20; $i++) {
      $cloudflaredLines = @()
      if (Test-Path $cloudflaredOut) { $cloudflaredLines += Get-Content $cloudflaredOut }
      if (Test-Path $cloudflaredErr) { $cloudflaredLines += Get-Content $cloudflaredErr }
      $match = $cloudflaredLines |
        Select-String -Pattern 'https://[-a-z0-9]+\.trycloudflare\.com' |
        Select-Object -First 1

      if ($match) {
        $tunnelUrl = $match.Matches[0].Value
        break
      }

      if ($cloudflaredProc.HasExited) {
        break
      }

      Start-Sleep -Seconds 1
    }

    if ($tunnelUrl) {
      Write-Host "  Tunnel URL: $tunnelUrl"
      Write-Host '  Use that URL on mobile to connect from anywhere.'
    } else {
      Write-Warning 'Cloudflare tunnel did not produce a URL yet. Check .dev-cloudflared.err.log if mobile access is not working.'
    }
  } else {
    Write-Host ''
    Write-Host 'Tip: install cloudflared for remote mobile access from anywhere:'
    Write-Host '     winget install Cloudflare.cloudflared'
  }
  Write-Host ''

  Write-Host 'Starting desktop app...'
  & pnpm.cmd --filter @remote-terminal/desktop dev
  $desktopExitCode = $LASTEXITCODE
  if ($desktopExitCode -ne 0) {
    exit $desktopExitCode
  }
}
finally {
  if ($relay -and -not $relay.HasExited) {
    Stop-Process -Id $relay.Id -Force
  }
  if ($cloudflaredProc -and -not $cloudflaredProc.HasExited) {
    Stop-Process -Id $cloudflaredProc.Id -Force
  }
}

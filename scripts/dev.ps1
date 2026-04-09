$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$relayOut = Join-Path $root '.dev-relay.out.log'
$relayErr = Join-Path $root '.dev-relay.err.log'

foreach ($log in @($relayOut, $relayErr)) {
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
$usingExistingRelay = $false
try {
  $existingRelayPids = @(Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique)
} catch {}

if ($existingRelayPids.Count -gt 0) {
  $healthyExistingRelay = $false
  try {
    $health = Invoke-RestMethod -Uri 'http://127.0.0.1:3001/health' -TimeoutSec 1
    if ($health.status -eq 'ok') {
      $healthyExistingRelay = $true
    }
  } catch {}

  if ($healthyExistingRelay) {
    $usingExistingRelay = $true
    Write-Host "Reusing existing relay on port 3001 (PID(s): $($existingRelayPids -join ', '))."
  } else {
    Write-Host "Port 3001 is already in use by PID(s): $($existingRelayPids -join ', ')"
    Write-Host "The process on 3001 is not a healthy Awesome Terminal relay."
    Write-Host "Stop that process or run the desktop and relay separately."
    exit 1
  }
}

$relay = $null
if (-not $usingExistingRelay) {
  $relay = Start-Process -FilePath 'pnpm.cmd' `
    -ArgumentList '--filter', '@awesome-terminal/relay', 'dev' `
    -WorkingDirectory $root `
    -RedirectStandardOutput $relayOut `
    -RedirectStandardError $relayErr `
    -PassThru
}

try {
  $healthy = $usingExistingRelay
  if (-not $usingExistingRelay) {
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

  if ($usingExistingRelay) {
    Write-Host 'Relay already running on http://127.0.0.1:3001'
  } else {
    Write-Host 'Relay is running on http://127.0.0.1:3001'
  }

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
      -ArgumentList 'tunnel', '--url', 'http://localhost:3001' `
      -PassThru -NoNewWindow
    Write-Host '  Tunnel starting - public URL will be printed above (look for trycloudflare.com)'
    Write-Host '  Enter that URL in the mobile app settings to connect from anywhere.'
  } else {
    Write-Host ''
    Write-Host 'Tip: install cloudflared for remote mobile access from anywhere:'
    Write-Host '     winget install Cloudflare.cloudflared'
  }
  Write-Host ''

  Write-Host 'Starting desktop app...'
  & pnpm.cmd --filter @awesome-terminal/desktop dev
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

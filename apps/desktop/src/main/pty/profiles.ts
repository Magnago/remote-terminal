import { existsSync } from 'fs';
import type { ShellProfile } from '@awesome-terminal/shared';

export function detectProfiles(): ShellProfile[] {
  const profiles: ShellProfile[] = [];

  // PowerShell 7 (pwsh)
  const pwsh7Paths = [
    'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
    'C:\\Program Files\\PowerShell\\7-preview\\pwsh.exe',
  ];
  for (const p of pwsh7Paths) {
    if (existsSync(p)) {
      profiles.push({
        id: 'pwsh7',
        name: 'PowerShell',
        executable: p,
        args: ['-NoLogo'],
        icon: 'powershell',
        color: '#012456',
      });
      break;
    }
  }

  // Windows PowerShell 5.1
  const ps5 = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
  if (existsSync(ps5)) {
    profiles.push({
      id: 'powershell5',
      name: 'Windows PowerShell',
      executable: ps5,
      args: ['-NoLogo'],
      icon: 'powershell',
      color: '#012456',
    });
  }

  // Command Prompt
  const cmd = 'C:\\Windows\\System32\\cmd.exe';
  if (existsSync(cmd)) {
    profiles.push({
      id: 'cmd',
      name: 'Command Prompt',
      executable: cmd,
      args: [],
      icon: 'cmd',
      color: '#0C0C0C',
    });
  }

  // Git Bash
  const gitBashPaths = [
    'C:\\Program Files\\Git\\bin\\bash.exe',
    'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
  ];
  for (const p of gitBashPaths) {
    if (existsSync(p)) {
      profiles.push({
        id: 'git-bash',
        name: 'Git Bash',
        executable: p,
        args: ['--login', '-i'],
        icon: 'git',
        color: '#F05033',
      });
      break;
    }
  }

  // WSL
  const wsl = 'C:\\Windows\\System32\\wsl.exe';
  if (existsSync(wsl)) {
    profiles.push({
      id: 'wsl',
      name: 'WSL',
      executable: wsl,
      args: [],
      icon: 'linux',
      color: '#FF6600',
    });
  }

  // Fallback: cmd
  if (profiles.length === 0) {
    profiles.push({
      id: 'cmd-fallback',
      name: 'Command Prompt',
      executable: 'cmd.exe',
      args: [],
      icon: 'cmd',
      color: '#0C0C0C',
    });
  }

  return profiles;
}

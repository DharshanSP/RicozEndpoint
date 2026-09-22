import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export interface AgentState {
  deviceId: string;
  agentToken: string;
}

export function loadState(stateFile: string): AgentState | null {
  try {
    const raw = readFileSync(stateFile, 'utf8');
    const parsed = JSON.parse(raw) as AgentState;
    if (!parsed || typeof parsed.deviceId !== 'string' || typeof parsed.agentToken !== 'string') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveState(stateFile: string, state: AgentState): void {
  mkdirSync(path.dirname(stateFile), { recursive: true });
  writeFileSync(stateFile, JSON.stringify(state, null, 2), 'utf8');
}

export function clearState(stateFile: string): void {
  try {
    mkdirSync(path.dirname(stateFile), { recursive: true });
    writeFileSync(stateFile, JSON.stringify({}, null, 2), 'utf8');
  } catch {
    // best-effort
  }
}
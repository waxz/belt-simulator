import { useStore } from '../store/useStore';
import type { SimulatorConfig } from '../store/useStore';

export const CONFIG_VERSION = '1.0';
export const STORAGE_KEY = 'conveyor-flow-simulator-config';

// ─── Serialization ──────────────────────────────────────────────────────────

/** Extract a portable config snapshot from the current store state. */
export function buildConfig(): SimulatorConfig {
  const s = useStore.getState();
  return {
    version: CONFIG_VERSION,
    savedAt: Date.now(),
    belts: s.belts,
    // Strip runtime-only fields before persisting
    sensors: s.sensors.map(({ detectionLog: _dl, ...rest }) => rest) as SimulatorConfig['sensors'],
    sources: s.sources.map(({ lastGeneratedTime: _lt, ...rest }) => rest) as SimulatorConfig['sources'],
    sinks: s.sinks,
    mqttSettings: s.mqttSettings,
    simulatorBackend: s.simulatorBackend,
    simulationSteps: s.simulationSteps,
    kineticFriction: s.kineticFriction,
    collisionEnabled: s.collisionEnabled,
    gridSnap: s.gridSnap,
    gridSize: s.gridSize,
  };
}

// ─── LocalStorage ────────────────────────────────────────────────────────────

/** Save current state to localStorage and mark store as clean. */
export function saveToLocalStorage(): void {
  const config = buildConfig();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    useStore.getState().setIsDirty(false);
    useStore.getState().addLog('Configuration saved to browser storage.', 'info');
  } catch (e) {
    useStore.getState().addLog('Failed to save configuration to storage.', 'error');
  }
}

/** Load config from localStorage. Returns null if nothing is saved or parse fails. */
export function loadFromLocalStorage(): SimulatorConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const config = JSON.parse(raw) as SimulatorConfig;
    if (!config.version || !Array.isArray(config.belts)) return null;
    return config;
  } catch {
    return null;
  }
}

/** Remove saved config from localStorage. */
export function clearLocalStorage(): void {
  localStorage.removeItem(STORAGE_KEY);
}

// ─── File Export / Import ────────────────────────────────────────────────────

/** Trigger a browser download of the current config as a .json file. */
export function downloadConfigFile(): void {
  const config = buildConfig();
  const json = JSON.stringify(config, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `conveyor-config-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  useStore.getState().addLog('Configuration exported to file.', 'info');
}

/** Parse a user-selected File object into a SimulatorConfig. */
export function readConfigFile(file: File): Promise<SimulatorConfig> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const config = JSON.parse(e.target?.result as string) as SimulatorConfig;
        if (!config.version || !Array.isArray(config.belts)) {
          reject(new Error('Invalid configuration file: missing required fields.'));
          return;
        }
        resolve(config);
      } catch {
        reject(new Error('Failed to parse configuration file. Ensure it is valid JSON.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read the selected file.'));
    reader.readAsText(file);
  });
}

// ─── Dirty Tracking ─────────────────────────────────────────────────────────

/** 
 * Subscribe to layout/settings changes and mark store as dirty.
 * Returns the unsubscribe function.
 */
export function initDirtyTracking(): () => void {
  return useStore.subscribe((state, prevState) => {
    // Skip if already dirty (avoids firing set() every frame)
    if (state.isDirty) return;
    if (
      state.belts !== prevState.belts ||
      state.sensors !== prevState.sensors ||
      state.sources !== prevState.sources ||
      state.sinks !== prevState.sinks ||
      state.mqttSettings !== prevState.mqttSettings ||
      state.simulatorBackend !== prevState.simulatorBackend ||
      state.simulationSteps !== prevState.simulationSteps ||
      state.kineticFriction !== prevState.kineticFriction ||
      state.collisionEnabled !== prevState.collisionEnabled ||
      state.gridSnap !== prevState.gridSnap ||
      state.gridSize !== prevState.gridSize
    ) {
      useStore.getState().setIsDirty(true);
    }
  });
}

/** Format a past timestamp as a human-readable age string (e.g. "3 min ago"). */
export function formatSavedAge(savedAt: number): string {
  const diffMs = Date.now() - savedAt;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(savedAt).toLocaleDateString();
}

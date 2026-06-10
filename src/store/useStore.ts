
import { create } from 'zustand';

export const PIXELS_PER_METER = 100;

export const snapToGrid = (value: number, gridSize: number, snapEnabled: boolean): number => {
  if (!snapEnabled || gridSize <= 0) return value;
  return Math.round(value / gridSize) * gridSize;
};

export type BeltShape = 'quadrilateral' | 'arc';
export type BeltType = 'linear' | 'curved';

export interface Belt {
  id: string;
  type: BeltType;
  shape: BeltShape;
  x: number; // meters
  y: number; // meters
  length: number; // meters (for linear)
  beltWidth: number; // meters
  rotation: number; // degrees
  radius: number; // meters (for curved)
  startAngle: number;
  endAngle: number;
  speed: number; // m/s
  directionAngle: number; // flow direction in degrees (0 = right, 90 = up, 180 = left, 270 = down)
  direction: 1 | -1; // (for curved)
  color: string;
  trianglePoints?: { x: number; y: number }[]; // For right_triangle and quadrilateral
  speedBinding?: string; // MQTT binding for belt speed
  directionAngleBinding?: string; // MQTT binding for belt direction angle
  directionBinding?: string; // MQTT binding for curved belt direction
}

export interface DetectionRecord {
  id: string;
  timestamp: number;
  itemLabel: string;
  type: 'ON' | 'OFF';
}

export interface Sensor {
  id: string;
  x: number; // meters
  y: number; // meters
  width: number; // meters
  height: number; // meters
  rotation: number; // degrees
  isActive: boolean;
  label: string;
  color: string;
  detectionLog: DetectionRecord[];
  stateBinding?: string; // MQTT binding for sensor state
}

export interface Item {
  id: string;
  x: number; // meters
  y: number; // meters
  width: number; // meters
  height: number; // meters
  rotation: number; // degrees
  label?: string;
  type: 'box' | 'circle';
  color: string;
}

export interface Source {
  id: string;
  x: number; // meters
  y: number; // meters
  interval: number; // seconds
  lastGeneratedTime: number; // timestamp ms
  minWidth: number;
  maxWidth: number;
  minHeight: number;
  maxHeight: number;
  label: string;
  colorScheme?: string[];
  triggerBinding?: string; // MQTT binding to force spawn
  intervalBinding?: string; // MQTT binding for spawn interval
}

export interface Sink {
  id: string;
  x: number; // meters
  y: number; // meters
  width: number; // meters
  height: number; // meters
  label: string;
}

export type ComponentType = 
  | 'select' 
  | 'belt_rectangle' 
  | 'belt_right_triangle' 
  | 'belt_quadrilateral' 
  | 'belt_arc'
  | 'sensor' 
  | 'item' 
  | 'source' 
  | 'sink';

export type SimulatorBackend = 'matter' | 'rapier';

export function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash;
}

export interface TopicConfig {
  id: string;
  topic: string;
  interval: number; // ms
  direction: 'in' | 'out';
  format: 'json' | 'raw' | 'binary_struct';
  endianness: 'LE' | 'BE';
  components: { id: string; type: 'belt' | 'sensor' | 'item' }[]; 
}

export interface MqttSettings {
  enabled: boolean;
  brokerUrl: string;
  topicPrefix: string;
  topics: TopicConfig[];
}

export interface SimulatorConfig {
  version: string;
  savedAt: number;
  belts: Belt[];
  sensors: Omit<Sensor, 'detectionLog'>[];
  sources: Omit<Source, 'lastGeneratedTime'>[];
  sinks: Sink[];
  mqttSettings: MqttSettings;
  simulatorBackend: SimulatorBackend;
  simulationSteps: number;
  kineticFriction: boolean;
  collisionEnabled: boolean;
  gridSnap: boolean;
  gridSize: number;
}

interface SimulatorState {
  belts: Belt[];
  sensors: Sensor[];
  sources: Source[];
  sinks: Sink[];
  items: Item[];
  isPlaying: boolean;
  kineticFriction: boolean;
  collisionEnabled: boolean;
  activeTool: ComponentType | null;
  simulatorBackend: SimulatorBackend;
  simulationSteps: number;
  gridSnap: boolean;
  gridSize: number;
  mqttSettings: MqttSettings;

  toggleGridSnap: () => void;
  setGridSize: (size: number) => void;

  // Actions
  addBelt: (belt: Omit<Belt, 'id'>) => void;
  updateBelt: (id: string, updates: Partial<Belt>) => void;
  renameBelt: (oldId: string, newId: string) => void;
  removeBelt: (id: string) => void;

  addSensor: (sensor: Omit<Sensor, 'id' | 'detectionLog'>) => void;
  updateSensor: (id: string, updates: Partial<Sensor>) => void;
  addDetectionRecord: (sensorId: string, record: Omit<DetectionRecord, 'id'>) => void;
  renameSensor: (oldId: string, newId: string) => void;
  removeSensor: (id: string) => void;

  addItem: (item: Omit<Item, 'id'>) => void;
  updateItem: (id: string, updates: Partial<Item>) => void;
  bulkUpdateItems: (updates: { id: string, updates: Partial<Item> }[]) => void;
  renameItem: (oldId: string, newId: string) => void;
  removeItem: (id: string) => void;

  addSource: (source: Omit<Source, 'id' | 'lastGeneratedTime'>) => void;
  updateSource: (id: string, updates: Partial<Source>) => void;
  renameSource: (oldId: string, newId: string) => void;
  removeSource: (id: string) => void;

  addSink: (sink: Omit<Sink, 'id'>) => void;
  updateSink: (id: string, updates: Partial<Sink>) => void;
  renameSink: (oldId: string, newId: string) => void;
  removeSink: (id: string) => void;

  setPlaying: (playing: boolean) => void;
  resetSimulation: () => void;
  toggleKineticFriction: () => void;
  toggleCollisionEnabled: () => void;
  setActiveTool: (tool: ComponentType | null) => void;
  clearItems: () => void;
  setStepMode: (enabled: boolean) => void;
  triggerStep: () => void;
  setSimulatorBackend: (backend: SimulatorBackend) => void;
  setSimulationSteps: (steps: number) => void;
  setMqttSettings: (settings: Partial<MqttSettings>) => void;
  isDirty: boolean;
  setIsDirty: (dirty: boolean) => void;
  importConfig: (config: SimulatorConfig) => void;

  stepTriggered: number;
  isStepMode: boolean;
  stepInterval: number;
  isAutoStepping: boolean;
  toggleAutoStepping: () => void;
  setStepInterval: (interval: number) => void;

  // Undo/Redo
  undoStack: any[];
  redoStack: any[];
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  pushHistory: (action: any) => void;

  // Reset snapshot — stores item positions before first play
  initialItems: Item[];
  snapshotItems: () => void;

  // Logging & Profiling
  logs: { id: string; msg: string; type: 'info' | 'warn' | 'error'; timestamp: number }[];
  addLog: (msg: string, type?: 'info' | 'warn' | 'error') => void;
  clearLogs: () => void;
  fps: number;
  setFps: (fps: number) => void;
  latency: { physics: number; logic: number; render: number };
  setLatency: (metrics: { physics: number; logic: number; render: number }) => void;

  // MQTT Debug Logs
  mqttMessages: { id: string; topic: string; payload: string; type: 'in' | 'out'; timestamp: number }[];
  addMqttMessage: (topic: string, payload: string, type: 'in' | 'out') => void;
  batchAddMqttMessages: (msgs: { topic: string; payload: string; type: 'in' | 'out' }[]) => void;
  clearMqttMessages: () => void;
}

export const useStore = create<SimulatorState>((set) => ({
  logs: [],
  fps: 0,
  latency: { physics: 0, logic: 0, render: 0 },
  addLog: (msg, type = 'info') => set((state) => ({
    logs: [{ id: Math.random().toString(36).substr(2, 9), msg, type, timestamp: Date.now() }, ...state.logs].slice(0, 100)
  })),
  clearLogs: () => set({ logs: [] }),
  setFps: (fps) => set({ fps }),
  setLatency: (metrics) => set({ latency: metrics }),
  mqttMessages: [],
  addMqttMessage: (topic, payload, type) => set((state) => ({
    mqttMessages: [{ id: Math.random().toString(36).substr(2, 9), topic, payload, type, timestamp: Date.now() }, ...state.mqttMessages].slice(0, 200)
  })),
  batchAddMqttMessages: (msgs) => set((state) => ({
    // Single set() call for all buffered messages — avoids N separate Zustand notifications
    mqttMessages: [
      ...msgs.map(m => ({ id: Math.random().toString(36).substr(2, 9), ...m, timestamp: Date.now() })).reverse(),
      ...state.mqttMessages
    ].slice(0, 200)
  })),
  clearMqttMessages: () => set({ mqttMessages: [] }),
  isDirty: false,
  setIsDirty: (dirty) => set({ isDirty: dirty }),
  importConfig: (config) => set(() => ({
    belts: config.belts,
    sensors: (config.sensors as any[]).map((s: any) => ({ ...s, detectionLog: [] })),
    sources: (config.sources as any[]).map((s: any) => ({ ...s, lastGeneratedTime: 0 })),
    sinks: config.sinks,
    items: [],
    mqttSettings: config.mqttSettings,
    simulatorBackend: config.simulatorBackend,
    simulationSteps: config.simulationSteps,
    kineticFriction: config.kineticFriction,
    collisionEnabled: config.collisionEnabled,
    gridSnap: config.gridSnap,
    gridSize: config.gridSize,
    isDirty: false,
    undoStack: [],
    redoStack: [],
    canUndo: false,
    canRedo: false,
    isPlaying: false,
    initialItems: [],
  })),
  mqttSettings: {
    enabled: false,
    brokerUrl: 'ws://broker.hivemq.com:8000/mqtt',
    topicPrefix: 'sim/',
    topics: []
  },
  belts: [
    {
      id: 'L-BELT-A',
      type: 'linear',
      shape: 'quadrilateral',
      x: 3,
      y: 4,
      length: 4,
      beltWidth: 0.4,
      rotation: 0,
      radius: 0,
      startAngle: 0,
      endAngle: 0,
      speed: 1,
      directionAngle: 0,
      direction: 1,
      color: '#1e293b',
      trianglePoints: [
        { x: -2, y: -0.2 },
        { x: 2, y: -0.2 },
        { x: 2, y: 0.2 },
        { x: -2, y: 0.2 }
      ]
    },
    {
      id: 'C-BELT-B',
      type: 'curved',
      shape: 'arc',
      x: 5,
      y: 4.4,
      length: 0,
      beltWidth: 0.4,
      rotation: 0,
      radius: 0.4,
      startAngle: 270,
      endAngle: 360,
      speed: 1,
      directionAngle: 0,
      direction: 1,
      color: '#1e293b'
    },
    {
      id: 'L-BELT-C',
      type: 'linear',
      shape: 'quadrilateral',
      x: 5.4,
      y: 6.4,
      length: 4,
      beltWidth: 0.4,
      rotation: 90,
      radius: 0,
      startAngle: 0,
      endAngle: 0,
      speed: 1,
      directionAngle: 90,
      direction: 1,
      color: '#1e293b',
      trianglePoints: [
        { x: -2, y: -0.2 },
        { x: 2, y: -0.2 },
        { x: 2, y: 0.2 },
        { x: -2, y: 0.2 }
      ]
    }
  ],
  sensors: [
    {
      id: 'ir-sensor-1',
      x: 2.5,
      y: 4,
      width: 0.02, // Thinner sensor
      height: 0.8,
      rotation: 0,
      isActive: false,
      label: 'Detection_Line_1',
      color: '#334155',
      detectionLog: []
    },
    {
      id: 'ir-sensor-2',
      x: 4.2,
      y: 4,
      width: 0.02,
      height: 0.8,
      rotation: 0,
      isActive: false,
      label: 'Detection_Line_2',
      color: '#334155',
      detectionLog: []
    }
  ],
  items: [
    {
      id: 'parcel-1',
      x: 1.5,
      y: 4,
      width: 0.3,
      height: 0.3,
      rotation: 0,
      label: 'P1',
      type: 'box',
      color: '#ef4444'
    },
    {
      id: 'parcel-2',
      x: 2,
      y: 4,
      width: 0.5,
      height: 0.4,
      rotation: 0,
      label: 'P2',
      type: 'box',
      color: '#f59e0b'
    }
  ],
  sources: [],
  sinks: [],
  isPlaying: false,
  kineticFriction: true,
  collisionEnabled: true,
  activeTool: null,
  isStepMode: false,
  stepTriggered: 0,
  stepInterval: 1.0,
  isAutoStepping: false,
  simulatorBackend: 'matter',
  simulationSteps: 4,
  gridSnap: true,
  gridSize: 0.5,

  toggleGridSnap: () => set((state) => ({ gridSnap: !state.gridSnap })),
  setGridSize: (size) => set({ gridSize: size }),

  undoStack: [],
  redoStack: [],
  canUndo: false,
  canRedo: false,

  initialItems: [],

  snapshotItems: () => set((state) => ({
    initialItems: state.items.map(i => ({ ...i }))
  })),

  pushHistory: (action) => set((state) => ({
    undoStack: [...state.undoStack.slice(-19), action],
    redoStack: [],
    canUndo: true,
    canRedo: false
  })),

  undo: () => set((state) => {
    if (state.undoStack.length === 0) return state;
    const lastAction = state.undoStack[state.undoStack.length - 1];
    return {
      undoStack: state.undoStack.slice(0, -1),
      redoStack: [...state.redoStack, lastAction],
      canUndo: state.undoStack.length > 1,
      canRedo: true,
      ...lastAction.undo
    };
  }),

  redo: () => set((state) => {
    if (state.redoStack.length === 0) return state;
    const nextAction = state.redoStack[state.redoStack.length - 1];
    return {
      redoStack: state.redoStack.slice(0, -1),
      undoStack: [...state.undoStack, nextAction],
      canRedo: state.redoStack.length > 1,
      canUndo: true,
      ...nextAction.redo
    };
  }),

  setMqttSettings: (settings) => set((state) => ({
    mqttSettings: { ...state.mqttSettings, ...settings }
  })),

  addBelt: (belt) => set((state) => {
    const newBelt = { ...belt, id: `belt-${Math.random().toString(36).slice(2, 4)}` };
    const newBelts = [...state.belts, newBelt];
    return {
      belts: newBelts,
      undoStack: [...state.undoStack.slice(-19), { undo: { belts: state.belts }, redo: { belts: newBelts } }],
      redoStack: [],
      canUndo: true,
      canRedo: false
    };
  }),
  updateBelt: (id, updates) => set((state) => ({
    belts: state.belts.map((b) => (b.id === id ? { ...b, ...updates } : b))
  })),
  renameBelt: (oldId, newId) => set((state) => ({
    belts: state.belts.map((b) => (b.id === oldId ? { ...b, id: newId } : b))
  })),
  removeBelt: (id) => set((state) => ({
    belts: state.belts.filter((b) => b.id !== id),
    undoStack: [...state.undoStack.slice(-19), { undo: { belts: state.belts }, redo: { belts: state.belts.filter((b) => b.id !== id) } }],
    redoStack: [],
    canUndo: true,
    canRedo: false
  })),

  addSensor: (sensor) => set((state) => {
    const newSensor = { ...sensor, id: `sensor-${Math.random().toString(36).substr(2, 4)}`, detectionLog: [] };
    const newSensors = [...state.sensors, newSensor];
    return {
      sensors: newSensors,
      undoStack: [...state.undoStack.slice(-19), { undo: { sensors: state.sensors }, redo: { sensors: newSensors } }],
      redoStack: [],
      canUndo: true,
      canRedo: false
    };
  }),
  updateSensor: (id, updates) => set((state) => ({
    sensors: state.sensors.map((s) => (s.id === id ? { ...s, ...updates } : s))
  })),
  addDetectionRecord: (sensorId, record) => set((state) => ({
    sensors: state.sensors.map((s) => (s.id === sensorId ? {
      ...s,
      detectionLog: [{ ...record, id: Math.random().toString(36).substr(2, 6) }, ...s.detectionLog].slice(0, 50)
    } : s))
  })),
  renameSensor: (oldId, newId) => set((state) => ({
    sensors: state.sensors.map((s) => (s.id === oldId ? { ...s, id: newId } : s))
  })),
  removeSensor: (id) => set((state) => ({
    sensors: state.sensors.filter((s) => s.id !== id),
    undoStack: [...state.undoStack.slice(-19), { undo: { sensors: state.sensors }, redo: { sensors: state.sensors.filter((s) => s.id !== id) } }],
    redoStack: [],
    canUndo: true,
    canRedo: false
  })),

  addItem: (item) => set((state) => {
    const newItem = { ...item, id: `item-${Math.random().toString(36).substr(2, 4)}` };
    const newItems = [...state.items, newItem];
    if (state.isPlaying) {
      return { items: newItems };
    }
    return {
      items: newItems,
      undoStack: [...state.undoStack.slice(-19), { undo: { items: state.items }, redo: { items: newItems } }],
      redoStack: [],
      canUndo: true,
      canRedo: false
    };
  }),
  updateItem: (id, updates) => set((state) => ({
    items: state.items.map((i) => (i.id === id ? { ...i, ...updates } : i))
  })),
  bulkUpdateItems: (updatesArray) => set((state) => {
    const changes = new Map(updatesArray.map(u => [u.id, u.updates]));
    return {
      items: state.items.map(i => changes.has(i.id) ? { ...i, ...changes.get(i.id) } : i)
    };
  }),
  renameItem: (oldId, newId) => set((state) => ({
    items: state.items.map((i) => (i.id === oldId ? { ...i, id: newId } : i))
  })),
  removeItem: (id) => set((state) => {
    const newItems = state.items.filter((i) => i.id !== id);
    if (state.isPlaying) {
      return { items: newItems };
    }
    return {
      items: newItems,
      undoStack: [...state.undoStack.slice(-19), { undo: { items: state.items }, redo: { items: newItems } }],
      redoStack: [],
      canUndo: true,
      canRedo: false
    };
  }),

  addSource: (source) => set((state) => ({
    sources: [...state.sources, { ...source, id: `source-${Math.random().toString(36).substr(2, 4)}`, lastGeneratedTime: 0 }]
  })),
  updateSource: (id, updates) => set((state) => ({
    sources: state.sources.map((s) => (s.id === id ? { ...s, ...updates } : s))
  })),
  renameSource: (oldId, newId) => set((state) => ({
    sources: state.sources.map((s) => (s.id === oldId ? { ...s, id: newId } : s))
  })),
  removeSource: (id) => set((state) => ({
    sources: state.sources.filter((s) => s.id !== id)
  })),

  addSink: (sink) => set((state) => ({
    sinks: [...state.sinks, { ...sink, id: `sink-${Math.random().toString(36).substr(2, 4)}` }]
  })),
  updateSink: (id, updates) => set((state) => ({
    sinks: state.sinks.map((s) => (s.id === id ? { ...s, ...updates } : s))
  })),
  renameSink: (oldId, newId) => set((state) => ({
    sinks: state.sinks.map((s) => (s.id === oldId ? { ...s, id: newId } : s))
  })),
  removeSink: (id) => set((state) => ({
    sinks: state.sinks.filter((s) => s.id !== id)
  })),

  setPlaying: (playing) => set((state) => {
    // Snapshot item positions when first starting play (so reset can restore them)
    const shouldSnapshot = playing && !state.isPlaying && state.initialItems.length === 0;
    return {
      isPlaying: playing,
      isStepMode: playing ? false : state.isStepMode,
      isAutoStepping: playing ? false : state.isAutoStepping,
      ...(shouldSnapshot ? { initialItems: state.items.map(i => ({ ...i })) } : {})
    };
  }),
  resetSimulation: () => set((state) => ({
    // Restore original item positions if snapshot exists, otherwise just clear physics state
    items: state.initialItems.length > 0
      ? state.initialItems.map(i => ({ ...i }))
      : state.items.map(i => ({ ...i, rotation: 0 })),
    initialItems: [],
    sensors: state.sensors.map(s => ({ ...s, detectionLog: [], isActive: false })),
    sources: state.sources.map(s => ({ ...s, lastGeneratedTime: 0 })),
    isPlaying: false
  })),
  toggleKineticFriction: () => set((state) => ({ kineticFriction: !state.kineticFriction })),
  toggleCollisionEnabled: () => set((state) => ({ collisionEnabled: !state.collisionEnabled })),
  setActiveTool: (tool) => set({ activeTool: tool }),
  clearItems: () => set({ items: [] }),
  setStepMode: (enabled) => set({ isStepMode: enabled, isPlaying: false, isAutoStepping: false }),
  triggerStep: () => set((state) => ({ stepTriggered: state.stepTriggered + 1 })),
  setSimulatorBackend: (backend) => set({ simulatorBackend: backend }),
  setSimulationSteps: (steps) => set({ simulationSteps: steps }),
  toggleAutoStepping: () => set((state) => ({ isAutoStepping: !state.isAutoStepping })),
  setStepInterval: (interval) => set({ stepInterval: interval })
}));

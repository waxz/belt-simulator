import mqtt, { MqttClient } from 'mqtt';
import { useStore, Belt, Sensor, Source, Item, hashCode } from '../store/useStore';

class MqttManager {
  private client: MqttClient | null = null;
  private currentUrl: string = '';
  private currentPrefix: string = '';
  private unsubscribeStore: (() => void) | null = null;
  private lastSensorStates: Record<string, boolean> = {};
  private publishTimers: Map<string, { timerId: ReturnType<typeof setInterval>; interval: number }> = new Map();
  private sensorPollTimer: ReturnType<typeof setInterval> | null = null;
  // Message log buffer — collected here, flushed to Zustand at 2Hz to avoid per-publish set() calls
  private pendingMessages: { topic: string; payload: string; type: 'in' | 'out' }[] = [];
  private messageFlushTimer: ReturnType<typeof setInterval> | null = null;

  public init() {
    this.destroy(); // Clean up any existing instances/timers before starting anew
    // Subscribe to store changes ONLY for connection/settings management.
    // KEY PERF FIX: Guard with mqttSettings object reference check.
    // The sim loop calls bulkUpdateItems/updateSensor 60x/sec, which fires this subscriber.
    // Without the guard, all that sim work also runs sensor-iteration and updateTimers.
    this.unsubscribeStore = useStore.subscribe((state, prevState) => {
      // *** O(1) Early exit: skip all processing if MQTT settings haven't changed ***
      if (state.mqttSettings === prevState.mqttSettings) return;

      const settings = state.mqttSettings;
      const prevSettings = prevState.mqttSettings;

      // 1. Handle connection changes
      const settingsChanged = 
        settings.brokerUrl !== prevSettings.brokerUrl || 
        settings.enabled !== prevSettings.enabled;

      if (settingsChanged) {
        if (settings.enabled) {
          this.connect(settings.brokerUrl, settings.topicPrefix);
        } else {
          this.disconnect();
        }
      }

      if (settings.topicPrefix !== prevSettings.topicPrefix && settings.enabled) {
        this.currentPrefix = settings.topicPrefix;
        this.resubscribe(state);
      }

      // 2. Update publish timers only when topics config changes
      if (settings.topics !== prevSettings.topics || settingsChanged) {
        this.updateTimers(state);
      }
    });

    // Flush message buffer to Zustand at 2Hz — single set() call for the whole batch
    this.messageFlushTimer = setInterval(() => {
      try {
        if (this.pendingMessages.length === 0) return;
        const msgs = this.pendingMessages.splice(0); // drain atomically
        useStore.getState().batchAddMqttMessages(msgs);
      } catch (e: any) {
        console.error('Error flushing MQTT messages to store:', e);
      }
    }, 500);

    // Dedicated sensor polling loop - runs at 50Hz, independent of the sim's 60fps.
    // This is the MQTT thread: checks for sensor state changes and publishes them.
    this.sensorPollTimer = setInterval(() => {
      try {
        this.pollSensors();
      } catch (e: any) {
        console.error('Error in sensor polling loop:', e);
      }
    }, 20);
  }

  // Buffer a message for deferred Zustand flush — zero allocation cost at call site
  private logMessage(topic: string, payload: string, type: 'in' | 'out') {
    // Keep pending buffer bounded to avoid memory growth when panel is closed for a long time
    if (this.pendingMessages.length < 200) {
      this.pendingMessages.push({ topic, payload, type });
    }
  }

  // Dedicated sensor state polling — runs on its own interval, not in the render loop.
  private pollSensors() {
    if (!this.client || !this.client.connected) return;

    const state = useStore.getState();
    const settings = state.mqttSettings;
    if (!settings.enabled) return;

    state.sensors.forEach(sensor => {
      const prevSensorActive = this.lastSensorStates[sensor.id];
      if (prevSensorActive !== sensor.isActive) {
        this.lastSensorStates[sensor.id] = sensor.isActive;

        // Legacy stateBinding path
        if (sensor.stateBinding) {
          this.publish(
            `${settings.topicPrefix}${sensor.stateBinding}`,
            sensor.isActive ? 1 : 0,
            'raw'
          );
        }

        // Event-driven: immediately publish any topics that contain this sensor
        settings.topics
          .filter((t: any) => t.direction === 'out' && (t.components || []).some((c: any) => c.type === 'sensor' && c.id === sensor.id))
          .forEach((t: any) => this.publishTopic(t.id));
      }
    });

    const activeSensorIds = new Set(state.sensors.map(sensor => sensor.id));
    Object.keys(this.lastSensorStates).forEach(id => {
      if (!activeSensorIds.has(id)) delete this.lastSensorStates[id];
    });
  }

  private updateTimers(state: any) {
    const settings = state.mqttSettings;
    
    // Clear all if disabled
    if (!settings.enabled || !this.client || !this.client.connected) {
      this.publishTimers.forEach(t => clearInterval(t.timerId));
      this.publishTimers.clear();
      return;
    }

    // Identify current topics that are "out"
    const outTopics = settings.topics.filter((t: any) => t.direction === 'out');
    
    // Remove timers for topics that no longer exist or changed interval
    for (const [id, timerInfo] of Array.from(this.publishTimers.entries())) {
      const topic = outTopics.find((t: any) => t.id === id);
      if (!topic || topic.interval !== timerInfo.interval) {
        clearInterval(timerInfo.timerId);
        this.publishTimers.delete(id);
      }
    }

    // Add or update timers
    for (const topic of outTopics) {
      if (!this.publishTimers.has(topic.id)) {
        const timerId = setInterval(() => {
          try {
            this.publishTopic(topic.id);
          } catch (e: any) {
            console.error(`Error in publish timer for topic ${topic.id}:`, e);
          }
        }, Math.max(10, topic.interval));
        this.publishTimers.set(topic.id, { timerId, interval: topic.interval });
      }
    }
  }

  private publishTopic(topicId: string) {
    if (!this.client || !this.client.connected) return;
    
    const state = useStore.getState();
    const settings = state.mqttSettings;
    const topicConfig = settings.topics.find((t: any) => t.id === topicId);
    if (!topicConfig) return;

    const fullTopic = `${settings.topicPrefix}${topicConfig.topic}`;
    const littleEndian = topicConfig.endianness !== 'BE';

    const format = topicConfig.format || 'binary_struct';

    let totalSize = 0;
    const components = topicConfig.components || [];
    components.forEach((c: any) => {
      if (c.type === 'belt') totalSize += 8;
      else if (c.type === 'sensor') totalSize += 1;
      else if (c.type === 'item') totalSize += 12;
    });

    if (format === 'binary_struct') {
      const buffer = new ArrayBuffer(totalSize);
      const view = new DataView(buffer);
      let offset = 0;

      components.forEach((comp: any) => {
        if (comp.type === 'belt') {
          const belt = state.belts.find(b => b.id === comp.id);
          view.setFloat32(offset, belt?.speed || 0, littleEndian);
          view.setFloat32(offset + 4, belt?.directionAngle || 0, littleEndian);
          offset += 8;
        } else if (comp.type === 'sensor') {
          const sensor = state.sensors.find(s => s.id === comp.id);
          view.setUint8(offset, sensor?.isActive ? 1 : 0);
          offset += 1;
        } else if (comp.type === 'item') {
          const item = state.items.find(i => i.id === comp.id);
          view.setInt32(offset, item ? hashCode(item.id) : 0, littleEndian);
          view.setFloat32(offset + 4, item?.x || 0, littleEndian);
          view.setFloat32(offset + 8, item?.y || 0, littleEndian);
          offset += 12;
        }
      });

      const u8 = new Uint8Array(buffer);
      try {
        this.client.publish(fullTopic, u8 as any); // use Uint8Array directly
        const hexStr = Array.from(u8).map(b => b.toString(16).padStart(2, '0')).join(' ');
        this.logMessage(fullTopic, `[Binary Struct] ${hexStr}`, 'out');
      } catch (e: any) {
        useStore.getState().addLog(`MQTT Publish Error on topic ${fullTopic}: ${e.message}`, 'error');
      }
    } else {
      // json or raw
      const values: number[] = [];
      components.forEach((comp: any) => {
        if (comp.type === 'belt') {
          const belt = state.belts.find(b => b.id === comp.id);
          values.push(belt?.speed || 0, belt?.directionAngle || 0);
        } else if (comp.type === 'sensor') {
          const sensor = state.sensors.find(s => s.id === comp.id);
          values.push(sensor?.isActive ? 1 : 0);
        } else if (comp.type === 'item') {
          const item = state.items.find(i => i.id === comp.id);
          values.push(item ? hashCode(item.id) : 0, item?.x || 0, item?.y || 0);
        }
      });
      const payload = format === 'json' ? JSON.stringify({ values }) : values.join(',');
      try {
        this.client.publish(fullTopic, payload);
        this.logMessage(fullTopic, payload, 'out');
      } catch (e: any) {
        useStore.getState().addLog(`MQTT Publish Error on topic ${fullTopic}: ${e.message}`, 'error');
      }
    }
  }

  private connect(url: string, prefix: string) {
    this.disconnect();
    this.currentUrl = url;
    this.currentPrefix = prefix;

    try {
      this.client = mqtt.connect(url, {
        queueQoSZero: false,      // do NOT buffer QoS-0 messages while offline — prevents reconnect flood
        reconnectPeriod: 2000,    // wait 2 s between reconnect attempts
        connectTimeout: 10 * 1000 // declare failure after 10 s
      });
      
      this.client.on('connect', () => {
        useStore.getState().addLog(`MQTT Connected to ${url}`, 'info');
        this.resubscribe(useStore.getState());
        this.updateTimers(useStore.getState());
      });

      this.client.on('reconnect', () => {
        useStore.getState().addLog(`MQTT Reconnecting to ${url}...`, 'warn');
      });

      this.client.on('close', () => {
        useStore.getState().addLog('MQTT Connection closed', 'warn');
      });

      this.client.on('offline', () => {
        useStore.getState().addLog('MQTT Client went offline', 'warn');
      });

      this.client.on('error', (err) => {
        useStore.getState().addLog(`MQTT Error: ${err.message}`, 'error');
      });

      this.client.on('message', (topic, message) => {
        // message is a Buffer
        this.handleMessage(topic, message);
      });

    } catch (e: any) {
      useStore.getState().addLog(`MQTT Connect Exception: ${e.message}`, 'error');
    }
  }

  private disconnect() {
    if (this.client) {
      this.client.end(true);
      this.client = null;
      useStore.getState().addLog('MQTT Disconnected', 'info');
    }
  }

  private resubscribe(state: any) {
    if (!this.client || !this.client.connected) return;

    // Unsubscribe from all first (to avoid duplicates if we had a wildcard, but we'll just wildcard sub)
    this.client.subscribe(`${this.currentPrefix}#`);
    useStore.getState().addLog(`MQTT Subscribed to ${this.currentPrefix}#`, 'info');
  }

  private publish(topic: string, value: any, format: 'json' | 'raw' | 'binary_float') {
    if (!this.client || !this.client.connected) return;
    
    let payload = '';
    if (format === 'json') {
      payload = JSON.stringify({ value });
    } else {
      payload = value.toString();
    }
    
    try {
      this.client.publish(topic, payload);
      this.logMessage(topic, payload, 'out');
    } catch (e: any) {
      useStore.getState().addLog(`MQTT Publish Error on topic ${topic}: ${e.message}`, 'error');
    }
  }

  public publishManual(topic: string, message: string) {
    if (!this.client || !this.client.connected) return;
    try {
      this.client.publish(topic, message);
      this.logMessage(topic, message, 'out');
    } catch (e: any) {
      useStore.getState().addLog(`MQTT Publish Manual Error on topic ${topic}: ${e.message}`, 'error');
    }
  }

  private handleMessage(topic: string, message: Buffer) {
    const state = useStore.getState();
    const { mqttSettings } = state;
    const prefix = mqttSettings.topicPrefix;
    
    if (!topic.startsWith(prefix)) return;
    const variableOrTopic = topic.substring(prefix.length);

    // Check if it matches a defined IN topic
    const topicConfig = mqttSettings.topics.find((t: any) => t.topic === variableOrTopic && t.direction === 'in');
    
    if (topicConfig) {
      const format = topicConfig.format || 'binary_struct';
      if (format === 'binary_struct') {
        const littleEndian = topicConfig.endianness !== 'BE';
        const u8 = new Uint8Array(message);
        const view = new DataView(u8.buffer);
        let offset = 0;

        const components = topicConfig.components || [];
        components.forEach((comp: any) => {
          if (offset >= view.byteLength) return;

          if (comp.type === 'belt') {
            if (offset + 8 > view.byteLength) return;
            const speed = view.getFloat32(offset, littleEndian);
            const dirAngle = view.getFloat32(offset + 4, littleEndian);
            state.updateBelt(comp.id, { speed, directionAngle: dirAngle });
            offset += 8;
          } else if (comp.type === 'sensor') {
            if (offset + 1 > view.byteLength) return;
            const stateVal = view.getUint8(offset);
            state.updateSensor(comp.id, { isActive: stateVal > 0 });
            offset += 1;
          } else if (comp.type === 'item') {
            if (offset + 12 > view.byteLength) return;
            const idHash = view.getInt32(offset, littleEndian);
            const posX = view.getFloat32(offset + 4, littleEndian);
            const posY = view.getFloat32(offset + 8, littleEndian);
            
            const item = state.items.find(i => hashCode(i.id) === idHash);
            if (item) {
               state.updateItem(item.id, { x: posX, y: posY });
            } else {
               state.addItem({
                 x: posX,
                 y: posY,
                 width: 0.4,
                 height: 0.4,
                 rotation: 0,
                 color: '#f59e0b',
                 type: 'box',
                 label: `PLC-${idHash}`
               });
            }
            offset += 12;
          }
        });
        const hexStr = Array.from(new Uint8Array(message)).map(b => b.toString(16).padStart(2, '0')).join(' ');
        this.logMessage(topic, `[Binary Struct IN] ${hexStr}`, 'in');
      } else {
        const msgStr = message.toString();
        this.logMessage(topic, msgStr, 'in');
        
        let values: number[] = [];
        if (format === 'json') {
          try {
            const obj = JSON.parse(msgStr);
            if (Array.isArray(obj.values)) values = obj.values.map(Number);
          } catch (e) {}
        } else {
          values = msgStr.split(',').map(Number);
        }

        let valIdx = 0;
        const components = topicConfig.components || [];
        components.forEach((comp: any) => {
          if (comp.type === 'belt') {
            if (valIdx + 1 < values.length) {
              state.updateBelt(comp.id, { speed: values[valIdx], directionAngle: values[valIdx+1] });
            }
            valIdx += 2;
          } else if (comp.type === 'sensor') {
            if (valIdx < values.length) {
              state.updateSensor(comp.id, { isActive: values[valIdx] > 0 });
            }
            valIdx += 1;
          } else if (comp.type === 'item') {
            valIdx += 3; // similar parsing
          }
        });
      }
      return;
    }

    // Fallback to legacy single-variable bindings
    const msgStr = message.toString();
    this.logMessage(topic, msgStr, 'in');

    const val = Number(msgStr);
    if (!isNaN(val)) {
      this.applyVariableValue(variableOrTopic, val, state);
    }
  }

  private applyVariableValue(varName: string, val: number, state: any) {
    state.belts.forEach((b: any) => {
      if (b.speedBinding === varName) {
        state.updateBelt(b.id, { speed: val });
      }
      if (b.directionAngleBinding === varName) {
        state.updateBelt(b.id, { directionAngle: val });
      }
      if (b.directionBinding === varName) {
        state.updateBelt(b.id, { direction: val < 0 ? -1 : 1 });
      }
    });
    state.sources.forEach((s: any) => {
      if (s.intervalBinding === varName) {
        state.updateSource(s.id, { interval: Math.max(0.1, val) });
      }
      if (s.triggerBinding === varName && val > 0) {
        const w = s.minWidth + Math.random() * (s.maxWidth - s.minWidth);
        const h = s.minHeight + Math.random() * (s.maxHeight - s.minHeight);
        state.addItem({
          x: s.x,
          y: s.y,
          width: w,
          height: h,
          rotation: 0,
          label: `P-${Math.random().toString(36).substr(2, 3).toUpperCase()}`,
          type: 'box',
          color: s.colorScheme ? s.colorScheme[Math.floor(Math.random() * s.colorScheme.length)] : `hsl(${Math.random() * 30 + 10}, 70%, 50%)`
        });
      }
    });
  }

  public destroy() {
    this.disconnect();
    this.publishTimers.forEach(t => clearInterval(t.timerId));
    this.publishTimers.clear();
    if (this.sensorPollTimer !== null) {
      clearInterval(this.sensorPollTimer);
      this.sensorPollTimer = null;
    }
    if (this.messageFlushTimer !== null) {
      clearInterval(this.messageFlushTimer);
      this.messageFlushTimer = null;
    }
    this.lastSensorStates = {};
    this.pendingMessages = [];
    if (this.unsubscribeStore) {
      this.unsubscribeStore();
      this.unsubscribeStore = null;
    }
  }
}

export const mqttManager = new MqttManager();

// HMR (Hot Module Replacement) safety helper:
// Cleans up background setInterval/WebSocket connections of the old singleton during dev hot-reloads.
const GLOBAL_KEY = '__GLOBAL_MQTT_MANAGER__';
if (typeof window !== 'undefined') {
  const win = window as any;
  if (win[GLOBAL_KEY]) {
    try {
      win[GLOBAL_KEY].destroy();
    } catch (e) {
      console.error('Error destroying stale HMR MQTT manager:', e);
    }
  }
  win[GLOBAL_KEY] = mqttManager;
}

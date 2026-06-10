
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Stage, Layer, Rect, Circle, Line, Arc, Group, Transformer, Text } from 'react-konva';
import Matter from 'matter-js';
import { init, World, RigidBodyDesc, ColliderDesc, RigidBody } from '@dimforge/rapier2d-compat';
import { useStore, Belt, Sensor, Item, PIXELS_PER_METER, ComponentType, snapToGrid } from '../store/useStore';
import CreationDialog from './CreationDialog';
import SimulationOverlayInfo from './SimulationOverlayInfo';
import NodesLayer from './NodesLayer';
import { RotateCcw } from 'lucide-react';

interface SimulationCanvasProps {
  selectedId: string | null;
  onSelectId: (id: string | null) => void;
  draggable?: boolean;
}

// Global guard for Rapier initialization
let globalRapierInitializing = false;
let globalRapierReady = false;

export default function SimulationCanvas({ selectedId, onSelectId, draggable = true }: SimulationCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const isPlaying = useStore(state => state.isPlaying);
  const isStepMode = useStore(state => state.isStepMode);
  const stepTriggered = useStore(state => state.stepTriggered);
  const kineticFriction = useStore(state => state.kineticFriction);
  const collisionEnabled = useStore(state => state.collisionEnabled);
  const activeTool = useStore(state => state.activeTool);
  const setActiveTool = useStore(state => state.setActiveTool);

  const updateItem = useStore(state => state.updateItem);
  const addItem = useStore(state => state.addItem);
  const removeItem = useStore(state => state.removeItem);
  const clearItems = useStore(state => state.clearItems);
  const addSource = useStore(state => state.addSource);
  const addSink = useStore(state => state.addSink);
  const updateSensor = useStore(state => state.updateSensor);
  const updateSource = useStore(state => state.updateSource);
  const addSensor = useStore(state => state.addSensor);
  const addBelt = useStore(state => state.addBelt);

  const setFps = useStore(state => state.setFps);
  const addLog = useStore(state => state.addLog);
  const simulatorBackend = useStore(state => state.simulatorBackend);

  const prevStepRef = useRef(useStore.getState().stepTriggered);
  const frameCountRef = useRef(0);
  const lastFpsTimeRef = useRef(performance.now());

  const [creationPos, setCreationPos] = useState<{ x: number, y: number } | null>(null);
  const [stageScale, setStageScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });

  const viewportBounds = useMemo(() => {
    if (dimensions.width === 0 || dimensions.height === 0) return undefined;
    return {
      x: (-stagePos.x) / stageScale,
      y: (-stagePos.y) / stageScale,
      width: dimensions.width / stageScale,
      height: dimensions.height / stageScale,
      scale: stageScale
    };
  }, [dimensions.width, dimensions.height, stageScale, stagePos.x, stagePos.y]);

  const stageRef = useRef<any>(null);

  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    const scaleBy = 1.1;
    const stage = e.target.getStage();
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
    const boundedScale = Math.max(0.1, Math.min(5, newScale));

    setStageScale(boundedScale);
    setStagePos({
      x: pointer.x - mousePointTo.x * boundedScale,
      y: pointer.y - mousePointTo.y * boundedScale,
    });
  };

  const handleAutoFit = useCallback(() => {
    if (!containerRef.current) return;
    const s = useStore.getState();
    const nodes = [...s.belts, ...s.sensors, ...s.sources, ...s.sinks, ...s.items];
    if (nodes.length === 0) {
      setStageScale(1);
      setStagePos({ x: 0, y: 0 });
      return;
    }

    const margin = 2; // meters
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    nodes.forEach(n => {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x);
      maxY = Math.max(maxY, n.y);
    });

    const worldW = (maxX - minX + margin * 2) * PIXELS_PER_METER;
    const worldH = (maxY - minY + margin * 2) * PIXELS_PER_METER;
    const viewW = containerRef.current.clientWidth;
    const viewH = containerRef.current.clientHeight;

    const scale = Math.min(viewW / worldW, viewH / worldH, 2);
    setStageScale(scale);
    setStagePos({
      x: -(minX - margin) * PIXELS_PER_METER * scale,
      y: (maxY + margin) * PIXELS_PER_METER * scale
    });
  }, []);

  // Physics Refs
  const engine = useRef(Matter.Engine.create());

  // Rapier Refs
  const rapierWorld = useRef<World | null>(null);
  const [rapierReady, setRapierReady] = useState(false);
  const rapierBodiesMap = useRef<Map<string, RigidBody>>(new Map()); // Map item id to Rapier body object
  const rapierCollidersMap = useRef<Map<string, any>>(new Map());
  const rapierFloorCreated = useRef(false);
  const isRapierInitializing = useRef(false);

  const safeNum = (n: any, fallback = 0) => (isFinite(n) ? n : fallback);

  useEffect(() => {
    if (globalRapierInitializing && !globalRapierReady) return;

    let world: World | null = null;
    let cancelled = false;

    const startRapier = async () => {
      try {
        if (!globalRapierReady) {
          globalRapierInitializing = true;
          await init();
          globalRapierReady = true;
          globalRapierInitializing = false;
        }

        if (cancelled) return;

        world = new World({ x: 0, y: 0 });
        if (cancelled) {
          world.free();
          world = null;
          return;
        }

        rapierWorld.current = world;

        // Initialize floor
        const gBody = world.createRigidBody(RigidBodyDesc.fixed().setTranslation(2000, 4000));
        gBody.userData = 'floor';
        world.createCollider(ColliderDesc.cuboid(4000, 100), gBody);
        rapierFloorCreated.current = true;

        // Match Matter.js standard step or handle substeps
        world.timestep = 1 / 60;
        if (!cancelled) {
          setRapierReady(true);
          addLog('Rapier2D (WASM) Initialized', 'info');
        }
      } catch (err) {
        console.error('Failed to init Rapier:', err);
        addLog('Rapier Init Error', 'error');
        globalRapierInitializing = false;
      }
    };

    startRapier();

    return () => {
      cancelled = true;
      setRapierReady(false);
      // Capture the current world in a local variable for synchronous cleanup
      const w = rapierWorld.current;
      rapierWorld.current = null;
      if (w) {
        try {
          rapierBodiesMap.current.clear();
          rapierCollidersMap.current.clear();
          rapierFloorCreated.current = false;
          // Free synchronously to ensure no more calls reach this world
          w.free();
          addLog('Rapier2D World Freed', 'info');
        } catch (err) {
          console.error('Error freeing Rapier world:', err);
        }
      }
    };
  }, []);

  useEffect(() => {
    engine.current.gravity.x = 0;
    engine.current.gravity.y = 0;
  }, []);
  const bodiesMap = useRef<Map<string, Matter.Body>>(new Map());
  useEffect(() => {
    (window as any).bodiesMapGlobal = bodiesMap.current;
    (window as any).rapierBodiesMapGlobal = rapierBodiesMap.current;
    (window as any).Matter = Matter;
    return () => {
      const win = window as any;
      if (win.bodiesMapGlobal === bodiesMap.current) delete win.bodiesMapGlobal;
      if (win.rapierBodiesMapGlobal === rapierBodiesMap.current) delete win.rapierBodiesMapGlobal;
      if (win.Matter === Matter) delete win.Matter;
    };
  }, []);
  const itemNodesRef = useRef<Map<string, any>>(new Map());
  const requestRef = useRef<number>(0);

  // Colors from theme
  const colors = {
    belt: '#1e293b',
    beltBorder: '#3b82f666',
    sensorActive: '#10b981',
    sensorInactive: '#f1f5f933',
    selection: '#fbbf24',
    selectionRing: '#fbbf2433'
  };

  // Initialize Canvas Size
  useEffect(() => {
    if (containerRef.current) {
      const { clientWidth, clientHeight } = containerRef.current;
      setDimensions({ width: clientWidth, height: clientHeight });
    }

    const handleResize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const itemsRef = useRef<Item[]>([]);
  const isPlayingRef = useRef(isPlaying);
  const isStepModeRef = useRef(isStepMode);
  const stepTriggeredRef = useRef(stepTriggered);
  const kineticFrictionRef = useRef(kineticFriction);
  const collisionEnabledRef = useRef(collisionEnabled);
  const simulatorBackendRef = useRef(useStore.getState().simulatorBackend);
  const simulationStepsRef = useRef(useStore.getState().simulationSteps);
  const beltsRef = useRef<Belt[]>([]);
  const sensorsRef = useRef<Sensor[]>([]);
  const sourcesRef = useRef<any[]>([]);
  const sinksRef = useRef<any[]>([]);
  const beltMetadataRef = useRef<any[]>([]);
  const itemIdsSetRef = useRef<Set<string>>(new Set());
  const itemsMapRef = useRef<Map<string, Item>>(new Map());
  const lastDetectedItems = useRef<Map<string, string>>(new Map());
  // Per-item dominant belt tracking: id -> { beltId, overlapCount, beltType }
  const lastDominantBeltRef = useRef<Map<string, { beltId: string; overlapCount: number; beltType: string }>>(new Map());

  // Subscription block to avoid re-renders while updating mutable refs for physics thread
  useEffect(() => {
    // initialize immediately
    const s = useStore.getState();
    itemsRef.current = s.items;
    beltsRef.current = s.belts;
    sensorsRef.current = s.sensors;
    sourcesRef.current = s.sources;
    sinksRef.current = s.sinks;
    simulatorBackendRef.current = s.simulatorBackend;
    simulationStepsRef.current = s.simulationSteps;

    const computeBeltMetadata = (beltsArray: Belt[]) => {
      const PIXELS = PIXELS_PER_METER;
      beltMetadataRef.current = beltsArray.map(belt => {
        const bX = belt.x * PIXELS;
        const bY = -belt.y * PIXELS;
        let hw = 0, hh = 0;
        let cos = 1, sin = 0;

        if (belt.type === 'linear') {
          const pts = belt.trianglePoints || [{ x: -1, y: -0.2 }, { x: 1, y: -0.2 }, { x: 1, y: 0.2 }, { x: -1, y: 0.2 }];
          const maxDim = Math.max(...pts.map(p => Math.max(Math.abs(p.x), Math.abs(p.y)))) * PIXELS * 1.5;
          hw = hh = maxDim;
          const angleRad = (-belt.rotation * Math.PI) / 180;
          cos = Math.cos(-angleRad);
          sin = Math.sin(-angleRad);
        } else if (belt.type === 'curved') {
          hw = hh = (belt.radius + belt.beltWidth / 2) * PIXELS;
        } else { hw = hh = 2 * PIXELS; }

        return {
          belt, bX, bY, hw, hh, cos, sin,
          brSqMin: belt.type === 'curved' ? Math.pow((belt.radius - belt.beltWidth / 2) * PIXELS, 2) : 0,
          brSqMax: belt.type === 'curved' ? Math.pow((belt.radius + belt.beltWidth / 2) * PIXELS, 2) : 0,
          normStart: belt.type === 'curved' ? (((-belt.endAngle % 360) + 360) % 360) : 0,
          normEnd: belt.type === 'curved' ? (((-belt.startAngle % 360) + 360) % 360) : 0,
          span: belt.type === 'curved' ? (function () {
            let ns = (((-belt.endAngle % 360) + 360) % 360);
            let ne = (((-belt.startAngle % 360) + 360) % 360);
            let s = ne - ns;
            if (s <= 0 && belt.endAngle !== belt.startAngle) s += 360;
            return s;
          })() : 0
        };
      });
    };

    const computeItemsMetadata = (itemsArray: Item[]) => {
      itemIdsSetRef.current = new Set(itemsArray.map(i => i.id));
      const m = new Map<string, Item>();
      for (let i = 0; i < itemsArray.length; i++) {
        // Key by raw item.id — same key used in rapierBodiesMap
        m.set(itemsArray[i].id, itemsArray[i]);
      }
      itemsMapRef.current = m;
    };

    computeBeltMetadata(s.belts);
    computeItemsMetadata(s.items);

    const checkMatterSync = (itemsArray: Item[], isPlay: boolean, isCollisionEnabled: boolean) => {
      const world = engine.current.world;
      const itemIds = new Set(itemsArray.map(i => i.id));
      bodiesMap.current.forEach((body, id) => {
        if (!itemIds.has(id)) {
          Matter.World.remove(world, body);
          bodiesMap.current.delete(id);
        }
      });

      itemsArray.forEach(item => {
        if (!bodiesMap.current.has(item.id)) {
          const body = Matter.Bodies.rectangle(
            item.x * PIXELS_PER_METER,
            -item.y * PIXELS_PER_METER,
            item.width * PIXELS_PER_METER,
            item.height * PIXELS_PER_METER,
            {
              friction: 0.1,
              frictionAir: 0.02,
              restitution: 0.3,
              label: `item-${item.id}`,
              collisionFilter: {
                group: isCollisionEnabled ? 0 : -1
              }
            }
          );
          Matter.World.add(world, body);
          bodiesMap.current.set(item.id, body);
        } else if (!isPlay) {
          const body = bodiesMap.current.get(item.id)!;
          Matter.Body.setPosition(body, {
            x: item.x * PIXELS_PER_METER,
            y: -item.y * PIXELS_PER_METER
          });
          Matter.Body.setAngle(body, (-item.rotation * Math.PI) / 180);
        }
      });

      bodiesMap.current.forEach((body) => {
        body.collisionFilter.group = isCollisionEnabled ? 0 : -1;
      });

      const existingBodies = Matter.Composite.allBodies(world);
      if (!existingBodies.some(b => b.label === 'floor')) {
        const floor = Matter.Bodies.rectangle(2000, 4000, 8000, 200, { isStatic: true, label: 'floor' });
        Matter.World.add(world, [floor]);
      }
    };

    checkMatterSync(s.items, s.isPlaying, s.collisionEnabled);

    return useStore.subscribe((state, prevState) => {
      if (state.items !== prevState.items) {
        itemsRef.current = state.items;
        computeItemsMetadata(state.items);
        checkMatterSync(state.items, state.isPlaying, state.collisionEnabled);
        lastDominantBeltRef.current.forEach((_value, id) => {
          if (!itemIdsSetRef.current.has(id)) lastDominantBeltRef.current.delete(id);
        });
      }
      if (state.collisionEnabled !== prevState.collisionEnabled) {
        checkMatterSync(state.items, state.isPlaying, state.collisionEnabled);
        rapierCollidersMap.current.forEach((collider) => {
          if (typeof collider.setSensor === 'function') {
            collider.setSensor(!state.collisionEnabled);
          }
        });
      }
      if (state.belts !== prevState.belts) {
        beltsRef.current = state.belts;
        computeBeltMetadata(state.belts);
      }
      if (state.sensors !== prevState.sensors) {
        sensorsRef.current = state.sensors;
        const sensorIds = new Set(state.sensors.map(sensor => sensor.id));
        lastDetectedItems.current.forEach((_value, id) => {
          if (!sensorIds.has(id)) lastDetectedItems.current.delete(id);
        });
      }
      if (state.sources !== prevState.sources) sourcesRef.current = state.sources;
      if (state.sinks !== prevState.sinks) sinksRef.current = state.sinks;
      if (state.simulatorBackend !== prevState.simulatorBackend) simulatorBackendRef.current = state.simulatorBackend;
      if (state.simulationSteps !== prevState.simulationSteps) simulationStepsRef.current = state.simulationSteps;
    });
  }, []);

  const prevIsPlayingRef = useRef(isPlaying);
  useEffect(() => {
    if (prevIsPlayingRef.current && !isPlaying) {
      // Sync physics to React store when pausing
      const PIXELS = PIXELS_PER_METER;
      const { bulkUpdateItems, simulatorBackend } = useStore.getState();

      const bulkUpdates: { id: string, updates: Partial<Item> }[] = [];

      if (simulatorBackend === 'matter') {
        bodiesMap.current.forEach((body, id) => {
          bulkUpdates.push({
            id,
            updates: {
              x: body.position.x / PIXELS,
              y: -body.position.y / PIXELS,
              rotation: (-body.angle * 180) / Math.PI,
            }
          });
        });
      } else if (simulatorBackend === 'rapier' && rapierReady && rapierWorld.current) {
        rapierBodiesMap.current.forEach((rb, id) => {
          const pos = rb.translation();
          const rot = rb.rotation();
          bulkUpdates.push({
            id,
            updates: {
              x: pos.x / PIXELS,
              y: -pos.y / PIXELS,
              rotation: (-rot * 180) / Math.PI,
            }
          });
        });
      }
      if (bulkUpdates.length > 0) {
        bulkUpdateItems(bulkUpdates);
      }
    }
    prevIsPlayingRef.current = isPlaying;
    isPlayingRef.current = isPlaying;
  }, [isPlaying, rapierReady]);
  useEffect(() => { isStepModeRef.current = isStepMode; }, [isStepMode]);
  useEffect(() => { stepTriggeredRef.current = stepTriggered; }, [stepTriggered]);
  useEffect(() => { kineticFrictionRef.current = kineticFriction; }, [kineticFriction]);
  useEffect(() => { collisionEnabledRef.current = collisionEnabled; }, [collisionEnabled]);

  const isStepping = useRef(false);
  const lastTimeRef = useRef<number>(0);
  const timeAccumulatorRef = useRef<number>(0);
  const simulationTimeRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      bodiesMap.current.clear();
      itemNodesRef.current.clear();
      itemsMapRef.current.clear();
      itemIdsSetRef.current.clear();
      beltMetadataRef.current = [];
      lastDetectedItems.current.clear();
      lastDominantBeltRef.current.clear();
      Matter.World.clear(engine.current.world, false);
      Matter.Engine.clear(engine.current);
    };
  }, []);


  // Simulation Loop
  const animate = useCallback((time: number) => {
    if (isStepping.current) return;

    if (lastTimeRef.current === 0) {
      lastTimeRef.current = time;
      lastFrameTimeRef.current = time;
    }
    
    // Precise delta time in seconds
    const frameDeltaMs = time - lastTimeRef.current;
    const preciseDt = (time - lastFrameTimeRef.current) / 1000;
    lastFrameTimeRef.current = time;
    lastTimeRef.current = time;
    
    // Cap delta to prevent huge jumps
    const cappedDeltaMs = Math.min(frameDeltaMs, 100);
    const cappedDt = Math.min(preciseDt, 0.1);

    const isPlaying = isPlayingRef.current;
    if (isPlaying) {
      timeAccumulatorRef.current += cappedDeltaMs;
    }

    const isStepMode = isStepModeRef.current;
    const stepTriggered = stepTriggeredRef.current;
    const simulatorBackend = simulatorBackendRef.current;
    const items = itemsRef.current;
    const itemsMap = itemsMapRef.current;
    const itemIds = itemIdsSetRef.current;
    const belts = beltsRef.current;
    const beltMetadata = beltMetadataRef.current;
    const sensors = sensorsRef.current;
    const sources = sourcesRef.current;
    const sinks = sinksRef.current;
    const kineticFriction = kineticFrictionRef.current;
    const collisionEnabled = collisionEnabledRef.current;

    // FPS Tracking
    frameCountRef.current++;
    if (time - lastFpsTimeRef.current >= 1000) {
      setFps(frameCountRef.current);
      frameCountRef.current = 0;
      lastFpsTimeRef.current = time;
    }

    const startPerf = performance.now();
    let physicsTime = 0;
    let logicTime = 0;
    let renderTime = 0;

    if (rapierReady && rapierWorld.current && simulatorBackend === 'rapier') {
      const world = rapierWorld.current;
      if (!world) return;
      const logicStart = performance.now();
      try {
        // 1. Sink Synchronize (Remove stale)
        rapierBodiesMap.current.forEach((body, id) => {
          if (!itemIds.has(id)) {
            world.removeRigidBody(body);
            rapierBodiesMap.current.delete(id);
            rapierCollidersMap.current.delete(id);
          }
        });

        // 2. Add or sync bodies
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          let rb = rapierBodiesMap.current.get(item.id);
          if (!rb) {
            const rx = safeNum(item.x * PIXELS_PER_METER);
            const ry = safeNum(-item.y * PIXELS_PER_METER);
            const rr = safeNum((-item.rotation * Math.PI) / 180);
            const rw = Math.max(0.1, safeNum((item.width * PIXELS_PER_METER) / 2));
            const rh = Math.max(0.1, safeNum((item.height * PIXELS_PER_METER) / 2));

            const rbDesc = RigidBodyDesc.dynamic()
              .setTranslation(rx, ry)
              .setRotation(rr);
            rb = world.createRigidBody(rbDesc);
            const clDesc = ColliderDesc.cuboid(rw, rh)
              .setRestitution(0.3).setFriction(0.1);
            if (!collisionEnabled) clDesc.setSensor(true);
            const collider = world.createCollider(clDesc, rb);
            rapierBodiesMap.current.set(item.id, rb);
            rapierCollidersMap.current.set(item.id, collider);
          } else if (!isPlaying) {
            const rx = safeNum(item.x * PIXELS_PER_METER);
            const ry = safeNum(-item.y * PIXELS_PER_METER);
            const rr = safeNum((-item.rotation * Math.PI) / 180);
            rb.setTranslation({ x: rx, y: ry }, true);
            rb.setRotation(rr, true);
          }
        }
      } finally { }
      logicTime += performance.now() - logicStart;
    }

    if (isPlaying || (isStepMode && stepTriggered !== prevStepRef.current)) {
      if (isStepMode) {
        prevStepRef.current = stepTriggered;
        timeAccumulatorRef.current = 1000 / 60; // force exactly 1 frame delay
      }

      const FRAME_MS = 1000 / 60;
      const PIXELS = PIXELS_PER_METER;
      const subSteps = simulationStepsRef.current;

      let framesToRun = 0;
      while (timeAccumulatorRef.current >= FRAME_MS) {
        timeAccumulatorRef.current -= FRAME_MS;
        framesToRun++;
      }

      if (framesToRun > 0) {
        if (framesToRun > 10) framesToRun = 10;

        // Use precise delta time in seconds for integration
        const preciseDt = cappedDt / framesToRun;
        const stepDt = (FRAME_MS / 1000) / subSteps;

        let physicsStart = performance.now();
        for (let frameIter = 0; frameIter < framesToRun; frameIter++) {
          simulationTimeRef.current += FRAME_MS;
          const deltaTime = FRAME_MS / subSteps;

          if (simulatorBackend === 'matter') {
            const itemBodies: Matter.Body[] = [];
            bodiesMap.current.forEach(b => itemBodies.push(b));

            for (let s = 0; s < subSteps; s++) {
              for (let bIdx = 0; bIdx < itemBodies.length; bIdx++) {
                const body = itemBodies[bIdx];
                const bounds = body.bounds;
                const bPos = body.position;
                let sumVx = 0, sumVy = 0, sumWeight = 0, dominantBelt = null, maxOverlap = 0;

                const itemId = body.label.replace('item-', '');
                const prevDominant = lastDominantBeltRef.current.get(itemId);
                const prevDominantId = prevDominant?.beltId;

                for (let i = 0; i < beltMetadata.length; i++) {
                  const meta = beltMetadata[i];
                  // Fast AABB check
                  if (bounds.max.x < meta.bX - meta.hw || bounds.min.x > meta.bX + meta.hw ||
                    bounds.max.y < meta.bY - meta.hh || bounds.min.y > meta.bY + meta.hh) continue;

                  let overlapCount = 0;
                  const dx = bPos.x - meta.bX;
                  const dy = bPos.y - meta.bY;

                  if (meta.belt.type === 'curved') {
                    const distSq = dx * dx + dy * dy;
                    if (distSq >= meta.brSqMin && distSq <= meta.brSqMax) {
                      // Angle check
                      let curAng = Math.atan2(dy, dx) * (180 / Math.PI);
                      if (curAng < 0) curAng += 360;
                      let rel = curAng - meta.normStart;
                      if (rel < 0) rel += 360;
                      if (rel >= 360) rel -= 360;
                      if (rel <= meta.span) overlapCount = 5;
                    }
                  } else if (meta.belt.type === 'linear') {
                    if (isPointInBeltMeta(bPos.x, bPos.y, meta)) {
                      overlapCount = 4; // Higher priority for linear belts
                      for (let v = 0; v < 4; v++) {
                        if (isPointInBeltMeta(body.vertices[v].x, body.vertices[v].y, meta)) overlapCount++;
                      }
                    }
                  }

                  // Fix #B: Hysteresis — give previous dominant belt an artificial bonus
                  // so it remains dominant until the parcel's center fully leaves it
                  if (overlapCount > 0 && meta.belt.id === prevDominantId) {
                    overlapCount += 5;
                  }

                  if (overlapCount > 0) {
                    if (overlapCount > maxOverlap) { maxOverlap = overlapCount; dominantBelt = meta.belt; }
                  }
                }

                if (dominantBelt) {
                  const v = getBeltVelocityAtPoint(bPos.x, bPos.y, dominantBelt);
                  const factor = kineticFriction ? 0.12 : 0.3;
                  const maxSpeed = dominantBelt.speed * PIXELS * 1.5;
                  const newVx = safeNum(body.velocity.x * (1 - factor) + (v.x / 60) * factor);
                  const newVy = safeNum(body.velocity.y * (1 - factor) + (v.y / 60) * factor);
                  const speedMag = Math.sqrt(newVx * newVx + newVy * newVy);
                  let finalVx = newVx, finalVy = newVy;
                  if (speedMag > maxSpeed) {
                    finalVx = (newVx / speedMag) * maxSpeed;
                    finalVy = (newVy / speedMag) * maxSpeed;
                  }
                  Matter.Body.setVelocity(body, { x: finalVx, y: finalVy });

                  // Normalized angle delta helper (avoids while-loop aliasing artifacts)
                  const lerpAngle = (current: number, target: number, alpha: number) => {
                    let delta = target - current;
                    // Normalize to [-PI, PI]
                    delta = delta - Math.PI * 2 * Math.round(delta / (Math.PI * 2));
                    Matter.Body.setAngle(body, current + delta * alpha);
                  };

                  if (Math.abs(v.x) > 0.001 || Math.abs(v.y) > 0.001) {
                    const targetAngle = Math.atan2(v.y, v.x);
                    const lerpAlpha = dominantBelt.type === 'curved' ? 0.15 : 0.1;
                    lerpAngle(body.angle, targetAngle, lerpAlpha);
                  }

                  if (dominantBelt.type === 'curved') {
                    const absSpeed = Math.abs(dominantBelt.speed);
                    const safeRadius = Math.max(dominantBelt.radius, 0.1);
                    const targetOmega = (-absSpeed / safeRadius) * dominantBelt.direction;
                    const clampedOmega = Math.max(-2, Math.min(2, targetOmega));
                    const clampedOmegaTick = clampedOmega / 60; // Matter expects rad/tick
                    Matter.Body.setAngularVelocity(body, body.angularVelocity * 0.7 + clampedOmegaTick * 0.3);
                  } else {
                    // Reset angular velocity when transitioning away from a curved belt
                    if (prevDominant?.beltType === 'curved') {
                      Matter.Body.setAngularVelocity(body, 0);
                    }
                    Matter.Body.setAngularVelocity(body, body.angularVelocity * 0.88);
                  }

                  // Update sticky dominant belt record
                  lastDominantBeltRef.current.set(itemId, { beltId: dominantBelt.id, overlapCount: maxOverlap, beltType: dominantBelt.type });
                } else {
                  // No belt — clear sticky record
                  lastDominantBeltRef.current.delete(itemId);
                }
              }
              
              Matter.Engine.update(engine.current, deltaTime);
            }
          } else if (simulatorBackend === 'rapier' && rapierReady) {
            const world = rapierWorld.current;
            if (world) {
              if (isStepping.current) return;
              isStepping.current = true;
              try {
                world.timestep = 1 / (60 * subSteps);
                const bodyItemPairs: { body: RigidBody, item: Item }[] = [];
                rapierBodiesMap.current.forEach((body, id) => {
                  const itm = itemsMap.get(id);
                  if (itm) bodyItemPairs.push({ body, item: itm });
                });

                for (let s = 0; s < subSteps; s++) {
                  for (let pairIdx = 0; pairIdx < bodyItemPairs.length; pairIdx++) {
                    const { body, item } = bodyItemPairs[pairIdx];
                    const bPos = body.translation();
                    const bRot = body.rotation();
                    const bVel = body.linvel();
                    const bAngVel = body.angvel();

                    const cosA = Math.abs(Math.cos(bRot)), sinA = Math.abs(Math.sin(bRot));
                    const mhw = (item.width * PIXELS * cosA + item.height * PIXELS * sinA) / 2;
                    const mhh = (item.width * PIXELS * sinA + item.height * PIXELS * cosA) / 2;

                    let sumVx = 0, sumVy = 0, sumWeight = 0, dominantBelt = null, maxOverlap = 0;

                    const rapierItemId = item.id;
                    const prevDominantR = lastDominantBeltRef.current.get(rapierItemId);
                    const prevDominantId = prevDominantR?.beltId;

                    for (let i = 0; i < beltMetadata.length; i++) {
                      const meta = beltMetadata[i];
                      if (bPos.x + mhw < meta.bX - meta.hw || bPos.x - mhw > meta.bX + meta.hw ||
                        bPos.y + mhh < meta.bY - meta.hh || bPos.y - mhh > meta.bY + meta.hh) continue;

                      let overlapCount = 0;
                      const dx = bPos.x - meta.bX;
                      const dy = bPos.y - meta.bY;

                      if (meta.belt.type === 'curved') {
                        const distSq = dx * dx + dy * dy;
                        if (distSq >= meta.brSqMin && distSq <= meta.brSqMax) {
                          let curAng = Math.atan2(dy, dx) * (180 / Math.PI);
                          if (curAng < 0) curAng += 360;
                          let rel = curAng - meta.normStart;
                          if (rel < 0) rel += 360;
                          if (rel >= 360) rel -= 360;
                          if (rel <= meta.span) overlapCount = 5;
                        }
                      } else if (meta.belt.type === 'linear') {
                        if (isPointInBeltMeta(bPos.x, bPos.y, meta)) {
                          overlapCount = 4; // Higher priority for linear belts
                        }
                      }

                      // Fix #B: Hysteresis — give previous dominant belt an artificial bonus
                      // so it remains dominant until the parcel's center fully leaves it
                      if (overlapCount > 0 && meta.belt.id === prevDominantId) {
                        overlapCount += 5;
                      }

                      if (overlapCount > 0) {
                        if (overlapCount > maxOverlap) { maxOverlap = overlapCount; dominantBelt = meta.belt; }
                      }
                    }

                    if (dominantBelt) {
                      const v = getBeltVelocityAtPoint(bPos.x, bPos.y, dominantBelt);
                      const factor = kineticFriction ? 0.12 : 0.3;
                      const maxSpeed = dominantBelt.speed * PIXELS * 1.5;
                      const newVx = safeNum(bVel.x * (1 - factor) + v.x * factor);
                      const newVy = safeNum(bVel.y * (1 - factor) + v.y * factor);
                      const speedMag = Math.sqrt(newVx * newVx + newVy * newVy);
                      let finalVx = newVx, finalVy = newVy;
                      if (speedMag > maxSpeed) {
                        finalVx = (newVx / speedMag) * maxSpeed;
                        finalVy = (newVy / speedMag) * maxSpeed;
                      }
                      body.setLinvel({ x: finalVx, y: finalVy }, true);

                      // Normalized angle delta helper
                      const lerpAngleR = (current: number, target: number, alpha: number) => {
                        let delta = target - current;
                        // Normalize to [-PI, PI]
                        delta = delta - Math.PI * 2 * Math.round(delta / (Math.PI * 2));
                        body.setRotation(current + delta * alpha, true);
                      };

                      if (Math.abs(v.x) > 0.001 || Math.abs(v.y) > 0.001) {
                        const targetAngle = Math.atan2(v.y, v.x);
                        const lerpAlpha = dominantBelt.type === 'curved' ? 0.15 : 0.1;
                        lerpAngleR(bRot, targetAngle, lerpAlpha);
                      }

                      if (dominantBelt.type === 'curved') {
                        const absSpeed = Math.abs(dominantBelt.speed);
                        const safeRadius = Math.max(dominantBelt.radius, 0.1);
                        const targetOmega = (-absSpeed / safeRadius) * dominantBelt.direction;
                        const clampedOmega = Math.max(-2, Math.min(2, targetOmega));
                        body.setAngvel(bAngVel * 0.7 + clampedOmega * 0.3, true);
                      } else {
                        // Reset angular velocity when transitioning away from curved belt
                        if (prevDominantR?.beltType === 'curved') {
                          body.setAngvel(0, true);
                        }
                        body.setAngvel(bAngVel * 0.88, true);
                      }

                      // Update sticky dominant belt record
                      lastDominantBeltRef.current.set(rapierItemId, { beltId: dominantBelt.id, overlapCount: maxOverlap, beltType: dominantBelt.type });
                    } else {
                      lastDominantBeltRef.current.delete(rapierItemId);
                    }
                  }
                  world.step();
                }
              } finally {
                isStepping.current = false;
              }
            }
          }

          physicsTime += performance.now() - physicsStart;
        }
      }

      // Logic shared for source/sink/sensor
      const logicIterStart = performance.now();
      const currentItemBodies: { id: string, pos: { x: number, y: number } }[] = [];

      if (simulatorBackend === 'matter') {
        bodiesMap.current.forEach((b, id) => currentItemBodies.push({ id, pos: b.position }));
      } else if (simulatorBackend === 'rapier' && rapierReady && rapierWorld.current) {
        rapierBodiesMap.current.forEach((rb, id) => currentItemBodies.push({ id, pos: rb.translation() }));
      }

      // Source gen
      const nowTs = simulationTimeRef.current;
      for (let i = 0; i < sources.length; i++) {
        const source = sources[i];
        const intervalMs = source.interval * 1000;
        if (source.lastGeneratedTime !== 0 && nowTs - source.lastGeneratedTime < intervalMs) continue;

        const sx = source.x * PIXELS, sy = -source.y * PIXELS;
        const clearance = Math.max(source.maxWidth, source.maxHeight) * PIXELS * 0.9;
        let blocked = false;
        for (let j = 0; j < currentItemBodies.length; j++) {
          const b = currentItemBodies[j];
          if ((b.pos.x - sx) ** 2 + (b.pos.y - sy) ** 2 < clearance ** 2) { blocked = true; break; }
        }
        if (blocked) continue;

        const w = source.minWidth + Math.random() * (source.maxWidth - source.minWidth);
        const h = source.minHeight + Math.random() * (source.maxHeight - source.minHeight);
        addItem({ x: source.x, y: source.y, width: w, height: h, rotation: 0, label: `P-${Math.random().toString(36).substr(2, 3).toUpperCase()}`, type: 'box', color: source.colorScheme ? source.colorScheme[Math.floor(Math.random() * source.colorScheme.length)] : `hsl(${Math.random() * 30 + 10}, 70%, 50%)` });
        updateSource(source.id, { lastGeneratedTime: nowTs === 0 ? Number.EPSILON : nowTs });
      }

      // Sensor logic
      const sensorState = new Map();
      const itemsToRemove = new Set<string>();

      for (let j = 0; j < currentItemBodies.length; j++) {
        const { id, pos } = currentItemBodies[j];
        for (let k = 0; k < sinks.length; k++) {
          const s = sinks[k];
          if (Math.abs(pos.x - s.x * PIXELS) < (s.width * PIXELS) / 2 && Math.abs(pos.y + s.y * PIXELS) < (s.height * PIXELS) / 2) {
            itemsToRemove.add(id); break;
          }
        }
        if (itemsToRemove.has(id)) continue;

        for (let k = 0; k < sensors.length; k++) {
          const s = sensors[k];
          const sx = s.x * PIXELS, sy = -s.y * PIXELS;
          const dx = pos.x - sx;
          const dy = pos.y - sy;
          const rad = (-s.rotation * Math.PI) / 180;
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);
          const lx = dx * cos + dy * sin;
          const ly = -dx * sin + dy * cos;

          const item = itemsMap.get(id);
          const itemRadius = item ? (Math.max(item.width, item.height) * PIXELS) / 2 : 20;

          if (Math.abs(lx) < (s.width * PIXELS) / 2 + itemRadius && Math.abs(ly) < (s.height * PIXELS) / 2 + itemRadius) {
            const itemLabel = item?.label || id;
            sensorState.set(s.id, { active: true, label: itemLabel });
          }
        }
      }

      itemsToRemove.forEach(id => {
        removeItem(id);
        // Prune dominant-belt tracking to prevent unbounded Map growth over long runs
        lastDominantBeltRef.current.delete(id);
      });
      for (let k = 0; k < sensors.length; k++) {
        const s = sensors[k];
        const state = sensorState.get(s.id);
        const isActive = state?.active || false;
        if (isActive !== s.isActive) {
          const label = state?.label || lastDetectedItems.current.get(s.id) || 'Unknown';
          if (isActive) lastDetectedItems.current.set(s.id, label);
          updateSensor(s.id, { isActive });
          
          const logMsg = `[DEBUG] Sensor ${s.label || s.id} is ${isActive ? `triggered by ${label}` : 'cleared'}`;
          console.log(logMsg);
          useStore.getState().addLog(logMsg);

          useStore.getState().addDetectionRecord(s.id, { timestamp: Date.now(), itemLabel: label, type: isActive ? 'ON' : 'OFF' });
        }
      }
      logicTime += performance.now() - logicIterStart;
    }

    // Final Sync Visuals (Runs every frame to keep UI updated even if simulation is paused, but we might want to skip if nothing moved)
    const renderIterStart = performance.now();
    if (simulatorBackend === 'matter') {
      bodiesMap.current.forEach((body, id) => {
        const node = itemNodesRef.current.get(id);
        if (node) {
          // Optimization: only update if changed
          const curX = node.x(), curY = node.y(), curR = node.rotation();
          const newX = body.position.x, newY = body.position.y, newR = (body.angle * 180) / Math.PI;
          if (Math.abs(curX - newX) > 0.1 || Math.abs(curY - newY) > 0.1 || Math.abs(curR - newR) > 0.5) {
            node.setAttrs({ x: newX, y: newY, rotation: newR });
          }
        }
      });
    } else if (simulatorBackend === 'rapier' && rapierReady && rapierWorld.current) {
      rapierBodiesMap.current.forEach((rb, id) => {
        const pos = rb.translation(), rot = rb.rotation();
        const node = itemNodesRef.current.get(id);
        if (node) {
          const curX = node.x(), curY = node.y(), curR = node.rotation();
          const newX = pos.x, newY = pos.y, newR = (rot * 180) / Math.PI;
          if (Math.abs(curX - newX) > 0.1 || Math.abs(curY - newY) > 0.1 || Math.abs(curR - newR) > 0.5) {
            node.setAttrs({ x: newX, y: newY, rotation: newR });
          }
        }
      });
    }
    renderTime += performance.now() - renderIterStart;

    if (performance.now() - lastFpsTimeRef.current >= 950) {
      useStore.getState().setLatency({ physics: physicsTime, logic: logicTime, render: renderTime });
    }

    requestRef.current = requestAnimationFrame(animate);
  }, [rapierReady, setFps, addItem, removeItem, updateItem, updateSensor, updateSource]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [animate]);

  // --- Helper functions for Overlap and Velocity ---

  const isPointInBeltMeta = (px: number, py: number, meta: any) => {
    const belt = meta.belt;
    const { bX, bY } = meta;
    const PIXELS = PIXELS_PER_METER;
    const dx = px - bX;
    const dy = py - bY;

    if (belt.type === 'linear') {
      const pts = (belt.trianglePoints || [
        { x: -1, y: -0.2 },
        { x: 1, y: -0.2 },
        { x: 1, y: 0.2 },
        { x: -1, y: 0.2 }
      ]).map(p => ({
        x: p.x * PIXELS,
        y: -p.y * PIXELS
      }));
      const angleRad = (-belt.rotation * Math.PI) / 180;
      const cosT = Math.cos(-angleRad);
      const sinT = Math.sin(-angleRad);
      const lx = dx * cosT - dy * sinT;
      const ly = dx * sinT + dy * cosT;

      const isInside = (px: number, py: number, p1: { x: number, y: number }, p2: { x: number, y: number }, p3: { x: number, y: number }, p4?: { x: number, y: number }) => {
        if (p4) {
          return (
            isPointInTriangle(px, py, p1, p2, p3) ||
            isPointInTriangle(px, py, p1, p3, p4)
          );
        }
        return isPointInTriangle(px, py, p1, p2, p3);
      };

      if (pts.length >= 4) {
        return isInside(lx, ly, pts[0], pts[1], pts[2], pts[3]);
      }
      return isInside(lx, ly, pts[0], pts[1], pts[2]);
    } else if (belt.type === 'curved') {
      const br = belt.radius * PIXELS;
      const bw = belt.beltWidth * PIXELS;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < br - bw / 2 || dist > br + bw / 2) return false;

      let currentAngleScreen = Math.atan2(dy, dx) * (180 / Math.PI);
      if (currentAngleScreen < 0) currentAngleScreen += 360;

      let screenStart = -belt.endAngle;
      let screenEnd = -belt.startAngle;
      let normStart = ((screenStart % 360) + 360) % 360;
      let normEnd = ((screenEnd % 360) + 360) % 360;

      let span = normEnd - normStart;
      if (span <= 0 && belt.endAngle !== belt.startAngle) span += 360;

      let rel = currentAngleScreen - normStart;
      if (rel < 0) rel += 360;
      if (rel >= 360) rel -= 360;
      return rel <= span;
    }
    return false;
  };

  const isPointInTriangle = (px: number, py: number, p1: { x: number, y: number }, p2: { x: number, y: number }, p3: { x: number, y: number }) => {
    const area = 0.5 * (-p2.y * p3.x + p1.y * (-p2.x + p3.x) + p1.x * (p2.y - p3.y) + p2.x * p3.y);
    if (Math.abs(area) < 0.1) return false;
    const s = 1 / (2 * area) * (p1.y * p3.x - p1.x * p3.y + (p3.y - p1.y) * px + (p1.x - p3.x) * py);
    const t = 1 / (2 * area) * (p1.x * p2.y - p1.y * p2.x + (p1.y - p2.y) * px + (p2.x - p1.x) * py);
    return s >= 0 && t >= 0 && (1 - s - t) >= 0;
  };

  const getBeltVelocityAtPoint = (px: number, py: number, belt: Belt) => {
    const PIXELS = PIXELS_PER_METER;
    if (belt.type === 'curved') {
      const bx = belt.x * PIXELS;
      const by = -belt.y * PIXELS;
      const dx = px - bx;
      const dy = py - by;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 0.001) return { x: 0, y: 0 };
      const nx = dx / dist;
      const ny = dy / dist;
      const tx = ny * belt.direction;
      const ty = -nx * belt.direction;
      return {
        x: tx * belt.speed * PIXELS,
        y: ty * belt.speed * PIXELS
      };
    } else {
      const angleRad = ((belt.directionAngle || 0) * Math.PI) / 180;
      const vx = Math.cos(angleRad) * belt.speed * PIXELS;
      const vy = -Math.sin(angleRad) * belt.speed * PIXELS;
      return {
        x: vx * belt.direction,
        y: vy * belt.direction
      };
    }
  };

  const handleStageClick = (e: any) => {
    if (activeTool && activeTool !== 'select') {
      const stage = e.target.getStage();
      const pos = stage.getPointerPosition();
      if (pos) {
        // Calculate relative coordinates by inverting stage transform
        const transform = stage.getAbsoluteTransform().copy().invert();
        const stagePos = transform.point(pos);

        setCreationPos({
          x: stagePos.x / PIXELS_PER_METER,
          y: -stagePos.y / PIXELS_PER_METER
        });
      }
      return;
    }
    onSelectId(null);
  };

  const handleConfirmCreation = (data: any) => {
    const { label, x, y, interval } = data;
    const gridSnap = useStore.getState().gridSnap;
    const gridSize = useStore.getState().gridSize;
    const snappedX = snapToGrid(x, gridSize, gridSnap);
    const snappedY = snapToGrid(y, gridSize, gridSnap);

    if (activeTool === 'belt_rectangle') {
      addBelt({
        type: 'linear',
        shape: 'quadrilateral',
        x: snappedX,
        y: snappedY,
        length: 2,
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
          { x: -1, y: -0.2 },
          { x: 1, y: -0.2 },
          { x: 1, y: 0.2 },
          { x: -1, y: 0.2 }
        ]
      });
    } else if (activeTool === 'belt_right_triangle') {
      addBelt({
        type: 'linear',
        shape: 'quadrilateral',
        x: snappedX, y: snappedY,
        length: 1.5,
        beltWidth: 1.5,
        rotation: 0,
        radius: 0,
        startAngle: 0,
        endAngle: 0,
        speed: 1,
        directionAngle: 0,
        direction: 1,
        color: '#1e293b',
        trianglePoints: [
          { x: -0.75, y: -0.75 },
          { x: 0.75, y: -0.75 },
          { x: -0.75, y: 0.75 },
          { x: -0.75, y: 0.75 }
        ]
      });
    } else if (activeTool === 'belt_quadrilateral') {
      addBelt({
        type: 'linear',
        shape: 'quadrilateral',
        x: snappedX, y: snappedY,
        length: 2,
        beltWidth: 1,
        rotation: 0,
        radius: 0,
        startAngle: 0,
        endAngle: 0,
        speed: 1,
        directionAngle: 0,
        direction: 1,
        color: '#1e293b',
        trianglePoints: [
          { x: -1, y: -0.5 },
          { x: 1, y: -0.3 },
          { x: 0.8, y: 0.5 },
          { x: -1, y: 0.5 }
        ]
      });
    } else if (activeTool === 'belt_arc') {
      addBelt({
        type: 'curved',
        shape: 'arc',
        x: snappedX, y: snappedY,
        length: 0,
        beltWidth: 0.4,
        rotation: 0,
        radius: 0.5,
        startAngle: 0,
        endAngle: 90,
        speed: 1,
        directionAngle: 0,
        direction: 1,
        color: '#1e293b'
      });
    } else if (activeTool === 'sensor') {
      addSensor({ x: snappedX, y: snappedY, width: 0.02, height: 0.8, rotation: 0, isActive: false, label, color: '#334155' });
    } else if (activeTool === 'source') {
      addSource({ x: snappedX, y: snappedY, interval: interval || 2, minWidth: 0.3, maxWidth: 0.6, minHeight: 0.3, maxHeight: 0.5, label });
    } else if (activeTool === 'sink') {
      addSink({ x: snappedX, y: snappedY, width: 1, height: 1, label });
    } else if (activeTool === 'item') {
      addItem({ x: snappedX, y: snappedY, width: 0.4, height: 0.4, rotation: 0, label, type: 'box', color: '#f59e0b' });
    }

    setCreationPos(null);
    setActiveTool(null);
  };

  const canInteract = !isPlaying && (activeTool === null || activeTool === 'select');

  return (
    <div ref={containerRef} className="w-full h-full bg-slate-950 overflow-hidden relative" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)', backgroundSize: '32px 32px' }}>
      {creationPos && activeTool && (
        <CreationDialog
          type={activeTool}
          x={creationPos.x}
          y={creationPos.y}
          onConfirm={handleConfirmCreation}
          onCancel={() => { setCreationPos(null); setActiveTool(null); }}
        />
      )}

      {/* Auto-Fit Viewport Control */}
      <div className="absolute bottom-6 right-6 z-10 flex flex-col gap-2">
        <button
          onClick={handleAutoFit}
          className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-blue-400 hover:text-white transition-all shadow-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest group"
          title="Auto Fit View"
        >
          <RotateCcw size={14} className="transition-transform group-hover:rotate-45" />
          Auto Fit
        </button>
      </div>

      {dimensions.width > 0 && dimensions.height > 0 && (
        <Stage
          ref={stageRef}
          width={dimensions.width}
          height={dimensions.height}
          onClick={handleStageClick}
          scaleX={stageScale}
          scaleY={stageScale}
          x={stagePos.x}
          y={stagePos.y}
          onWheel={handleWheel}
          draggable={activeTool === null || activeTool === 'select'}
          onDragEnd={(e) => {
            if (e.target === stageRef.current) {
              setStagePos({ x: e.target.x(), y: e.target.y() });
            }
          }}
          onMouseDown={(e) => {
            if (e.evt.button === 1) { // Middle mouse button
              stageRef.current.startDrag();
            }
          }}
        >
          <Layer>
            {/* Grid handled by CSS background for performance */}
            <Group listening={false} />
            <NodesLayer
              draggable={draggable}
              canInteract={canInteract}
              selectedId={selectedId}
              onSelectId={onSelectId}
              colors={colors}
              stageScale={stageScale}
              stagePos={stagePos}
              itemNodesRef={itemNodesRef}
              bodiesMap={bodiesMap}
              rapierBodiesMap={rapierBodiesMap}
              simulatorBackendRef={simulatorBackendRef}
              rapierReady={rapierReady}
              viewportBounds={viewportBounds}
            />
          </Layer>
        </Stage>
      )}

      {/* Selection Border Overlay (blueprint style from design) */}
      {selectedId && (
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-0">
          {/* Custom logic can be added here for specific node indicator overlays */}
        </div>
      )}

      {/* Editor Overlay Info */}
      <SimulationOverlayInfo />
    </div>
  );
}

// Optimized Grid is now handled via CSS background in SimulationCanvas

import React, { memo, useMemo, useCallback } from 'react';
import { useStore, PIXELS_PER_METER, Belt, Sensor, Source, Sink } from '../store/useStore';
import { Group, Rect, Circle, Line, Arc, Text } from 'react-konva';
import Matter from 'matter-js';
import ItemsLayer from './ItemsLayer';

interface ViewportBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
}

interface NodesLayerProps {
  draggable: boolean;
  canInteract: boolean;
  selectedId: string | null;
  onSelectId: (id: string | null) => void;
  colors: any;
  stageScale: number;
  stagePos: { x: number; y: number };
  itemNodesRef: React.MutableRefObject<Map<string, any>>;
  bodiesMap: React.MutableRefObject<Map<string, Matter.Body>>;
  rapierBodiesMap: React.MutableRefObject<Map<string, any>>;
  simulatorBackendRef: React.MutableRefObject<string>;
  rapierReady: boolean;
  viewportBounds?: ViewportBounds;
}

interface BeltProps {
  belt: Belt;
  selected: boolean;
  onSelectId: (id: string | null) => void;
  colors: any;
  stageScale: number;
  stagePos: { x: number; y: number };
  canInteract: boolean;
}

const BeltNode = memo(function BeltNode({ belt, selected, onSelectId, colors, stageScale, stagePos, canInteract }: BeltProps) {
  const updateBelt = useStore(state => state.updateBelt);

  const handleDragEnd = useCallback((e: any) => {
    if (e.target !== e.currentTarget) return;
    updateBelt(belt.id, { 
      x: e.target.x() / PIXELS_PER_METER, 
      y: -e.target.y() / PIXELS_PER_METER 
    });
  }, [belt.id, updateBelt]);

  const handleClick = useCallback((e: any) => {
    e.cancelBubble = true;
    onSelectId(belt.id);
  }, [belt.id, onSelectId]);

  const x = useMemo(() => belt.x * PIXELS_PER_METER, [belt.x]);
  const y = useMemo(() => -belt.y * PIXELS_PER_METER, [belt.y]);
  const groupProps = {
    x, y,
    draggable: canInteract,
    onDragEnd: handleDragEnd,
    onClick: handleClick
  };

  const selectionProps = {
    stroke: selected ? colors.selection : colors.beltBorder,
    strokeWidth: selected ? 2 : 1,
    shadowBlur: selected ? 10 : 0,
    shadowColor: colors.selectionRing
  };

  const innerRadius = useMemo(() => (belt.radius - belt.beltWidth/2) * PIXELS_PER_METER, [belt.radius, belt.beltWidth]);
  const outerRadius = useMemo(() => (belt.radius + belt.beltWidth/2) * PIXELS_PER_METER, [belt.radius, belt.beltWidth]);
  const arcAngle = useMemo(() => belt.endAngle - belt.startAngle, [belt.endAngle, belt.startAngle]);
  const midAngle = useMemo(() => (belt.startAngle + (belt.endAngle - belt.startAngle) / 2) * Math.PI / 180, [belt.startAngle, belt.endAngle]);
  const groupX = useMemo(() => Math.cos(midAngle) * belt.radius * PIXELS_PER_METER, [midAngle, belt.radius]);
  const groupY = useMemo(() => -Math.sin(midAngle) * belt.radius * PIXELS_PER_METER, [midAngle, belt.radius]);
  const groupRotation = useMemo(() => -(belt.startAngle + (belt.endAngle - belt.startAngle) / 2), [belt.startAngle, belt.endAngle]);
  const trianglePoints = useMemo(() => 
    (belt.trianglePoints || [{ x: -1, y: -0.2 }, { x: 1, y: -0.2 }, { x: 1, y: 0.2 }, { x: -1, y: 0.2 }]).flatMap(p => [p.x * PIXELS_PER_METER, -p.y * PIXELS_PER_METER]),
    [belt.trianglePoints]
  );
  const dirArrowX = useMemo(() => {
    const angleRad = ((belt.directionAngle || 0) * Math.PI) / 180;
    return Math.cos(angleRad) * 60 * belt.direction;
  }, [belt.directionAngle, belt.direction]);
  const dirArrowY = useMemo(() => {
    const angleRad = ((belt.directionAngle || 0) * Math.PI) / 180;
    return -Math.sin(angleRad) * 60 * belt.direction;
  }, [belt.directionAngle, belt.direction]);

  if (belt.type === 'curved') {
    return (
      <Group {...groupProps}>
        <Arc
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          angle={arcAngle}
          rotation={-belt.endAngle}
          fill={belt.color}
          {...selectionProps}
        />
        <Group rotation={groupRotation} x={groupX} y={groupY}>
          <Line points={[-8, 0, 8, 0, 4, -4, 8, 0, 4, 4]} stroke="white" strokeWidth={2} opacity={0.4} rotation={-90 * belt.direction} />
        </Group>
      </Group>
    );
  }

  // Linear (quadrilateral) belt rendering - renders polygon with handles
  return (
    <Group {...groupProps}>
      <Group rotation={-belt.rotation}>
        <Line points={trianglePoints} closed fill={belt.color} {...selectionProps} />
        {selected && (
          <Group x={0} y={-40} draggable onDragEnd={(e) => {
            e.cancelBubble = true;
            const stage = e.target.getStage();
            const pos = stage.getPointerPosition();
            if (pos) {
              const angle = - (Math.atan2(
                pos.y - (-belt.y * PIXELS_PER_METER * stageScale + stagePos.y),
                pos.x - (belt.x * PIXELS_PER_METER * stageScale + stagePos.x)
              ) * 180 / Math.PI + 90);
              updateBelt(belt.id, { rotation: angle });
            }
            e.target.x(0); e.target.y(-40);
          }}>
            <Line points={[0, 0, 0, 20]} stroke={colors.selection} strokeWidth={1} />
            <Circle radius={5} fill={colors.selection} />
          </Group>
        )}
        {selected && belt.trianglePoints?.map((pt, idx) => (
          <Circle key={idx} x={pt.x * PIXELS_PER_METER} y={-pt.y * PIXELS_PER_METER} radius={6} fill={colors.selection} draggable onDragEnd={(e) => {
            e.cancelBubble = true;
            const newPts = [...belt.trianglePoints!];
            newPts[idx] = { x: e.target.x() / PIXELS_PER_METER, y: -e.target.y() / PIXELS_PER_METER };
            updateBelt(belt.id, { trianglePoints: newPts });
          }} />
        ))}
      </Group>
      {selected && (
        <Group draggable onDragEnd={(e) => {
          e.cancelBubble = true;
          const dx = e.target.x();
          const dy = e.target.y();
          const mag = Math.sqrt(dx * dx + dy * dy);
          if (mag > 10) {
            let angle = Math.atan2(-dy, dx) * 180 / Math.PI;
            if (angle < 0) angle += 360;
            updateBelt(belt.id, { directionAngle: Math.round(angle) });
          }
          e.target.x(0); e.target.y(0);
        }}>
          <Line points={[0, 0, dirArrowX, dirArrowY]} stroke="white" strokeWidth={3} opacity={0.8} />
          <Circle x={dirArrowX} y={dirArrowY} radius={5} fill="white" opacity={1} />
        </Group>
      )}
    </Group>
  );
}, (prev, next) => {
  return (
    prev.belt.id === next.belt.id &&
    prev.belt.x === next.belt.x &&
    prev.belt.y === next.belt.y &&
    prev.belt.rotation === next.belt.rotation &&
    prev.belt.speed === next.belt.speed &&
    prev.belt.direction === next.belt.direction &&
    prev.belt.type === next.belt.type &&
    prev.belt.directionAngle === next.belt.directionAngle &&
    prev.belt.trianglePoints === next.belt.trianglePoints &&
    prev.selected === next.selected &&
    prev.canInteract === next.canInteract
  );
});

interface SensorProps {
  sensor: Sensor;
  selected: boolean;
  onSelectId: (id: string | null) => void;
  colors: any;
  canInteract: boolean;
}

const SensorNode = memo(function SensorNode({ sensor, selected, onSelectId, colors, canInteract }: SensorProps) {
  const updateSensor = useStore(state => state.updateSensor);

  const handleDragEnd = useCallback((e: any) => {
    if (e.target !== e.currentTarget) return;
    updateSensor(sensor.id, { x: e.target.x() / PIXELS_PER_METER, y: -e.target.y() / PIXELS_PER_METER });
  }, [sensor.id, updateSensor]);

  const handleClick = useCallback((e: any) => { e.cancelBubble = true; onSelectId(sensor.id); }, [sensor.id, onSelectId]);

  const x = useMemo(() => sensor.x * PIXELS_PER_METER, [sensor.x]);
  const y = useMemo(() => -sensor.y * PIXELS_PER_METER, [sensor.y]);
  const width = useMemo(() => sensor.width * PIXELS_PER_METER, [sensor.width]);
  const height = useMemo(() => sensor.height * PIXELS_PER_METER, [sensor.height]);
  const halfWidth = useMemo(() => (-sensor.width / 2) * PIXELS_PER_METER, [sensor.width]);
  const halfHeight = useMemo(() => (-sensor.height / 2) * PIXELS_PER_METER, [sensor.height]);
  const indicatorY = useMemo(() => (sensor.height * PIXELS_PER_METER) / 2, [sensor.height]);
  const labelY = useMemo(() => (-sensor.height / 2) * PIXELS_PER_METER - 14, [sensor.height]);

  return (
    <Group x={x} y={y} rotation={-sensor.rotation} draggable={canInteract} onDragEnd={handleDragEnd} onClick={handleClick}>
      <Rect x={halfWidth} y={halfHeight} width={width} height={height} fill={sensor.isActive ? colors.sensorActive : colors.sensorInactive} opacity={sensor.isActive ? 0.6 : 0.2} stroke={selected ? colors.selection : 'transparent'} strokeWidth={2} />
      <Circle x={0} y={indicatorY} radius={4} fill={sensor.isActive ? colors.sensorActive : '#64748b'} shadowBlur={sensor.isActive ? 8 : 0} shadowColor={colors.sensorActive} />
      <Text text={sensor.label} y={labelY} x={-50} width={100} align="center" fontSize={9} fill={sensor.isActive ? colors.sensorActive : '#64748b'} fontStyle="bold" fontFamily="JetBrains Mono" />
    </Group>
  );
}, (prev, next) => {
  return (
    prev.sensor.id === next.sensor.id &&
    prev.sensor.x === next.sensor.x &&
    prev.sensor.y === next.sensor.y &&
    prev.sensor.rotation === next.sensor.rotation &&
    prev.sensor.isActive === next.sensor.isActive &&
    prev.sensor.label === next.sensor.label &&
    prev.selected === next.selected &&
    prev.canInteract === next.canInteract
  );
});

interface SourceSinkProps {
  item: Source | Sink;
  type: 'source' | 'sink';
  selected: boolean;
  onSelectId: (id: string | null) => void;
  canInteract: boolean;
}

const SourceNode = memo(function SourceNode({ item, selected, onSelectId, canInteract }: Omit<SourceSinkProps, 'type'>) {
  const updateSource = useStore(state => state.updateSource);
  const handleDragEnd = useCallback((e: any) => {
    if (e.target !== e.currentTarget) return;
    updateSource(item.id, { x: e.target.x() / PIXELS_PER_METER, y: -e.target.y() / PIXELS_PER_METER });
  }, [item.id, updateSource]);
  const handleClick = useCallback((e: any) => { e.cancelBubble = true; onSelectId(item.id); }, [item.id, onSelectId]);
  const x = useMemo(() => item.x * PIXELS_PER_METER, [item.x]);
  const y = useMemo(() => -item.y * PIXELS_PER_METER, [item.y]);

  return (
    <Group x={x} y={y} draggable={canInteract} onDragEnd={handleDragEnd} onClick={handleClick}>
      <Rect x={-20} y={-20} width={40} height={40} fill="#3b82f6" opacity={0.3} stroke={selected ? '#fbbf24' : '#3b82f6'} strokeWidth={selected ? 2 : 1} dash={[5, 5]} />
      <Text text="SRC" x={-20} y={-4} width={40} align="center" fontSize={8} fontStyle="bold" fill="#60a5fa" />
      <Text text={item.label} y={22} x={-50} width={100} align="center" fontSize={9} fill="#60a5fa" fontStyle="bold" fontFamily="JetBrains Mono" />
    </Group>
  );
}, (prev, next) => prev.item.id === next.item.id && prev.item.x === next.item.x && prev.item.y === next.item.y && prev.selected === next.selected && prev.canInteract === next.canInteract);

const SinkNode = memo(function SinkNode({ item, selected, onSelectId, canInteract }: Omit<SourceSinkProps, 'type'>) {
  const updateSink = useStore(state => state.updateSink);
  const handleDragEnd = useCallback((e: any) => {
    if (e.target !== e.currentTarget) return;
    updateSink(item.id, { x: e.target.x() / PIXELS_PER_METER, y: -e.target.y() / PIXELS_PER_METER });
  }, [item.id, updateSink]);
  const handleClick = useCallback((e: any) => { e.cancelBubble = true; onSelectId(item.id); }, [item.id, onSelectId]);
  const x = useMemo(() => item.x * PIXELS_PER_METER, [item.x]);
  const y = useMemo(() => -item.y * PIXELS_PER_METER, [item.y]);
  const width = useMemo(() => (item as Sink).width * PIXELS_PER_METER, [item]);
  const height = useMemo(() => (item as Sink).height * PIXELS_PER_METER, [item]);
  const halfW = useMemo(() => (-(item as Sink).width / 2) * PIXELS_PER_METER, [item]);
  const halfH = useMemo(() => (-(item as Sink).height / 2) * PIXELS_PER_METER, [item]);
  const labelY = useMemo(() => ((item as Sink).height/2)*PIXELS_PER_METER + 4, [item]);

  return (
    <Group x={x} y={y} draggable={canInteract} onDragEnd={handleDragEnd} onClick={handleClick}>
      <Rect x={halfW} y={halfH} width={width} height={height} fill="#ef4444" opacity={0.2} stroke={selected ? '#fbbf24' : '#ef4444'} strokeWidth={selected ? 2 : 1} dash={[5, 5]} />
      <Text text="SINK" x={-20} y={-4} width={40} align="center" fontSize={8} fontStyle="bold" fill="#f87171" />
      <Text text={item.label} y={labelY} x={-50} width={100} align="center" fontSize={9} fill="#f87171" fontStyle="bold" fontFamily="JetBrains Mono" />
    </Group>
  );
}, (prev, next) => prev.item.id === next.item.id && prev.item.x === next.item.x && prev.item.y === next.item.y && prev.selected === next.selected && prev.canInteract === next.canInteract);

export default function NodesLayer({
  draggable,
  canInteract,
  selectedId,
  onSelectId,
  colors,
  stageScale,
  stagePos,
  itemNodesRef,
  bodiesMap,
  rapierBodiesMap,
  simulatorBackendRef,
  rapierReady,
  viewportBounds
}: NodesLayerProps) {
  const belts = useStore(state => state.belts);
  const sensors = useStore(state => state.sensors);
  const sources = useStore(state => state.sources);
  const sinks = useStore(state => state.sinks);

  const beltsMemo = useMemo(() => belts, [belts]);
  const sensorsMemo = useMemo(() => sensors, [sensors]);
  const sourcesMemo = useMemo(() => sources, [sources]);
  const sinksMemo = useMemo(() => sinks, [sinks]);

return (
    <>
      {beltsMemo.map((belt) => (
        <BeltNode key={belt.id} belt={belt} selected={selectedId === belt.id} onSelectId={onSelectId} colors={colors} stageScale={stageScale} stagePos={stagePos} canInteract={canInteract && draggable} />
      ))}
      {sensorsMemo.map((sensor) => (
        <SensorNode key={sensor.id} sensor={sensor} selected={selectedId === sensor.id} onSelectId={onSelectId} colors={colors} canInteract={canInteract && draggable} />
      ))}
      {sourcesMemo.map((source) => (
        <SourceNode key={source.id} item={source} selected={selectedId === source.id} onSelectId={onSelectId} canInteract={canInteract && draggable} />
      ))}
      {sinksMemo.map((sink) => (
        <SinkNode key={sink.id} item={sink} selected={selectedId === sink.id} onSelectId={onSelectId} canInteract={canInteract && draggable} />
      ))}
      <ItemsLayer
        itemNodesRef={itemNodesRef}
        draggable={draggable}
        canInteract={canInteract}
        onSelectId={onSelectId}
        bodiesMap={bodiesMap}
        rapierBodiesMap={rapierBodiesMap}
        simulatorBackendRef={simulatorBackendRef}
        rapierReady={rapierReady}
        viewportBounds={viewportBounds}
      />
    </>
  );
}

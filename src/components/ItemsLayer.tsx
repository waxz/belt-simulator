import React, { memo, useMemo, useCallback } from 'react';
import { Rect } from 'react-konva';
import { useStore, PIXELS_PER_METER, Item } from '../store/useStore';
import Matter from 'matter-js';

interface ViewportBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
}

interface ItemsLayerProps {
  itemNodesRef: React.MutableRefObject<Map<string, any>>;
  draggable: boolean;
  canInteract: boolean;
  onSelectId: (id: string | null) => void;
  bodiesMap: React.MutableRefObject<Map<string, Matter.Body>>;
  rapierBodiesMap: React.MutableRefObject<Map<string, any>>;
  simulatorBackendRef: React.MutableRefObject<string>;
  rapierReady: boolean;
  viewportBounds?: ViewportBounds;
}

interface ItemRectProps {
  item: Item;
  itemNodesRef: React.MutableRefObject<Map<string, any>>;
  draggable: boolean;
  canInteract: boolean;
  onSelectId: (id: string | null) => void;
  bodiesMap: React.MutableRefObject<Map<string, Matter.Body>>;
  rapierBodiesMap: React.MutableRefObject<Map<string, any>>;
  simulatorBackendRef: React.MutableRefObject<string>;
  rapierReady: boolean;
  updateItem: (id: string, updates: Partial<Item>) => void;
}

const ItemRect = memo(function ItemRect({
  item,
  itemNodesRef,
  draggable,
  canInteract,
  onSelectId,
  bodiesMap,
  rapierBodiesMap,
  simulatorBackendRef,
  rapierReady,
  updateItem
}: ItemRectProps) {
  const handleDragEnd = useCallback((e: any) => {
    const body = bodiesMap.current.get(item.id);
    const nx = e.target.x();
    const ny = e.target.y();
    if (body) {
      if (simulatorBackendRef.current === 'matter') {
        Matter.Body.setPosition(body, { x: nx, y: ny });
      } else if (rapierReady && rapierBodiesMap.current.has(item.id)) {
        rapierBodiesMap.current.get(item.id)?.setTranslation({ x: nx, y: ny }, true);
      }
    }
    updateItem(item.id, { 
      x: nx / PIXELS_PER_METER, 
      y: -ny / PIXELS_PER_METER 
    });
  }, [item.id, bodiesMap, rapierBodiesMap, simulatorBackendRef, rapierReady, updateItem]);

  const handleClick = useCallback((e: any) => {
    e.cancelBubble = true;
    onSelectId(item.id);
  }, [item.id, onSelectId]);

  const setRef = useCallback((node: any) => {
    if (node) {
      itemNodesRef.current.set(item.id, node);
    } else {
      itemNodesRef.current.delete(item.id);
    }
  }, [item.id, itemNodesRef]);

  const x = useMemo(() => item.x * PIXELS_PER_METER, [item.x]);
  const y = useMemo(() => -item.y * PIXELS_PER_METER, [item.y]);
  const width = useMemo(() => item.width * PIXELS_PER_METER, [item.width]);
  const height = useMemo(() => item.height * PIXELS_PER_METER, [item.height]);
  const offsetX = useMemo(() => (item.width * PIXELS_PER_METER) / 2, [item.width]);
  const offsetY = useMemo(() => (item.height * PIXELS_PER_METER) / 2, [item.height]);
  const rotation = useMemo(() => -item.rotation, [item.rotation]);

  return (
    <Rect
      ref={setRef}
      x={x}
      y={y}
      width={width}
      height={height}
      offsetX={offsetX}
      offsetY={offsetY}
      rotation={rotation}
      fill={item.color}
      cornerRadius={1}
      stroke="rgba(255,255,255,0.1)"
      strokeWidth={1}
      draggable={draggable && canInteract}
      perfectDrawEnabled={false}
      shadowForStrokeEnabled={false}
      strokeHitEnabled={false}
      onDragEnd={handleDragEnd}
      onClick={handleClick}
    />
  );
}, (prev, next) => {
  return (
    prev.item.id === next.item.id &&
    prev.item.x === next.item.x &&
    prev.item.y === next.item.y &&
    prev.item.rotation === next.item.rotation &&
    prev.item.width === next.item.width &&
    prev.item.height === next.item.height &&
    prev.item.color === next.item.color &&
    prev.draggable === next.draggable &&
    prev.canInteract === next.canInteract &&
    prev.rapierReady === next.rapierReady
  );
});

export default memo(function ItemsLayer({
  itemNodesRef,
  draggable,
  canInteract,
  onSelectId,
  bodiesMap,
  rapierBodiesMap,
  simulatorBackendRef,
  rapierReady,
  viewportBounds,
}: ItemsLayerProps) {
  const items = useStore(state => state.items);
  const updateItem = useStore(state => state.updateItem);

  const itemsArray = useMemo(() => {
    let result = items;
    if (viewportBounds) {
      const { x: vpX, y: vpY, width: vpW, height: vpH, scale } = viewportBounds;
      const margin = 100 / scale;
      result = items.filter(item => {
        const itemX = item.x * PIXELS_PER_METER;
        const itemY = -item.y * PIXELS_PER_METER;
        const itemW = item.width * PIXELS_PER_METER;
        const itemH = item.height * PIXELS_PER_METER;
        return (
          itemX + itemW / 2 > vpX - margin &&
          itemX - itemW / 2 < vpX + vpW + margin &&
          itemY + itemH / 2 > vpY - margin &&
          itemY - itemH / 2 < vpY + vpH + margin
        );
      });
    }
    return result;
  }, [items, viewportBounds]);

  return (
    <>
      {itemsArray.map((item) => (
        <ItemRect
          key={item.id}
          item={item}
          itemNodesRef={itemNodesRef}
          draggable={draggable}
          canInteract={canInteract}
          onSelectId={onSelectId}
          bodiesMap={bodiesMap}
          rapierBodiesMap={rapierBodiesMap}
          simulatorBackendRef={simulatorBackendRef}
          rapierReady={rapierReady}
          updateItem={updateItem}
        />
      ))}
    </>
  );
}, (prev, next) => {
  return (
    prev.itemNodesRef === next.itemNodesRef &&
    prev.draggable === next.draggable &&
    prev.canInteract === next.canInteract &&
    prev.rapierReady === next.rapierReady &&
    prev.viewportBounds?.x === next.viewportBounds?.x &&
    prev.viewportBounds?.y === next.viewportBounds?.y &&
    prev.viewportBounds?.width === next.viewportBounds?.width &&
    prev.viewportBounds?.height === next.viewportBounds?.height
  );
});

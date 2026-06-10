
import React from 'react';
import { X, Trash2, Sliders, Palette, Move, ArrowRightLeft, Activity } from 'lucide-react';
import { useStore } from '../store/useStore';

interface PropertyPanelProps {
  id: string;
  onClose: () => void;
  onRename: (newId: string) => void;
}

export default function PropertyPanel({ id, onClose, onRename }: PropertyPanelProps) {
  const belt = useStore(state => state.belts.find(b => b.id === id));
  const sensor = useStore(state => state.sensors.find(s => s.id === id));
  const item = useStore(state => state.items.find(i => i.id === id));
  const source = useStore(state => state.sources.find(s => s.id === id));
  const sink = useStore(state => state.sinks.find(s => s.id === id));

  const updateBelt = useStore(state => state.updateBelt);
  const updateSensor = useStore(state => state.updateSensor);
  const updateItem = useStore(state => state.updateItem);
  const updateSource = useStore(state => state.updateSource);
  const updateSink = useStore(state => state.updateSink);

  const removeBelt = useStore(state => state.removeBelt);
  const removeSensor = useStore(state => state.removeSensor);
  const removeItem = useStore(state => state.removeItem);
  const removeSource = useStore(state => state.removeSource);
  const removeSink = useStore(state => state.removeSink);

  const renameBelt = useStore(state => state.renameBelt);
  const renameSensor = useStore(state => state.renameSensor);
  const renameItem = useStore(state => state.renameItem);
  const renameSource = useStore(state => state.renameSource);
  const renameSink = useStore(state => state.renameSink);

  const kineticFriction = useStore(state => state.kineticFriction);
  const collisionEnabled = useStore(state => state.collisionEnabled);
  const toggleKineticFriction = useStore(state => state.toggleKineticFriction);
  const toggleCollisionEnabled = useStore(state => state.toggleCollisionEnabled);

  const [tempId, setTempId] = React.useState(id);
  const [preset, setPreset] = React.useState<'rectangle' | 'right_triangle' | 'custom'>('custom');

  React.useEffect(() => {
    setTempId(id);
  }, [id]);

  React.useEffect(() => {
    if (!belt || belt.type !== 'linear' || !belt.trianglePoints) return;
    const pts = belt.trianglePoints;
    if (pts.length === 4) {
      const l = belt.length || 2;
      const w = belt.beltWidth || 0.4;
      const isRect = 
        Math.abs(pts[0].x - (-l/2)) < 0.01 && Math.abs(pts[0].y - (-w/2)) < 0.01 &&
        Math.abs(pts[1].x - (l/2)) < 0.01 && Math.abs(pts[1].y - (-w/2)) < 0.01 &&
        Math.abs(pts[2].x - (l/2)) < 0.01 && Math.abs(pts[2].y - (w/2)) < 0.01 &&
        Math.abs(pts[3].x - (-l/2)) < 0.01 && Math.abs(pts[3].y - (w/2)) < 0.01;
      
      const isTri = 
        Math.abs(pts[0].x - (-l/2)) < 0.01 && Math.abs(pts[0].y - (-w/2)) < 0.01 &&
        Math.abs(pts[1].x - (l/2)) < 0.01 && Math.abs(pts[1].y - (-w/2)) < 0.01 &&
        Math.abs(pts[2].x - (-l/2)) < 0.01 && Math.abs(pts[2].y - (w/2)) < 0.01 &&
        Math.abs(pts[3].x - (-l/2)) < 0.01 && Math.abs(pts[3].y - (w/2)) < 0.01;

      if (isRect) {
        setPreset('rectangle');
      } else if (isTri) {
        setPreset('right_triangle');
      } else {
        setPreset('custom');
      }
    } else {
      setPreset('custom');
    }
  }, [id, belt?.trianglePoints, belt?.length, belt?.beltWidth]);

  if (!belt && !sensor && !item && !source && !sink) return null;

  const handleDelete = () => {
    if (belt) removeBelt(id);
    if (sensor) removeSensor(id);
    if (item) removeItem(id);
    if (source) removeSource(id);
    if (sink) removeSink(id);
    onClose();
  };

  const handleIdChange = (newId: string) => {
    if (!newId || newId === id) return;
    
    // Simple collision check for duplicate IDs
    const state = useStore.getState();
    const idExists = state.belts.some(b => b.id === newId) || 
                     state.sensors.some(s => s.id === newId) || 
                     state.items.some(i => i.id === newId) ||
                     state.sources.some(s => s.id === newId) ||
                     state.sinks.some(s => s.id === newId);
    
    if (idExists) {
      setTempId(id);
      return;
    }

    if (belt) renameBelt(id, newId);
    if (sensor) renameSensor(id, newId);
    if (item) renameItem(id, newId);
    if (source) renameSource(id, newId);
    if (sink) renameSink(id, newId);
    onRename(newId);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden select-none">
      <div className="p-5 border-b border-white/10 flex items-center justify-between">
        <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Node Configuration</h2>
        <button 
          onClick={onClose}
          className="p-1 hover:bg-white/10 rounded transition-colors text-slate-500"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-8">
        {/* Component Identity */}
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="block text-[10px] text-slate-400 uppercase tracking-widest">Component ID</label>
            <input 
              type="text"
              value={tempId}
              onChange={(e) => setTempId(e.target.value)}
              onBlur={() => handleIdChange(tempId)}
              onKeyDown={(e) => e.key === 'Enter' && handleIdChange(tempId)}
              className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-xs text-blue-200 font-mono focus:border-blue-500/50 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-[10px] text-slate-400 uppercase tracking-widest">Position X (m)</label>
              <div className="flex items-center bg-white/5 border border-white/10 rounded px-2 focus-within:border-blue-500/50 transition-colors">
                <input 
                  type="number" step="0.1"
                  name="x"
                  id="prop-pos-x"
                  value={belt?.x ?? sensor?.x ?? item?.x ?? source?.x ?? sink?.x ?? 0}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (belt) updateBelt(id, { x: val });
                    if (sensor) updateSensor(id, { x: val });
                    if (item) updateItem(id, { x: val });
                    if (source) updateSource(id, { x: val });
                    if (sink) updateSink(id, { x: val });
                  }}
                  className="w-full bg-transparent py-2 text-xs text-blue-100 outline-none font-mono"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] text-slate-400 uppercase tracking-widest">Position Y (m)</label>
              <div className="flex items-center bg-white/5 border border-white/10 rounded px-2 focus-within:border-blue-500/50 transition-colors">
                <input 
                  type="number" step="0.1"
                  name="y"
                  id="prop-pos-y"
                  value={belt?.y ?? sensor?.y ?? item?.y ?? source?.y ?? sink?.y ?? 0}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (belt) updateBelt(id, { y: val });
                    if (sensor) updateSensor(id, { y: val });
                    if (item) updateItem(id, { y: val });
                    if (source) updateSource(id, { y: val });
                    if (sink) updateSink(id, { y: val });
                  }}
                  className="w-full bg-transparent py-2 text-xs text-blue-100 outline-none font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Controls based on Object Type */}
        {belt && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-[10px] text-slate-400 uppercase tracking-widest">Belt Speed</label>
                <div className="flex items-center bg-white/5 border border-white/10 rounded px-2 focus-within:border-blue-500/50 transition-colors">
                  <input 
                    type="number" step="0.1"
                    name="speed"
                    id="prop-belt-speed"
                    value={belt.speed}
                    onChange={(e) => updateBelt(id, { speed: parseFloat(e.target.value) })}
                    className="w-full bg-transparent py-2 text-xs text-blue-100 outline-none font-mono"
                  />
                  <span className="text-[9px] text-slate-500 font-bold">m/s</span>
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-[10px] text-slate-400 uppercase tracking-widest">Direction</label>
                <button
                  id="prop-belt-dir-btn"
                  onClick={() => updateBelt(id, { direction: belt.direction === 1 ? -1 : 1 })}
                  className={`w-full flex items-center justify-center gap-2 py-2 rounded border transition-all text-[10px] font-bold uppercase tracking-tight ${
                    belt.direction === 1 
                    ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' 
                    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  }`}
                >
                  <ArrowRightLeft size={12} />
                  {belt.direction === 1 ? 'Forward' : 'Reverse'}
                </button>
              </div>
            </div>

            {belt.type === 'linear' ? (
              <>
                <div className="space-y-2">
                  <label className="block text-[10px] text-slate-400 uppercase tracking-widest">Belt Geometry Preset</label>
                  <div className="grid grid-cols-3 gap-1 p-1 bg-white/5 border border-white/10 rounded-lg">
                    {(['rectangle', 'right_triangle', 'custom'] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => {
                          if (p === 'rectangle') {
                            const l = belt.length || 2;
                            const w = belt.beltWidth || 0.4;
                            updateBelt(id, {
                              length: l,
                              beltWidth: w,
                              trianglePoints: [
                                { x: -l/2, y: -w/2 },
                                { x: l/2, y: -w/2 },
                                { x: l/2, y: w/2 },
                                { x: -l/2, y: w/2 }
                              ]
                            });
                          } else if (p === 'right_triangle') {
                            const l = belt.length || 1.5;
                            const w = belt.beltWidth || 1.5;
                            updateBelt(id, {
                              length: l,
                              beltWidth: w,
                              trianglePoints: [
                                { x: -l/2, y: -w/2 },
                                { x: l/2, y: -w/2 },
                                { x: -l/2, y: w/2 },
                                { x: -l/2, y: w/2 }
                              ]
                            });
                          } else {
                            setPreset('custom');
                          }
                        }}
                        className={`py-1.5 rounded text-[9px] font-bold uppercase transition-all cursor-pointer ${
                          preset === p ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {p.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>

                {(preset === 'rectangle' || preset === 'right_triangle') && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="block text-[10px] text-slate-400 uppercase tracking-widest">
                        {preset === 'right_triangle' ? 'Triangle Base' : 'Belt Length'} (m)
                      </label>
                      <div className="flex items-center bg-white/5 border border-white/10 rounded px-2 focus-within:border-blue-500/50 transition-colors">
                        <input 
                          type="number" step="0.1"
                          name="length"
                          id="prop-belt-length"
                          value={belt.length}
                          onChange={(e) => {
                            const l = Math.max(0.1, parseFloat(e.target.value) || 0);
                            if (preset === 'rectangle') {
                              updateBelt(id, {
                                length: l,
                                trianglePoints: [
                                  { x: -l/2, y: -belt.beltWidth/2 },
                                  { x: l/2, y: -belt.beltWidth/2 },
                                  { x: l/2, y: belt.beltWidth/2 },
                                  { x: -l/2, y: belt.beltWidth/2 }
                                ]
                              });
                            } else {
                              updateBelt(id, {
                                length: l,
                                trianglePoints: [
                                  { x: -l/2, y: -belt.beltWidth/2 },
                                  { x: l/2, y: -belt.beltWidth/2 },
                                  { x: -l/2, y: belt.beltWidth/2 },
                                  { x: -l/2, y: belt.beltWidth/2 }
                                ]
                              });
                            }
                          }}
                          className="w-full bg-transparent py-2 text-xs text-blue-100 outline-none font-mono"
                        />
                        <span className="text-[9px] text-slate-500 font-bold">m</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[10px] text-slate-400 uppercase tracking-widest">
                        {preset === 'right_triangle' ? 'Triangle Height' : 'Belt Width'} (m)
                      </label>
                      <div className="flex items-center bg-white/5 border border-white/10 rounded px-2 focus-within:border-blue-500/50 transition-colors">
                        <input 
                          type="number" step="0.05"
                          name="beltWidth"
                          id="prop-belt-width"
                          value={belt.beltWidth}
                          onChange={(e) => {
                            const w = Math.max(0.1, parseFloat(e.target.value) || 0);
                            if (preset === 'rectangle') {
                              updateBelt(id, {
                                beltWidth: w,
                                trianglePoints: [
                                  { x: -belt.length/2, y: -w/2 },
                                  { x: belt.length/2, y: -w/2 },
                                  { x: belt.length/2, y: w/2 },
                                  { x: -belt.length/2, y: w/2 }
                                ]
                              });
                            } else {
                              updateBelt(id, {
                                beltWidth: w,
                                trianglePoints: [
                                  { x: -belt.length/2, y: -w/2 },
                                  { x: belt.length/2, y: -w/2 },
                                  { x: -belt.length/2, y: w/2 },
                                  { x: -belt.length/2, y: w/2 }
                                ]
                              });
                            }
                          }}
                          className="w-full bg-transparent py-2 text-xs text-blue-100 outline-none font-mono"
                        />
                        <span className="text-[9px] text-slate-500 font-bold">m</span>
                      </div>
                    </div>
                  </div>
                )}

                {preset === 'custom' && belt.trianglePoints && (
                  <div className="space-y-4">
                    <label className="block text-[10px] text-slate-400 uppercase tracking-widest">Quadrilateral Vertices (Offsets from center)</label>
                    {belt.trianglePoints.map((pt, idx) => (
                      <div key={idx} className="grid grid-cols-2 gap-2">
                        <div className="flex items-center bg-white/5 border border-white/10 rounded px-2">
                           <span className="text-[8px] text-slate-500 mr-2">P{idx+1}_X</span>
                           <input 
                            type="number" step="0.05"
                            name={`trianglePoint-${idx}-x`}
                            id={`prop-belt-pt-${idx}-x`}
                            value={pt.x}
                            onChange={(e) => {
                              const newPts = [...belt.trianglePoints!];
                              newPts[idx] = { ...newPts[idx], x: parseFloat(e.target.value) || 0 };
                              updateBelt(id, { trianglePoints: newPts });
                            }}
                            className="w-full bg-transparent py-1 text-[10px] text-blue-100 outline-none font-mono"
                          />
                        </div>
                        <div className="flex items-center bg-white/5 border border-white/10 rounded px-2">
                           <span className="text-[8px] text-slate-500 mr-2">P{idx+1}_Y</span>
                           <input 
                            type="number" step="0.05"
                            name={`trianglePoint-${idx}-y`}
                            id={`prop-belt-pt-${idx}-y`}
                            value={pt.y}
                            onChange={(e) => {
                              const newPts = [...belt.trianglePoints!];
                              newPts[idx] = { ...newPts[idx], y: parseFloat(e.target.value) || 0 };
                              updateBelt(id, { trianglePoints: newPts });
                            }}
                            className="w-full bg-transparent py-1 text-[10px] text-blue-100 outline-none font-mono"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-2">
                  <label className="block text-[10px] text-slate-400 uppercase tracking-widest">Flow Direction Angle</label>
                  <div className="flex items-center bg-white/5 border border-white/10 rounded px-2 focus-within:border-blue-500/50 transition-colors">
                    <input 
                      type="number" step="1"
                      name="directionAngle"
                      id="prop-belt-flowAngle"
                      value={belt.directionAngle || 0}
                      onChange={(e) => updateBelt(id, { directionAngle: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-transparent py-2 text-xs text-blue-100 outline-none font-mono"
                    />
                    <span className="text-[9px] text-slate-500 font-bold">deg</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] text-slate-400 uppercase tracking-widest">Belt Rotation</label>
                  <div className="flex items-center bg-white/5 border border-white/10 rounded px-2 focus-within:border-blue-500/50 transition-colors">
                    <input 
                      type="number"
                      name="rotation"
                      id="prop-belt-rotation"
                      value={belt.rotation}
                      onChange={(e) => updateBelt(id, { rotation: parseInt(e.target.value) })}
                      className="w-full bg-transparent py-2 text-xs text-blue-100 outline-none font-mono"
                    />
                    <span className="text-[9px] text-slate-500 font-bold">deg</span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-[10px] text-slate-400 uppercase tracking-widest">Arc Radius (m)</label>
                    <div className="flex items-center bg-white/5 border border-white/10 rounded px-2 focus-within:border-blue-500/50 transition-colors">
                      <input 
                        type="number" step="0.1"
                        name="radius"
                        id="prop-belt-radius"
                        value={belt.radius}
                        onChange={(e) => updateBelt(id, { radius: Math.max(0.1, parseFloat(e.target.value) || 0) })}
                        className="w-full bg-transparent py-2 text-xs text-blue-100 outline-none font-mono"
                      />
                      <span className="text-[9px] text-slate-500 font-bold">m</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] text-slate-400 uppercase tracking-widest">Belt Width (m)</label>
                     <div className="flex items-center bg-white/5 border border-white/10 rounded px-2 focus-within:border-blue-500/50 transition-colors">
                        <input 
                          type="number" step="0.05"
                          name="beltWidth"
                          id="prop-belt-width-curved"
                          value={belt.beltWidth}
                          onChange={(e) => updateBelt(id, { beltWidth: Math.max(0.1, parseFloat(e.target.value) || 0) })}
                          className="w-full bg-transparent py-2 text-xs text-blue-100 outline-none font-mono" 
                        />
                        <span className="text-[9px] text-slate-500 font-bold">m</span>
                     </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-[10px] text-slate-400 uppercase tracking-widest">Start Angle</label>
                    <div className="flex items-center bg-white/5 border border-white/10 rounded px-2 focus-within:border-blue-500/50 transition-colors">
                      <input 
                        type="number"
                        name="startAngle"
                        id="prop-belt-startAngle"
                        value={belt.startAngle}
                        onChange={(e) => updateBelt(id, { startAngle: parseInt(e.target.value) })}
                        className="w-full bg-transparent py-2 text-xs text-blue-100 outline-none font-mono"
                      />
                      <span className="text-[9px] text-slate-500 font-bold">deg</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] text-slate-400 uppercase tracking-widest">End Angle</label>
                    <div className="flex items-center bg-white/5 border border-white/10 rounded px-2 focus-within:border-blue-500/50 transition-colors">
                      <input 
                        type="number"
                        name="endAngle"
                        id="prop-belt-endAngle"
                        value={belt.endAngle}
                        onChange={(e) => updateBelt(id, { endAngle: parseInt(e.target.value) })}
                        className="w-full bg-transparent py-2 text-xs text-blue-100 outline-none font-mono"
                      />
                      <span className="text-[9px] text-slate-500 font-bold">deg</span>
                    </div>
                  </div>
                </div>
              </>
            )}

            <div className="space-y-2">
              <label className="block text-[10px] text-slate-400 uppercase tracking-widest">Variable Bindings</label>
              <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg flex justify-between items-center group cursor-pointer hover:bg-blue-500/20 transition-all">
                <div>
                  <p className="text-[11px] font-bold text-blue-100">$SPEED_CONTROL</p>
                  <p className="text-[9px] text-blue-400">Mapped to Belt_Logic_{id.slice(0, 2)}</p>
                </div>
                <div className="w-2 h-2 bg-blue-400 rounded-full shadow-[0_0_8px_rgba(96,165,250,0.8)] animate-pulse" />
              </div>
            </div>
          </div>
        )}

        {item && (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="block text-[10px] text-slate-400 uppercase tracking-widest">Parcel Label</label>
              <input 
                type="text"
                value={item.label}
                onChange={(e) => updateItem(id, { label: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-xs text-blue-100 outline-none focus:border-blue-500/50 transition-colors"
                placeholder="No Label"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-[10px] text-slate-400 uppercase tracking-widest">Width (m)</label>
                <input 
                  type="number" step="0.1"
                  value={item.width}
                  onChange={(e) => updateItem(id, { width: Math.max(0.1, parseFloat(e.target.value) || 0) })}
                  className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-xs text-blue-100 font-mono"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-[10px] text-slate-400 uppercase tracking-widest">Height (m)</label>
                <input 
                  type="number" step="0.1"
                  value={item.height}
                  onChange={(e) => updateItem(id, { height: Math.max(0.1, parseFloat(e.target.value) || 0) })}
                  className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-xs text-blue-100 font-mono"
                />
              </div>
            </div>
          </div>
        )}

        {source && (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="block text-[10px] text-slate-400 uppercase tracking-widest">Source Label</label>
              <input 
                type="text"
                name="label"
                id="prop-source-label"
                value={source.label}
                onChange={(e) => updateSource(id, { label: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-xs text-blue-100 outline-none focus:border-blue-500/50 transition-colors"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] text-slate-400 uppercase tracking-widest">Interval (sec)</label>
              <div className="flex items-center bg-white/5 border border-white/10 rounded px-2 focus-within:border-blue-500/50 transition-colors">
                <input 
                  type="number" step="0.01"
                  name="interval"
                  id="prop-source-interval"
                  value={source.interval}
                  onChange={(e) => updateSource(id, { interval: Math.max(0.01, parseFloat(e.target.value) || 0.01) })}
                  className="w-full bg-transparent py-2 text-xs text-blue-100 outline-none font-mono"
                />
                <span className="text-[9px] text-slate-500 font-bold">s</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-[10px] text-slate-400 uppercase tracking-widest">Min Width</label>
                <input 
                  type="number" step="0.1"
                  name="minWidth"
                  id="prop-source-minWidth"
                  value={source.minWidth}
                  onChange={(e) => updateSource(id, { minWidth: Math.max(0.01, parseFloat(e.target.value) || 0) })}
                  className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-xs text-blue-100 font-mono"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-[10px] text-slate-400 uppercase tracking-widest">Max Width</label>
                <input 
                  type="number" step="0.1"
                  name="maxWidth"
                  id="prop-source-maxWidth"
                  value={source.maxWidth}
                  onChange={(e) => updateSource(id, { maxWidth: Math.max(0.01, parseFloat(e.target.value) || 0) })}
                  className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-xs text-blue-100 font-mono"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-[10px] text-slate-400 uppercase tracking-widest">Min Height</label>
                <input 
                  type="number" step="0.1"
                  name="minHeight"
                  id="prop-source-minHeight"
                  value={source.minHeight}
                  onChange={(e) => updateSource(id, { minHeight: Math.max(0.01, parseFloat(e.target.value) || 0) })}
                  className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-xs text-blue-100 font-mono"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-[10px] text-slate-400 uppercase tracking-widest">Max Height</label>
                <input 
                  type="number" step="0.1"
                  name="maxHeight"
                  id="prop-source-maxHeight"
                  value={source.maxHeight}
                  onChange={(e) => updateSource(id, { maxHeight: Math.max(0.01, parseFloat(e.target.value) || 0) })}
                  className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-xs text-blue-100 font-mono"
                />
              </div>
            </div>

            {/* Parcel Color Scheme */}
            <div className="space-y-3">
              <label className="block text-[10px] text-slate-400 uppercase tracking-widest">Parcel Color Scheme</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Random', colors: undefined },
                  { label: 'Warm', colors: ['#ef4444', '#f97316', '#f59e0b', '#dc2626'] },
                  { label: 'Cool', colors: ['#3b82f6', '#06b6d4', '#6366f1', '#0ea5e9'] },
                  { label: 'Mono', colors: ['#94a3b8', '#cbd5e1', '#64748b', '#e2e8f0'] },
                  { label: 'Vivid', colors: ['#a855f7', '#ec4899', '#06b6d4', '#84cc16'] },
                  { label: 'Earth', colors: ['#78350f', '#92400e', '#a16207', '#166534'] },
                ].map(({ label, colors }) => {
                  const isActive = colors === undefined
                    ? !source.colorScheme
                    : JSON.stringify(source.colorScheme) === JSON.stringify(colors);
                  return (
                    <button
                      key={label}
                      onClick={() => updateSource(id, { colorScheme: colors })}
                      className={`p-2 rounded border flex items-center gap-2 transition-all text-[9px] font-bold uppercase ${
                        isActive ? 'border-blue-500/50 bg-blue-500/10 text-blue-300' : 'border-white/10 bg-white/5 text-slate-500 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex gap-0.5">
                        {colors
                          ? colors.slice(0, 3).map((c, i) => (
                              <div key={i} className="w-2 h-2 rounded-full" style={{ backgroundColor: c }} />
                            ))
                          : <div className="w-6 h-2 rounded-full bg-gradient-to-r from-rose-400 via-sky-400 to-emerald-400" />
                        }
                      </div>
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}


        {sink && (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="block text-[10px] text-slate-400 uppercase tracking-widest">Sink Label</label>
              <input 
                type="text"
                name="label"
                id="prop-sink-label"
                value={sink.label}
                onChange={(e) => updateSink(id, { label: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-xs text-blue-100 outline-none focus:border-blue-500/50 transition-colors"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-[10px] text-slate-400 uppercase tracking-widest">Width (m)</label>
                <input 
                  type="number" step="0.1"
                  name="width"
                  id="prop-sink-width"
                  value={sink.width}
                  onChange={(e) => updateSink(id, { width: Math.max(0.1, parseFloat(e.target.value) || 0) })}
                  className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-xs text-blue-100 font-mono"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-[10px] text-slate-400 uppercase tracking-widest">Height (m)</label>
                <input 
                  type="number" step="0.1"
                  name="height"
                  id="prop-sink-height"
                  value={sink.height}
                  onChange={(e) => updateSink(id, { height: Math.max(0.1, parseFloat(e.target.value) || 0) })}
                  className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-xs text-blue-100 font-mono"
                />
              </div>
            </div>
          </div>
        )}

        {sensor && (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="block text-[10px] text-slate-400 uppercase tracking-widest">Sensor Logic Name</label>
              <input 
                type="text"
                name="label"
                id="prop-sensor-label"
                value={sensor.label}
                onChange={(e) => updateSensor(id, { label: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-xs text-blue-100 outline-none focus:border-blue-500/50 transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-[10px] text-slate-400 uppercase tracking-widest">Rotate Angle</label>
                <div className="flex items-center bg-white/5 border border-white/10 rounded px-2 focus-within:border-blue-500/50 transition-colors">
                  <input 
                    type="number"
                    name="rotation"
                    id="prop-sensor-rotation"
                    value={sensor.rotation}
                    onChange={(e) => updateSensor(id, { rotation: parseInt(e.target.value) })}
                    className="w-full bg-transparent py-2 text-xs text-blue-100 outline-none font-mono"
                  />
                  <span className="text-[9px] text-slate-500 font-bold">deg</span>
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-[10px] text-slate-400 uppercase tracking-widest">Beam Length (m)</label>
                <div className="flex items-center bg-white/5 border border-white/10 rounded px-2 focus-within:border-blue-500/50 transition-colors">
                  <input 
                    type="number" step="0.1"
                    name="height"
                    id="prop-sensor-height"
                    value={sensor.height}
                    onChange={(e) => updateSensor(id, { height: Math.max(0.1, parseFloat(e.target.value) || 0) })}
                    className="w-full bg-transparent py-2 text-xs text-blue-100 outline-none font-mono"
                  />
                  <span className="text-[9px] text-slate-500 font-bold">m</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
               <label className="block text-[10px] text-slate-400 uppercase tracking-widest flex items-center gap-2">
                 <Activity size={10} className="text-emerald-500" />
                 Detection Records
               </label>
               <div className="bg-slate-900/50 border border-white/5 rounded-lg overflow-hidden flex flex-col max-h-80">
                 <div className="p-3 border-b border-white/10 bg-white/5 flex justify-between text-[8px] font-bold text-slate-500 uppercase tracking-widest">
                   <span className="w-1/3">Item</span>
                   <span className="w-1/4 text-center">State</span>
                   <span className="w-1/3 text-right">Timestamp</span>
                 </div>
                 <div className="overflow-y-auto flex-1 divide-y divide-white/5">
                   {sensor.detectionLog.length > 0 ? (
                     sensor.detectionLog.map((record) => (
                       <div key={record.id} className="px-3 py-2 flex justify-between items-center text-[10px] font-mono">
                         <span className="w-1/3 text-blue-400 font-bold truncate">{record.itemLabel}</span>
                         <span className={`w-1/4 text-center font-black text-[8px] ${record.type === 'ON' ? 'text-emerald-500' : 'text-slate-500'}`}>
                           {record.type}
                         </span>
                         <span className="w-1/3 text-right text-slate-500">
                           {new Date(record.timestamp).toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' }).concat('.' + (record.timestamp % 1000).toString().padStart(3, '0'))}
                         </span>
                       </div>
                     ))
                   ) : (
                     <div className="p-4 text-center text-slate-600 text-[10px] italic">No detections</div>
                   )}
                 </div>
               </div>
            </div>
          </div>
        )}

        {/* Variable Bindings */}
        {(belt || sensor || source) && (
          <div className="space-y-4 pt-4 border-t border-white/5">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>
              <label className="block text-[10px] text-indigo-400 uppercase tracking-widest font-bold">MQTT Variable Binding</label>
            </div>
            
            {belt && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <label className="block text-[9px] text-slate-500 uppercase tracking-widest">Speed Binding (Input)</label>
                  <input 
                    type="text"
                    name="speedBinding"
                    placeholder="e.g. Motor1_Speed"
                    value={belt.speedBinding || ''}
                    onChange={(e) => updateBelt(id, { speedBinding: e.target.value })}
                    className="w-full bg-slate-950 border border-white/10 rounded px-3 py-2 text-xs text-indigo-300 font-mono outline-none focus:border-indigo-500/50 transition-colors"
                  />
                </div>
                {belt.type === 'linear' && (
                  <div className="space-y-2">
                    <label className="block text-[9px] text-slate-500 uppercase tracking-widest">Flow Angle Binding (Input)</label>
                    <input 
                      type="text"
                      name="directionAngleBinding"
                      placeholder="e.g. Motor1_FlowAngle"
                      value={belt.directionAngleBinding || ''}
                      onChange={(e) => updateBelt(id, { directionAngleBinding: e.target.value })}
                      className="w-full bg-slate-950 border border-white/10 rounded px-3 py-2 text-xs text-indigo-300 font-mono outline-none focus:border-indigo-500/50 transition-colors"
                    />
                  </div>
                )}
                {belt.type === 'curved' && (
                  <div className="space-y-2">
                    <label className="block text-[9px] text-slate-500 uppercase tracking-widest">Direction Binding (Input)</label>
                    <input 
                      type="text"
                      name="directionBinding"
                      placeholder="e.g. Motor1_Direction"
                      value={belt.directionBinding || ''}
                      onChange={(e) => updateBelt(id, { directionBinding: e.target.value })}
                      className="w-full bg-slate-950 border border-white/10 rounded px-3 py-2 text-xs text-indigo-300 font-mono outline-none focus:border-indigo-500/50 transition-colors"
                    />
                  </div>
                )}
              </div>
            )}

            {sensor && (
              <div className="space-y-2">
                <label className="block text-[9px] text-slate-500 uppercase tracking-widest">State Binding (Output)</label>
                <input 
                  type="text"
                  name="stateBinding"
                  placeholder="e.g. Sensor1_State"
                  value={sensor.stateBinding || ''}
                  onChange={(e) => updateSensor(id, { stateBinding: e.target.value })}
                  className="w-full bg-slate-950 border border-white/10 rounded px-3 py-2 text-xs text-indigo-300 font-mono outline-none focus:border-indigo-500/50 transition-colors"
                />
              </div>
            )}

            {source && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <label className="block text-[9px] text-slate-500 uppercase tracking-widest">Trigger Binding (Input)</label>
                  <input 
                    type="text"
                    name="triggerBinding"
                    placeholder="e.g. Spawn_Parcel"
                    value={source.triggerBinding || ''}
                    onChange={(e) => updateSource(id, { triggerBinding: e.target.value })}
                    className="w-full bg-slate-950 border border-white/10 rounded px-3 py-2 text-xs text-indigo-300 font-mono outline-none focus:border-indigo-500/50 transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-[9px] text-slate-500 uppercase tracking-widest">Interval Binding (Input)</label>
                  <input 
                    type="text"
                    name="intervalBinding"
                    placeholder="e.g. Spawn_Interval"
                    value={source.intervalBinding || ''}
                    onChange={(e) => updateSource(id, { intervalBinding: e.target.value })}
                    className="w-full bg-slate-950 border border-white/10 rounded px-3 py-2 text-xs text-indigo-300 font-mono outline-none focus:border-indigo-500/50 transition-colors"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Global Styles / Theming */}
        <div className="space-y-4 pt-4 border-t border-white/5">
          <label className="block text-[10px] text-slate-400 uppercase tracking-widest">Color Schema</label>
          <div className="flex gap-3">
            {['#1e293b', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'].map(color => (
              <button
                key={color}
                onClick={() => {
                  if (belt) updateBelt(id, { color });
                  if (sensor) updateSensor(id, { color });
                  if (item) updateItem(id, { color });
                }}
                className={`w-7 h-7 rounded-sm border transition-all ${
                  (belt?.color === color || sensor?.color === color || item?.color === color) 
                  ? 'border-white scale-110 shadow-lg shadow-white/10' 
                  : 'border-white/10 hover:border-white/30'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>

        {/* Feature Toggles */}
        <div className="pt-6 border-t border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-[11px] text-slate-300 font-medium">Kinetic Friction</label>
            <button 
              onClick={toggleKineticFriction}
              className={`w-8 h-4 rounded-full relative cursor-pointer transition-colors ${kineticFriction ? 'bg-emerald-500/20 border border-emerald-500/50 shadow-inner' : 'bg-white/10 border border-white/20'}`}
            >
               <div className={`absolute top-0.5 w-2.5 h-2.5 rounded-full transition-all ${kineticFriction ? 'right-0.5 bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.8)]' : 'left-0.5 bg-slate-500'}`}></div>
            </button>
          </div>
          <div className="flex items-center justify-between">
            <label className="text-[11px] text-slate-300 font-medium">Collision Engine</label>
            <button 
              onClick={toggleCollisionEnabled}
              className={`w-8 h-4 rounded-full relative cursor-pointer transition-colors ${collisionEnabled ? 'bg-emerald-500/20 border border-emerald-500/50 shadow-inner' : 'bg-white/10 border border-white/20'}`}
            >
               <div className={`absolute top-0.5 w-2.5 h-2.5 rounded-full transition-all ${collisionEnabled ? 'right-0.5 bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.8)]' : 'left-0.5 bg-slate-500'}`}></div>
            </button>
          </div>
        </div>
      </div>

      <div className="p-5 mt-auto">
        <button 
          onClick={handleDelete}
          className="w-full flex items-center justify-center gap-2 py-3 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white border border-red-500/30 rounded-lg transition-all font-bold text-[10px] uppercase tracking-widest active:scale-95"
        >
          <Trash2 size={14} />
          Destroy Object
        </button>
      </div>
    </div>
  );
}

const SettingsIcon = ({ size, className }: { size: number, className?: string }) => (
  <Sliders size={size} className={className} />
);

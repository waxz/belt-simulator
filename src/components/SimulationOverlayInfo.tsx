import React from 'react';
import { useStore } from '../store/useStore';

export default function SimulationOverlayInfo() {
  const isPlaying = useStore(state => state.isPlaying);
  const beltsLength = useStore(state => state.belts.length);
  const sensorsLength = useStore(state => state.sensors.length);
  const itemsLength = useStore(state => state.items.length);
  const fps = useStore(state => state.fps);
  const latency = useStore(state => state.latency);

  return (
    <div className="absolute bottom-6 left-6 p-4 bg-slate-900/80 rounded-xl border border-white/10 pointer-events-none select-none min-w-[180px]">
      <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center justify-between">
        <span>Simulation Engine</span>
        <div className={`w-1.5 h-1.5 rounded-full ${isPlaying ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-700'}`} />
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between items-center text-[11px]">
          <span className="text-slate-400">Environment</span>
          <span className="text-blue-200 font-mono">Vacuum_Ref_X2</span>
        </div>
        <div className="flex justify-between items-center text-[11px]">
          <span className="text-slate-400">Total Nodes</span>
          <span className="text-blue-200 font-mono">{beltsLength + sensorsLength}</span>
        </div>
        <div className="flex justify-between items-center text-[11px]">
          <span className="text-slate-400">FPS</span>
          <span className={`font-mono ${fps < 30 ? 'text-red-400 font-bold' : 'text-blue-200'}`}>{fps.toFixed(0)}</span>
        </div>
        <div className="flex justify-between items-center text-[11px] pt-1 border-t border-white/5">
          <span className="text-slate-500 text-[10px]">Physics Latency</span>
          <span className="text-slate-300 font-mono text-[10px]">{latency.physics.toFixed(1)}ms</span>
        </div>
        <div className="flex justify-between items-center text-[11px]">
          <span className="text-slate-500 text-[10px]">Logic Latency</span>
          <span className="text-slate-300 font-mono text-[10px]">{latency.logic.toFixed(1)}ms</span>
        </div>
        <div className="flex justify-between items-center text-[11px]">
          <span className="text-slate-500 text-[10px]">Render Sync</span>
          <span className="text-slate-300 font-mono text-[10px]">{latency.render.toFixed(1)}ms</span>
        </div>
        <div className="flex justify-between items-center text-[11px]">
          <span className="text-slate-400">Process Items</span>
          <span className="text-blue-200 font-mono">{itemsLength}</span>
        </div>
      </div>
    </div>
  );
}

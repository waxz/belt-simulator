
import React from 'react';
import { useStore } from '../store/useStore';
import { Activity } from 'lucide-react';

export default function FpsIndicator() {
  const fps = useStore(state => state.fps);

  const getStatusColor = () => {
    if (fps >= 55) return 'text-emerald-400';
    if (fps >= 30) return 'text-amber-400';
    return 'text-red-400';
  };

  return (
    <div className="absolute top-4 right-4 z-10 bg-slate-900 px-3 py-1.5 rounded-full border border-slate-700 flex items-center gap-2 shadow-lg">
      <Activity size={14} className={getStatusColor()} />
      <div className="flex items-baseline gap-1">
        <span className={`font-mono font-bold text-sm ${getStatusColor()}`}>
          {fps}
        </span>
        <span className="text-slate-500 text-[10px] uppercase font-bold tracking-tighter">FPS</span>
      </div>
    </div>
  );
}

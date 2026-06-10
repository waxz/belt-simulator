
import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import { ComponentType } from '../store/useStore';

interface CreationDialogProps {
  type: ComponentType;
  x: number;
  y: number;
  onConfirm: (data: any) => void;
  onCancel: () => void;
}

export default function CreationDialog({ type, x, y, onConfirm, onCancel }: CreationDialogProps) {
  const [label, setLabel] = useState(
    type?.startsWith('belt_') ? 'BELT' :
      type === 'sensor' ? 'SENSOR' :
        type === 'source' ? 'SOURCE' :
          type === 'sink' ? 'SINK' : 'ITEM'
  );
  const [interval, setIntervalVal] = useState(1.0);

  const handleSubmit = (e: React.SyntheticEvent) => {
    e.preventDefault();
    onConfirm({
      label,
      interval: parseFloat(interval.toString()),
      x: parseFloat(x.toFixed(2)),
      y: parseFloat(y.toFixed(2))
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80">
      <div className="bg-slate-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-white/5">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">New {type}</h3>
          <button onClick={onCancel} className="text-slate-500 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="block text-[10px] text-slate-500 uppercase tracking-widest font-bold">Node Label / ID</label>
              <input
                autoFocus
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-blue-100 outline-none focus:border-blue-500/50 transition-all font-mono"
                placeholder="e.g. Belt_01"
              />
            </div>

            {type === 'source' && (
              <div className="space-y-2">
                <label className="block text-[10px] text-slate-500 uppercase tracking-widest font-bold">Generation Interval (sec)</label>
                <input
                  type="number"
                  step="0.01"
                  value={interval}
                  onChange={(e) => setIntervalVal(parseFloat(e.target.value))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-blue-100 outline-none focus:border-blue-500/50 transition-all font-mono"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="space-y-1.5 p-3 bg-white/5 rounded-lg border border-white/5">
                <span className="block text-[8px] text-slate-500 uppercase tracking-widest font-black">X-Coord</span>
                <span className="text-xs text-blue-300 font-mono">{x.toFixed(2)}m</span>
              </div>
              <div className="space-y-1.5 p-3 bg-white/5 rounded-lg border border-white/5">
                <span className="block text-[8px] text-slate-500 uppercase tracking-widest font-black">Y-Coord</span>
                <span className="text-xs text-blue-300 font-mono">{y.toFixed(2)}m</span>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-slate-400 text-xs font-bold rounded-xl transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
            >
              <Check size={14} />
              Create Node
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

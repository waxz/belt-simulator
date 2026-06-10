import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { 
  FolderOpen, 
  ChevronRight, 
  ChevronDown, 
  Trash2, 
  Box, 
  Activity, 
  ArrowRight, 
  LogIn, 
  LogOut,
  Layers
} from 'lucide-react';

interface ExplorerPanelProps {
  onSelectId: (id: string | null) => void;
  selectedId: string | null;
}

export default function ExplorerPanel({ onSelectId, selectedId }: ExplorerPanelProps) {
  const belts = useStore(state => state.belts);
  const sensors = useStore(state => state.sensors);
  const items = useStore(state => state.items);
  const sources = useStore(state => state.sources);
  const sinks = useStore(state => state.sinks);
  
  const removeBelt = useStore(state => state.removeBelt);
  const removeSensor = useStore(state => state.removeSensor);
  const removeItem = useStore(state => state.removeItem);
  const removeSource = useStore(state => state.removeSource);
  const removeSink = useStore(state => state.removeSink);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    belts: true,
    sensors: true,
    sources: true,
    sinks: true,
    items: true
  });

  const toggleExpand = (category: string) => {
    setExpanded(prev => ({ ...prev, [category]: !prev[category] }));
  };

  const renderCategory = (
    key: string, 
    title: string, 
    itemsList: any[], 
    Icon: React.ElementType, 
    removeFn: (id: string) => void,
    nameResolver: (item: any) => string
  ) => {
    const isExpanded = expanded[key];
    
    return (
      <div className="mb-2">
        <button 
          onClick={() => toggleExpand(key)}
          className="flex items-center gap-1.5 w-full text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-slate-200 transition-colors py-1"
        >
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <FolderOpen size={12} className="text-blue-400" />
          <span>{title} ({itemsList.length})</span>
        </button>
        
        {isExpanded && (
          <div className="pl-6 pr-2 mt-1 space-y-0.5">
            {itemsList.length === 0 && (
              <div className="text-[10px] text-slate-600 italic py-1">Empty</div>
            )}
            {itemsList.map(item => {
              const isSelected = selectedId === item.id;
              return (
                <div 
                  key={item.id}
                  onClick={() => onSelectId(item.id)}
                  className={`group flex items-center justify-between px-2 py-1.5 rounded cursor-pointer transition-colors ${
                    isSelected ? 'bg-blue-600/20 text-blue-300' : 'text-slate-400 hover:bg-white/5 hover:text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Icon size={12} className={isSelected ? 'text-blue-400' : 'text-slate-500'} />
                    <span className="text-[11px] truncate">{nameResolver(item)}</span>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFn(item.id);
                      if (isSelected) onSelectId(null);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 text-red-400/50 hover:text-red-400 rounded transition-all"
                    title="Delete"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border-r border-white/10 w-64 shadow-2xl relative z-30">
      <div className="h-14 border-b border-white/10 flex items-center px-4 bg-slate-950/50 shrink-0">
        <div className="flex items-center gap-2">
          <Layers size={16} className="text-blue-400" />
          <h2 className="text-xs font-bold text-slate-200 uppercase tracking-widest">Explorer</h2>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
        {renderCategory('belts', 'Belts', belts, ArrowRight, removeBelt, (b) => `Belt (${b.type === 'linear' ? 'linear' : 'curved'})`)}
        {renderCategory('sensors', 'Sensors', sensors, Activity, removeSensor, (s) => s.label || 'Sensor')}
        {renderCategory('sources', 'Sources', sources, LogIn, removeSource, (s) => s.label || 'Source')}
        {renderCategory('sinks', 'Sinks', sinks, LogOut, removeSink, (s) => s.label || 'Sink')}
        {renderCategory('items', 'Items', items, Box, removeItem, (i) => i.label || `Parcel (${i.type})`)}
      </div>
    </div>
  );
}

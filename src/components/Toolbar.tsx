import React from 'react';
import { 
  ArrowRight, 
  MousePointer2,
  Box as BoxIcon, 
  Activity, 
  Square,
  Repeat,
  LogIn,
  LogOut,
  Trash2,
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  Triangle,
  Layers
} from 'lucide-react';
import { useStore, ComponentType } from '../store/useStore';

interface ToolbarProps {
  onSelectElement: (id: string | null) => void;
}

interface ToolItem {
  id: ComponentType;
  icon: React.ReactNode;
  label: string;
  preview: React.ReactNode;
  action: () => void;
}

interface ToolCategory {
  name: string;
  icon: React.ReactNode;
  items: ToolItem[];
}

export default function Toolbar({ onSelectElement }: ToolbarProps) {
  const setActiveTool = useStore(state => state.setActiveTool);
  const activeTool = useStore(state => state.activeTool);
  const isPlaying = useStore(state => state.isPlaying);
  const setPlaying = useStore(state => state.setPlaying);
  const resetSimulation = useStore(state => state.resetSimulation);
  const clearItems = useStore(state => state.clearItems);
  const isStepMode = useStore(state => state.isStepMode);
  const setStepMode = useStore(state => state.setStepMode);
  const triggerStep = useStore(state => state.triggerStep);
  const isAutoStepping = useStore(state => state.isAutoStepping);
  const toggleAutoStepping = useStore(state => state.toggleAutoStepping);
  const stepInterval = useStore(state => state.stepInterval);
  const setStepInterval = useStore(state => state.setStepInterval);
  const simulatorBackend = useStore(state => state.simulatorBackend);
  const setSimulatorBackend = useStore(state => state.setSimulatorBackend);
  const simulationSteps = useStore(state => state.simulationSteps);
  const setSimulationSteps = useStore(state => state.setSimulationSteps);
  const gridSnap = useStore(state => state.gridSnap);
  const toggleGridSnap = useStore(state => state.toggleGridSnap);

  React.useEffect(() => {
    let interval: any;
    if (isStepMode && isAutoStepping) {
      interval = setInterval(() => {
        triggerStep();
      }, stepInterval * 1000);
    }
    return () => clearInterval(interval);
  }, [isStepMode, isAutoStepping, stepInterval, triggerStep]);

  const categories: ToolCategory[] = [
    {
      name: 'Linear Belts',
      icon: <ArrowRight size={14} />,
      items: [
        {
          id: 'belt_rectangle' as ComponentType,
          icon: <ArrowRight size={16} strokeWidth={2} />,
          label: 'Rectangle',
          preview: <div className="w-10 h-4 bg-blue-500/30 border border-blue-400/50 rounded-sm"></div>,
          action: () => setActiveTool('belt_rectangle')
        },
        {
          id: 'belt_right_triangle' as ComponentType,
          icon: <Triangle size={16} fill="currentColor" strokeWidth={0} className="text-blue-400" />,
          label: 'Right Triangle',
          preview: <div className="w-8 h-6 flex items-end justify-start"><Triangle size={20} className="text-blue-400/50" /></div>,
          action: () => setActiveTool('belt_right_triangle')
        },
        {
          id: 'belt_quadrilateral' as ComponentType,
          icon: <Square size={16} className="text-blue-400" />,
          label: 'Quadrilateral',
          preview: <div className="w-8 h-6 border-2 border-blue-400/50 rounded-sm transform rotate-6"></div>,
          action: () => setActiveTool('belt_quadrilateral')
        }
      ]
    },
    {
      name: 'Curved Belts',
      icon: <Repeat size={14} />,
      items: [
        {
          id: 'belt_arc' as ComponentType,
          icon: <Repeat size={16} className="text-blue-400" />,
          label: 'Arc Belt',
          preview: <div className="w-10 h-8 rounded-full border-2 border-blue-400/50" style={{ borderTopColor: 'transparent', borderRightColor: 'transparent' }}></div>,
          action: () => setActiveTool('belt_arc')
        }
      ]
    },
    {
      name: 'Sensors',
      icon: <Activity size={14} />,
      items: [
        {
          id: 'sensor' as ComponentType,
          icon: <Activity size={16} />,
          label: 'IR Sensor',
          preview: <div className="w-1 h-8 bg-emerald-500/40 border border-emerald-500 rounded"></div>,
          action: () => setActiveTool('sensor')
        }
      ]
    },
    {
      name: 'Flow Control',
      icon: <LogIn size={14} />,
      items: [
        {
          id: 'source' as ComponentType,
          icon: <LogIn size={16} />,
          label: 'Source',
          preview: <div className="w-8 h-8 rounded-full border-2 border-blue-400 border-dashed flex items-center justify-center text-blue-400 font-bold text-[8px]">IN</div>,
          action: () => setActiveTool('source')
        },
        {
          id: 'sink' as ComponentType,
          icon: <LogOut size={16} />,
          label: 'Sink',
          preview: <div className="w-8 h-8 rounded border-2 border-red-400 border-dashed flex items-center justify-center text-red-400 font-bold text-[8px]">OUT</div>,
          action: () => setActiveTool('sink')
        }
      ]
    },
    {
      name: 'Items',
      icon: <BoxIcon size={14} />,
      items: [
        {
          id: 'item' as ComponentType,
          icon: <BoxIcon size={16} />,
          label: 'Parcel',
          preview: <div className="w-6 h-6 bg-amber-500/30 border border-amber-500/60 rounded flex items-center justify-center"><Square size={8} className="text-amber-400" /></div>,
          action: () => setActiveTool('item')
        }
      ]
    }
  ];

  const selectTool: ToolItem = {
    id: 'select' as ComponentType,
    icon: <MousePointer2 size={16} />,
    label: 'Select',
    preview: <div className="w-8 h-8 flex items-center justify-center"><MousePointer2 size={16} className="text-slate-400" /></div>,
    action: () => setActiveTool(null)
  };

  return (
    <div className="flex flex-col h-full p-3 overflow-y-auto">
      <h2 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
        <Layers size={12} />
        Components
      </h2>

      {/* Select Tool */}
      <button
        onClick={selectTool.action}
        className={`mb-4 p-2 border rounded-lg flex items-center gap-2 cursor-pointer transition-all ${
          activeTool === null 
            ? 'bg-blue-500/20 border-blue-500/50' 
            : 'bg-white/5 hover:bg-white/10 border-white/10'
        }`}
      >
        {selectTool.preview}
        <span className="text-[10px] font-bold text-slate-400">{selectTool.label}</span>
      </button>

      {/* Tool Categories */}
      {categories.map((category) => (
        <div key={category.name} className="mb-4">
          <div className="text-[8px] font-bold text-slate-600 uppercase tracking-widest mb-2 flex items-center gap-1.5 pl-1">
            {category.icon}
            {category.name}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {category.items.map((tool) => (
              <button
                key={tool.id}
                onClick={tool.action}
                className={`p-2 border rounded-lg flex flex-col items-center gap-1.5 cursor-pointer transition-all hover:scale-[1.02] ${
                  activeTool === tool.id 
                    ? 'bg-blue-500/20 border-blue-500/50 shadow-[0_0_10px_rgba(59,130,246,0.2)]' 
                    : 'bg-white/5 hover:bg-white/10 border-white/10'
                }`}
              >
                <div className="h-8 flex items-center justify-center">
                  {tool.preview}
                </div>
                <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tight">
                  {tool.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* Simulation Controls */}
      <div className="mt-6 pt-4 border-t border-white/10 space-y-3">
        <h2 className="text-[8px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <Activity size={12} />
          Simulation
        </h2>
        
        <div className="p-1 bg-white/5 border border-white/10 rounded-lg flex gap-1">
          <button 
            onClick={() => setSimulatorBackend('matter')}
            className={`flex-1 py-1.5 rounded text-[9px] font-bold uppercase transition-all ${
              simulatorBackend === 'matter' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Matter
          </button>
          <button 
            onClick={() => setSimulatorBackend('rapier')}
            className={`flex-1 py-1.5 rounded text-[9px] font-bold uppercase transition-all ${
              simulatorBackend === 'rapier' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Rapier
          </button>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between items-center text-[9px] uppercase font-bold text-slate-500">
            <span>Steps</span>
            <span className="text-white bg-white/10 px-1.5 py-0.5 rounded">{simulationSteps}</span>
          </div>
          <input 
            type="range" 
            min="1" 
            max="10" 
            step="1"
            value={simulationSteps}
            onChange={(e) => setSimulationSteps(parseInt(e.target.value))}
            className="w-full accent-blue-500 bg-white/10 h-1 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div className="flex gap-2">
          <button 
            onClick={() => setPlaying(!isPlaying)}
            className={`flex-1 p-2 rounded-lg border flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase transition-all ${
              isPlaying 
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-400' 
                : 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
            }`}
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          
          <button 
            onClick={() => setStepMode(!isStepMode)}
            className={`flex-1 p-2 rounded-lg border flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase transition-all ${
              isStepMode 
                ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' 
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
            }`}
          >
            <Activity size={14} />
            Step
          </button>
        </div>

        {isStepMode && (
          <div className="space-y-2 p-2 bg-blue-500/5 border border-blue-500/10 rounded-lg">
            <div className="flex gap-1.5">
              <button 
                onClick={triggerStep}
                className="flex-1 p-2 bg-blue-600 hover:bg-blue-500 border border-blue-400/30 rounded-lg flex items-center justify-center gap-1.5 text-white text-[9px] font-bold uppercase"
              >
                <SkipForward size={12} />
                Step
              </button>
              
              <button 
                onClick={toggleAutoStepping}
                className={`p-2 rounded-lg border flex items-center justify-center transition-all ${
                  isAutoStepping 
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-400' 
                    : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                }`}
              >
                {isAutoStepping ? <Pause size={12} /> : <Play size={12} />}
              </button>
            </div>
            
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[8px] uppercase font-black text-slate-500">
                <span>Interval</span>
                <span className="text-blue-400 font-mono">{stepInterval.toFixed(2)}s</span>
              </div>
              <input 
                type="range"
                min="0.05"
                max="5.0"
                step="0.05"
                value={stepInterval}
                onChange={(e) => setStepInterval(parseFloat(e.target.value))}
                className="w-full accent-blue-500 h-1"
              />
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button 
            onClick={resetSimulation}
            className="flex-1 p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg flex items-center justify-center gap-1.5 text-slate-400 hover:text-white text-[9px] font-bold uppercase"
          >
            <RotateCcw size={12} />
            Reset
          </button>
          
          <button 
            onClick={clearItems}
            className="flex-1 p-2 bg-red-950/20 hover:bg-red-900/30 border border-red-500/20 rounded-lg flex items-center justify-center gap-1.5 text-red-400 hover:text-red-300 text-[9px] font-bold uppercase"
          >
            <Trash2 size={12} />
            Clear
          </button>
        </div>

        {/* Grid Snap Toggle */}
        <button 
          onClick={toggleGridSnap}
          className={`w-full p-2 rounded-lg border text-[9px] font-bold uppercase flex items-center justify-center gap-2 transition-all ${
            gridSnap 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
              : 'bg-white/5 border-white/10 text-slate-500'
          }`}
        >
          <div className={`w-2 h-2 rounded-full ${gridSnap ? 'bg-emerald-400' : 'bg-slate-600'}`}></div>
          Grid Snap: {gridSnap ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* Version Info */}
      <div className="mt-auto pt-4">
        <div className="bg-blue-500/10 rounded-lg px-3 py-2 border border-blue-500/20">
          <p className="text-[8px] text-blue-300 uppercase font-black tracking-widest mb-1">System</p>
          <div className="flex justify-between text-[10px]">
            <span className="text-slate-400">Build</span>
            <span className="text-blue-400 font-mono">v2.5</span>
          </div>
        </div>
      </div>
    </div>
  );
}
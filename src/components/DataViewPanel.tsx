import React, { useMemo } from 'react';
import { useStore } from '../store/useStore';
import { Database, Copy, CheckCircle2 } from 'lucide-react';

interface DataViewPanelProps {
  onClose: () => void;
}

export default function DataViewPanel({ onClose }: DataViewPanelProps) {
  const [copied, setCopied] = React.useState(false);
  const copyTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const belts = useStore(state => state.belts);
  const sensors = useStore(state => state.sensors);
  const items = useStore(state => state.items);
  const sources = useStore(state => state.sources);
  const sinks = useStore(state => state.sinks);

  const stateData = useMemo(() => {
    return {
      belts,
      sensors,
      items,
      sources,
      sinks
    };
  }, [belts, sensors, items, sources, sinks]);

  const jsonString = useMemo(() => JSON.stringify(stateData, null, 2), [stateData]);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
  };

  React.useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  return (
    <div className="flex flex-col h-full bg-slate-900 border-l border-white/10 w-96 shadow-2xl z-40 relative">
      <div className="h-14 border-b border-white/10 flex items-center justify-between px-4 bg-slate-950/50">
        <div className="flex items-center gap-2">
          <Database size={16} className="text-blue-400" />
          <h2 className="text-xs font-bold text-slate-200 uppercase tracking-widest">State Data</h2>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleCopy}
            className="p-1.5 hover:bg-white/10 rounded transition-colors text-slate-400 hover:text-white flex items-center gap-1"
            title="Copy JSON"
          >
            {copied ? <CheckCircle2 size={14} className="text-emerald-400" /> : <Copy size={14} />}
            <span className="text-[10px] uppercase font-bold">{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <div className="w-px h-4 bg-white/10 mx-1"></div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded transition-colors text-slate-400 hover:text-white"
          >
            &times;
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-auto p-4 bg-slate-950/50 custom-scrollbar">
        <pre className="text-[10px] leading-relaxed font-mono text-slate-300">
          <code dangerouslySetInnerHTML={{ __html: highlightJson(jsonString) }} />
        </pre>
      </div>
    </div>
  );
}

// Simple JSON syntax highlighter
function highlightJson(json: string) {
  json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
    let cls = 'text-blue-300'; // number
    if (/^"/.test(match)) {
      if (/:$/.test(match)) {
        cls = 'text-slate-400 font-semibold'; // key
      } else {
        cls = 'text-emerald-300'; // string
      }
    } else if (/true|false/.test(match)) {
      cls = 'text-amber-400 font-bold'; // boolean
    } else if (/null/.test(match)) {
      cls = 'text-rose-400'; // null
    }
    return '<span class="' + cls + '">' + match + '</span>';
  });
}

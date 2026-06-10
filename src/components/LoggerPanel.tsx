
import React from 'react';
import { useStore } from '../store/useStore';
import { Terminal, Trash2, Clock } from 'lucide-react';

export default function LoggerPanel() {
  const logs = useStore(state => state.logs);
  const clearLogs = useStore(state => state.clearLogs);

  return (
    <div className="flex flex-col h-full bg-slate-900 border-l border-slate-700 w-80 text-xs font-mono">
      <div className="flex items-center justify-between p-3 border-b border-slate-700 bg-slate-800">
        <div className="flex items-center gap-2 text-slate-300">
          <Terminal size={14} />
          <span className="font-bold uppercase tracking-wider">System Logs</span>
        </div>
        <button 
          onClick={clearLogs}
          className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200 transition-colors"
          title="Clear Logs"
        >
          <Trash2 size={14} />
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {logs.length === 0 ? (
            <div className="text-slate-600 text-center py-10 italic">No events recorded</div>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className={`p-2 rounded border-l-2 ${
                  log.type === 'error' ? 'bg-red-500/10 border-red-500 text-red-400' :
                  log.type === 'warn' ? 'bg-amber-500/10 border-amber-500 text-amber-400' :
                  'bg-slate-800/50 border-sky-500 text-slate-300'
                }`}
              >
                <div className="flex justify-between items-start mb-1 opacity-70">
                  <div className="flex items-center gap-1">
                    <Clock size={10} />
                    {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </div>
                  <span className="uppercase text-[10px] font-bold">{log.type}</span>
                </div>
                <div className="break-words leading-relaxed">{log.msg}</div>
              </div>
            ))
          )}
      </div>
    </div>
  );
}

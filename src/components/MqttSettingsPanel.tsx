import React from 'react';
import { useStore } from '../store/useStore';
import { Wifi, Save, WifiOff, Terminal, Send, Trash2, Filter, ArrowDownCircle, ArrowUpCircle, X } from 'lucide-react';
import { mqttManager } from '../lib/mqttClient';

interface MqttSettingsPanelProps {
  onClose: () => void;
}

export default function MqttSettingsPanel({ onClose }: MqttSettingsPanelProps) {
  const settings = useStore(state => state.mqttSettings);
  const setMqttSettings = useStore(state => state.setMqttSettings);

  const [localSettings, setLocalSettings] = React.useState(settings);
  const [activeTab, setActiveTab] = React.useState<'settings' | 'topics' | 'debug'>('settings');
  
  const mqttMessages = useStore(state => state.mqttMessages);
  const clearMqttMessages = useStore(state => state.clearMqttMessages);
  
  const [pubTopic, setPubTopic] = React.useState('');
  const [pubPayload, setPubPayload] = React.useState('');
  const [filterText, setFilterText] = React.useState('');
  const [filterDir, setFilterDir] = React.useState<'all' | 'in' | 'out'>('all');
  const logEndRef = React.useRef<HTMLDivElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    setLocalSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleSave = () => {
    setMqttSettings(localSettings);
  };

  const handlePublish = () => {
    if (pubTopic && pubPayload) {
      mqttManager.publishManual(pubTopic, pubPayload);
    }
  };

  const filteredMessages = React.useMemo(() => {
    return mqttMessages.filter(msg => {
      if (filterDir !== 'all' && msg.type !== filterDir) return false;
      if (filterText && !msg.topic.toLowerCase().includes(filterText.toLowerCase()) && !msg.payload.toLowerCase().includes(filterText.toLowerCase())) return false;
      return true;
    });
  }, [mqttMessages, filterDir, filterText]);

  return (
    <div className="flex flex-col h-full bg-slate-900 border-l border-white/10 w-80 shadow-2xl z-40 relative">
      <div className="h-14 border-b border-white/10 flex items-center justify-between px-4 bg-slate-950/50">
        <div className="flex items-center gap-2">
          {settings.enabled ? (
            <Wifi size={16} className="text-emerald-400" />
          ) : (
            <WifiOff size={16} className="text-slate-500" />
          )}
          <h2 className="text-xs font-bold text-slate-200 uppercase tracking-widest">MQTT Settings</h2>
        </div>
        <button 
          onClick={onClose}
          className="p-1.5 hover:bg-white/10 rounded transition-colors text-slate-400 hover:text-white"
        >
          &times;
        </button>
      </div>
      
      <div className="flex border-b border-white/5">
        <button 
          className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest ${activeTab === 'settings' ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-500/5' : 'text-slate-500 hover:text-slate-300 bg-slate-900/50'}`}
          onClick={() => setActiveTab('settings')}
        >
          Settings
        </button>
        <button 
          className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest ${activeTab === 'topics' ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-500/5' : 'text-slate-500 hover:text-slate-300 bg-slate-900/50'}`}
          onClick={() => setActiveTab('topics')}
        >
          Topics
        </button>
        <button 
          className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest ${activeTab === 'debug' ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-500/5' : 'text-slate-500 hover:text-slate-300 bg-slate-900/50'}`}
          onClick={() => setActiveTab('debug')}
        >
          Debug
          {mqttMessages.length > 0 && <span className="ml-1 bg-blue-500/30 text-blue-300 text-[8px] px-1 rounded">{mqttMessages.length}</span>}
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4 custom-scrollbar space-y-4">
        {activeTab === 'settings' && (
          <>
            <div className="flex items-center justify-between bg-white/5 p-3 rounded border border-white/10">
              <span className="text-xs font-bold text-slate-300 uppercase">Enable MQTT</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  name="enabled"
                  className="sr-only peer" 
                  checked={localSettings.enabled}
                  onChange={handleChange}
                />
                <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Broker URL</label>
              <input
                type="text"
                name="brokerUrl"
                value={localSettings.brokerUrl}
                onChange={handleChange}
                placeholder="ws://localhost:9001"
                className="w-full bg-slate-950 border border-white/10 rounded px-3 py-2 text-xs font-mono text-blue-300 outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Topic Prefix</label>
              <input
                type="text"
                name="topicPrefix"
                value={localSettings.topicPrefix}
                onChange={handleChange}
                placeholder="sim/"
                className="w-full bg-slate-950 border border-white/10 rounded px-3 py-2 text-xs font-mono text-emerald-300 outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <button
              onClick={handleSave}
              className="w-full mt-4 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white rounded py-2 text-xs font-bold uppercase transition-colors"
            >
              <Save size={14} />
              Apply Settings
            </button>
          </>
        )}

        {activeTab === 'topics' && (
          <div className="flex flex-col h-full space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Topic Definitions</h3>
              <button
                onClick={() => {
                  const newId = `topic-${Math.random().toString(36).substr(2, 4)}`;
                  setLocalSettings(prev => ({ ...prev, topics: [...(prev.topics || []), {
                    id: newId,
                    topic: 'new_topic',
                    interval: 100,
                    direction: 'out',
                    format: 'binary_struct',
                    endianness: 'LE',
                    components: []
                  }]}));
                }}
                className="text-[10px] font-bold bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded"
              >
                + Add Topic
              </button>
            </div>
            
            <div className="space-y-4 overflow-y-auto custom-scrollbar flex-1 pr-1">
              {(localSettings.topics || []).map((topic, index) => (
                <div key={topic.id} className="bg-slate-950/50 border border-white/10 rounded p-3 space-y-3">
                  <div className="flex justify-between items-center">
                    <input 
                      type="text" 
                      value={topic.topic}
                      onChange={(e) => {
                        const newTopics = [...localSettings.topics];
                        newTopics[index].topic = e.target.value;
                        setLocalSettings(prev => ({ ...prev, topics: newTopics }));
                      }}
                      className="bg-slate-900 border border-white/10 rounded px-2 py-1 text-xs font-mono text-emerald-300 w-32"
                    />
                    <button 
                      onClick={() => {
                        const newTopics = localSettings.topics.filter((_, i) => i !== index);
                        setLocalSettings(prev => ({ ...prev, topics: newTopics }));
                      }}
                      className="text-slate-500 hover:text-red-400"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-500 uppercase">Format</label>
                      <select 
                        value={topic.format || 'binary_struct'}
                        onChange={(e) => {
                          const newTopics = [...localSettings.topics];
                          newTopics[index].format = e.target.value as any;
                          setLocalSettings(prev => ({ ...prev, topics: newTopics }));
                        }}
                        className="w-full bg-slate-900 border border-white/10 rounded px-2 py-1 text-xs text-slate-300"
                      >
                        <option value="binary_struct">Binary Struct</option>
                        <option value="json">JSON Array</option>
                        <option value="raw">Raw Array</option>
                      </select>
                    </div>
                    
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-500 uppercase">Direction</label>
                      <select 
                        value={topic.direction}
                        onChange={(e) => {
                          const newTopics = [...localSettings.topics];
                          newTopics[index].direction = e.target.value as 'in' | 'out';
                          setLocalSettings(prev => ({ ...prev, topics: newTopics }));
                        }}
                        className="w-full bg-slate-900 border border-white/10 rounded px-2 py-1 text-xs text-slate-300"
                      >
                        <option value="out">Publish (Out)</option>
                        <option value="in">Subscribe (In)</option>
                      </select>
                    </div>

                    {topic.direction === 'out' && (
                      <div className="space-y-1">
                        <label className="text-[9px] text-slate-500 uppercase">Interval (ms)</label>
                        <input 
                          type="number" 
                          value={topic.interval}
                          onChange={(e) => {
                            const newTopics = [...localSettings.topics];
                            newTopics[index].interval = parseInt(e.target.value) || 100;
                            setLocalSettings(prev => ({ ...prev, topics: newTopics }));
                          }}
                          className="w-full bg-slate-900 border border-white/10 rounded px-2 py-1 text-xs text-slate-300 font-mono"
                        />
                      </div>
                    )}
                    
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-500 uppercase">Endianness</label>
                      <select 
                        value={topic.endianness || 'LE'}
                        onChange={(e) => {
                          const newTopics = [...localSettings.topics];
                          newTopics[index].endianness = e.target.value as 'LE' | 'BE';
                          setLocalSettings(prev => ({ ...prev, topics: newTopics }));
                        }}
                        className="w-full bg-slate-900 border border-white/10 rounded px-2 py-1 text-xs text-slate-300"
                      >
                        <option value="LE">Little-Endian</option>
                        <option value="BE">Big-Endian</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-white/10">
                    <div className="flex justify-between items-center">
                      <label className="text-[9px] text-slate-500 uppercase font-bold">Components Map</label>
                      <button
                        onClick={() => {
                          const newTopics = [...localSettings.topics];
                          newTopics[index].components = newTopics[index].components || [];
                          newTopics[index].components.push({ id: '', type: 'belt' });
                          setLocalSettings(prev => ({ ...prev, topics: newTopics }));
                        }}
                        className="text-[10px] text-blue-400 hover:text-blue-300"
                      >
                        + Add Component
                      </button>
                    </div>
                    {(topic.components || []).map((comp, compIndex) => (
                      <div key={compIndex} className="flex gap-2 items-center bg-white/5 p-1.5 rounded border border-white/5">
                        <span className="text-[9px] font-mono text-slate-500 w-4">[{compIndex}]</span>
                        <select
                          value={comp.type}
                          onChange={(e) => {
                            const newTopics = [...localSettings.topics];
                            newTopics[index].components[compIndex].type = e.target.value as any;
                            setLocalSettings(prev => ({ ...prev, topics: newTopics }));
                          }}
                          className="bg-slate-900 border border-white/10 rounded px-1 py-1 text-[10px] text-slate-300 w-16"
                        >
                          <option value="belt">Belt</option>
                          <option value="sensor">Sensor</option>
                          <option value="item">Parcel</option>
                        </select>
                        <input 
                          type="text"
                          value={comp.id}
                          placeholder="ID (e.g. L-BELT-A)"
                          onChange={(e) => {
                            const newTopics = [...localSettings.topics];
                            newTopics[index].components[compIndex].id = e.target.value;
                            setLocalSettings(prev => ({ ...prev, topics: newTopics }));
                          }}
                          className="flex-1 bg-slate-900 border border-white/10 rounded px-2 py-1 text-xs font-mono text-indigo-300 min-w-0"
                        />
                        <button 
                          onClick={() => {
                            const newTopics = [...localSettings.topics];
                            newTopics[index].components = newTopics[index].components.filter((_, i) => i !== compIndex);
                            setLocalSettings(prev => ({ ...prev, topics: newTopics }));
                          }}
                          className="text-slate-600 hover:text-red-400 shrink-0"
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                    {(!topic.components || topic.components.length === 0) && (
                      <p className="text-[9px] text-slate-500 italic">No components mapped yet.</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={handleSave}
              className="w-full mt-4 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white rounded py-2 text-xs font-bold uppercase transition-colors shrink-0"
            >
              <Save size={14} />
              Apply Settings
            </button>
          </div>
        )}

        {activeTab === 'debug' && (
          <div className="flex flex-col h-full space-y-3">
            {/* Manual Publish */}
            <div className="bg-slate-950/50 border border-white/10 rounded p-3 space-y-2 shrink-0">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Send size={12} className="text-blue-400" />
                Manual Publish
              </h3>
              <input
                type="text"
                placeholder="Topic (e.g., sim/Belt1_Speed)"
                value={pubTopic}
                onChange={(e) => setPubTopic(e.target.value)}
                className="w-full bg-slate-900 border border-white/10 rounded px-2 py-1.5 text-[10px] font-mono text-blue-300 outline-none focus:border-blue-500 transition-colors"
              />
              <input
                type="text"
                placeholder="Payload (e.g., 2.5)"
                value={pubPayload}
                onChange={(e) => setPubPayload(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handlePublish(); }}
                className="w-full bg-slate-900 border border-white/10 rounded px-2 py-1.5 text-[10px] font-mono text-emerald-300 outline-none focus:border-blue-500 transition-colors"
              />
              <button
                onClick={handlePublish}
                disabled={!settings.enabled || !pubTopic}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded py-1.5 text-[10px] font-bold uppercase transition-colors flex justify-center items-center gap-1.5"
              >
                Publish Message
              </button>
            </div>

            {/* Logger */}
            <div className="flex-1 min-h-0 flex flex-col border border-white/10 rounded bg-slate-950/50 overflow-hidden">
              {/* Logger header */}
              <div className="shrink-0 p-2 border-b border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Terminal size={12} className="text-emerald-400" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Message Log</span>
                    <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono">
                      {filteredMessages.length}/{mqttMessages.length}
                    </span>
                  </div>
                  <button 
                    onClick={clearMqttMessages}
                    className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-red-400 transition-colors"
                    title="Clear all messages"
                  >
                    <Trash2 size={11} />
                    Clear
                  </button>
                </div>
                {/* Filter bar */}
                <div className="flex gap-1.5 items-center">
                  <div className="relative flex-1">
                    <Filter size={9} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Filter topic / payload..."
                      value={filterText}
                      onChange={(e) => setFilterText(e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 rounded pl-6 pr-6 py-1 text-[10px] font-mono text-slate-300 outline-none focus:border-blue-500 transition-colors"
                    />
                    {filterText && (
                      <button onClick={() => setFilterText('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                        <X size={9} />
                      </button>
                    )}
                  </div>
                  <div className="flex rounded overflow-hidden border border-white/10">
                    <button
                      onClick={() => setFilterDir('all')}
                      className={`px-1.5 py-1 text-[9px] font-bold ${filterDir === 'all' ? 'bg-slate-600 text-white' : 'bg-slate-900 text-slate-500 hover:text-slate-300'}`}
                    >ALL</button>
                    <button
                      onClick={() => setFilterDir('out')}
                      className={`px-1.5 py-1 text-[9px] font-bold flex items-center gap-0.5 border-l border-white/10 ${filterDir === 'out' ? 'bg-blue-600/60 text-blue-200' : 'bg-slate-900 text-slate-500 hover:text-slate-300'}`}
                    >
                      <ArrowUpCircle size={9} />SND
                    </button>
                    <button
                      onClick={() => setFilterDir('in')}
                      className={`px-1.5 py-1 text-[9px] font-bold flex items-center gap-0.5 border-l border-white/10 ${filterDir === 'in' ? 'bg-emerald-600/60 text-emerald-200' : 'bg-slate-900 text-slate-500 hover:text-slate-300'}`}
                    >
                      <ArrowDownCircle size={9} />RCV
                    </button>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {filteredMessages.length === 0 ? (
                  <div className="text-center text-slate-600 text-[10px] italic mt-4">
                    {mqttMessages.length > 0 ? 'No messages match filter.' : 'No messages yet...'}
                  </div>
                ) : (
                  filteredMessages.map(msg => (
                    <div key={msg.id} className={`border rounded p-1.5 font-mono text-[9px] flex flex-col gap-0.5 ${
                      msg.type === 'in' 
                        ? 'bg-emerald-950/30 border-emerald-500/20' 
                        : 'bg-blue-950/30 border-blue-500/20'
                    }`}>
                      <div className="flex items-center gap-1.5">
                        <span className={`px-1 py-0.5 rounded text-[8px] font-bold uppercase leading-none ${
                          msg.type === 'in' ? 'bg-emerald-500/30 text-emerald-300' : 'bg-blue-500/30 text-blue-300'
                        }`}>
                          {msg.type === 'in' ? '▼ RCV' : '▲ SND'}
                        </span>
                        <span className="text-slate-300 font-bold truncate flex-1 text-[9px]">{msg.topic}</span>
                        <span className="text-slate-500 text-[8px] whitespace-nowrap tabular-nums">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                      <div className="pl-1 text-amber-300 break-all text-[9px] leading-relaxed">{msg.payload}</div>
                    </div>
                  ))
                )}
                <div ref={logEndRef} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
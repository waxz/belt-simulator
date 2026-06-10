/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Plus, 
  Trash2, 
  Settings2, 
  Box, 
  Activity, 
  ChevronRight,
  Maximize2,
  MousePointer2,
  Terminal,
  Layers,
  Database,
  Wifi,
  Save,
  Upload,
  Download,
  AlertTriangle,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import SimulationCanvas from './components/SimulationCanvas';
import Toolbar from './components/Toolbar';
import PropertyPanel from './components/PropertyPanel';
import LoggerPanel from './components/LoggerPanel';
import FpsIndicator from './components/FpsIndicator';
import ExplorerPanel from './components/ExplorerPanel';
import DataViewPanel from './components/DataViewPanel';
import MqttSettingsPanel from './components/MqttSettingsPanel';
import { mqttManager } from './lib/mqttClient';
import { useStore } from './store/useStore';
import type { SimulatorConfig } from './store/useStore';
import {
  saveToLocalStorage,
  loadFromLocalStorage,
  downloadConfigFile,
  readConfigFile,
  initDirtyTracking,
  formatSavedAge,
} from './lib/configManager';

export default function App() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<'select' | 'pan'>('select');
  const [showLogger, setShowLogger] = useState(false);
  const [showExplorer, setShowExplorer] = useState(false);
  const [showDataView, setShowDataView] = useState(false);
  const [showMqttSettings, setShowMqttSettings] = useState(false);
  const [restoreConfig, setRestoreConfig] = useState<SimulatorConfig | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const isPlaying = useStore(state => state.isPlaying);
  const setPlaying = useStore(state => state.setPlaying);
  const resetSimulation = useStore(state => state.resetSimulation);
  const storeActiveTool = useStore(state => state.activeTool);
  const setStoreActiveTool = useStore(state => state.setActiveTool);
  const isStepMode = useStore(state => state.isStepMode);
  const triggerStep = useStore(state => state.triggerStep);
  const undo = useStore(state => state.undo);
  const redo = useStore(state => state.redo);
  const canUndo = useStore(state => state.canUndo);
  const canRedo = useStore(state => state.canRedo);
  const isDirty = useStore(state => state.isDirty);
  const importConfig = useStore(state => state.importConfig);

  useEffect(() => {
    mqttManager.init();
    const unsubDirty = initDirtyTracking();

    // Check localStorage for a previous session
    const saved = loadFromLocalStorage();
    if (saved) setRestoreConfig(saved);

    return () => {
      mqttManager.destroy();
      unsubDirty();
    };
  }, []);

  // Warn browser before tab close if there are unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = 'You have unsaved changes. Save before leaving?';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const config = await readConfigFile(file);
      importConfig(config);
      useStore.getState().addLog(`Config imported from "${file.name}".`, 'info');
    } catch (err: any) {
      useStore.getState().addLog(err.message || 'Import failed.', 'error');
    }
    // Reset so the same file can be re-imported
    if (importFileRef.current) importFileRef.current.value = '';
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    
    const isCtrlOrCmd = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();

    if (key === ' ' && !isCtrlOrCmd) {
      e.preventDefault();
      setPlaying(!isPlaying);
      return;
    }

    if (key === 's' && isCtrlOrCmd) {
      e.preventDefault();
      saveToLocalStorage();
      return;
    }

    if (key === 's' && !isCtrlOrCmd) {
      setActiveTool(activeTool === 'pan' ? 'select' : 'pan');
      return;
    }

    if (key === 'v' && !isCtrlOrCmd) {
      setStoreActiveTool(null);
      setActiveTool('select');
      return;
    }

    if (key === 'l' && !isCtrlOrCmd) {
      setShowLogger(prev => !prev);
      return;
    }

    if (key === 'escape') {
      setSelectedId(null);
      setStoreActiveTool(null);
      return;
    }

    if (key === '1' && !isCtrlOrCmd) {
      setStoreActiveTool('belt_rectangle');
      return;
    }

    if (key === '2' && !isCtrlOrCmd) {
      setStoreActiveTool('belt_right_triangle');
      return;
    }

    if (key === '3' && !isCtrlOrCmd) {
      setStoreActiveTool('belt_quadrilateral');
      return;
    }

    if (key === '4' && !isCtrlOrCmd) {
      setStoreActiveTool('belt_arc');
      return;
    }

    if (key === 'i' && !isCtrlOrCmd) {
      setStoreActiveTool('source');
      return;
    }

    if (key === 'o' && !isCtrlOrCmd) {
      setStoreActiveTool('sink');
      return;
    }

    if (key === 'p' && !isCtrlOrCmd) {
      setStoreActiveTool('item');
      return;
    }

    if (key === 'r' && !isCtrlOrCmd) {
      setStoreActiveTool('sensor');
      return;
    }

    if (isStepMode && key === 'arrowright') {
      triggerStep();
      return;
    }

    if (key === 'delete' || key === 'backspace') {
      if (selectedId) {
        const { removeBelt, removeSensor, removeItem, removeSource, removeSink } = useStore.getState();
        removeBelt(selectedId);
        removeSensor(selectedId);
        removeItem(selectedId);
        removeSource(selectedId);
        removeSink(selectedId);
        setSelectedId(null);
      }
      return;
    }

    if (key === '1' && isCtrlOrCmd) {
      useStore.getState().setSimulatorBackend('matter');
      return;
    }
    if (key === '2' && isCtrlOrCmd) {
      useStore.getState().setSimulatorBackend('rapier');
      return;
    }

    if (key === 'z' && isCtrlOrCmd && !e.shiftKey) {
      e.preventDefault();
      undo();
      return;
    }
    if ((key === 'z' && isCtrlOrCmd && e.shiftKey) || (key === 'y' && isCtrlOrCmd)) {
      e.preventDefault();
      redo();
      return;
    }
  }, [isPlaying, setPlaying, activeTool, setActiveTool, setStoreActiveTool, showLogger, isStepMode, triggerStep, selectedId, undo, redo]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-200 font-sans flex-col overflow-hidden select-none">
      {/* Header Navigation */}
      <header className="h-14 border-b border-white/10 bg-slate-900 flex items-center justify-between px-6 z-50">
        <div className="flex items-center gap-4">
          <div className="bg-blue-600 w-8 h-8 rounded flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-lg font-semibold tracking-tight uppercase text-blue-100">
            KineticFlow <span className="text-slate-500 font-normal text-xs lowercase">v2.4</span>
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white/5 p-1 rounded-lg border border-white/10">
            <button
              onClick={() => setPlaying(!isPlaying)}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-md transition-all text-xs font-bold uppercase tracking-wider ${
                isPlaying 
                ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30' 
                : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              }`}
            >
              {isPlaying ? <Pause size={14} strokeWidth={3} /> : <Play size={14} strokeWidth={3} />}
              <span>{isPlaying ? 'Pause Sim' : 'Run Simulation'}</span>
            </button>
            <button
              onClick={resetSimulation}
              className="p-1.5 hover:bg-white/10 rounded-md transition-colors text-slate-400 hover:text-white"
              title="Reset System"
            >
              <RotateCcw size={14} />
            </button>
          </div>
          
          {/* Save / Export / Import */}
          <div className="flex items-center gap-1 bg-white/5 rounded-md border border-white/10 p-1">
            <button
              onClick={saveToLocalStorage}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-bold uppercase transition-all ${
                isDirty
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30'
                  : 'text-slate-500 hover:bg-white/10 hover:text-slate-300'
              }`}
              title="Save to browser storage (Ctrl+S)"
            >
              <Save size={13} />
              <span className="hidden xl:inline">Save</span>
              {isDirty && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />}
            </button>
            <button
              onClick={downloadConfigFile}
              className="p-1.5 text-slate-400 hover:bg-white/10 hover:text-slate-200 rounded transition-colors"
              title="Export config to .json file"
            >
              <Download size={14} />
            </button>
            <button
              onClick={() => importFileRef.current?.click()}
              className="p-1.5 text-slate-400 hover:bg-white/10 hover:text-slate-200 rounded transition-colors"
              title="Import config from .json file"
            >
              <Upload size={14} />
            </button>
          </div>

          <button
            onClick={() => setShowExplorer(!showExplorer)}
            className={`p-2 rounded-md transition-all ${
              showExplorer ? 'bg-blue-600 text-white shadow-lg' : 'bg-white/5 text-slate-400 hover:bg-white/10'
            }`}
            title="Toggle Explorer"
          >
            <Layers size={18} />
          </button>
          
          <button
            onClick={() => setShowDataView(!showDataView)}
            className={`p-2 rounded-md transition-all ${
              showDataView ? 'bg-blue-600 text-white shadow-lg' : 'bg-white/5 text-slate-400 hover:bg-white/10'
            }`}
            title="Toggle Data View"
          >
            <Database size={18} />
          </button>

          <button
            onClick={() => setShowMqttSettings(!showMqttSettings)}
            className={`p-2 rounded-md transition-all ${
              showMqttSettings ? 'bg-blue-600 text-white shadow-lg' : 'bg-white/5 text-slate-400 hover:bg-white/10'
            }`}
            title="Toggle MQTT Settings"
          >
            <Wifi size={18} />
          </button>

          <button
            onClick={() => setShowLogger(!showLogger)}
            className={`p-2 rounded-md transition-all ${
              showLogger ? 'bg-blue-600 text-white shadow-lg' : 'bg-white/5 text-slate-400 hover:bg-white/10'
            }`}
            title="Toggle System Logs"
          >
            <Terminal size={18} />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Sidebar */}
        <aside className="w-64 border-r border-white/10 bg-slate-900 z-20 flex flex-col shrink-0">
          <Toolbar onSelectElement={setSelectedId} />
        </aside>

        {/* Explorer Panel */}
        <AnimatePresence>
          {showExplorer && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 256, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="z-20 overflow-hidden shrink-0 border-r border-white/10"
            >
              <ExplorerPanel selectedId={selectedId} onSelectId={setSelectedId} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Canvas Area */}
        <main className="flex-1 bg-slate-950 relative overflow-hidden">
          <FpsIndicator />
          <SimulationCanvas 
            selectedId={selectedId} 
            onSelectId={setSelectedId}
            draggable={activeTool === 'select'}
          />
          
          {/* Bottom Tool Palette */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-slate-900 border border-white/10 rounded-full px-6 py-3 flex gap-6 shadow-2xl items-center z-10 pointer-events-auto">
            <button 
              onClick={() => setActiveTool('select')}
              className={`flex items-center gap-2 cursor-pointer transition-all ${activeTool === 'select' ? 'text-blue-400 scale-110' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <MousePointer2 size={14} strokeWidth={3} />
              <span className="text-[10px] font-bold uppercase">Select</span>
            </button>
            <div className="h-4 w-px bg-white/10"></div>
            <button 
              onClick={() => setActiveTool('pan')}
              className={`flex items-center gap-2 cursor-pointer transition-all ${activeTool === 'pan' ? 'text-blue-400 scale-110' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <Maximize2 size={14} />
              <span className="text-[10px] font-bold uppercase">Pan</span>
            </button>
          </div>
        </main>

        {/* Right Panels Overlay */}
        <div className="flex h-full z-20 pointer-events-none">
          {/* Logger Panel */}
          <AnimatePresence>
            {showLogger && (
              <motion.aside
                initial={{ x: 320 }}
                animate={{ x: 0 }}
                exit={{ x: 320 }}
                className="pointer-events-auto shadow-2xl shrink-0"
              >
                <LoggerPanel />
              </motion.aside>
            )}
          </AnimatePresence>

          {/* Data View Panel */}
          <AnimatePresence>
            {showDataView && (
              <motion.aside
                initial={{ x: 384 }}
                animate={{ x: 0 }}
                exit={{ x: 384 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="pointer-events-auto shadow-2xl shrink-0"
              >
                <DataViewPanel onClose={() => setShowDataView(false)} />
              </motion.aside>
            )}
          </AnimatePresence>

          {/* MQTT Settings Panel */}
          <AnimatePresence>
            {showMqttSettings && (
              <motion.aside
                initial={{ x: 320 }}
                animate={{ x: 0 }}
                exit={{ x: 320 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="pointer-events-auto shadow-2xl shrink-0"
              >
                <MqttSettingsPanel onClose={() => setShowMqttSettings(false)} />
              </motion.aside>
            )}
          </AnimatePresence>

          {/* Property Panel */}
          <AnimatePresence mode="wait">
            {selectedId && (
              <motion.aside
                initial={{ x: 320 }}
                animate={{ x: 0 }}
                exit={{ x: 320 }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="w-72 border-l border-white/10 bg-slate-900 pointer-events-auto"
              >
                <PropertyPanel 
                  id={selectedId} 
                  onClose={() => setSelectedId(null)}
                  onRename={(newId) => setSelectedId(newId)}
                />
              </motion.aside>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Hidden file input for import */}
      <input
        ref={importFileRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleImportFile}
      />

      {/* Restore Session Prompt */}
      {restoreConfig && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-white/10 rounded-xl shadow-2xl p-6 w-96 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
                <Clock size={20} className="text-blue-400" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-100">Restore Previous Session?</h2>
                <p className="text-xs text-slate-400 mt-1">
                  A saved configuration was found from{' '}
                  <span className="text-slate-200 font-mono">{formatSavedAge(restoreConfig.savedAt)}</span>.
                  It contains <span className="text-blue-300">{restoreConfig.belts.length} belt(s)</span>,{' '}
                  <span className="text-emerald-300">{restoreConfig.sensors.length} sensor(s)</span>, and{' '}
                  <span className="text-amber-300">{restoreConfig.sources.length} source(s)</span>.
                </p>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => {
                  importConfig(restoreConfig);
                  useStore.getState().addLog('Previous session restored.', 'info');
                  setRestoreConfig(null);
                }}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2 text-xs font-bold uppercase transition-colors"
              >
                Restore Session
              </button>
              <button
                onClick={() => setRestoreConfig(null)}
                className="flex-1 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg py-2 text-xs font-bold uppercase transition-colors border border-white/10"
              >
                Start Fresh
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

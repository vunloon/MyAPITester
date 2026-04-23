import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Globe, Edit2 } from 'lucide-react';
import type { Environment, EnvironmentVariable } from './types';
import { KeyValueEditor } from './KeyValueEditor';
import type { KeyValueItem } from './KeyValueEditor';

interface EnvironmentManagerProps {
  isOpen: boolean;
  onClose: () => void;
  environments: Environment[];
  globals: EnvironmentVariable[];
  onSave: (environments: Environment[], globals: EnvironmentVariable[]) => void;
}

export function EnvironmentManager({ isOpen, onClose, environments: initialEnvs, globals: initialGlobals, onSave }: EnvironmentManagerProps) {
  const [envs, setEnvs] = useState<Environment[]>([]);
  const [globs, setGlobs] = useState<EnvironmentVariable[]>([]);
  const [selectedEnvId, setSelectedEnvId] = useState<string>('globals'); // 'globals' or an env id
  const [editingEnvId, setEditingEnvId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Deep copy to prevent mutating props directly before saving
      setEnvs(JSON.parse(JSON.stringify(initialEnvs)));
      setGlobs(JSON.parse(JSON.stringify(initialGlobals)));
      setSelectedEnvId('globals');
      setEditingEnvId(null);
    }
  }, [isOpen, initialEnvs, initialGlobals]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(envs, globs);
    onClose();
  };

  const createEnvironment = () => {
    const newEnv: Environment = {
      id: Date.now().toString(),
      name: `New Environment`,
      variables: []
    };
    setEnvs([...envs, newEnv]);
    setSelectedEnvId(newEnv.id);
    setEditingEnvId(newEnv.id);
  };

  const deleteEnvironment = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this environment?')) return;
    setEnvs(envs.filter(env => env.id !== id));
    if (selectedEnvId === id) {
      setSelectedEnvId('globals');
    }
  };

  const updateEnvName = (id: string, newName: string) => {
    setEnvs(envs.map(env => env.id === id ? { ...env, name: newName } : env));
  };

  const getActiveItems = (): KeyValueItem[] => {
    if (selectedEnvId === 'globals') {
      return globs.map(g => ({ key: g.key, value: g.value, active: g.enabled }));
    } else {
      const env = envs.find(e => e.id === selectedEnvId);
      if (!env) return [];
      return env.variables.map(v => ({ key: v.key, value: v.value, active: v.enabled }));
    }
  };

  const handleItemsChange = (newItems: KeyValueItem[]) => {
    const updatedVars: EnvironmentVariable[] = newItems.map(item => ({
      key: item.key,
      value: item.value,
      enabled: item.active
    }));

    if (selectedEnvId === 'globals') {
      setGlobs(updatedVars);
    } else {
      setEnvs(envs.map(env => env.id === selectedEnvId ? { ...env, variables: updatedVars } : env));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
      <div className="w-[800px] h-[600px] bg-[var(--panel-bg)] border border-[var(--panel-border)] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--panel-border)] bg-black/10">
          <div className="flex items-center space-x-2 text-text-primary font-bold">
            <Globe size={18} className="text-[var(--accent)]" />
            <span>Manage Environments</span>
          </div>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary transition-colors p-1 rounded-md hover:bg-white/10">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Left Sidebar - Environment List */}
          <div className="w-1/3 border-r border-[var(--panel-border)] bg-black/5 flex flex-col">
            <div className="p-3 border-b border-[var(--panel-border)] flex items-center justify-between">
              <span className="text-sm font-semibold text-text-secondary">Environments</span>
              <button 
                onClick={createEnvironment}
                className="text-text-tertiary hover:text-[var(--accent)] transition-colors p-1.5 rounded-md hover:bg-black/20"
                title="Create Environment"
              >
                <Plus size={16} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {/* Globals */}
              <div 
                onClick={() => setSelectedEnvId('globals')}
                className={`flex items-center justify-between p-2 rounded-lg cursor-pointer text-sm font-medium transition-colors border ${selectedEnvId === 'globals' ? 'bg-[var(--accent)]/10 border-[var(--accent)]/30 text-text-primary' : 'border-transparent text-text-tertiary hover:bg-white/5 hover:text-text-primary'}`}
              >
                <div className="flex items-center space-x-2">
                  <Globe size={14} />
                  <span>Globals</span>
                </div>
              </div>

              {/* Environments */}
              {envs.map(env => (
                <div 
                  key={env.id}
                  onClick={() => setSelectedEnvId(env.id)}
                  className={`group flex items-center justify-between p-2 rounded-lg cursor-pointer text-sm transition-colors border ${selectedEnvId === env.id ? 'bg-[var(--accent)]/10 border-[var(--accent)]/30 text-text-primary' : 'border-transparent text-text-tertiary hover:bg-white/5 hover:text-text-primary'}`}
                >
                  {editingEnvId === env.id ? (
                    <input 
                      autoFocus
                      type="text"
                      className="bg-black/20 text-text-primary px-2 py-0.5 rounded border border-[var(--accent)] outline-none w-full text-sm"
                      value={env.name}
                      onChange={(e) => updateEnvName(env.id, e.target.value)}
                      onBlur={() => setEditingEnvId(null)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') setEditingEnvId(null);
                        e.stopPropagation();
                      }}
                    />
                  ) : (
                    <>
                      <span className="truncate">{env.name}</span>
                      <div className="hidden group-hover:flex items-center space-x-1 flex-shrink-0">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setEditingEnvId(env.id); }}
                          className="text-text-tertiary hover:text-blue-400 p-1 rounded transition-colors"
                          title="Rename"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button 
                          onClick={(e) => deleteEnvironment(e, env.id)}
                          className="text-text-tertiary hover:text-red-400 p-1 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Right Pane - Variables Editor */}
          <div className="flex-1 flex flex-col bg-transparent">
            <div className="p-4 border-b border-[var(--panel-border)] bg-black/5 text-sm font-semibold text-text-secondary">
              {selectedEnvId === 'globals' ? 'Global Variables' : `Variables for ${envs.find(e => e.id === selectedEnvId)?.name || ''}`}
            </div>
            <div className="flex-1 min-h-0 relative">
              <KeyValueEditor
                items={getActiveItems()}
                onChange={handleItemsChange}
                namePlaceholder="Variable"
                valuePlaceholder="Initial Value"
              />
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--panel-border)] bg-black/10 flex justify-end space-x-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-white/5 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            className="px-6 py-2 text-sm font-bold bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg transition-colors shadow-lg hover:shadow-[var(--accent)]/50"
          >
            Save
          </button>
        </div>

      </div>
    </div>
  );
}

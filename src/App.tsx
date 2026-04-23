import { useState, useEffect, useRef } from 'react'
import { Plus, Folder, Settings, Send, Save, FileJson, Globe, Download, Upload, X, Code, Check, Trash } from 'lucide-react'
import Editor from '@monaco-editor/react'
import type { ApiCollection, ApiRequest, HttpMethod, Environment, EnvironmentVariable, OpenTab } from './types'
import { KeyValueEditor } from './KeyValueEditor'
import type { KeyValueItem } from './KeyValueEditor'
import { PromptDialog } from './PromptDialog'

function App() {
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([
    {
      id: 'default',
      name: 'New Request',
      method: 'GET',
      url: 'https://jsonplaceholder.typicode.com/todos/1',
      body: '{\n  \n}',
      preRequestScript: '// pm.environment.set("test", "123");',
      testScript: '// pm.test("Status code is 200", function () { pm.response.to.have.status(200); });',
      headers: [],
      params: [],
      response: null,
      testResults: [],
      activeEditorTab: 'Body',
      activeResponseTab: 'Body',
      isDirty: false,
      loading: false
    }
  ])
  const [activeTabId, setActiveTabId] = useState<string>('default')
  const [copiedCurl, setCopiedCurl] = useState(false);
  
  const currentTab = openTabs.find(t => t.id === activeTabId)

  const [collections, setCollections] = useState<ApiCollection[]>([])
  const [collapsedCollections, setCollapsedCollections] = useState<Set<string>>(new Set())
  
  const [environments, setEnvironments] = useState<Environment[]>([])
  const [activeEnvironmentId, setActiveEnvironmentId] = useState<string>('none')
  const [globals, setGlobals] = useState<EnvironmentVariable[]>([
    { key: 'baseUrl', value: 'https://jsonplaceholder.typicode.com', enabled: true }
  ])

  const [theme, setTheme] = useState<string>(() => localStorage.getItem('theme') || 'dark')

  const [promptConfig, setPromptConfig] = useState<{
    isOpen: boolean;
    title: string;
    defaultValue: string;
    resolve: ((value: string | null) => void) | null;
  }>({
    isOpen: false,
    title: '',
    defaultValue: '',
    resolve: null
  });

  const showPrompt = (title: string, defaultValue: string = ''): Promise<string | null> => {
    return new Promise((resolve) => {
      setPromptConfig({
        isOpen: true,
        title,
        defaultValue,
        resolve
      });
    });
  };

  const handlePromptSubmit = (value: string) => {
    if (promptConfig.resolve) promptConfig.resolve(value);
    setPromptConfig(prev => ({ ...prev, isOpen: false, resolve: null }));
  };

  const handlePromptCancel = () => {
    if (promptConfig.resolve) promptConfig.resolve(null);
    setPromptConfig(prev => ({ ...prev, isOpen: false, resolve: null }));
  };

  useEffect(() => {
    localStorage.setItem('theme', theme)
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        saveCurrentRequest();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }); // Using no dependency array to always have the latest saveCurrentRequest closure

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const colls = await window.api.readCollections()
      setCollections(colls || [])
      const envs = await window.api.readEnvironments()
      setEnvironments(envs || [])
      const globs = await window.api.readGlobals()
      if (globs && globs.length > 0) setGlobals(globs)
    } catch (e) {
      console.error('Failed to load data', e)
    }
  }

  const saveCollections = async (newCollections: ApiCollection[]) => {
    setCollections(newCollections)
    await window.api.writeCollections(newCollections)
  }

  const updateCurrentTab = (updates: Partial<OpenTab>) => {
    setOpenTabs(tabs => tabs.map(t => t.id === activeTabId ? { ...t, ...updates, isDirty: true } : t))
  }

  const updateTabWithoutDirty = (tabId: string, updates: Partial<OpenTab>) => {
    setOpenTabs(tabs => tabs.map(t => t.id === tabId ? { ...t, ...updates } : t))
  }

  const handleParamsChange = (newParams: KeyValueItem[]) => {
    if (!currentTab) return;
    const urlParts = currentTab.url.split('?');
    const baseUrl = urlParts[0];
    
    const activeParams = newParams.filter(p => p.active && p.key);
    
    let newUrl = baseUrl;
    if (activeParams.length > 0) {
      const qs = activeParams.map(p => `${p.key}=${p.value}`).join('&');
      newUrl = `${baseUrl}?${qs}`;
    } else if (currentTab.url.includes('?')) {
      newUrl = baseUrl;
    }
    
    updateCurrentTab({ params: newParams, url: newUrl });
  };

  const handleUrlChange = (newUrl: string) => {
    if (!currentTab) return;
    const urlParts = newUrl.split('?');
    if (urlParts.length > 1) {
      const qs = urlParts.slice(1).join('?');
      const pairs = qs.split('&');
      
      const inactiveParams = (currentTab.params || []).filter(p => !p.active);
      
      const parsedParams = pairs.map(pair => {
         const [k, ...v] = pair.split('=');
         return { key: k || '', value: v.join('=') || '', active: true };
      });
      
      const validParsed = parsedParams.filter(p => p.key || p.value);
      
      const finalParams = [...validParsed, ...inactiveParams];
      updateCurrentTab({ url: newUrl, params: finalParams });
    } else {
      const inactiveParams = (currentTab.params || []).filter(p => !p.active);
      updateCurrentTab({ url: newUrl, params: inactiveParams });
    }
  };

  const resolveVariables = (text: string): string => {
    let activeEnvVars: EnvironmentVariable[] = [];
    if (activeEnvironmentId !== 'none') {
      const activeEnv = environments.find(e => e.id === activeEnvironmentId);
      if (activeEnv) activeEnvVars = activeEnv.variables;
    }
    
    return text.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
      const envVar = activeEnvVars.find(v => v.key === key && v.enabled);
      if (envVar) return envVar.value;
      const globVar = globals.find(v => v.key === key && v.enabled);
      if (globVar) return globVar.value;
      return match; 
    });
  }

  const getActiveEnvMap = () => {
    const map: Record<string, string> = {};
    if (activeEnvironmentId !== 'none') {
      const activeEnv = environments.find(e => e.id === activeEnvironmentId);
      activeEnv?.variables.forEach(v => { if(v.enabled) map[v.key] = v.value });
    }
    return map;
  }

  const getGlobalsMap = () => {
    const map: Record<string, string> = {};
    globals.forEach(v => { if(v.enabled) map[v.key] = v.value });
    return map;
  }

  const syncVarsMapAfterScript = async (pmData: any) => {
    if (pmData.globals) {
      const newGlobals = [...globals];
      for (const key of Object.keys(pmData.globals)) {
        const existing = newGlobals.find(g => g.key === key);
        if (existing) {
          existing.value = pmData.globals[key];
        } else {
          newGlobals.push({ key, value: pmData.globals[key], enabled: true });
        }
      }
      setGlobals(newGlobals);
      await window.api.writeGlobals(newGlobals);
    }
    
    if (pmData.environment && activeEnvironmentId !== 'none') {
      const newEnvs = [...environments];
      const envIndex = newEnvs.findIndex(e => e.id === activeEnvironmentId);
      if (envIndex !== -1) {
        for (const key of Object.keys(pmData.environment)) {
          const existing = newEnvs[envIndex].variables.find(v => v.key === key);
          if (existing) {
            existing.value = pmData.environment[key];
          } else {
            newEnvs[envIndex].variables.push({ key, value: pmData.environment[key], enabled: true });
          }
        }
        setEnvironments(newEnvs);
        await window.api.writeEnvironments(newEnvs);
      }
    }
  }

  const sendRequest = async () => {
    if (!currentTab) return;
    const tabId = currentTab.id;
    
    updateTabWithoutDirty(tabId, { loading: true, testResults: [], activeResponseTab: 'Body', response: null })

    try {
      let currentPmData: any = {
        environment: getActiveEnvMap(),
        globals: getGlobalsMap(),
        request: { url: currentTab.url, method: currentTab.method, body: currentTab.body },
        info: { requestName: currentTab.name }
      };

      if (currentTab.preRequestScript.trim()) {
        const result = await window.api.executeScript({
          script: currentTab.preRequestScript,
          pmData: currentPmData
        });
        if (result.success && result.pmData) {
          currentPmData = result.pmData;
          await syncVarsMapAfterScript(result.pmData);
        } else {
          console.error("Pre-request script error:", result.error);
        }
      }

      let finalBody = currentTab.body;
      const resolvedUrl = resolveVariables(currentTab.url);
      const resolvedBody = resolveVariables(finalBody);
      
      let parsedBody = undefined;
      if (['POST', 'PUT', 'PATCH'].includes(currentTab.method)) {
        try {
          parsedBody = JSON.parse(resolvedBody);
        } catch(e) {
          parsedBody = resolvedBody; 
        }
      }

      const res = await window.api.sendRequest({
        url: resolvedUrl,
        method: currentTab.method,
        data: parsedBody
      })
      
      let newTestResults: any[] = [];
      let newActiveResponseTab: 'Body' | 'Tests' = 'Body';

      if (currentTab.testScript.trim() && res) {
        currentPmData.response = res; 
        const testResult = await window.api.executeScript({
          script: currentTab.testScript,
          pmData: currentPmData
        });
        
        if (testResult.success && testResult.pmData) {
          await syncVarsMapAfterScript(testResult.pmData);
          if (testResult.pmData.tests) {
            newTestResults = testResult.pmData.tests;
            if (testResult.pmData.tests.length > 0) {
              newActiveResponseTab = 'Tests';
            }
          }
        } else {
          console.error("Test script error:", testResult.error);
        }
      }

      updateTabWithoutDirty(tabId, { loading: false, response: res, testResults: newTestResults, activeResponseTab: newActiveResponseTab });

    } catch (e) {
      console.error(e)
      updateTabWithoutDirty(tabId, { loading: false });
    }
  }

  const copyCurl = () => {
    if (!currentTab) return;
    
    const resolvedUrl = resolveVariables(currentTab.url);
    const resolvedBody = resolveVariables(currentTab.body);
    
    let curl = `curl -X ${currentTab.method} '${resolvedUrl}'`;
    
    const activeHeaders = currentTab.headers.filter(h => h.active && h.key);
    activeHeaders.forEach(h => {
      const resolvedValue = resolveVariables(h.value);
      curl += ` \\\n  -H '${h.key}: ${resolvedValue}'`;
    });
    
    if (resolvedBody.trim() && ['POST', 'PUT', 'PATCH'].includes(currentTab.method) && !activeHeaders.find(h => h.key.toLowerCase() === 'content-type')) {
       curl += ` \\\n  -H 'Content-Type: application/json'`;
    }

    if (resolvedBody.trim() && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(currentTab.method)) {
      const safeBody = resolvedBody.replace(/'/g, "'\\''");
      curl += ` \\\n  -d '${safeBody}'`;
    }
    
    navigator.clipboard.writeText(curl).then(() => {
      setCopiedCurl(true);
      setTimeout(() => setCopiedCurl(false), 2000);
    }).catch(err => {
      console.error('Failed to copy', err);
    });
  };

  const createNewCollection = async () => {
    const name = await showPrompt('Collection Name:')
    if (!name) return
    const newCol: ApiCollection = {
      id: Date.now().toString(),
      name,
      folders: [],
      requests: []
    }
    saveCollections([...collections, newCol])
  }

  const deleteCollection = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this collection?')) return;
    const newCollections = collections.filter(c => c.id !== id);
    saveCollections(newCollections);
  }

  const addNewRequestToCollection = async (e: React.MouseEvent, collectionId: string) => {
    e.stopPropagation();
    const name = await showPrompt('New Request Name:');
    if (!name) return;
    
    const newReq: ApiRequest = {
      id: Date.now().toString(),
      name,
      method: 'GET',
      url: '',
      body: '{\n  \n}',
      preRequestScript: '',
      testScript: '',
      headers: [],
      params: []
    };
    
    const newCollections = collections.map(col => {
      if (col.id === collectionId) {
        return { ...col, requests: [...col.requests, newReq] };
      }
      return col;
    });
    
    saveCollections(newCollections);
    
    if (collapsedCollections.has(collectionId)) {
      toggleCollection(collectionId);
    }
    
    loadRequest(newReq);
  }

  const deleteRequest = (e: React.MouseEvent, collectionId: string, requestId: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this request?')) return;
    
    const newCollections = collections.map(col => {
      if (col.id === collectionId) {
        return { ...col, requests: col.requests.filter(r => r.id !== requestId) };
      }
      return col;
    });
    
    saveCollections(newCollections);
    
    setOpenTabs(prev => prev.filter(t => t.id !== requestId));
    if (activeTabId === requestId) {
      const remainingTabs = openTabs.filter(t => t.id !== requestId);
      if (remainingTabs.length > 0) {
        setActiveTabId(remainingTabs[remainingTabs.length - 1].id);
      }
    }
  }


  const exportCollections = () => {
    const data = JSON.stringify(collections, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `myapitester_export_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const postman = JSON.parse(evt.target?.result as string);
        const newCol: ApiCollection = {
          id: postman.info?._postman_id || Date.now().toString(),
          name: postman.info?.name || 'Imported Collection',
          folders: [],
          requests: []
        };

        const parseItems = (items: any[]) => {
          items.forEach((item: any) => {
            if(item.request) {
               newCol.requests.push({
                 id: item.id || Date.now().toString() + Math.random(),
                 name: item.name,
                 method: item.request.method,
                 url: item.request.url?.raw || item.request.url || '',
                 body: item.request.body?.raw || '',
                 headers: item.request.header?.map((h: any) => ({key: h.key, value: h.value, active: true})) || [],
                 params: [],
                 preRequestScript: item.event?.find((ev:any)=>ev.listen==='prerequest')?.script?.exec?.join('\n') || '',
                 testScript: item.event?.find((ev:any)=>ev.listen==='test')?.script?.exec?.join('\n') || ''
               });
            } else if (item.item) {
               parseItems(item.item); 
            }
          });
        };
        
        if (postman.item) parseItems(postman.item);
        
        saveCollections([...collections, newCol]);
      } catch (err) {
        alert('Failed to import: Invalid Postman v2.1 JSON');
      }
    };
    reader.readAsText(file);
    if(fileInputRef.current) fileInputRef.current.value = '';
  }

  const toggleCollection = (id: string) => {
    setCollapsedCollections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const saveTab = async (tabToSave: OpenTab): Promise<string | null> => {
    if (collections.length === 0) {
      alert('Please create a collection first')
      return null;
    }
    
    let name = tabToSave.name;
    const isTemp = tabToSave.id.startsWith('default') || tabToSave.id.startsWith('temp');
    if (isTemp) {
      const promptName = await showPrompt('Request Name:', name);
      if (!promptName) return null;
      name = promptName;
    }

    const reqId = isTemp ? Date.now().toString() : tabToSave.id;

    const req: ApiRequest = {
      id: reqId,
      name,
      method: tabToSave.method,
      url: tabToSave.url,
      body: tabToSave.body,
      preRequestScript: tabToSave.preRequestScript,
      testScript: tabToSave.testScript,
      headers: tabToSave.headers,
      params: tabToSave.params
    }

    const newCollections = [...collections]
    
    let found = false
    for (const col of newCollections) {
      const idx = col.requests.findIndex(r => r.id === req.id)
      if (idx !== -1) {
        col.requests[idx] = req
        found = true
        break
      }
    }

    if (!found && newCollections.length > 0) {
      newCollections[0].requests.push(req)
    }

    saveCollections(newCollections)
    updateTabWithoutDirty(tabToSave.id, { id: req.id, name: req.name, isDirty: false });
    
    return reqId;
  }

  const saveCurrentRequest = async () => {
    if (currentTab) {
      const newId = await saveTab(currentTab);
      if (newId && currentTab.id !== newId) {
        setActiveTabId(newId);
      }
    }
  }

  const handleSwitchTab = async (newTabId: string) => {
    if (newTabId === activeTabId) return;
    if (currentTab && currentTab.isDirty) {
      await saveTab(currentTab);
    }
    setActiveTabId(newTabId);
  }

  const loadRequest = async (req: ApiRequest) => {
    if (currentTab && currentTab.isDirty && currentTab.id !== req.id) {
      await saveTab(currentTab);
    }

    const existing = openTabs.find(t => t.id === req.id);
    if (existing) {
      setActiveTabId(req.id);
    } else {
      const newTab: OpenTab = {
        id: req.id,
        name: req.name,
        method: req.method,
        url: req.url,
        body: req.body || '',
        preRequestScript: req.preRequestScript || '',
        testScript: req.testScript || '',
        headers: req.headers || [],
        params: req.params || [],
        response: null,
        testResults: [],
        activeEditorTab: 'Body',
        activeResponseTab: 'Body',
        isDirty: false,
        loading: false
      };
      setOpenTabs(prev => [...prev, newTab]);
      setActiveTabId(req.id);
    }
  }

  const closeTab = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    
    const tabToClose = openTabs.find(t => t.id === id);
    if (tabToClose && tabToClose.isDirty) {
      await saveTab(tabToClose);
    }

    setOpenTabs(prev => {
      const newTabs = prev.filter(t => t.id !== id);
      if (newTabs.length === 0) {
        const defaultTab: OpenTab = {
           id: 'temp-' + Date.now(),
           name: 'New Request',
           method: 'GET',
           url: '',
           body: '{\n  \n}',
           preRequestScript: '',
           testScript: '',
           headers: [],
           params: [],
           response: null,
           testResults: [],
           activeEditorTab: 'Body',
           activeResponseTab: 'Body',
           isDirty: false,
           loading: false
        };
        setActiveTabId(defaultTab.id);
        return [defaultTab];
      } else if (activeTabId === id) {
        setActiveTabId(newTabs[newTabs.length - 1].id);
      }
      return newTabs;
    });
  }

  return (
    <div className="flex h-screen w-screen bg-bg-surface text-text-secondary font-sans mt-0">
      {/* Sidebar */}
      <div className="w-64 border-r border-border-main flex flex-col bg-bg-base">
        <div className="p-4 pt-8 border-b border-border-main flex items-center justify-between" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
          <span className="font-semibold text-text-primary ml-12">Collections</span>
          <div className="flex space-x-2" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            <input type="file" ref={fileInputRef} onChange={handleImport} className="hidden" accept=".json" />
            <button title="Import Postman" onClick={() => fileInputRef.current?.click()}><Upload size={16} className="cursor-pointer hover:text-text-inverted" /></button>
            <button title="Export Collections" onClick={exportCollections}><Download size={16} className="cursor-pointer hover:text-text-inverted" /></button>
            <button title="New Collection" onClick={createNewCollection}><Plus size={16} className="cursor-pointer hover:text-text-inverted" /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {collections.map(col => (
            <div key={col.id} className="mb-2">
              <div 
                className="group flex items-center justify-between p-2 hover:bg-bg-hover rounded cursor-pointer text-sm font-semibold"
                onClick={() => toggleCollection(col.id)}
              >
                <div className="flex items-center space-x-2 truncate">
                  <Folder size={14} className="text-yellow-500 flex-shrink-0" />
                  <span className="truncate">{col.name}</span>
                </div>
                <div className="hidden group-hover:flex items-center space-x-1.5 flex-shrink-0 text-text-tertiary">
                  <span title="Add Request" className="flex items-center justify-center cursor-pointer hover:text-text-inverted" onClick={(e) => addNewRequestToCollection(e, col.id)}>
                    <Plus size={14} />
                  </span>
                  <span title="Delete Collection" className="flex items-center justify-center cursor-pointer hover:text-red-500" onClick={(e) => deleteCollection(e, col.id)}>
                    <Trash size={14} />
                  </span>
                </div>
              </div>
              
              {!collapsedCollections.has(col.id) && (
                <div className="pl-6 space-y-1 mt-1">
                  {col.requests.map(req => (
                    <div 
                      key={req.id} 
                      onClick={() => loadRequest(req)}
                      className={`group flex items-center justify-between p-1.5 hover:bg-bg-hover rounded cursor-pointer text-xs ${activeTabId === req.id ? 'bg-bg-hover text-blue-400' : 'text-text-tertiary'}`}
                    >
                      <div className="flex items-center space-x-2 truncate">
                        <FileJson size={12} className={`flex-shrink-0 ${
                          req.method === 'GET' ? 'text-green-500' :
                          req.method === 'POST' ? 'text-yellow-500' :
                          req.method === 'DELETE' ? 'text-red-500' : 'text-blue-500'
                        }`} />
                        <span className="truncate">{req.name}</span>
                      </div>
                      <div className="hidden group-hover:flex items-center flex-shrink-0 text-text-tertiary">
                        <span title="Delete Request" className="flex items-center justify-center cursor-pointer hover:text-red-500" onClick={(e) => deleteRequest(e, col.id, req.id)}>
                          <Trash size={12} />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {collections.length === 0 && (
            <div className="text-xs text-text-tertiary text-center mt-10">No collections found</div>
          )}
        </div>
        <div className="p-4 border-t border-border-main flex items-center justify-between text-text-tertiary">
          <div className="flex items-center space-x-2 cursor-pointer hover:text-text-inverted">
            <Settings size={16} />
            <span className="text-sm">Settings</span>
          </div>
          <select 
            className="bg-bg-base border border-border-main text-xs p-1 outline-none text-text-secondary cursor-pointer hover:border-border-hover rounded"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
            <option value="dracula">Dracula</option>
            <option value="nord">Nord</option>
            <option value="hacker">Hacker</option>
          </select>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Tab Bar */}
        <div className="flex bg-bg-base border-b border-border-main overflow-x-auto min-h-[36px] pt-2" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
          {openTabs.map(tab => (
            <div 
              key={tab.id}
              onClick={() => handleSwitchTab(tab.id)}
              className={`flex items-center space-x-2 px-3 py-1.5 border-r border-border-main cursor-pointer min-w-[120px] max-w-[200px] ${activeTabId === tab.id ? 'bg-bg-surface text-text-inverted border-t-2 border-t-orange-500' : 'text-text-tertiary hover:bg-bg-hover'}`}
              style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            >
              <span className={`text-[10px] font-bold ${
                tab.method === 'GET' ? 'text-green-500' :
                tab.method === 'POST' ? 'text-yellow-500' :
                tab.method === 'DELETE' ? 'text-red-500' : 'text-blue-500'
              }`}>{tab.method}</span>
              <span className="truncate flex-1 text-xs">{tab.name}{tab.isDirty ? '*' : ''}</span>
              <X size={14} className="hover:bg-border-hover rounded p-0.5 text-text-tertiary hover:text-text-secondary" onClick={(e) => closeTab(e, tab.id)} />
            </div>
          ))}
          <div className="flex items-center px-3 cursor-pointer hover:text-text-inverted text-text-tertiary" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties} onClick={async () => {
            if (currentTab && currentTab.isDirty) {
               await saveTab(currentTab);
            }
            const newTab: OpenTab = {
               id: 'temp-' + Date.now(),
               name: 'New Request',
               method: 'GET',
               url: '',
               body: '{\n  \n}',
               preRequestScript: '',
               testScript: '',
               headers: [],
               params: [],
               response: null,
               testResults: [],
               activeEditorTab: 'Body',
               activeResponseTab: 'Body',
               isDirty: false,
               loading: false
            };
            setOpenTabs(prev => [...prev, newTab]);
            setActiveTabId(newTab.id);
          }}>
            <Plus size={16} />
          </div>
        </div>

        {currentTab ? (
          <>
            {/* Header / URL Bar */}
            <div className="p-4 border-b border-border-main flex items-center space-x-2">
              <select 
                className="bg-bg-hover border border-border-hover text-text-primary p-2 outline-none font-semibold w-24 flex-shrink-0"
                value={currentTab.method}
                onChange={e => updateCurrentTab({ method: e.target.value as HttpMethod })}
              >
                <option>GET</option>
                <option>POST</option>
                <option>PUT</option>
                <option>PATCH</option>
                <option>DELETE</option>
              </select>
              <input 
                type="text" 
                className="flex-1 min-w-0 bg-bg-surface border border-border-hover text-text-primary p-2 outline-none focus:border-blue-500 transition-colors font-mono text-sm"
                placeholder="Enter request URL e.g. {{baseUrl}}/users"
                value={currentTab.url}
                onChange={(e) => handleUrlChange(e.target.value)}
              />
              
              <div className="flex items-center space-x-2 ml-4 flex-shrink-0">
                <Globe size={16} className="text-text-tertiary" />
                <select
                  className="bg-bg-surface border border-border-hover text-sm text-text-primary p-1.5 outline-none cursor-pointer hover:border-border-hover"
                  value={activeEnvironmentId}
                  onChange={(e) => setActiveEnvironmentId(e.target.value)}
                >
                  <option value="none">No Environment</option>
                  {environments.map(env => (
                    <option key={env.id} value={env.id}>{env.name}</option>
                  ))}
                </select>
              </div>

              <button 
                onClick={copyCurl}
                className="bg-bg-hover border border-border-hover hover:bg-bg-active text-text-secondary px-4 py-2 rounded flex items-center space-x-2 transition-colors focus:outline-none flex-shrink-0"
                title="Copy cURL"
              >
                {copiedCurl ? <Check size={16} className="text-green-500" /> : <Code size={16} />}
                <span>cURL</span>
              </button>
              <button 
                onClick={saveCurrentRequest}
                className="bg-bg-hover border border-border-hover hover:bg-bg-active text-text-secondary px-4 py-2 rounded flex items-center space-x-2 transition-colors focus:outline-none flex-shrink-0"
                title="Save Request"
              >
                <Save size={16} />
              </button>
              <button 
                onClick={sendRequest}
                disabled={currentTab.loading}
                className="bg-blue-600 hover:bg-blue-700 text-text-inverted px-6 py-2 rounded flex items-center space-x-2 transition-colors focus:outline-none flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {currentTab.loading ? <span className="animate-pulse">Sending...</span> : <><Send size={16} /><span>Send</span></>}
              </button>
            </div>

            {/* Request Tabs & Editor */}
            <div className="flex-1 flex flex-col border-b border-border-main h-1/2">
              <div className="flex space-x-6 p-2 px-4 border-b border-border-main text-sm overflow-x-auto">
                {['Params', 'Headers', 'Body', 'Pre-request', 'Tests'].map(tab => (
                  <button 
                    key={tab}
                    onClick={() => updateCurrentTab({ activeEditorTab: tab as any })}
                    className={`pb-2 border-b-2 transition-colors flex-shrink-0 ${currentTab.activeEditorTab === tab ? 'border-accent text-text-inverted' : 'border-transparent hover:text-text-primary'}`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              <div className="flex-1 min-h-0 bg-bg-surface">
                {currentTab.activeEditorTab === 'Headers' && (
                  <KeyValueEditor 
                    items={currentTab.headers || []}
                    onChange={(newHeaders) => updateCurrentTab({ headers: newHeaders })}
                  />
                )}
                {currentTab.activeEditorTab === 'Params' && (
                  <KeyValueEditor 
                    items={currentTab.params || []}
                    onChange={handleParamsChange}
                  />
                )}
                {currentTab.activeEditorTab === 'Body' && (
                  <Editor
                    height="100%"
                    defaultLanguage="json"
                    theme={theme === 'light' ? 'vs' : 'vs-dark'}
                    value={currentTab.body}
                    onChange={(val) => updateCurrentTab({ body: val || '' })}
                    options={{ minimap: { enabled: false }, fontSize: 13 }}
                  />
                )}
                {currentTab.activeEditorTab === 'Pre-request' && (
                  <Editor
                    height="100%"
                    defaultLanguage="javascript"
                    theme={theme === 'light' ? 'vs' : 'vs-dark'}
                    value={currentTab.preRequestScript}
                    onChange={(val) => updateCurrentTab({ preRequestScript: val || '' })}
                    options={{ minimap: { enabled: false }, fontSize: 13 }}
                  />
                )}
                {currentTab.activeEditorTab === 'Tests' && (
                  <Editor
                    height="100%"
                    defaultLanguage="javascript"
                    theme={theme === 'light' ? 'vs' : 'vs-dark'}
                    value={currentTab.testScript}
                    onChange={(val) => updateCurrentTab({ testScript: val || '' })}
                    options={{ minimap: { enabled: false }, fontSize: 13 }}
                  />
                )}
                {!['Params', 'Headers', 'Body', 'Pre-request', 'Tests'].includes(currentTab.activeEditorTab) && (
                  <div className="p-4 text-text-tertiary italic text-sm">
                    {currentTab.activeEditorTab} editor coming soon...
                  </div>
                )}
              </div>
            </div>

            {/* Response Area */}
            <div className="flex-1 flex flex-col h-1/2 min-h-0 bg-bg-surface">
              <div className="flex items-center justify-between p-2 px-4 border-b border-border-main text-sm flex-shrink-0">
                <div className="flex space-x-4">
                  <button 
                    onClick={() => updateCurrentTab({ activeResponseTab: 'Body' })}
                    className={`pb-1 border-b-2 transition-colors ${currentTab.activeResponseTab === 'Body' ? 'border-accent text-text-inverted' : 'border-transparent hover:text-text-primary'}`}
                  >
                    Body
                  </button>
                  <button 
                    onClick={() => updateCurrentTab({ activeResponseTab: 'Tests' })}
                    className={`pb-1 border-b-2 transition-colors ${currentTab.activeResponseTab === 'Tests' ? 'border-accent text-text-inverted' : 'border-transparent hover:text-text-primary'}`}
                  >
                    Test Results ({currentTab.testResults?.length || 0})
                  </button>
                </div>
                
                {currentTab.response && (
                  <div className="flex space-x-4 text-xs">
                    <span className={`font-mono font-bold ${currentTab.response.status >= 200 && currentTab.response.status < 300 ? 'text-green-500' : 'text-red-500'}`}>Status: {currentTab.response.status} {currentTab.response.statusText}</span>
                    <span className="font-mono text-blue-400">Time: {currentTab.response.time} ms</span>
                    <span className="font-mono text-text-tertiary">Size: {currentTab.response.size} B</span>
                  </div>
                )}
              </div>
              <div className="flex-1 min-h-0 relative">
                {!currentTab.response && (!currentTab.testResults || currentTab.testResults.length === 0) ? (
                  <div className="flex items-center justify-center h-full text-text-tertiary text-sm">
                    Enter a URL and click Send to get a response
                  </div>
                ) : currentTab.response?.error ? (
                  <div className="p-4 text-red-500 font-mono text-sm">
                    Error: {currentTab.response.error}
                  </div>
                ) : currentTab.activeResponseTab === 'Body' && currentTab.response ? (
                  <Editor
                    height="100%"
                    defaultLanguage="json"
                    theme={theme === 'light' ? 'vs' : 'vs-dark'}
                    value={typeof currentTab.response.data === 'object' ? JSON.stringify(currentTab.response.data, null, 2) : currentTab.response.data}
                    options={{ readOnly: true, minimap: { enabled: false }, fontSize: 13, wordWrap: 'on' }}
                  />
                ) : currentTab.activeResponseTab === 'Tests' ? (
                  <div className="p-4 space-y-2 overflow-y-auto h-full text-sm">
                    {(currentTab.testResults || []).map((t, idx) => (
                      <div key={idx} className={`p-2 rounded border ${t.status === 'pass' ? 'border-green-800 bg-green-900/20 text-green-400' : 'border-red-800 bg-red-900/20 text-red-400'}`}>
                        <div className="font-semibold">{t.status === 'pass' ? 'PASS' : 'FAIL'} | {t.name}</div>
                        {t.error && <div className="text-xs mt-1 font-mono">{t.error}</div>}
                      </div>
                    ))}
                    {(!currentTab.testResults || currentTab.testResults.length === 0) && (
                      <div className="text-text-tertiary italic">No tests found.</div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-text-tertiary">
            No active tabs. Open a request or create a new tab.
          </div>
        )}
      </div>
      <PromptDialog 
        isOpen={promptConfig.isOpen}
        title={promptConfig.title}
        defaultValue={promptConfig.defaultValue}
        onSubmit={handlePromptSubmit}
        onCancel={handlePromptCancel}
      />
    </div>
  )
}

export default App

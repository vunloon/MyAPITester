import { useState, useEffect, useRef } from 'react'
import { Plus, Folder, Settings, Send, Save, Globe, Download, Upload, X, Code, Check, Trash, Eye, Edit2 } from 'lucide-react'
import Editor from '@monaco-editor/react'
import type { ApiCollection, ApiRequest, HttpMethod, Environment, EnvironmentVariable, OpenTab } from './types'
import { KeyValueEditor } from './KeyValueEditor'
import type { KeyValueItem } from './KeyValueEditor'
import { PromptDialog } from './PromptDialog'
import { EnvironmentManager } from './EnvironmentManager'

function App() {
  const [openTabs, setOpenTabs] = useState<OpenTab[]>(() => {
    try {
      const saved = localStorage.getItem('openTabs')
      if (saved) return JSON.parse(saved)
    } catch (e) {
      console.error('Failed to parse openTabs', e)
    }
    return [
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
    ]
  })
  const [activeTabId, setActiveTabId] = useState<string>(() => {
    return localStorage.getItem('activeTabId') || 'default'
  })

  useEffect(() => {
    localStorage.setItem('openTabs', JSON.stringify(openTabs))
  }, [openTabs])

  useEffect(() => {
    localStorage.setItem('activeTabId', activeTabId)
  }, [activeTabId])
  const [copiedCurl, setCopiedCurl] = useState(false);
  
  const currentTab = openTabs.find(t => t.id === activeTabId)

  const [collections, setCollections] = useState<ApiCollection[]>([])
  const [collapsedCollections, setCollapsedCollections] = useState<Set<string>>(new Set())
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  
  const [environments, setEnvironments] = useState<Environment[]>([])
  const [activeEnvironmentId, setActiveEnvironmentId] = useState<string>('none')
  const [globals, setGlobals] = useState<EnvironmentVariable[]>([
    { key: 'baseUrl', value: 'https://jsonplaceholder.typicode.com', enabled: true }
  ])
  const [isEnvManagerOpen, setIsEnvManagerOpen] = useState(false);

  const handleSaveEnvironments = async (newEnvs: Environment[], newGlobs: EnvironmentVariable[]) => {
    setEnvironments(newEnvs);
    setGlobals(newGlobs);
    await window.api.writeEnvironments(newEnvs);
    await window.api.writeGlobals(newGlobs);
  };

  const [theme, setTheme] = useState<string>(() => localStorage.getItem('theme') || 'dark')

  const [responseHeight, setResponseHeight] = useState(300);
  const isResizing = useRef(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      // We are dragging the top edge of the response panel
      // Height = window height - mouse Y - bottom padding
      const newHeight = window.innerHeight - e.clientY - 20;
      if (newHeight > 100 && newHeight < window.innerHeight - 200) {
        setResponseHeight(newHeight);
      }
    };
    const handleMouseUp = () => {
      if (isResizing.current) {
        isResizing.current = false;
        document.body.style.cursor = 'default';
      }
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

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

  useEffect(() => {
    const colWithReq = collections.find(c => c.requests.some(r => r.id === activeTabId));
    if (colWithReq) {
      setCollapsedCollections(prev => {
        if (prev.has(colWithReq.id)) {
          const next = new Set(prev);
          next.delete(colWithReq.id);
          return next;
        }
        return prev;
      });
      setTimeout(() => {
        const el = document.getElementById(`request-item-${activeTabId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 50);
    }
  }, [activeTabId, collections]);

  const loadData = async () => {
    try {
      const colls = await window.api.readCollections()
      setCollections(colls || [])
      if (colls && colls.length > 0) {
        setCollapsedCollections(new Set(colls.map((c: any) => c.id)))
      }
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

  const renameCollection = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const col = collections.find(c => c.id === id);
    if (!col) return;
    const newName = await showPrompt('Rename Collection:', col.name);
    if (!newName || newName === col.name) return;
    const newCollections = collections.map(c => c.id === id ? { ...c, name: newName } : c);
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

  const renameRequest = async (e: React.MouseEvent, collectionId: string, requestId: string) => {
    e.stopPropagation();
    const col = collections.find(c => c.id === collectionId);
    const req = col?.requests.find(r => r.id === requestId);
    if (!req) return;
    
    const newName = await showPrompt('Rename Request:', req.name);
    if (!newName || newName === req.name) return;
    
    const newCollections = collections.map(c => {
      if (c.id === collectionId) {
        return {
          ...c,
          requests: c.requests.map(r => r.id === requestId ? { ...r, name: newName } : r)
        };
      }
      return c;
    });
    saveCollections(newCollections);
    
    updateTabWithoutDirty(requestId, { name: newName });
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

  const handleDragStart = (e: React.DragEvent, type: 'request', colId: string, reqId: string) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ type, sourceColId: colId, sourceReqId: reqId }));
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    setDragOverId(id);
  };

  const handleDragLeave = () => {
    setDragOverId(null);
  };

  const handleDrop = (e: React.DragEvent, targetType: 'collection' | 'request', targetColId: string, targetReqId?: string) => {
    e.preventDefault();
    setDragOverId(null);
    
    try {
      const dataStr = e.dataTransfer.getData('application/json');
      if (!dataStr) return;
      
      const data = JSON.parse(dataStr);
      if (data.type !== 'request') return;
      
      const { sourceColId, sourceReqId } = data;
      
      // Prevent dropping on itself
      if (targetType === 'request' && sourceReqId === targetReqId) return;
      
      const newCollections = [...collections];
      const sourceColIdx = newCollections.findIndex(c => c.id === sourceColId);
      if (sourceColIdx === -1) return;
      
      const sourceReqIdx = newCollections[sourceColIdx].requests.findIndex(r => r.id === sourceReqId);
      if (sourceReqIdx === -1) return;
      
      // Clone the request
      const movedReq = { ...newCollections[sourceColIdx].requests[sourceReqIdx] };
      
      // Remove from source
      newCollections[sourceColIdx].requests.splice(sourceReqIdx, 1);
      
      const targetColIdx = newCollections.findIndex(c => c.id === targetColId);
      if (targetColIdx === -1) return;
      
      if (targetType === 'collection') {
        newCollections[targetColIdx].requests.push(movedReq);
      } else if (targetType === 'request' && targetReqId) {
        let targetReqIdx = newCollections[targetColIdx].requests.findIndex(r => r.id === targetReqId);
        if (targetReqIdx === -1) {
          newCollections[targetColIdx].requests.push(movedReq);
        } else {
          newCollections[targetColIdx].requests.splice(targetReqIdx, 0, movedReq);
        }
      }
      
      saveCollections(newCollections);
      
    } catch (err) {
      console.error('Drag drop error:', err);
    }
  };

  return (
    <div className="flex h-screen w-screen bg-transparent text-text-secondary font-sans p-4 gap-4 overflow-hidden box-border" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
      
      {/* Sidebar (Left Side) */}
      <div className="w-80 flex flex-col bg-[var(--panel-bg)] border border-[var(--panel-border)] backdrop-blur-2xl rounded-2xl shadow-2xl overflow-hidden flex-shrink-0" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <div className="p-5 border-b border-[var(--panel-border)] flex items-center justify-between bg-black/10" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
          <span className="font-bold text-text-primary text-lg">Collections</span>
          <div className="flex space-x-3 text-text-tertiary" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            <input type="file" ref={fileInputRef} onChange={handleImport} className="hidden" accept=".json" />
            <button title="Import Postman" onClick={() => fileInputRef.current?.click()} className="hover:text-white transition-colors"><Upload size={18} /></button>
            <button title="Export Collections" onClick={exportCollections} className="hover:text-white transition-colors"><Download size={18} /></button>
            <button title="New Collection" onClick={createNewCollection} className="hover:text-[var(--accent)] transition-colors"><Plus size={18} /></button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {collections.map(col => (
            <div key={col.id} className="mb-1">
              <div 
                className={`group flex items-center justify-between p-3 hover:bg-white/5 rounded-xl cursor-pointer text-sm font-semibold transition-colors border ${dragOverId === `col-${col.id}` ? 'border-[var(--accent)] bg-white/10' : 'border-transparent hover:border-[var(--panel-border)]'}`}
                onClick={() => toggleCollection(col.id)}
                onDragOver={(e) => handleDragOver(e, `col-${col.id}`)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, 'collection', col.id)}
              >
                <div className="flex items-center space-x-3 truncate">
                  <Folder size={16} className="text-[var(--accent)] flex-shrink-0" />
                  <span className="truncate">{col.name}</span>
                </div>
                <div className="hidden group-hover:flex items-center space-x-2 flex-shrink-0 text-text-tertiary">
                  <span title="Add Request" className="flex items-center justify-center cursor-pointer hover:text-[var(--accent)] bg-black/20 p-1.5 rounded-md transition-colors" onClick={(e) => addNewRequestToCollection(e, col.id)}>
                    <Plus size={14} />
                  </span>
                  <span title="Rename Collection" className="flex items-center justify-center cursor-pointer hover:text-[var(--accent)] bg-black/20 p-1.5 rounded-md transition-colors" onClick={(e) => renameCollection(e, col.id)}>
                    <Edit2 size={14} />
                  </span>
                  <span title="Delete Collection" className="flex items-center justify-center cursor-pointer hover:text-red-400 bg-black/20 p-1.5 rounded-md transition-colors" onClick={(e) => deleteCollection(e, col.id)}>
                    <Trash size={14} />
                  </span>
                </div>
              </div>
              
              {!collapsedCollections.has(col.id) && (
                <div className="pl-6 pr-2 py-1 space-y-1">
                  {col.requests.map(req => (
                    <div 
                      key={req.id} 
                      id={`request-item-${req.id}`}
                      onClick={() => loadRequest(req)}
                      draggable
                      onDragStart={(e) => handleDragStart(e, 'request', col.id, req.id)}
                      onDragOver={(e) => handleDragOver(e, `req-${req.id}`)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, 'request', col.id, req.id)}
                      className={`group flex items-center justify-between p-2 rounded-lg cursor-pointer text-sm transition-all border ${activeTabId === req.id ? 'bg-[var(--accent)]/10 border-[var(--accent)]/30 text-text-primary' : 'border-transparent text-text-tertiary hover:bg-white/5 hover:text-text-primary'} ${dragOverId === `req-${req.id}` ? 'border-t-[var(--accent)] border-t-2 rounded-t-none' : ''}`}
                    >
                      <div className="flex items-center space-x-3 truncate">
                        <span className={`text-[10px] font-bold w-10 ${
                          req.method === 'GET' ? 'text-green-400' :
                          req.method === 'POST' ? 'text-yellow-400' :
                          req.method === 'DELETE' ? 'text-red-400' : 'text-blue-400'
                        }`}>{req.method}</span>
                        <span className="truncate">{req.name}</span>
                      </div>
                      <div className="hidden group-hover:flex items-center space-x-1 flex-shrink-0 text-text-tertiary">
                        <span title="Rename Request" className="flex items-center justify-center cursor-pointer hover:text-[var(--accent)] p-1 transition-colors" onClick={(e) => renameRequest(e, col.id, req.id)}>
                          <Edit2 size={14} />
                        </span>
                        <span title="Delete Request" className="flex items-center justify-center cursor-pointer hover:text-red-400 p-1 transition-colors" onClick={(e) => deleteRequest(e, col.id, req.id)}>
                          <Trash size={14} />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {collections.length === 0 && (
            <div className="text-sm text-text-tertiary text-center mt-12 bg-black/10 py-8 rounded-xl border border-[var(--panel-border)] border-dashed">
              No collections found.<br/>Click + to create one.
            </div>
          )}
        </div>

        <div className="p-4 border-t border-[var(--panel-border)] flex items-center justify-between bg-black/10">
          <div className="flex items-center space-x-2 text-text-tertiary hover:text-text-primary cursor-pointer transition-colors">
            <Settings size={18} />
            <span className="text-sm font-medium">Settings</span>
          </div>
          <select 
            className="bg-black/20 border border-[var(--panel-border)] text-xs p-2 outline-none text-text-secondary cursor-pointer hover:border-[var(--accent)] rounded-lg transition-colors focus:ring-1 focus:ring-[var(--accent)]"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
          >
            <option value="dark" className="bg-bg-surface">Dark</option>
            <option value="light" className="bg-bg-surface">Light</option>
            <option value="dracula" className="bg-bg-surface">Dracula</option>
            <option value="nord" className="bg-bg-surface">Nord</option>
            <option value="hacker" className="bg-bg-surface">Hacker</option>
          </select>
        </div>
      </div>

      {/* Main Content (Right Side) */}
      <div className="flex-1 flex flex-col min-w-0 bg-[var(--panel-bg)] border border-[var(--panel-border)] backdrop-blur-2xl rounded-2xl shadow-2xl overflow-hidden" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        
        {/* Tab Bar - Modern Pills */}
        <div className="flex items-center bg-black/10 px-4 py-3 overflow-x-auto gap-2" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
          {openTabs.map(tab => (
            <div 
              key={tab.id}
              onClick={() => handleSwitchTab(tab.id)}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-full cursor-pointer transition-all border ${activeTabId === tab.id ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-glow shadow-[var(--accent)]' : 'bg-[var(--panel-bg)] border-[var(--panel-border)] text-text-tertiary hover:text-text-primary hover:bg-white/5'}`}
              style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            >
              <span className={`text-[10px] font-bold ${
                activeTabId === tab.id ? 'text-white' : 
                tab.method === 'GET' ? 'text-green-400' :
                tab.method === 'POST' ? 'text-yellow-400' :
                tab.method === 'DELETE' ? 'text-red-400' : 'text-blue-400'
              }`}>{tab.method}</span>
              <span className="truncate max-w-[100px] text-xs font-medium">{tab.name}{tab.isDirty ? '*' : ''}</span>
              <X size={12} className="hover:bg-black/20 rounded-full p-0.5" onClick={(e) => closeTab(e, tab.id)} />
            </div>
          ))}
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--panel-bg)] border border-[var(--panel-border)] cursor-pointer hover:bg-white/10 text-text-tertiary transition-colors" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties} onClick={async () => {
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
          <div className="flex-1 flex flex-col min-h-0 relative">
            {/* Command Bar / URL Bar */}
            <div className="px-6 py-4 border-b border-[var(--panel-border)] flex flex-col gap-3">
              <div className="flex items-center space-x-3">
                <div className="flex flex-1 items-center bg-black/20 rounded-xl border border-[var(--panel-border)] overflow-hidden focus-within:border-[var(--accent)] transition-colors shadow-inner">
                  <select 
                    className="bg-transparent text-text-primary p-3 outline-none font-bold text-sm w-28 border-r border-[var(--panel-border)] cursor-pointer appearance-none text-center"
                    value={currentTab.method}
                    onChange={e => updateCurrentTab({ method: e.target.value as HttpMethod })}
                  >
                    <option className="bg-bg-surface">GET</option>
                    <option className="bg-bg-surface">POST</option>
                    <option className="bg-bg-surface">PUT</option>
                    <option className="bg-bg-surface">PATCH</option>
                    <option className="bg-bg-surface">DELETE</option>
                  </select>
                  <input 
                    type="text" 
                    className="flex-1 bg-transparent text-text-primary p-3 outline-none font-mono text-sm"
                    placeholder="Enter request URL e.g. {{baseUrl}}/users"
                    value={currentTab.url}
                    onChange={(e) => handleUrlChange(e.target.value)}
                  />
                </div>
                <button 
                  onClick={sendRequest}
                  disabled={currentTab.loading}
                  className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white px-8 py-3 rounded-xl flex items-center space-x-2 transition-all shadow-lg hover:shadow-[var(--accent)]/50 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed font-bold"
                >
                  {currentTab.loading ? <span className="animate-pulse">Sending...</span> : <><Send size={18} /><span>Send</span></>}
                </button>
              </div>

              <div className="flex items-center justify-between text-xs text-text-tertiary">
                <div className="flex items-center space-x-2 bg-black/20 rounded-lg px-3 py-1.5 border border-[var(--panel-border)]">
                  <Globe size={14} />
                  <select
                    className="bg-transparent text-text-primary outline-none cursor-pointer"
                    value={activeEnvironmentId}
                    onChange={(e) => setActiveEnvironmentId(e.target.value)}
                  >
                    <option value="none" className="bg-bg-surface">No Environment</option>
                    {environments.map(env => (
                      <option key={env.id} value={env.id} className="bg-bg-surface">{env.name}</option>
                    ))}
                  </select>
                  <button onClick={() => setIsEnvManagerOpen(true)} className="text-text-tertiary hover:text-[var(--accent)] ml-1 p-1 hover:bg-white/10 rounded-md transition-colors" title="Manage Environments">
                    <Eye size={14} />
                  </button>
                </div>
                <div className="flex items-center space-x-2">
                  <button 
                    onClick={copyCurl}
                    className="hover:bg-white/10 px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition-colors"
                    title="Copy cURL"
                  >
                    {copiedCurl ? <Check size={14} className="text-green-500" /> : <Code size={14} />}
                    <span>cURL</span>
                  </button>
                  <button 
                    onClick={saveCurrentRequest}
                    className="hover:bg-white/10 px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition-colors"
                    title="Save Request"
                  >
                    <Save size={14} />
                    <span>Save</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Request Tabs & Editor */}
            <div className="flex-1 flex flex-col min-h-0 bg-black/10">
              <div className="flex space-x-6 px-6 pt-3 border-b border-[var(--panel-border)] text-sm font-medium bg-[var(--panel-bg)]">
                {['Params', 'Headers', 'Body', 'Pre-request', 'Tests'].map(tab => (
                  <button 
                    key={tab}
                    onClick={() => updateCurrentTab({ activeEditorTab: tab as any })}
                    className={`pb-3 border-b-2 transition-all ${currentTab.activeEditorTab === tab ? 'border-[var(--accent)] text-text-primary' : 'border-transparent text-text-tertiary hover:text-text-primary'}`}
                  >
                    {tab}
                    {tab === 'Headers' && currentTab.headers.filter(h => h.active && h.key).length > 0 && 
                      <span className="ml-1.5 text-[10px] bg-[var(--accent)]/20 text-[var(--accent)] px-1.5 py-0.5 rounded-full">{currentTab.headers.filter(h => h.active && h.key).length}</span>}
                    {tab === 'Params' && currentTab.params.filter(p => p.active && p.key).length > 0 && 
                      <span className="ml-1.5 text-[10px] bg-[var(--accent)]/20 text-[var(--accent)] px-1.5 py-0.5 rounded-full">{currentTab.params.filter(p => p.active && p.key).length}</span>}
                  </button>
                ))}
              </div>
              <div className="flex-1 min-h-0 bg-transparent relative">
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
              </div>
            </div>

            {/* Resize Handle */}
            <div 
              className="h-2 w-full bg-[var(--panel-border)] cursor-row-resize hover:bg-[var(--accent)] transition-colors flex items-center justify-center relative z-10"
              onMouseDown={(e) => {
                e.preventDefault();
                isResizing.current = true;
                document.body.style.cursor = 'row-resize';
              }}
            >
              <div className="w-8 h-1 rounded-full bg-white/20"></div>
            </div>

            {/* Response Area */}
            <div className="flex flex-col bg-black/5 flex-shrink-0" style={{ height: responseHeight }}>
              <div className="flex items-center justify-between px-6 border-b border-[var(--panel-border)] text-sm font-medium bg-[var(--panel-bg)]">
                <div className="flex space-x-6">
                  <button 
                    onClick={() => updateCurrentTab({ activeResponseTab: 'Body' })}
                    className={`py-3 border-b-2 transition-all ${currentTab.activeResponseTab === 'Body' ? 'border-[var(--accent)] text-text-primary' : 'border-transparent text-text-tertiary hover:text-text-primary'}`}
                  >
                    Response
                  </button>
                  <button 
                    onClick={() => updateCurrentTab({ activeResponseTab: 'Tests' })}
                    className={`py-3 border-b-2 transition-all ${currentTab.activeResponseTab === 'Tests' ? 'border-[var(--accent)] text-text-primary' : 'border-transparent text-text-tertiary hover:text-text-primary'}`}
                  >
                    Test Results ({currentTab.testResults?.length || 0})
                  </button>
                </div>
                
                {currentTab.response && (
                  <div className="flex space-x-4 text-xs font-mono bg-black/20 px-3 py-1.5 rounded-lg border border-[var(--panel-border)]">
                    <span className={`${currentTab.response.status >= 200 && currentTab.response.status < 300 ? 'text-green-400' : 'text-red-400'} font-bold`}>{currentTab.response.status} {currentTab.response.statusText}</span>
                    <span className="text-blue-400">{currentTab.response.time} ms</span>
                    <span className="text-text-tertiary">{currentTab.response.size} B</span>
                  </div>
                )}
              </div>
              <div className="flex-1 min-h-0 relative">
                {!currentTab.response && (!currentTab.testResults || currentTab.testResults.length === 0) ? (
                  <div className="flex items-center justify-center h-full text-text-tertiary text-sm">
                    Enter a URL and click Send to get a response
                  </div>
                ) : currentTab.response?.error ? (
                  <div className="p-6 text-red-400 font-mono text-sm bg-red-900/10 h-full overflow-auto">
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
                  <div className="p-6 space-y-3 overflow-y-auto h-full text-sm">
                    {(currentTab.testResults || []).map((t, idx) => (
                      <div key={idx} className={`p-4 rounded-xl border backdrop-blur-sm ${t.status === 'pass' ? 'border-green-500/30 bg-green-500/10 text-green-300' : 'border-red-500/30 bg-red-500/10 text-red-300'}`}>
                        <div className="font-semibold flex items-center gap-2">
                          {t.status === 'pass' ? <Check size={16} className="text-green-500" /> : <X size={16} className="text-red-500" />}
                          {t.name}
                        </div>
                        {t.error && <div className="text-xs mt-2 font-mono bg-black/20 p-2 rounded">{t.error}</div>}
                      </div>
                    ))}
                    {(!currentTab.testResults || currentTab.testResults.length === 0) && (
                      <div className="text-text-tertiary italic">No tests found.</div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-text-tertiary space-y-4">
            <Globe size={48} className="opacity-20" />
            <div className="text-lg font-medium">No active requests</div>
            <button 
              onClick={() => {
                const newTab: OpenTab = { id: 'temp-' + Date.now(), name: 'New Request', method: 'GET', url: '', body: '{\n  \n}', preRequestScript: '', testScript: '', headers: [], params: [], response: null, testResults: [], activeEditorTab: 'Body', activeResponseTab: 'Body', isDirty: false, loading: false };
                setOpenTabs(prev => [...prev, newTab]);
                setActiveTabId(newTab.id);
              }}
              className="px-6 py-2 bg-[var(--accent)] text-white rounded-full hover:bg-[var(--accent-hover)] transition-colors shadow-lg"
            >
              Create New Request
            </button>
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
      
      <EnvironmentManager 
        isOpen={isEnvManagerOpen}
        onClose={() => setIsEnvManagerOpen(false)}
        environments={environments}
        globals={globals}
        onSave={handleSaveEnvironments}
      />
    </div>
  )
}

export default App

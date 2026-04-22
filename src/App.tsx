import { useState, useEffect, useRef } from 'react'
import { Plus, Folder, Settings, Send, Save, FileJson, Globe, Download, Upload } from 'lucide-react'
import Editor from '@monaco-editor/react'
import type { ApiCollection, ApiRequest, HttpMethod, Environment, EnvironmentVariable } from './types'

function App() {
  const [url, setUrl] = useState('https://jsonplaceholder.typicode.com/todos/1')
  const [method, setMethod] = useState<HttpMethod>('GET')
  const [body, setBody] = useState<string>('{\n  \n}')
  const [preRequestScript, setPreRequestScript] = useState<string>('// pm.environment.set("test", "123");')
  const [testScript, setTestScript] = useState<string>('// pm.test("Status code is 200", function () { pm.response.to.have.status(200); });')
  const [response, setResponse] = useState<any>(null)
  const [testResults, setTestResults] = useState<any[]>([])
  
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'Params' | 'Headers' | 'Body' | 'Pre-request' | 'Tests'>('Body')
  const [activeResponseTab, setActiveResponseTab] = useState<'Body' | 'Tests'>('Body')
  
  const [collections, setCollections] = useState<ApiCollection[]>([])
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null)
  const [collapsedCollections, setCollapsedCollections] = useState<Set<string>>(new Set())
  
  const [environments, setEnvironments] = useState<Environment[]>([])
  const [activeEnvironmentId, setActiveEnvironmentId] = useState<string>('none')
  const [globals, setGlobals] = useState<EnvironmentVariable[]>([
    { key: 'baseUrl', value: 'https://jsonplaceholder.typicode.com', enabled: true }
  ])

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
      // Very naive merge back (does not remove keys, only adds/updates)
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
    setLoading(true)
    setTestResults([])
    setActiveResponseTab('Body')
    try {
      // 1. Run Pre-request Script
      let currentPmData = {
        environment: getActiveEnvMap(),
        globals: getGlobalsMap(),
        request: { url, method, body },
        info: { requestName: 'Request' }
      };

      if (preRequestScript.trim()) {
        const result = await window.api.executeScript({
          script: preRequestScript,
          pmData: currentPmData
        });
        if (result.success && result.pmData) {
          currentPmData = result.pmData;
          await syncVarsMapAfterScript(result.pmData);
        } else {
          console.error("Pre-request script error:", result.error);
        }
      }

      // 2. Resolve Variables
      let finalBody = body;
      const resolvedUrl = resolveVariables(url);
      const resolvedBody = resolveVariables(finalBody);
      
      let parsedBody = undefined;
      if (['POST', 'PUT', 'PATCH'].includes(method)) {
        try {
          parsedBody = JSON.parse(resolvedBody);
        } catch(e) {
          parsedBody = resolvedBody; 
        }
      }

      // 3. Send Request
      const res = await window.api.sendRequest({
        url: resolvedUrl,
        method,
        data: parsedBody
      })
      setResponse(res)

      // 4. Run Tests
      if (testScript.trim() && res) {
        currentPmData.response = res; // Add response for tests
        const testResult = await window.api.executeScript({
          script: testScript,
          pmData: currentPmData
        });
        
        if (testResult.success && testResult.pmData) {
          await syncVarsMapAfterScript(testResult.pmData);
          if (testResult.pmData.tests) {
            setTestResults(testResult.pmData.tests);
            if (testResult.pmData.tests.length > 0) {
              setActiveResponseTab('Tests');
            }
          }
        } else {
          console.error("Test script error:", testResult.error);
        }
      }

    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  const createNewCollection = () => {
    const name = prompt('Collection Name:')
    if (!name) return
    const newCol: ApiCollection = {
      id: Date.now().toString(),
      name,
      folders: [],
      requests: []
    }
    saveCollections([...collections, newCol])
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

  const saveCurrentRequest = () => {
    if (collections.length === 0) {
      alert('Please create a collection first')
      return
    }
    
    const name = prompt('Request Name:', 'New Request')
    if (!name) return

    const req: ApiRequest = {
      id: activeRequestId || Date.now().toString(),
      name,
      method,
      url,
      body,
      preRequestScript,
      testScript,
      headers: [],
      params: []
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

    if (!found) {
      newCollections[0].requests.push(req)
    }

    saveCollections(newCollections)
    setActiveRequestId(req.id)
  }

  const loadRequest = (req: ApiRequest) => {
    setActiveRequestId(req.id)
    setUrl(req.url)
    setMethod(req.method)
    setBody(req.body || '')
    setPreRequestScript(req.preRequestScript || '')
    setTestScript(req.testScript || '')
    setResponse(null)
    setTestResults([])
    setActiveResponseTab('Body')
  }

  return (
    <div className="flex h-screen w-screen bg-[#1e1e1e] text-gray-300 font-sans mt-0">
      {/* Sidebar */}
      <div className="w-64 border-r border-[#333] flex flex-col bg-[#181818]">
        <div className="p-4 pt-8 border-b border-[#333] flex items-center justify-between" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
          <span className="font-semibold text-gray-100 ml-12">Collections</span>
          <div className="flex space-x-2" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            <input type="file" ref={fileInputRef} onChange={handleImport} className="hidden" accept=".json" />
            <Upload size={16} className="cursor-pointer hover:text-white" title="Import Postman" onClick={() => fileInputRef.current?.click()} />
            <Download size={16} className="cursor-pointer hover:text-white" title="Export Collections" onClick={exportCollections} />
            <Plus size={16} className="cursor-pointer hover:text-white" title="New Collection" onClick={createNewCollection} />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {collections.map(col => (
            <div key={col.id} className="mb-2">
              <div 
                className="flex items-center space-x-2 p-2 hover:bg-[#2a2a2a] rounded cursor-pointer text-sm font-semibold"
                onClick={() => toggleCollection(col.id)}
              >
                <Folder size={14} className="text-yellow-500" />
                <span>{col.name}</span>
              </div>
              
              {!collapsedCollections.has(col.id) && (
                <div className="pl-6 space-y-1 mt-1">
                  {col.requests.map(req => (
                    <div 
                      key={req.id} 
                      onClick={() => loadRequest(req)}
                      className={`flex items-center space-x-2 p-1.5 hover:bg-[#2a2a2a] rounded cursor-pointer text-xs ${activeRequestId === req.id ? 'bg-[#2a2a2a] text-blue-400' : 'text-gray-400'}`}
                    >
                      <FileJson size={12} className={
                        req.method === 'GET' ? 'text-green-500' :
                        req.method === 'POST' ? 'text-yellow-500' :
                        req.method === 'DELETE' ? 'text-red-500' : 'text-blue-500'
                      } />
                      <span className="truncate">{req.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {collections.length === 0 && (
            <div className="text-xs text-gray-500 text-center mt-10">No collections found</div>
          )}
        </div>
        <div className="p-4 border-t border-[#333] flex items-center space-x-2 cursor-pointer hover:text-white">
          <Settings size={16} />
          <span className="text-sm">Settings</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header / Top Bar */}
        <div className="p-4 pt-8 border-b border-[#333] flex items-center space-x-2" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
          <select 
            className="bg-[#2a2a2a] border border-[#444] text-gray-100 p-2 outline-none font-semibold w-24 flex-shrink-0"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            value={method}
            onChange={e => setMethod(e.target.value as HttpMethod)}
          >
            <option>GET</option>
            <option>POST</option>
            <option>PUT</option>
            <option>PATCH</option>
            <option>DELETE</option>
          </select>
          <input 
            type="text" 
            className="flex-1 min-w-0 bg-[#1e1e1e] border border-[#444] text-gray-100 p-2 outline-none focus:border-blue-500 transition-colors font-mono text-sm"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            placeholder="Enter request URL e.g. {{baseUrl}}/users"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          
          <div className="flex items-center space-x-2 ml-4 flex-shrink-0" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            <Globe size={16} className="text-gray-400" />
            <select
              className="bg-[#1e1e1e] border border-[#444] text-sm text-gray-100 p-1.5 outline-none cursor-pointer hover:border-gray-500"
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
            onClick={saveCurrentRequest}
            className="bg-[#2a2a2a] border border-[#444] hover:bg-[#333] text-gray-300 px-4 py-2 rounded flex items-center space-x-2 transition-colors focus:outline-none flex-shrink-0"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            title="Save Request"
          >
            <Save size={16} />
          </button>
          <button 
            onClick={sendRequest}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded flex items-center space-x-2 transition-colors focus:outline-none flex-shrink-0"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          >
            {loading ? <span className="animate-pulse">Sending...</span> : <><Send size={16} /><span>Send</span></>}
          </button>
        </div>

        {/* Request Tabs & Editor */}
        <div className="flex-1 flex flex-col border-b border-[#333] h-1/2">
          <div className="flex space-x-6 p-2 px-4 border-b border-[#333] text-sm overflow-x-auto">
            {['Params', 'Headers', 'Body', 'Pre-request', 'Tests'].map(tab => (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`pb-2 border-b-2 transition-colors flex-shrink-0 ${activeTab === tab ? 'border-orange-500 text-white' : 'border-transparent hover:text-gray-100'}`}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="flex-1 min-h-0 bg-[#1e1e1e]">
            {activeTab === 'Body' && (
              <Editor
                height="100%"
                defaultLanguage="json"
                theme="vs-dark"
                value={body}
                onChange={(val) => setBody(val || '')}
                options={{ minimap: { enabled: false }, fontSize: 13 }}
              />
            )}
            {activeTab === 'Pre-request' && (
              <Editor
                height="100%"
                defaultLanguage="javascript"
                theme="vs-dark"
                value={preRequestScript}
                onChange={(val) => setPreRequestScript(val || '')}
                options={{ minimap: { enabled: false }, fontSize: 13 }}
              />
            )}
            {activeTab === 'Tests' && (
              <Editor
                height="100%"
                defaultLanguage="javascript"
                theme="vs-dark"
                value={testScript}
                onChange={(val) => setTestScript(val || '')}
                options={{ minimap: { enabled: false }, fontSize: 13 }}
              />
            )}
            {!['Body', 'Pre-request', 'Tests'].includes(activeTab) && (
              <div className="p-4 text-gray-500 italic text-sm">
                {activeTab} editor coming soon...
              </div>
            )}
          </div>
        </div>

        {/* Response Area */}
        <div className="flex-1 flex flex-col h-1/2 min-h-0 bg-[#1e1e1e]">
          <div className="flex items-center justify-between p-2 px-4 border-b border-[#333] text-sm flex-shrink-0">
            <div className="flex space-x-4">
              <button 
                onClick={() => setActiveResponseTab('Body')}
                className={`pb-1 border-b-2 transition-colors ${activeResponseTab === 'Body' ? 'border-orange-500 text-white' : 'border-transparent hover:text-gray-100'}`}
              >
                Body
              </button>
              <button 
                onClick={() => setActiveResponseTab('Tests')}
                className={`pb-1 border-b-2 transition-colors ${activeResponseTab === 'Tests' ? 'border-orange-500 text-white' : 'border-transparent hover:text-gray-100'}`}
              >
                Test Results ({testResults.length})
              </button>
            </div>
            
            {response && (
              <div className="flex space-x-4 text-xs">
                <span className={`font-mono font-bold ${response.status >= 200 && response.status < 300 ? 'text-green-500' : 'text-red-500'}`}>Status: {response.status} {response.statusText}</span>
                <span className="font-mono text-blue-400">Time: {response.time} ms</span>
                <span className="font-mono text-gray-400">Size: {response.size} B</span>
              </div>
            )}
          </div>
          <div className="flex-1 min-h-0 relative">
            {!response && testResults.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                Enter a URL and click Send to get a response
              </div>
            ) : response?.error ? (
              <div className="p-4 text-red-500 font-mono text-sm">
                Error: {response.error}
              </div>
            ) : activeResponseTab === 'Body' && response ? (
              <Editor
                height="100%"
                defaultLanguage="json"
                theme="vs-dark"
                value={typeof response.data === 'object' ? JSON.stringify(response.data, null, 2) : response.data}
                options={{ readOnly: true, minimap: { enabled: false }, fontSize: 13, wordWrap: 'on' }}
              />
            ) : activeResponseTab === 'Tests' ? (
              <div className="p-4 space-y-2 overflow-y-auto h-full text-sm">
                {testResults.map((t, idx) => (
                  <div key={idx} className={`p-2 rounded border ${t.status === 'pass' ? 'border-green-800 bg-green-900/20 text-green-400' : 'border-red-800 bg-red-900/20 text-red-400'}`}>
                    <div className="font-semibold">{t.status === 'pass' ? 'PASS' : 'FAIL'} | {t.name}</div>
                    {t.error && <div className="text-xs mt-1 font-mono">{t.error}</div>}
                  </div>
                ))}
                {testResults.length === 0 && (
                  <div className="text-gray-500 italic">No tests found.</div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

export default App

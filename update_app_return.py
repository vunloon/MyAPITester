import sys

with open('src/App.tsx', 'r') as f:
    content = f.read()

search_str = '  return (\n    <div className="flex h-screen w-screen bg-bg-surface text-text-secondary font-sans mt-0">'
start_idx = content.find(search_str)

if start_idx == -1:
    # Try different newline combinations just in case
    search_str = '  return (\n    <div className="flex h-screen w-screen bg-bg-surface text-text-secondary font-sans mt-0">'
    start_idx = content.find('  return (\n    <div className="flex h-screen w-screen bg-bg-surface')
    if start_idx == -1:
        print("Could not find the specific return block")
        sys.exit(1)

new_return = """  return (
    <div className="flex h-screen w-screen bg-transparent text-text-secondary font-sans p-4 gap-4 overflow-hidden box-border">
      
      {/* Main Content (Left Side) */}
      <div className="flex-1 flex flex-col min-w-0 bg-[var(--panel-bg)] border border-[var(--panel-border)] backdrop-blur-2xl rounded-2xl shadow-2xl overflow-hidden">
        
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
               body: '{\\n  \\n}',
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
          <div className="flex-1 flex flex-col min-h-0">
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
            <div className="flex-1 flex flex-col min-h-0 border-b border-[var(--panel-border)]">
              <div className="flex space-x-6 px-6 pt-3 border-b border-[var(--panel-border)] text-sm font-medium">
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
              <div className="flex-1 min-h-0 bg-black/10">
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
                    options={{ minimap: { enabled: false }, fontSize: 13, background: 'transparent' }}
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

            {/* Response Area */}
            <div className="h-1/3 flex flex-col min-h-[200px] bg-black/5">
              <div className="flex items-center justify-between px-6 border-b border-[var(--panel-border)] text-sm font-medium">
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
                const newTab: OpenTab = { id: 'temp-' + Date.now(), name: 'New Request', method: 'GET', url: '', body: '{\\n  \\n}', preRequestScript: '', testScript: '', headers: [], params: [], response: null, testResults: [], activeEditorTab: 'Body', activeResponseTab: 'Body', isDirty: false, loading: false };
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

      {/* Sidebar (Right Side) */}
      <div className="w-80 flex flex-col bg-[var(--panel-bg)] border border-[var(--panel-border)] backdrop-blur-2xl rounded-2xl shadow-2xl overflow-hidden flex-shrink-0">
        <div className="p-5 border-b border-[var(--panel-border)] flex items-center justify-between bg-black/10">
          <span className="font-bold text-text-primary text-lg">Collections</span>
          <div className="flex space-x-3 text-text-tertiary">
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
                className="group flex items-center justify-between p-3 hover:bg-white/5 rounded-xl cursor-pointer text-sm font-semibold transition-colors border border-transparent hover:border-[var(--panel-border)]"
                onClick={() => toggleCollection(col.id)}
              >
                <div className="flex items-center space-x-3 truncate">
                  <Folder size={16} className="text-[var(--accent)] flex-shrink-0" />
                  <span className="truncate">{col.name}</span>
                </div>
                <div className="hidden group-hover:flex items-center space-x-2 flex-shrink-0 text-text-tertiary">
                  <span title="Add Request" className="flex items-center justify-center cursor-pointer hover:text-[var(--accent)] bg-black/20 p-1.5 rounded-md transition-colors" onClick={(e) => addNewRequestToCollection(e, col.id)}>
                    <Plus size={14} />
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
                      onClick={() => loadRequest(req)}
                      className={`group flex items-center justify-between p-2 rounded-lg cursor-pointer text-sm transition-all border ${activeTabId === req.id ? 'bg-[var(--accent)]/10 border-[var(--accent)]/30 text-text-primary' : 'border-transparent text-text-tertiary hover:bg-white/5 hover:text-text-primary'}`}
                    >
                      <div className="flex items-center space-x-3 truncate">
                        <span className={`text-[10px] font-bold w-10 ${
                          req.method === 'GET' ? 'text-green-400' :
                          req.method === 'POST' ? 'text-yellow-400' :
                          req.method === 'DELETE' ? 'text-red-400' : 'text-blue-400'
                        }`}>{req.method}</span>
                        <span className="truncate">{req.name}</span>
                      </div>
                      <div className="hidden group-hover:flex items-center flex-shrink-0">
                        <span title="Delete Request" className="flex items-center justify-center cursor-pointer text-text-tertiary hover:text-red-400 p-1 transition-colors" onClick={(e) => deleteRequest(e, col.id, req.id)}>
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
"""

with open('src/App.tsx', 'w') as f:
    f.write(content[:start_idx] + new_return)

import React, { useState } from 'react';
import { X, Globe, Download, Loader2, CheckSquare, Square, AlertCircle, Zap } from 'lucide-react';
import type { ApiCollection, ApiRequest } from './types';
import {
  detectContentType,
  parseCxfListing,
  parseOpenApi,
  parseWadl,
  parseWsdl,
  type DiscoveredService,
  type ContentType
} from './utils/serviceImporter';

interface ImportFromUrlDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (collections: ApiCollection[]) => void;
  sendRequest: (config: any) => Promise<any>;
}

type Step = 'input' | 'services' | 'importing' | 'done' | 'error';

export function ImportFromUrlDialog({ isOpen, onClose, onImport, sendRequest }: ImportFromUrlDialogProps) {
  const [url, setUrl] = useState('');
  const [step, setStep] = useState<Step>('input');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [services, setServices] = useState<DiscoveredService[]>([]);
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());
  const [detectedType, setDetectedType] = useState<ContentType>('unknown');
  const [importProgress, setImportProgress] = useState('');
  const [importedCount, setImportedCount] = useState(0);

  if (!isOpen) return null;

  const resetState = () => {
    setUrl('');
    setStep('input');
    setLoading(false);
    setError('');
    setServices([]);
    setSelectedServices(new Set());
    setDetectedType('unknown');
    setImportProgress('');
    setImportedCount(0);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const fetchUrl = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError('');

    try {
      const res = await sendRequest({
        url: url.trim(),
        method: 'GET',
        headers: { 'Accept': 'text/html, application/xml, application/json, */*' }
      });

      if (res.error && res.status === 0) {
        throw new Error(res.data || res.error || 'Failed to fetch URL');
      }

      const responseText = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
      const contentType = detectContentType(responseText, url.trim());
      setDetectedType(contentType);

      if (contentType === 'cxf-listing') {
        const discovered = parseCxfListing(responseText, url.trim());
        if (discovered.length === 0) {
          throw new Error('No services found on this page. Make sure the URL points to a CXF service listing page.');
        }
        setServices(discovered);
        setSelectedServices(new Set(discovered.map(s => s.name)));
        setStep('services');
      } else if (contentType === 'openapi') {
        const data = typeof res.data === 'object' ? res.data : JSON.parse(responseText);
        const serviceName = data.info?.title || extractServiceName(url.trim());
        const requests = parseOpenApi(data, serviceName, url.trim());
        importDirectly(serviceName, requests);
      } else if (contentType === 'wadl') {
        const serviceName = extractServiceName(url.trim());
        const requests = parseWadl(responseText, serviceName);
        importDirectly(serviceName, requests);
      } else if (contentType === 'wsdl') {
        const serviceName = extractServiceName(url.trim());
        const requests = parseWsdl(responseText, serviceName);
        importDirectly(serviceName, requests);
      } else {
        throw new Error('Could not detect the format of this URL. Supported formats: CXF service listing, WSDL, WADL, OpenAPI/Swagger JSON');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch URL');
      setStep('error');
    } finally {
      setLoading(false);
    }
  };

  const importDirectly = (serviceName: string, requests: ApiRequest[]) => {
    if (requests.length === 0) {
      setError('No operations found in the service definition.');
      setStep('error');
      return;
    }
    const collection: ApiCollection = {
      id: Date.now().toString(),
      name: serviceName,
      folders: [],
      requests
    };
    onImport([collection]);
    setImportedCount(requests.length);
    setStep('done');
  };

  const extractServiceName = (url: string): string => {
    try {
      const urlObj = new URL(url);
      const parts = urlObj.pathname.split('/').filter(Boolean);
      // Remove known suffixes
      const cleaned = parts.filter(p => !['cxf', 'openapi.json'].includes(p));
      return cleaned[cleaned.length - 1]?.replace(/\?.*$/, '') || 'Imported Service';
    } catch {
      return 'Imported Service';
    }
  };

  const toggleService = (name: string) => {
    setSelectedServices(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedServices.size === services.length) {
      setSelectedServices(new Set());
    } else {
      setSelectedServices(new Set(services.map(s => s.name)));
    }
  };

  const importSelected = async () => {
    const toImport = services.filter(s => selectedServices.has(s.name));
    if (toImport.length === 0) return;

    setStep('importing');
    setLoading(true);
    const collections: ApiCollection[] = [];
    let totalOps = 0;

    for (let i = 0; i < toImport.length; i++) {
      const svc = toImport[i];
      setImportProgress(`Importing ${svc.name} (${i + 1}/${toImport.length})...`);

      try {
        // Prefer OpenAPI > WADL > WSDL
        const specUrl = svc.openApiUrl || svc.wadlUrl || svc.wsdlUrl;
        if (!specUrl) continue;

        const res = await sendRequest({
          url: specUrl,
          method: 'GET',
          headers: { 'Accept': 'application/json, application/xml, text/xml, */*' }
        });

        if (res.error && res.status === 0) continue;

        const responseText = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
        let requests: ApiRequest[] = [];

        if (svc.openApiUrl && specUrl === svc.openApiUrl) {
          const data = typeof res.data === 'object' ? res.data : JSON.parse(responseText);
          requests = parseOpenApi(data, svc.name, specUrl);
        } else if (svc.wadlUrl && specUrl === svc.wadlUrl) {
          requests = parseWadl(responseText, svc.name);
        } else if (svc.wsdlUrl && specUrl === svc.wsdlUrl) {
          requests = parseWsdl(responseText, svc.name);
        }

        if (requests.length > 0) {
          totalOps += requests.length;
          collections.push({
            id: Date.now().toString() + Math.random().toString(36).substring(7),
            name: svc.name,
            folders: [],
            requests
          });
        }
      } catch (err) {
        console.error(`Failed to import ${svc.name}:`, err);
      }
    }

    if (collections.length > 0) {
      onImport(collections);
    }

    setImportedCount(totalOps);
    setStep('done');
    setLoading(false);
  };

  const getTypeLabel = (type: ContentType): string => {
    switch (type) {
      case 'cxf-listing': return 'CXF Service Listing';
      case 'wsdl': return 'WSDL (SOAP)';
      case 'wadl': return 'WADL (REST)';
      case 'openapi': return 'OpenAPI / Swagger';
      default: return 'Unknown';
    }
  };

  const getTypeBadgeColor = (type: string): string => {
    switch (type) {
      case 'soap': return 'text-orange-400 bg-orange-400/10 border-orange-400/30';
      case 'rest': return 'text-green-400 bg-green-400/10 border-green-400/30';
      default: return 'text-blue-400 bg-blue-400/10 border-blue-400/30';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
      <div className="w-[700px] max-h-[80vh] bg-[var(--panel-bg)] border border-[var(--panel-border)] rounded-2xl shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--panel-border)] bg-black/10">
          <div className="flex items-center space-x-2 text-text-primary font-bold">
            <Download size={18} className="text-[var(--accent)]" />
            <span>Import from URL</span>
          </div>
          <button onClick={handleClose} className="text-text-tertiary hover:text-text-primary transition-colors p-1 rounded-md hover:bg-white/10">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col overflow-hidden p-5 space-y-4">

          {/* URL Input - always visible */}
          <div className="flex items-center space-x-3">
            <div className="flex-1 flex items-center bg-black/20 rounded-xl border border-[var(--panel-border)] overflow-hidden focus-within:border-[var(--accent)] transition-colors">
              <div className="px-3 text-text-tertiary">
                <Globe size={16} />
              </div>
              <input
                type="text"
                className="flex-1 bg-transparent text-text-primary p-3 outline-none font-mono text-sm"
                placeholder="Enter service URL (CXF listing, WSDL, WADL, or OpenAPI)"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !loading) fetchUrl(); }}
                disabled={loading}
              />
            </div>
            <button
              onClick={fetchUrl}
              disabled={loading || !url.trim()}
              className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white px-5 py-3 rounded-xl flex items-center space-x-2 transition-all shadow-lg hover:shadow-[var(--accent)]/50 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-sm"
            >
              {loading && step === 'input' ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Zap size={16} />
              )}
              <span>Fetch</span>
            </button>
          </div>

          {/* Detected type badge */}
          {detectedType !== 'unknown' && step !== 'input' && step !== 'error' && (
            <div className="flex items-center space-x-2 text-xs">
              <span className="text-text-tertiary">Detected:</span>
              <span className="px-2 py-1 rounded-full bg-[var(--accent)]/10 border border-[var(--accent)]/30 text-[var(--accent)] font-medium">
                {getTypeLabel(detectedType)}
              </span>
            </div>
          )}

          {/* Error State */}
          {step === 'error' && (
            <div className="flex items-start space-x-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-sm">
              <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold mb-1">Import Failed</div>
                <div className="text-red-400/80">{error}</div>
              </div>
            </div>
          )}

          {/* Service List */}
          {step === 'services' && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-text-secondary">
                  Found {services.length} service{services.length !== 1 ? 's' : ''}
                </span>
                <button
                  onClick={toggleAll}
                  className="text-xs text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors font-medium"
                >
                  {selectedServices.size === services.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-1 max-h-[40vh] pr-1">
                {services.map(svc => (
                  <div
                    key={svc.name}
                    onClick={() => toggleService(svc.name)}
                    className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all border ${
                      selectedServices.has(svc.name)
                        ? 'bg-[var(--accent)]/5 border-[var(--accent)]/20'
                        : 'border-transparent hover:bg-white/5 hover:border-[var(--panel-border)]'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      {selectedServices.has(svc.name) ? (
                        <CheckSquare size={18} className="text-[var(--accent)]" />
                      ) : (
                        <Square size={18} className="text-text-tertiary" />
                      )}
                      <span className="text-sm font-medium text-text-primary">{svc.name}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${getTypeBadgeColor(svc.type)}`}>
                        {svc.type}
                      </span>
                      {svc.openApiUrl && <span className="text-[10px] text-text-tertiary bg-black/20 px-1.5 py-0.5 rounded">OpenAPI</span>}
                      {svc.wadlUrl && <span className="text-[10px] text-text-tertiary bg-black/20 px-1.5 py-0.5 rounded">WADL</span>}
                      {svc.wsdlUrl && <span className="text-[10px] text-text-tertiary bg-black/20 px-1.5 py-0.5 rounded">WSDL</span>}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Importing Progress */}
          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 size={32} className="animate-spin text-[var(--accent)]" />
              <div className="text-sm text-text-secondary">{importProgress}</div>
            </div>
          )}

          {/* Done State */}
          {step === 'done' && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center">
                <Download size={28} className="text-green-400" />
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-text-primary">Import Complete!</div>
                <div className="text-sm text-text-tertiary mt-1">
                  Imported {importedCount} operation{importedCount !== 1 ? 's' : ''} successfully
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--panel-border)] bg-black/10 flex justify-end space-x-3">
          {step === 'done' ? (
            <button
              onClick={handleClose}
              className="px-6 py-2 text-sm font-bold bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg transition-colors shadow-lg"
            >
              Close
            </button>
          ) : (
            <>
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-white/5 rounded-lg transition-colors"
              >
                Cancel
              </button>
              {step === 'services' && (
                <button
                  onClick={importSelected}
                  disabled={selectedServices.size === 0}
                  className="px-6 py-2 text-sm font-bold bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg transition-colors shadow-lg hover:shadow-[var(--accent)]/50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Import {selectedServices.size} Service{selectedServices.size !== 1 ? 's' : ''}
                </button>
              )}
              {step === 'error' && (
                <button
                  onClick={() => { setStep('input'); setError(''); }}
                  className="px-6 py-2 text-sm font-bold bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-lg transition-colors shadow-lg"
                >
                  Try Again
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

import type { ApiCollection, ApiRequest } from '../types';

export function parseHttpFile(content: string, filename: string): ApiCollection {
  const collection: ApiCollection = {
    id: 'http_' + Date.now().toString(),
    name: filename.replace(/\.(http|rest)$/i, ''),
    folders: [],
    requests: []
  };

  // Split content by '###'
  // But wait, what if '###' is inside the body? In IntelliJ, '###' at the beginning of a line starts a new request.
  const blocks = content.split(/^###/m).map(b => b.trim()).filter(b => b.length > 0);

  for (const block of blocks) {
    const lines = block.split('\n');
    let requestName = '';
    
    // First line of block might be the name if it was like '### Request Name'
    // Actually, when we split by /^###/m, the text immediately following '###' is on the first line.
    // Let's re-parse that carefully. If we just split by '###', the first line might contain the name.
    
    let method = 'GET';
    let url = '';
    let headers: { key: string, value: string, active: boolean }[] = [];
    let bodyLines: string[] = [];
    let scriptContent = '';
    
    let state = 'name'; // name -> request_line -> headers -> body
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      // Skip comments starting with // or # unless in body
      if (state !== 'body' && (trimmedLine.startsWith('//') || trimmedLine.startsWith('#'))) {
        if (state === 'name' && i === 0 && !trimmedLine.startsWith('//')) {
           // wait, if we split by '###', the first line might just be the request name text
           requestName = trimmedLine;
        }
        continue;
      }
      
      if (state === 'name') {
         if (i === 0 && !trimmedLine.match(/^(GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD|TRACE|CONNECT)\s/)) {
            requestName = trimmedLine;
            state = 'request_line';
            continue;
         }
         state = 'request_line';
      }

      if (state === 'request_line') {
        if (!trimmedLine) continue; // Skip empty lines before request line
        
        const parts = trimmedLine.split(/\s+/);
        const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD', 'TRACE', 'CONNECT'];
        
        if (methods.includes(parts[0].toUpperCase())) {
          method = parts[0].toUpperCase();
          url = parts.slice(1).join(' ');
        } else {
          // If no method specified, default to GET
          method = 'GET';
          url = trimmedLine;
        }
        state = 'headers';
        continue;
      }

      if (state === 'headers') {
        if (!trimmedLine) {
          // Empty line indicates end of headers, start of body
          state = 'body';
          continue;
        }
        
        const colonIndex = line.indexOf(':');
        if (colonIndex !== -1) {
          const key = line.substring(0, colonIndex).trim();
          const value = line.substring(colonIndex + 1).trim();
          headers.push({ key, value, active: true });
        }
        continue;
      }

      if (state === 'body') {
        bodyLines.push(line);
      }
    }
    
    // Extract script blocks from body
    // Scripts are inside `> {% ... %}`
    let finalBody = bodyLines.join('\n');
    const scriptMatch = finalBody.match(/>\s*{%([\s\S]*?)%}/);
    if (scriptMatch) {
      scriptContent = scriptMatch[1].trim();
      finalBody = finalBody.replace(scriptMatch[0], '').trim();
    }

    if (!url) continue;

    if (!requestName) {
      // Use URL as name if no name was provided
      try {
        const urlObj = new URL(url.replace(/{{.*?}}/g, 'VAR'));
        requestName = urlObj.pathname.split('/').pop() || urlObj.pathname || 'Request';
      } catch {
        requestName = url || 'Request';
      }
    }

    const req: ApiRequest = {
      id: Date.now().toString() + Math.random().toString(36).substring(7),
      name: requestName,
      method: method as any,
      url: url,
      body: finalBody,
      headers: headers,
      params: [], // We don't parse params from URL here, keep it simple
      preRequestScript: '',
      testScript: scriptContent
    };

    collection.requests.push(req);
  }

  return collection;
}

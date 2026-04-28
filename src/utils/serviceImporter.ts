import type { ApiRequest } from '../types';

export interface DiscoveredService {
  name: string;
  wadlUrl?: string;
  openApiUrl?: string;
  wsdlUrl?: string;
  type: 'rest' | 'soap';
}

export type ContentType = 'cxf-listing' | 'wsdl' | 'wadl' | 'openapi' | 'unknown';

export function detectContentType(text: string, url: string): ContentType {
  const trimmed = text.trim();

  // JSON → OpenAPI
  if (trimmed.startsWith('{')) {
    try {
      const json = JSON.parse(trimmed);
      if (json.openapi || json.swagger || json.paths) return 'openapi';
    } catch { /* not JSON */ }
  }

  // XML-based detection
  if (trimmed.includes('<wsdl:definitions') || trimmed.includes('<definitions') || trimmed.includes('schemas.xmlsoap.org/wsdl')) {
    return 'wsdl';
  }
  if (trimmed.includes('<application') && trimmed.includes('wadl.dev.java.net')) {
    return 'wadl';
  }

  // HTML with CXF listing indicators
  if (trimmed.includes('?_wadl') || trimmed.includes('?wsdl') || trimmed.includes('/openapi.json') || trimmed.includes('Available')) {
    return 'cxf-listing';
  }

  // URL-based fallback
  if (url.includes('?wsdl')) return 'wsdl';
  if (url.includes('?_wadl')) return 'wadl';
  if (url.endsWith('openapi.json') || url.endsWith('swagger.json')) return 'openapi';

  return 'unknown';
}

export function parseCxfListing(html: string, sourceUrl: string): DiscoveredService[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const links = doc.querySelectorAll('a[href]');

  const serviceMap = new Map<string, DiscoveredService>();

  // Derive base URL from source
  const urlObj = new URL(sourceUrl);
  const base = `${urlObj.protocol}//${urlObj.host}`;

  links.forEach(link => {
    const href = link.getAttribute('href') || '';
    const fullUrl = href.startsWith('http') ? href : `${base}${href}`;

    let serviceName = '';

    if (href.includes('?_wadl')) {
      const match = href.match(/\/cxf\/(.+?)\?_wadl/);
      if (match) serviceName = match[1];
      if (serviceName) {
        const existing = serviceMap.get(serviceName) || { name: serviceName, type: 'rest' as const };
        existing.wadlUrl = fullUrl;
        serviceMap.set(serviceName, existing);
      }
    } else if (href.includes('/openapi.json')) {
      const match = href.match(/\/cxf\/(.+?)\/openapi\.json/);
      if (match) serviceName = match[1];
      if (serviceName) {
        const existing = serviceMap.get(serviceName) || { name: serviceName, type: 'rest' as const };
        existing.openApiUrl = fullUrl;
        serviceMap.set(serviceName, existing);
      }
    } else if (href.includes('?wsdl')) {
      const match = href.match(/\/cxf\/(.+?)\?wsdl/);
      if (match) serviceName = match[1];
      if (serviceName) {
        const existing = serviceMap.get(serviceName) || { name: serviceName, type: 'soap' as const };
        existing.wsdlUrl = fullUrl;
        serviceMap.set(serviceName, existing);
      }
    }
  });

  return Array.from(serviceMap.values());
}

export function parseOpenApi(data: any, _serviceName: string, sourceUrl: string): ApiRequest[] {
  const spec = typeof data === 'string' ? JSON.parse(data) : data;
  const requests: ApiRequest[] = [];

  // Determine base URL
  let baseUrl = '';
  if (spec.servers && spec.servers.length > 0) {
    baseUrl = spec.servers[0].url;
  } else if (spec.host) {
    // Swagger 2.0
    const scheme = spec.schemes?.[0] || 'https';
    baseUrl = `${scheme}://${spec.host}${spec.basePath || ''}`;
  }
  if (!baseUrl) {
    // Derive from source URL
    const urlObj = new URL(sourceUrl);
    baseUrl = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname.replace(/\/openapi\.json$/, '')}`;
  }
  // Remove trailing slash
  baseUrl = baseUrl.replace(/\/$/, '');

  const paths = spec.paths || {};
  for (const [path, methods] of Object.entries(paths)) {
    const methodsObj = methods as Record<string, any>;
    for (const [method, operation] of Object.entries(methodsObj)) {
      if (['get', 'post', 'put', 'patch', 'delete', 'options', 'head'].indexOf(method.toLowerCase()) === -1) continue;

      const op = operation as any;
      const opName = op.operationId || op.summary || `${method.toUpperCase()} ${path}`;
      const httpMethod = method.toUpperCase() as any;

      // Build headers from parameters
      const headers: Array<{ key: string; value: string; active: boolean }> = [];
      const params: Array<{ key: string; value: string; active: boolean }> = [];

      if (op.parameters) {
        for (const param of op.parameters) {
          if (param.in === 'header') {
            headers.push({ key: param.name, value: '', active: true });
          } else if (param.in === 'query') {
            params.push({ key: param.name, value: '', active: false });
          }
        }
      }

      // Add Content-Type for methods with body
      if (['POST', 'PUT', 'PATCH'].includes(httpMethod) && op.requestBody) {
        const contentTypes = Object.keys(op.requestBody?.content || {});
        if (contentTypes.length > 0 && !headers.find(h => h.key.toLowerCase() === 'content-type')) {
          headers.push({ key: 'Content-Type', value: contentTypes[0], active: true });
        }
      }

      // Generate body template from schema
      let body = '{\n  \n}';
      if (op.requestBody?.content) {
        const contentType = Object.keys(op.requestBody.content)[0];
        const schema = op.requestBody.content[contentType]?.schema;
        if (schema && contentType?.includes('json')) {
          body = JSON.stringify(generateBodyFromSchema(schema, spec), null, 2);
        } else if (schema && contentType?.includes('xml')) {
          body = generateXmlBodyFromSchema(schema, spec);
        }
      }

      // Build URL with query params
      let fullUrl = `${baseUrl}${path}`;

      requests.push({
        id: Date.now().toString() + Math.random().toString(36).substring(7),
        name: `${opName}`,
        method: httpMethod,
        url: fullUrl,
        body,
        headers,
        params,
        preRequestScript: '',
        testScript: ''
      });
    }
  }

  return requests;
}

export function parseWadl(xml: string, _serviceName: string): ApiRequest[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');
  const requests: ApiRequest[] = [];

  // Get base URL from <resources> element
  const resourcesEl = doc.querySelector('resources');
  const baseUrl = resourcesEl?.getAttribute('base') || '';

  // Find all resource elements
  const resources = doc.querySelectorAll('resource');
  resources.forEach(resource => {
    const path = resource.getAttribute('path') || '';
    const methods = resource.querySelectorAll(':scope > method');

    methods.forEach(method => {
      const httpMethod = (method.getAttribute('name') || 'GET').toUpperCase() as any;
      const methodId = method.getAttribute('id') || `${httpMethod} ${path}`;

      const headers: Array<{ key: string; value: string; active: boolean }> = [];
      const params: Array<{ key: string; value: string; active: boolean }> = [];

      // Extract parameters
      const reqParams = method.querySelectorAll('request param');
      reqParams.forEach(param => {
        const style = param.getAttribute('style');
        const name = param.getAttribute('name') || '';
        if (style === 'query') {
          params.push({ key: name, value: '', active: false });
        } else if (style === 'header') {
          headers.push({ key: name, value: '', active: true });
        }
      });

      // Check for JSON representation
      const representations = method.querySelectorAll('request representation');
      let hasJsonBody = false;
      representations.forEach(rep => {
        const mediaType = rep.getAttribute('mediaType') || '';
        if (mediaType.includes('json')) hasJsonBody = true;
      });

      if (['POST', 'PUT', 'PATCH'].includes(httpMethod) && hasJsonBody) {
        if (!headers.find(h => h.key.toLowerCase() === 'content-type')) {
          headers.push({ key: 'Content-Type', value: 'application/json', active: true });
        }
      }

      const fullUrl = `${baseUrl}${path === '/' ? '' : path}`;

      requests.push({
        id: Date.now().toString() + Math.random().toString(36).substring(7),
        name: methodId,
        method: httpMethod,
        url: fullUrl,
        body: '{\n  \n}',
        headers,
        params,
        preRequestScript: '',
        testScript: ''
      });
    });
  });

  return requests;
}

export function parseWsdl(xml: string, _serviceName: string): ApiRequest[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');
  const requests: ApiRequest[] = [];

  // Get target namespace
  const defs = doc.documentElement;
  const targetNamespace = defs.getAttribute('targetNamespace') || '';

  // Find service endpoint URL
  let endpointUrl = '';
  const addressEls = doc.querySelectorAll('[location]');
  addressEls.forEach(el => {
    const loc = el.getAttribute('location');
    if (loc && loc.startsWith('http')) {
      endpointUrl = loc;
    }
  });

  // Also try soap:address
  const allEls = doc.getElementsByTagNameNS('*', 'address');
  for (let i = 0; i < allEls.length; i++) {
    const loc = allEls[i].getAttribute('location');
    if (loc && loc.startsWith('http')) {
      endpointUrl = loc;
      break;
    }
  }

  // Find operations from portType
  const operations = doc.getElementsByTagNameNS('*', 'operation');
  const seenOps = new Set<string>();

  // Find binding operations for SOAPAction
  const soapActions = new Map<string, string>();
  // Iterate all operations to find SOAPAction values from binding operations
  for (let i = 0; i < operations.length; i++) {
    const op = operations[i];
    const opName = op.getAttribute('name');
    if (!opName) continue;

    // Look for soap:operation inside binding operations
    const soapOp = op.getElementsByTagNameNS('*', 'operation');
    for (let j = 0; j < soapOp.length; j++) {
      const action = soapOp[j].getAttribute('soapAction');
      if (action && opName) {
        soapActions.set(opName, action);
      }
    }
  }

  // Extract operations from portType
  const portTypes = doc.getElementsByTagNameNS('*', 'portType');
  for (let i = 0; i < portTypes.length; i++) {
    const ops = portTypes[i].getElementsByTagNameNS('*', 'operation');
    for (let j = 0; j < ops.length; j++) {
      const opName = ops[j].getAttribute('name');
      if (!opName || seenOps.has(opName)) continue;
      seenOps.add(opName);

      // Try to extract input message element for body template
      const inputEl = ops[j].getElementsByTagNameNS('*', 'input')[0];
      const inputMessage = inputEl?.getAttribute('message')?.split(':').pop() || '';

      // Build SOAP body template
      const soapAction = soapActions.get(opName) || `${targetNamespace}/${opName}`;
      const body = buildSoapEnvelope(opName, targetNamespace, inputMessage, doc);

      const headers: Array<{ key: string; value: string; active: boolean }> = [
        { key: 'Content-Type', value: 'text/xml; charset=utf-8', active: true },
        { key: 'SOAPAction', value: soapAction, active: true }
      ];

      requests.push({
        id: Date.now().toString() + Math.random().toString(36).substring(7),
        name: opName,
        method: 'POST',
        url: endpointUrl,
        body,
        headers,
        params: [],
        preRequestScript: '',
        testScript: ''
      });
    }
  }

  return requests;
}

function buildSoapEnvelope(opName: string, tns: string, inputMessage: string, doc: Document): string {
  // Try to find the message parts and schema elements
  let bodyContent = `    <tns:${opName}>\n      <!-- Add parameters here -->\n    </tns:${opName}>`;

  // Look up message definition
  const messages = doc.getElementsByTagNameNS('*', 'message');
  for (let i = 0; i < messages.length; i++) {
    const msgName = messages[i].getAttribute('name');
    if (msgName === inputMessage) {
      const parts = messages[i].getElementsByTagNameNS('*', 'part');
      if (parts.length > 0) {
        const elementRef = parts[0].getAttribute('element')?.split(':').pop();
        if (elementRef) {
          // Try to find the element in types/schema
          const schemaElements = doc.getElementsByTagNameNS('*', 'element');
          for (let j = 0; j < schemaElements.length; j++) {
            if (schemaElements[j].getAttribute('name') === elementRef) {
              bodyContent = buildXmlFromSchemaElement(schemaElements[j], tns, 3);
              break;
            }
          }
        }
      }
      break;
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:tns="${tns}">
  <soap:Header/>
  <soap:Body>
${bodyContent}
  </soap:Body>
</soap:Envelope>`;
}

function buildXmlFromSchemaElement(element: Element, _tns: string, indent: number): string {
  const name = element.getAttribute('name') || 'unknown';
  const spaces = ' '.repeat(indent * 2);

  // Check for complexType children
  const complexType = element.getElementsByTagNameNS('*', 'complexType')[0];
  if (!complexType) {
    return `${spaces}<tns:${name}>?</tns:${name}>`;
  }

  const sequences = complexType.getElementsByTagNameNS('*', 'sequence');
  if (sequences.length === 0) {
    return `${spaces}<tns:${name}/>`;
  }

  const children = sequences[0].getElementsByTagNameNS('*', 'element');
  let childXml = '';
  for (let i = 0; i < children.length; i++) {
    // Only process direct children of the first sequence
    if (children[i].parentElement !== sequences[0]) continue;
    const childName = children[i].getAttribute('name') || '';
    const childType = children[i].getAttribute('type')?.split(':').pop() || '';
    const placeholder = getXsdPlaceholder(childType);
    childXml += `${spaces}  <tns:${childName}>${placeholder}</tns:${childName}>\n`;
  }

  return `${spaces}<tns:${name}>\n${childXml}${spaces}</tns:${name}>`;
}

function getXsdPlaceholder(type: string): string {
  switch (type) {
    case 'string': return '?';
    case 'int': case 'integer': case 'long': case 'short': return '0';
    case 'decimal': case 'double': case 'float': return '0.0';
    case 'boolean': return 'false';
    case 'date': return '2024-01-01';
    case 'dateTime': return '2024-01-01T00:00:00';
    default: return '?';
  }
}

function generateBodyFromSchema(schema: any, spec: any, depth: number = 0): any {
  if (depth > 5) return {};
  if (!schema) return {};

  // Resolve $ref
  if (schema.$ref) {
    const refPath = schema.$ref.replace('#/', '').split('/');
    let resolved = spec;
    for (const part of refPath) {
      resolved = resolved?.[part];
    }
    return generateBodyFromSchema(resolved, spec, depth + 1);
  }

  if (schema.type === 'object' || schema.properties) {
    const obj: Record<string, any> = {};
    const props = schema.properties || {};
    for (const [key, propSchema] of Object.entries(props)) {
      obj[key] = generateBodyFromSchema(propSchema as any, spec, depth + 1);
    }
    return obj;
  }

  if (schema.type === 'array') {
    return [generateBodyFromSchema(schema.items, spec, depth + 1)];
  }

  // Primitives
  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;
  if (schema.enum && schema.enum.length > 0) return schema.enum[0];

  switch (schema.type) {
    case 'string': return schema.format === 'date' ? '2024-01-01' : schema.format === 'date-time' ? '2024-01-01T00:00:00Z' : '';
    case 'number': case 'integer': return 0;
    case 'boolean': return false;
    default: return null;
  }
}

function generateXmlBodyFromSchema(schema: any, spec: any): string {
  // Basic XML body generation for XML content types
  const body = generateBodyFromSchema(schema, spec);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<request>\n${jsonToXml(body, 1)}</request>`;
}

function jsonToXml(obj: any, indent: number): string {
  if (obj === null || obj === undefined) return '';
  const spaces = '  '.repeat(indent);
  let xml = '';
  if (typeof obj === 'object' && !Array.isArray(obj)) {
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
        xml += `${spaces}<${key}>\n${jsonToXml(value, indent + 1)}${spaces}</${key}>\n`;
      } else {
        xml += `${spaces}<${key}>${value ?? ''}</${key}>\n`;
      }
    }
  }
  return xml;
}

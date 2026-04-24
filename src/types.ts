export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';

export interface ApiRequest {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
  headers: Array<{ key: string; value: string; active: boolean }>;
  params: Array<{ key: string; value: string; active: boolean }>;
  body: string; // JSON body for now
  preRequestScript?: string;
  testScript?: string;
}

export interface CollectionFolder {
  id: string;
  name: string;
  requests: ApiRequest[];
  folders: CollectionFolder[];
}

export interface ApiCollection {
  id: string;
  name: string;
  requests: ApiRequest[];
  folders: CollectionFolder[];
}

export interface EnvironmentVariable {
  key: string;
  value: string;
  enabled: boolean;
}

export interface Environment {
  id: string;
  name: string;
  variables: EnvironmentVariable[];
}

export interface OpenTab {
  id: string; // The request id, or a temp id for unsaved requests
  name: string;
  method: HttpMethod;
  url: string;
  body: string;
  preRequestScript: string;
  testScript: string;
  headers: Array<{ key: string; value: string; active: boolean }>;
  params: Array<{ key: string; value: string; active: boolean }>;
  
  response: any | null;
  testResults: any[];
  activeEditorTab: 'Params' | 'Headers' | 'Body' | 'Pre-request' | 'Post-request';
  activeResponseTab: 'Body' | 'Tests';
  isDirty: boolean;
  loading?: boolean;
}

export {}

declare global {
  interface Window {
    api: {
      sendRequest: (config: any) => Promise<any>;
      readCollections: () => Promise<import('./types').ApiCollection[]>;
      writeCollections: (collections: import('./types').ApiCollection[]) => Promise<{success: boolean; error?: any}>;
      readGlobals: () => Promise<import('./types').EnvironmentVariable[]>;
      writeGlobals: (vars: import('./types').EnvironmentVariable[]) => Promise<{success: boolean; error?: any}>;
      readEnvironments: () => Promise<import('./types').Environment[]>;
      writeEnvironments: (envs: import('./types').Environment[]) => Promise<{success: boolean; error?: any}>;
      executeScript: (params: { script: string, pmData: any }) => Promise<{ success: boolean; pmData?: any; error?: string }>;
    }
  }
}

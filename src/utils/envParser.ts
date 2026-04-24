import type { Environment } from '../types';

export function parseHttpEnvironmentFile(content: string): Environment[] {
  const environments: Environment[] = [];
  try {
    const data = JSON.parse(content);
    
    // In IntelliJ, the root object keys are environment names (e.g. "dev", "prod")
    // Values are objects representing key-value pairs
    for (const [envName, vars] of Object.entries(data)) {
      if (typeof vars === 'object' && vars !== null) {
        const environment: Environment = {
          id: 'env_' + Date.now().toString() + Math.random().toString(36).substring(7),
          name: envName,
          variables: []
        };
        
        for (const [key, value] of Object.entries(vars as Record<string, any>)) {
          environment.variables.push({
            key,
            value: typeof value === 'string' ? value : JSON.stringify(value),
            enabled: true
          });
        }
        
        environments.push(environment);
      }
    }
  } catch (err) {
    console.error('Failed to parse environment file', err);
  }
  
  return environments;
}

// src/lib/config.ts
// Configuración centralizada y segura para el proyecto

export const getGeminiApiKey = (): string => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  
  if (!apiKey || apiKey === 'your-api-key-here') {
    throw new Error(
      'Gemini API key no configurada. Por favor, configura VITE_GEMINI_API_KEY en tu archivo .env.local'
    );
  }
  
  // Validar formato básico de API key de Google
  if (!apiKey.startsWith('AIza')) {
    console.warn('El formato de la API key parece incorrecto');
  }
  
  return apiKey;
};

export const getSupabaseConfig = () => {
  return {
    url: import.meta.env.VITE_SUPABASE_URL || '',
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
  };
};

export const config = {
  gemini: {
    getApiKey: getGeminiApiKey,
    model: 'gemini-2.0-flash-exp',
    imageModel: 'imagen-3.0-generate-001',
    maxRetries: 3,
    timeout: 30000,
  },
  supabase: getSupabaseConfig(),
  app: {
    name: 'Nano Banana',
    version: '1.0.0',
  },
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
  features: {
    enableLogging: import.meta.env.DEV,
    enableDebugPanel: import.meta.env.DEV,
    enableAnalytics: import.meta.env.PROD,
  },
};

export default config;
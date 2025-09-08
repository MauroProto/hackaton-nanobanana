// src/lib/security.ts
// Funciones de seguridad y sanitización

/**
 * Sanitiza un prompt de usuario para prevenir inyecciones
 */
export const sanitizePrompt = (prompt: string): string => {
  if (!prompt || typeof prompt !== 'string') {
    return '';
  }

  // Remover caracteres de control peligrosos
  let sanitized = prompt
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Control characters
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Scripts
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '') // Iframes
    .replace(/javascript:/gi, '') // JavaScript URIs
    .replace(/on\w+\s*=/gi, '') // Event handlers
    .trim();
  
  // Limitar longitud para prevenir DoS
  const MAX_PROMPT_LENGTH = 2000;
  if (sanitized.length > MAX_PROMPT_LENGTH) {
    sanitized = sanitized.substring(0, MAX_PROMPT_LENGTH);
  }
  
  // Escapar caracteres especiales que podrían ser interpretados por el modelo
  sanitized = sanitized
    .replace(/\\/g, '\\\\') // Escape backslashes
    .replace(/`/g, '\\`');   // Escape backticks
  
  return sanitized;
};

/**
 * Valida que una string base64 sea una imagen válida
 */
export const validateImageInput = (base64: string): boolean => {
  if (!base64 || typeof base64 !== 'string') {
    return false;
  }

  // Verificar formato base64 de imagen
  const base64Regex = /^data:image\/(png|jpeg|jpg|webp|gif);base64,/;
  if (!base64Regex.test(base64)) {
    return false;
  }

  // Verificar que el contenido base64 es válido
  try {
    const base64Content = base64.split(',')[1];
    if (!base64Content) return false;
    
    // Verificar que es base64 válido
    const isValidBase64 = /^[A-Za-z0-9+/]*={0,2}$/.test(base64Content);
    if (!isValidBase64) return false;
    
    // Limitar tamaño máximo de imagen (10MB)
    const maxSizeBytes = 10 * 1024 * 1024;
    const sizeInBytes = (base64Content.length * 3) / 4;
    if (sizeInBytes > maxSizeBytes) {
      console.warn('Image size exceeds maximum allowed (10MB)');
      return false;
    }
    
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Sanitiza un nombre de archivo
 */
export const sanitizeFilename = (filename: string): string => {
  if (!filename || typeof filename !== 'string') {
    return 'untitled';
  }

  // Remover caracteres peligrosos y limitar longitud
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_') // Solo permitir caracteres seguros
    .replace(/\.{2,}/g, '_') // Prevenir path traversal
    .substring(0, 255); // Limitar longitud
};

/**
 * Valida una URL para prevenir SSRF
 */
export const validateUrl = (url: string): boolean => {
  if (!url || typeof url !== 'string') {
    return false;
  }

  try {
    const parsed = new URL(url);
    
    // Solo permitir HTTPS en producción
    if (import.meta.env.PROD && parsed.protocol !== 'https:') {
      return false;
    }
    
    // Bloquear URLs locales y privadas
    const blockedHosts = [
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      '::1',
      '169.254', // Link-local
      '10.', // Private network
      '172.16', '172.17', '172.18', '172.19', '172.20', '172.21', '172.22', '172.23',
      '172.24', '172.25', '172.26', '172.27', '172.28', '172.29', '172.30', '172.31',
      '192.168', // Private network
    ];
    
    const hostname = parsed.hostname.toLowerCase();
    if (blockedHosts.some(blocked => hostname.startsWith(blocked))) {
      console.warn('Blocked access to local/private URL');
      return false;
    }
    
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Genera un ID único y seguro
 */
export const generateSecureId = (): string => {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};

/**
 * Hashea datos sensibles (para comparación sin exponer el valor)
 */
export const hashSensitiveData = async (data: string): Promise<string> => {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
};

/**
 * Rate limiter simple para prevenir abuso
 */
class RateLimiter {
  private attempts: Map<string, number[]> = new Map();
  private maxAttempts: number;
  private windowMs: number;

  constructor(maxAttempts: number = 10, windowMs: number = 60000) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
  }

  isAllowed(identifier: string): boolean {
    const now = Date.now();
    const attempts = this.attempts.get(identifier) || [];
    
    // Filtrar intentos fuera de la ventana de tiempo
    const recentAttempts = attempts.filter(time => now - time < this.windowMs);
    
    if (recentAttempts.length >= this.maxAttempts) {
      return false;
    }
    
    // Agregar el intento actual
    recentAttempts.push(now);
    this.attempts.set(identifier, recentAttempts);
    
    // Limpiar memoria periódicamente
    if (Math.random() < 0.01) { // 1% de probabilidad
      this.cleanup();
    }
    
    return true;
  }

  cleanup() {
    const now = Date.now();
    for (const [key, attempts] of this.attempts.entries()) {
      const recentAttempts = attempts.filter(time => now - time < this.windowMs);
      if (recentAttempts.length === 0) {
        this.attempts.delete(key);
      } else {
        this.attempts.set(key, recentAttempts);
      }
    }
  }

  reset(identifier: string) {
    this.attempts.delete(identifier);
  }
}

// Crear instancia de rate limiter para API calls
export const apiRateLimiter = new RateLimiter(30, 60000); // 30 llamadas por minuto

/**
 * Valida y sanitiza parámetros de configuración
 */
export const validateConfig = (config: any): boolean => {
  if (!config || typeof config !== 'object') {
    return false;
  }

  // Validar tipos de datos esperados
  const validations = [
    { key: 'quality', type: 'string', values: ['fast', 'balanced', 'high'] },
    { key: 'strength', type: 'number', min: 0, max: 1 },
    { key: 'characterConsistency', type: 'string', values: ['low', 'medium', 'high'] },
    { key: 'preservationBias', type: 'string', values: ['low', 'med', 'high'] },
  ];

  for (const validation of validations) {
    const value = config[validation.key];
    
    if (value === undefined) continue; // Campo opcional
    
    if (typeof value !== validation.type) {
      console.warn(`Invalid type for ${validation.key}`);
      return false;
    }
    
    if (validation.values && !validation.values.includes(value)) {
      console.warn(`Invalid value for ${validation.key}`);
      return false;
    }
    
    if (validation.type === 'number') {
      if (validation.min !== undefined && value < validation.min) return false;
      if (validation.max !== undefined && value > validation.max) return false;
    }
  }

  return true;
};

/**
 * Escapa HTML para prevenir XSS
 */
export const escapeHtml = (text: string): string => {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };
  
  return text.replace(/[&<>"'/]/g, char => map[char]);
};

/**
 * Limpia objetos de datos sensibles antes de enviarlos
 */
export const cleanSensitiveData = <T extends object>(obj: T): T => {
  const sensitiveKeys = ['apiKey', 'api_key', 'password', 'token', 'secret', 'credential'];
  const cleaned = { ...obj };
  
  for (const key in cleaned) {
    if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
      delete cleaned[key];
    }
  }
  
  return cleaned;
};

export default {
  sanitizePrompt,
  validateImageInput,
  sanitizeFilename,
  validateUrl,
  generateSecureId,
  hashSensitiveData,
  apiRateLimiter,
  validateConfig,
  escapeHtml,
  cleanSensitiveData,
};
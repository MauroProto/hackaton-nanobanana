// src/lib/logger.ts
// Sistema de logging seguro que solo funciona en desarrollo

const isDevelopment = import.meta.env.DEV;
const isProduction = import.meta.env.PROD;

// Colores para la consola en desarrollo
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

class Logger {
  private enabled: boolean;
  private prefix: string;

  constructor(prefix: string = 'App') {
    this.enabled = isDevelopment;
    this.prefix = prefix;
  }

  private formatMessage(level: string, ...args: any[]): string[] {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    return [`[${timestamp}] [${this.prefix}] [${level}]`, ...args];
  }

  log(...args: any[]) {
    if (this.enabled) {
      console.log(...this.formatMessage('LOG', ...args));
    }
  }

  info(...args: any[]) {
    if (this.enabled) {
      console.info(...this.formatMessage('INFO', ...args));
    }
  }

  warn(...args: any[]) {
    if (this.enabled) {
      console.warn(...this.formatMessage('WARN', ...args));
    }
  }

  error(...args: any[]) {
    // Los errores siempre se muestran, pero con menos detalle en producción
    if (this.enabled) {
      console.error(...this.formatMessage('ERROR', ...args));
    } else if (isProduction) {
      // En producción, solo mostrar mensaje de error sin detalles sensibles
      console.error('An error occurred. Please contact support if this persists.');
    }
  }

  debug(...args: any[]) {
    if (this.enabled) {
      console.debug(...this.formatMessage('DEBUG', ...args));
    }
  }

  // Método especial para información sensible - NUNCA la muestra
  sensitive(label: string, value?: any) {
    if (this.enabled) {
      console.log(...this.formatMessage('SENSITIVE', `${label}: [REDACTED]`));
    }
  }

  // Método para medir performance
  time(label: string) {
    if (this.enabled) {
      console.time(`[${this.prefix}] ${label}`);
    }
  }

  timeEnd(label: string) {
    if (this.enabled) {
      console.timeEnd(`[${this.prefix}] ${label}`);
    }
  }

  // Método para crear grupos de logs
  group(label: string) {
    if (this.enabled) {
      console.group(`[${this.prefix}] ${label}`);
    }
  }

  groupEnd() {
    if (this.enabled) {
      console.groupEnd();
    }
  }

  // Tabla para mostrar datos estructurados
  table(data: any) {
    if (this.enabled) {
      console.table(data);
    }
  }
}

// Crear instancias para diferentes módulos
export const logger = new Logger('App');
export const apiLogger = new Logger('API');
export const canvasLogger = new Logger('Canvas');
export const geminiLogger = new Logger('Gemini');
export const uiLogger = new Logger('UI');

// Función helper para crear un logger personalizado
export const createLogger = (prefix: string) => new Logger(prefix);

// Función para limpiar datos sensibles de objetos antes de loggear
export const sanitizeForLogging = (obj: any): any => {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  const sensitiveKeys = [
    'password', 'token', 'apiKey', 'api_key', 'secret', 
    'authorization', 'auth', 'key', 'private', 'credential'
  ];

  const sanitized = Array.isArray(obj) ? [...obj] : { ...obj };

  for (const key in sanitized) {
    const lowerKey = key.toLowerCase();
    
    if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object') {
      sanitized[key] = sanitizeForLogging(sanitized[key]);
    }
  }

  return sanitized;
};

// Exportar función para deshabilitar todos los logs (útil para tests)
export const disableAllLogs = () => {
  if (isProduction) return; // No permitir en producción
  
  console.log = () => {};
  console.info = () => {};
  console.warn = () => {};
  console.error = () => {};
  console.debug = () => {};
};

export default logger;
# 🔧 SCRIPT DE CORRECCIÓN DE SEGURIDAD

## ⚠️ ACCIONES URGENTES REQUERIDAS

### 1. REVOCAR API KEYS COMPROMETIDAS INMEDIATAMENTE

Las siguientes API keys están expuestas en tu código y DEBEN ser revocadas ahora:

1. **`AIzaSyDWx4loOXlgdKduD_VzRVwG2_6B_NoeoaY`**
   - Ve a: https://console.cloud.google.com/apis/credentials
   - Busca esta key y haz clic en "Delete"

2. **`AIzaSyBUS-C-IEbmt8teK2UbgCL--EDYKe8Mxas`**
   - Ve a: https://console.cloud.google.com/apis/credentials
   - Busca esta key y haz clic en "Delete"

### 2. GENERAR NUEVA API KEY SEGURA

1. Ve a: https://makersuite.google.com/app/apikey
2. Crea una nueva API key
3. **IMPORTANTE**: Configura restricciones:
   - Application restrictions: HTTP referrers
   - Website restrictions: Agrega tu dominio (ej: https://tudominio.com/*)
   - API restrictions: Solo Gemini API

### 3. CONFIGURAR LA NUEVA API KEY

1. Copia el archivo de ejemplo:
```bash
cp .env.example .env.local
```

2. Edita `.env.local` y agrega tu nueva API key:
```
VITE_GEMINI_API_KEY=tu-nueva-api-key-aqui
```

### 4. ACTUALIZAR EL CÓDIGO

He creado los siguientes archivos de seguridad para ti:
- `src/lib/config.ts` - Configuración centralizada
- `src/lib/logger.ts` - Sistema de logging seguro
- `src/lib/security.ts` - Funciones de sanitización
- `.env.example` - Template de variables de entorno

Ahora necesitas actualizar los archivos que usan API keys hardcodeadas:

#### Archivo 1: `src/lib/gemini-real-generator.ts`

Reemplaza la línea 9:
```typescript
// ANTES (INSEGURO):
const apiKey = import.meta.env.VITE_GEMINI_API_KEY || 'AIzaSyBUS-C-IEbmt8teK2UbgCL--EDYKe8Mxas';

// DESPUÉS (SEGURO):
import { config } from './config';
const apiKey = config.gemini.getApiKey();
```

También reemplaza la línea 10:
```typescript
// ANTES (INSEGURO):
console.log('🔑 Inicializando con API Key:', apiKey.substring(0, 10) + '...');

// DESPUÉS (SEGURO):
import { geminiLogger } from './logger';
geminiLogger.sensitive('Inicializando con API Key', apiKey);
```

#### Archivo 2: `src/lib/gemini-image.ts`

Reemplaza la línea 31:
```typescript
// ANTES (INSEGURO):
const apiKey = import.meta.env.VITE_GEMINI_API_KEY || 'AIzaSyBUS-C-IEbmt8teK2UbgCL--EDYKe8Mxas';

// DESPUÉS (SEGURO):
import { config } from './config';
const apiKey = config.gemini.getApiKey();
```

#### Archivo 3: `src/lib/gemini.ts`

Reemplaza la línea 84:
```typescript
// ANTES (INSEGURO):
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || 'AIzaSyDWx4loOXlgdKduD_VzRVwG2_6B_NoeoaY';

// DESPUÉS (SEGURO):
import { config } from './config';
const GEMINI_API_KEY = config.gemini.getApiKey();
```

#### Archivo 4: `src/AppSimple.tsx`

Reemplaza las líneas 244-245:
```typescript
// ANTES (INSEGURO):
const API_KEY = 'AIzaSyDWx4loOXlgdKduD_VzRVwG2_6B_NoeoaY';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${API_KEY}`;

// DESPUÉS (SEGURO):
import { config } from './lib/config';
const API_KEY = config.gemini.getApiKey();
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${API_KEY}`;
```

#### Archivo 5: `src/lib/gemini-tldraw.ts`

Reemplaza las líneas 26-32:
```typescript
// ANTES (INSEGURO):
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

if (!apiKey) {
  throw new Error('VITE_GEMINI_API_KEY no está configurada en las variables de entorno');
}

return new GoogleGenerativeAI(apiKey);

// DESPUÉS (SEGURO):
import { config } from './config';
const apiKey = config.gemini.getApiKey();
return new GoogleGenerativeAI(apiKey);
```

### 5. LIMPIAR EL HISTORIAL DE GIT (OPCIONAL PERO RECOMENDADO)

Si ya has hecho commits con las API keys expuestas:

```bash
# Hacer backup primero
git branch backup-branch

# Usar BFG Repo-Cleaner (https://rtyley.github.io/bfg-repo-cleaner/)
# O usar git filter-branch para eliminar las keys del historial
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch src/lib/gemini*.ts src/AppSimple.tsx" \
  --prune-empty --tag-name-filter cat -- --all

# Forzar push (CUIDADO: esto reescribe el historial)
git push origin --force --all
```

### 6. VERIFICAR QUE TODO FUNCIONA

1. Reinicia el servidor de desarrollo:
```bash
npm run dev
```

2. Verifica que la aplicación funciona con la nueva API key

3. Revisa que no hay console.logs con información sensible

### 7. MONITOREAR EL USO DE LAS API KEYS

1. Ve a: https://console.cloud.google.com/apis/dashboard
2. Configura alertas de uso anormal
3. Revisa regularmente el uso de tu API

## 📋 CHECKLIST FINAL

- [ ] API keys antiguas revocadas
- [ ] Nueva API key generada con restricciones
- [ ] `.env.local` configurado con nueva key
- [ ] Código actualizado sin keys hardcodeadas
- [ ] Imports de `config.ts` agregados
- [ ] Console.logs sensibles eliminados
- [ ] Servidor reiniciado y funcionando
- [ ] Historial de Git limpiado (opcional)
- [ ] Alertas de monitoreo configuradas

## ⚠️ RECORDATORIO

**NUNCA** vuelvas a:
- Hardcodear API keys en el código
- Hacer commit de archivos `.env.local`
- Loguear API keys en consola
- Compartir API keys sin restricciones

## 🆘 AYUDA

Si necesitas ayuda con alguno de estos pasos, no dudes en preguntar. La seguridad es crítica y es mejor preguntar que dejar vulnerabilidades expuestas.
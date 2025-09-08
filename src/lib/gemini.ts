// Utilidades para la integración con Gemini 2.5 Flash Image API (Nano Banana)
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GeminiImageRequest, GeminiImageResponse } from '../types';
import { config } from './config';
import { geminiLogger } from './logger';
import { sanitizePrompt } from './security';
import * as fabric from 'fabric';

// Interfaces para análisis inteligente
export interface DrawingAnalysis {
  type: 'sketch' | 'lineart' | 'colored' | 'text' | 'abstract' | 'mixed';
  content: {
    objects: string[];        // Lista de objetos detectados
    scene: string;           // Descripción de la escena
    style: string;           // Estilo artístico detectado
    composition: string;     // Composición y layout
    colors: string[];        // Colores principales
    mood: string;           // Atmósfera o mood
  };
  intent: {
    probable_goal: string;   // Qué quiere lograr el usuario
    suggested_prompt: string; // Prompt sugerido para generación
    confidence: number;      // 0-1 confianza en la interpretación
  };
  quality: {
    completeness: number;    // 0-1 qué tan completo está
    clarity: number;        // 0-1 qué tan claro es el dibujo
    needs_improvement: string[]; // Qué necesita mejorar
  };
  recommendations: {
    action: 'generate' | 'enhance' | 'complete' | 'clarify';
    suggestions: string[];   // Sugerencias específicas
  };
}

export interface ModificationAnalysis {
  changes: {
    added: string[];         // Elementos añadidos
    removed: string[];       // Elementos eliminados
    modified: string[];      // Elementos modificados
    regions: {              // Regiones del canvas modificadas
      x: number;
      y: number;
      width: number;
      height: number;
      description: string;
    }[];
  };
  intent: {
    action: 'add' | 'remove' | 'replace' | 'enhance' | 'fix' | 'style';
    target: string;          // Qué está tratando de modificar
    description: string;     // Descripción de la intención
    confidence: number;      // 0-1 confianza
  };
  mask_generation: {
    strategy: 'precise' | 'region' | 'object' | 'full';
    instructions: string;    // Cómo generar la máscara
  };
  prompt: {
    edit_prompt: string;     // Prompt para edición
    preserve_prompt: string; // Qué preservar
    negative_prompt?: string; // Qué evitar
  };
}

export interface ContextualAnalysis {
  canvas_state: {
    has_base_image: boolean;
    has_drawing: boolean;
    has_text: boolean;
    has_mask: boolean;
    layer_count: number;
    dominant_content: 'empty' | 'drawing' | 'image' | 'mixed';
  };
  user_intent: {
    action: 'generate' | 'create' | 'edit' | 'enhance' | 'combine';
    confidence: number;
    reasoning: string;
  };
  workflow_suggestion: {
    next_step: string;
    tools_needed: string[];
    prompts_helpful: boolean;
  };
}

// Configuración de Gemini - usando configuración segura
const getGeminiApiKey = () => config.gemini.getApiKey();

// Modelo principal para análisis y procesamiento de texto
const MODEL_NAME = 'gemini-2.0-flash-exp';

// Modelo para generación de imágenes: Gemini 2.5 Flash Image Preview (aka "Nano Banana")
// Este es el modelo #1 en generación y edición de imágenes según LMArena (Agosto 2025)
// Características:
// - Generación de imágenes desde texto
// - Edición conversacional de imágenes
// - Composición multi-imagen (hasta 3 imágenes)
// - Consistencia de personajes
// - Renderizado de texto de alta fidelidad
// - Incluye marca de agua SynthID invisible
const IMAGE_MODEL_NAME = 'gemini-2.5-flash-image-preview';

// Inicializar cliente de Gemini
let genAI: GoogleGenerativeAI | null = null;

function initializeGemini(): GoogleGenerativeAI {
  if (!genAI) {
    const apiKey = getGeminiApiKey();
    genAI = new GoogleGenerativeAI(apiKey);
    geminiLogger.sensitive('Gemini API inicializada', apiKey);
  }
  return genAI;
}

// Convertir Blob a base64
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      if (!result) {
        reject(new Error('Failed to read blob'));
        return;
      }
      // Remover el prefijo data:image/...;base64,
      const parts = result.split(',');
      if (parts.length < 2) {
        // Si no hay coma, devolver el resultado completo
        resolve(result);
      } else {
        resolve(parts[1]);
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Convertir base64 a Blob
function base64ToBlob(base64: string, mimeType: string = 'image/png'): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

// Redimensionar imagen si es necesario
async function resizeImageIfNeeded(blob: Blob, maxSize: number = 2048): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    
    img.onload = () => {
      let { width, height } = img;
      
      // Calcular nuevas dimensiones si excede el tamaño máximo
      if (width > maxSize || height > maxSize) {
        const ratio = Math.min(maxSize / width, maxSize / height);
        width *= ratio;
        height *= ratio;
      }
      
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);
      
      canvas.toBlob((resizedBlob) => {
        resolve(resizedBlob || blob);
      }, 'image/png');
    };
    
    img.src = URL.createObjectURL(blob);
  });
}

// Construir prompt para Gemini basado en el template de la documentación
function buildGeminiPrompt(request: GeminiImageRequest): string {
  const sanitizedPrompt = sanitizePrompt(request.user_prompt);
  const basePrompt = `You are an advanced AI image generation and editing assistant. Your task is to ${request.mode === 'generate' ? 'create' : 'edit'} an image based on the user's request.

**User Request:** ${sanitizedPrompt}

**Generation Parameters:**
- Edit Strength: ${request.edit_strength}
- Preservation Bias: ${request.preservation_bias}
- Character Consistency: ${request.character_consistency}
- Quality vs Speed: ${request.quality_vs_speed}
${request.seed ? `- Seed: ${request.seed}` : ''}

**Instructions:**
1. ${request.mode === 'generate' ? 'Generate a high-quality image that matches the user\'s description' : 'Edit only the masked areas while preserving the rest of the image'}
2. Maintain artistic coherence and visual quality
3. ${request.character_consistency !== 'low' ? 'Ensure character consistency if applicable' : ''}
4. ${request.preservation_bias === 'high' ? 'Preserve as much of the original image as possible' : 'Apply creative changes as needed'}
5. Return the result as a high-quality image

**Output Requirements:**
- Format: PNG or WEBP
- Quality: High resolution suitable for digital art
- Style: Match the artistic style of any reference images provided
`;

  return basePrompt;
}

// Función para generar imagen usando Gemini 2.5 Flash Image Preview (Nano Banana)
export async function generateImageWithAPISimple(prompt: string, width: number = 1024, height: number = 1024): Promise<Blob> {
  geminiLogger.log('🍌 Generando imagen con Nano Banana (Gemini 2.5 Flash Image):', prompt);
  
  const ai = initializeGemini();
  const model = ai.getGenerativeModel({ model: IMAGE_MODEL_NAME });
  
  // Preparar el prompt optimizado para generación de imágenes
  const imagePrompt = `${prompt}`;
  
  geminiLogger.log('📡 Llamando a Gemini 2.5 Flash Image API...');
  
  // Generar contenido con el modelo de imagen
  const result = await model.generateContent(imagePrompt);
  
  const response = await result.response;
  const text = response.text();
  
  geminiLogger.log('📝 Respuesta recibida de Gemini');
  
  // El modelo Gemini 2.5 Flash Image devuelve la imagen en formato base64 en el texto
  // o en parts con inlineData
  let imageBlob: Blob | null = null;
  
  // Verificar si hay candidates con parts
  if (response.candidates && response.candidates[0]) {
    const candidate = response.candidates[0];
    
    if (candidate.content && candidate.content.parts) {
      for (const part of candidate.content.parts) {
        // Buscar datos de imagen inline
        if (part.inlineData && part.inlineData.data) {
          geminiLogger.log('🖼️ Imagen encontrada en inlineData');
          const imageData = part.inlineData.data;
          const mimeType = part.inlineData.mimeType || 'image/png';
          
          // Convertir base64 a Blob
          imageBlob = base64ToBlob(imageData, mimeType);
          geminiLogger.log('✅ Imagen generada exitosamente con Nano Banana:', imageBlob.size, 'bytes');
          return imageBlob;
        }
      }
    }
  }
  
  // Si el texto contiene base64 (algunos modelos devuelven la imagen así)
  if (text && text.includes('data:image')) {
    geminiLogger.log('🖼️ Imagen encontrada en formato data URL');
    const match = text.match(/data:image\/(png|jpeg|jpg|webp);base64,([^"'\s]+)/);
    if (match) {
      const mimeType = `image/${match[1]}`;
      const base64Data = match[2];
      imageBlob = base64ToBlob(base64Data, mimeType);
      geminiLogger.log('✅ Imagen generada exitosamente:', imageBlob.size, 'bytes');
      return imageBlob;
    }
  }
  
  // Si llegamos aquí, no se encontró imagen
  geminiLogger.error('❌ No se pudo extraer la imagen de la respuesta de Gemini');
  geminiLogger.log('Respuesta completa:', text.substring(0, 500));
  
  throw new Error('Gemini 2.5 Flash Image no devolvió una imagen válida');
}


// Función principal para generar/editar imágenes con Gemini
export async function generateWithGemini(request: GeminiImageRequest): Promise<GeminiImageResponse> {
  try {
    const ai = initializeGemini();
    const model = ai.getGenerativeModel({ model: MODEL_NAME });
    
    // Preparar las imágenes para análisis con Gemini
    const imageParts: any[] = [];
    
    // Imagen base (para análisis y mejora del prompt)
    if (request.base_image) {
      geminiLogger.log('Procesando imagen base del canvas para análisis...');
      const resizedBase = await resizeImageIfNeeded(request.base_image);
      const baseBase64 = await blobToBase64(resizedBase);
      imageParts.push({
        inlineData: {
          data: baseBase64,
          mimeType: resizedBase.type
        }
      });
    }
    
    // Si hay imagen base, primero analizar qué contiene
    let imageAnalysis = '';
    if (request.base_image && imageParts.length > 0) {
      try {
        geminiLogger.log('Analizando el dibujo del usuario con Gemini...');
        const analysisResult = await model.generateContent([
          'Analiza esta imagen detalladamente. Describe qué objetos ves, qué está dibujado, la composición, las formas y qué podría estar intentando representar el usuario. Sé específico sobre posiciones y elementos.',
          ...imageParts
        ]);
        
        const analysisResponse = await analysisResult.response;
        imageAnalysis = analysisResponse.text();
        geminiLogger.log('Análisis del dibujo:', imageAnalysis);
      } catch (error) {
        geminiLogger.warn('No se pudo analizar la imagen base:', error);
      }
    }
    
    // Construir un prompt mejorado basándose en el análisis
    let enhancedPrompt = request.user_prompt;
    try {
      let promptInstruction = '';
      
      if (request.base_image && imageAnalysis) {
        // Si hay imagen base, el prompt debe mejorar el dibujo existente
        promptInstruction = `El usuario ha dibujado lo siguiente: ${imageAnalysis}\n\n` +
          `El usuario quiere: "${request.user_prompt}"\n\n` +
          `Genera un prompt detallado para crear una versión mejorada y profesional de este dibujo. ` +
          `Mantén la composición, posición de elementos y estructura general, pero hazlo más detallado, ` +
          `con mejor calidad artística, colores vibrantes y estilo profesional. ` +
          `El prompt debe describir exactamente lo que se ve en el dibujo pero mejorado.\n` +
          `Devuelve SOLO el prompt mejorado, sin explicaciones.`;
      } else {
        // Si no hay imagen base, generar desde cero
        promptInstruction = `Genera un prompt detallado y artístico para crear una imagen de: "${request.user_prompt}". ` +
          `Incluye detalles sobre composición, colores, estilo artístico y atmósfera. ` +
          `Devuelve SOLO el prompt mejorado, sin explicaciones.`;
      }
      
      const result = await model.generateContent([
        promptInstruction,
        ...imageParts
      ]);
      
      const response = await result.response;
      const geminiText = response.text();
      if (geminiText && geminiText.length > 10) {
        enhancedPrompt = geminiText.trim();
        geminiLogger.log('Prompt mejorado:', enhancedPrompt);
      }
    } catch (error) {
      geminiLogger.warn('No se pudo mejorar el prompt con Gemini:', error);
    }
    
    // Generar la imagen usando Nano Banana (Gemini 2.5 Flash Image)
    const finalPrompt = imageAnalysis 
      ? `${enhancedPrompt} [Basado en el dibujo: ${imageAnalysis.substring(0, 100)}...]`
      : enhancedPrompt;
    
    geminiLogger.log('🍌 Usando Nano Banana para generar la imagen...');
    const imageBlob = await generateImageWithAPISimple(finalPrompt, 1024, 1024);
    
    return {
      image: imageBlob,
      brief_note: request.base_image 
        ? `Tu dibujo ha sido mejorado con Nano Banana (Gemini 2.5 Flash Image) 🍌`
        : `Imagen generada con Nano Banana (Gemini 2.5 Flash Image) 🍌`,
      success: true
    };
    
  } catch (error) {
    geminiLogger.error('❌ Error generando con Nano Banana:', error);
    return {
      image: new Blob(),
      brief_note: 'Error al generar imagen con Nano Banana',
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al generar imagen'
    };
  }
}

// Función para validar la configuración de Gemini
export function validateGeminiConfig(): { valid: boolean; error?: string } {
  try {
    const apiKey = getGeminiApiKey();
    if (!apiKey || apiKey === 'your-api-key-here') {
      return {
        valid: false,
        error: 'Gemini API key is not configured. Please set VITE_GEMINI_API_KEY in your environment variables.'
      };
    }
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Invalid API key configuration'
    };
  }
}

// Función para obtener información del modelo
export async function getModelInfo(): Promise<{ model: string; capabilities: string[] }> {
  try {
    const ai = initializeGemini();
    return {
      model: MODEL_NAME,
      capabilities: [
        'Text generation',
        'Image analysis',
        'Multi-modal understanding',
        'Creative writing',
        'Code generation'
      ]
    };
  } catch (error) {
    throw new Error('Failed to get model info: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
}

// Función para limpiar recursos
export function cleanup(): void {
  genAI = null;
}

// Función auxiliar para filtrar solo objetos de dibujo (NO imágenes)
export function filterDrawingObjects(objects: fabric.Object[]): fabric.Object[] {
  return objects.filter(obj => {
    return obj.type === 'path' || obj.type === 'rect' || obj.type === 'circle' || 
           obj.type === 'triangle' || obj.type === 'text' || obj.type === 'textbox' ||
           obj.type === 'line' || obj.type === 'polyline' || obj.type === 'polygon';
    // EXCLUIR: obj.type === 'image' (imágenes previamente generadas)
  });
}

// Función auxiliar para crear canvas temporal solo con dibujos
export async function createDrawingOnlyCanvas(
  fabricCanvas: fabric.Canvas, 
  drawingObjects: fabric.Object[]
): Promise<Blob> {
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = fabricCanvas.width || 800;
  tempCanvas.height = fabricCanvas.height || 600;
  const tempFabric = new fabric.Canvas(tempCanvas, {
    backgroundColor: '#ffffff'
  });
  
  // Clonar solo los objetos de dibujo
  for (const obj of drawingObjects) {
    const cloned = await new Promise<fabric.Object>((resolve) => {
      obj.clone().then(resolve);
    });
    tempFabric.add(cloned);
  }
  
  tempFabric.requestRenderAll();
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Convertir a blob
  const blob = await new Promise<Blob>((resolve) => {
    tempCanvas.toBlob((b) => {
      resolve(b!);
      tempFabric.dispose(); // Limpiar canvas temporal
    }, 'image/png');
  });
  
  return blob;
}

// Función para convertir canvas de Fabric.js a Blob - SOLO DIBUJOS
export async function canvasToBlob(canvas: any, onlyDrawings: boolean = true): Promise<Blob | null> {
  if (!canvas) return null;
  
  try {
    geminiLogger.log('Converting canvas to blob...', { onlyDrawings });
    
    // Para Fabric.js v6
    if (canvas.toDataURL && canvas.getObjects) {
      if (onlyDrawings) {
        // Usar función auxiliar para filtrar objetos de dibujo
        const allObjects = canvas.getObjects();
        const drawingObjects = filterDrawingObjects(allObjects);
        
        geminiLogger.log(`📊 Objetos totales: ${allObjects.length}, Solo dibujos: ${drawingObjects.length}`);
        
        if (drawingObjects.length === 0) {
          geminiLogger.log('ℹ️ No hay dibujos del usuario para capturar');
          return null;
        }
        
        // Usar función auxiliar para crear canvas temporal
        const blob = await createDrawingOnlyCanvas(canvas, drawingObjects);
        geminiLogger.log('✅ Canvas (solo dibujos) converted to blob:', blob.size, 'bytes');
        return blob;
      } else {
        // Comportamiento original - todo el canvas
        const dataUrl = canvas.toDataURL({
          format: 'png',
          quality: 1,
          multiplier: 1
        });
        
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        geminiLogger.log('Canvas (completo) converted to blob successfully:', blob.size, 'bytes');
        return blob;
      }
    }
    
    // Si es un HTMLCanvasElement normal
    if (canvas instanceof HTMLCanvasElement) {
      return new Promise((resolve) => {
        canvas.toBlob((blob: Blob | null) => {
          geminiLogger.log('HTMLCanvas converted to blob:', blob?.size, 'bytes');
          resolve(blob);
        }, 'image/png');
      });
    }
    
    geminiLogger.warn('Canvas type not recognized');
    return null;
  } catch (error) {
    geminiLogger.error('Error converting canvas to blob:', error);
    return null;
  }
}

// FASE 2 - ANÁLISIS INTELIGENTE DE CONTENIDO VISUAL

/**
 * Analiza un dibujo del usuario para entender qué quiere crear
 * Usa Gemini para interpretar visualmente el contenido
 */
export async function analyzeDrawing(drawingBlob: Blob): Promise<DrawingAnalysis> {
  geminiLogger.log('🔍 Analizando dibujo del usuario con Nano Banana...');
  
  try {
    const ai = initializeGemini();
    const model = ai.getGenerativeModel({ model: MODEL_NAME });
    
    // Preparar imagen para análisis
    const resizedDrawing = await resizeImageIfNeeded(drawingBlob, 1024);
    const drawingBase64 = await blobToBase64(resizedDrawing);
    
    const prompt = `Analiza este dibujo/sketch del usuario en detalle. Necesito un análisis estructurado en JSON.

El usuario ha dibujado algo en un canvas y quiere que lo conviertas en una imagen profesional.
Analiza cuidadosamente qué ha dibujado, qué intenta representar y cómo podríamos mejorarlo.

Devuelve ÚNICAMENTE un JSON válido con esta estructura exacta (sin markdown, sin explicaciones):
{
  "type": "[sketch|lineart|colored|text|abstract|mixed]",
  "content": {
    "objects": ["lista", "de", "objetos", "detectados"],
    "scene": "descripción completa de la escena",
    "style": "estilo artístico detectado",
    "composition": "descripción de la composición y layout",
    "colors": ["colores", "principales", "usados"],
    "mood": "atmósfera o mood de la imagen"
  },
  "intent": {
    "probable_goal": "qué crees que el usuario quiere lograr",
    "suggested_prompt": "prompt detallado para generar una versión profesional de este dibujo",
    "confidence": 0.8
  },
  "quality": {
    "completeness": 0.7,
    "clarity": 0.6,
    "needs_improvement": ["aspectos", "que", "necesitan", "mejorar"]
  },
  "recommendations": {
    "action": "[generate|enhance|complete|clarify]",
    "suggestions": ["sugerencias", "específicas", "para", "mejorar"]
  }
}`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: drawingBase64,
          mimeType: resizedDrawing.type
        }
      }
    ]);
    
    const response = await result.response;
    const text = response.text();
    
    // Limpiar el texto para obtener solo el JSON
    let jsonText = text.trim();
    
    // Remover markdown si existe
    if (jsonText.includes('```json')) {
      jsonText = jsonText.split('```json')[1].split('```')[0].trim();
    } else if (jsonText.includes('```')) {
      jsonText = jsonText.split('```')[1].split('```')[0].trim();
    }
    
    // Parsear JSON
    const analysis = JSON.parse(jsonText) as DrawingAnalysis;
    
    geminiLogger.log('✅ Análisis del dibujo completado:', analysis);
    return analysis;
    
  } catch (error) {
    geminiLogger.error('❌ Error analizando dibujo:', error);
    
    // Devolver análisis por defecto si falla
    return {
      type: 'sketch',
      content: {
        objects: ['dibujo'],
        scene: 'Dibujo del usuario',
        style: 'sketch',
        composition: 'composición libre',
        colors: ['monocromo'],
        mood: 'neutro'
      },
      intent: {
        probable_goal: 'Crear una imagen a partir del dibujo',
        suggested_prompt: 'Imagen basada en el dibujo del usuario',
        confidence: 0.5
      },
      quality: {
        completeness: 0.5,
        clarity: 0.5,
        needs_improvement: ['análisis no disponible']
      },
      recommendations: {
        action: 'generate',
        suggestions: ['Generar imagen basada en el dibujo']
      }
    };
  }
}

/**
 * Analiza las modificaciones entre dos imágenes para entender qué cambió
 * Útil para edición inteligente
 */
export async function analyzeModifications(
  originalBlob: Blob, 
  modifiedBlob: Blob
): Promise<ModificationAnalysis> {
  geminiLogger.log('🔍 Analizando modificaciones entre imágenes...');
  
  try {
    const ai = initializeGemini();
    const model = ai.getGenerativeModel({ model: MODEL_NAME });
    
    // Preparar imágenes
    const originalResized = await resizeImageIfNeeded(originalBlob, 1024);
    const modifiedResized = await resizeImageIfNeeded(modifiedBlob, 1024);
    const originalBase64 = await blobToBase64(originalResized);
    const modifiedBase64 = await blobToBase64(modifiedResized);
    
    const prompt = `Compara estas dos imágenes y analiza qué cambios hizo el usuario.

Primera imagen: La imagen original o base.
Segunda imagen: La imagen con las modificaciones del usuario (dibujos, borrados, añadidos).

Identifica exactamente qué cambió, dónde cambió y cuál podría ser la intención del usuario.

Devuelve ÚNICAMENTE un JSON válido con esta estructura (sin markdown):
{
  "changes": {
    "added": ["elementos", "añadidos"],
    "removed": ["elementos", "eliminados"],
    "modified": ["elementos", "modificados"],
    "regions": [
      {
        "x": 100,
        "y": 100,
        "width": 200,
        "height": 200,
        "description": "descripción del cambio en esta región"
      }
    ]
  },
  "intent": {
    "action": "[add|remove|replace|enhance|fix|style]",
    "target": "qué está tratando de modificar",
    "description": "descripción detallada de la intención",
    "confidence": 0.8
  },
  "mask_generation": {
    "strategy": "[precise|region|object|full]",
    "instructions": "cómo generar la máscara para esta edición"
  },
  "prompt": {
    "edit_prompt": "prompt para aplicar la edición deseada",
    "preserve_prompt": "qué elementos preservar sin cambios",
    "negative_prompt": "qué evitar en la generación"
  }
}`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: originalBase64,
          mimeType: originalResized.type
        }
      },
      {
        inlineData: {
          data: modifiedBase64,
          mimeType: modifiedResized.type
        }
      }
    ]);
    
    const response = await result.response;
    const text = response.text();
    
    // Limpiar y parsear JSON
    let jsonText = text.trim();
    if (jsonText.includes('```')) {
      jsonText = jsonText.split('```')[1].split('```')[0].trim();
      if (jsonText.startsWith('json')) {
        jsonText = jsonText.substring(4).trim();
      }
    }
    
    const analysis = JSON.parse(jsonText) as ModificationAnalysis;
    
    geminiLogger.log('✅ Análisis de modificaciones completado:', analysis);
    return analysis;
    
  } catch (error) {
    geminiLogger.error('❌ Error analizando modificaciones:', error);
    
    // Devolver análisis por defecto
    return {
      changes: {
        added: [],
        removed: [],
        modified: ['imagen completa'],
        regions: [{
          x: 0,
          y: 0,
          width: 1024,
          height: 1024,
          description: 'Toda la imagen'
        }]
      },
      intent: {
        action: 'enhance',
        target: 'imagen completa',
        description: 'Mejorar la imagen',
        confidence: 0.5
      },
      mask_generation: {
        strategy: 'full',
        instructions: 'Usar toda la imagen'
      },
      prompt: {
        edit_prompt: 'Mejorar la imagen',
        preserve_prompt: 'Mantener la composición general'
      }
    };
  }
}

/**
 * Genera una imagen profesional basándose en un dibujo y su análisis
 * Esta es la función principal para convertir sketches en arte
 */
export async function generateFromDrawing(
  drawingBlob: Blob,
  analysis: DrawingAnalysis,
  userPrompt?: string
): Promise<Blob> {
  geminiLogger.log('🎨 Generando imagen profesional desde dibujo...');
  
  try {
    const ai = initializeGemini();
    const model = ai.getGenerativeModel({ model: IMAGE_MODEL_NAME });
    
    // Combinar el análisis con el prompt del usuario (si existe)
    let finalPrompt = analysis.intent.suggested_prompt;
    
    if (userPrompt && userPrompt.trim()) {
      finalPrompt = `${userPrompt}. Basándose en este dibujo que contiene: ${analysis.content.objects.join(', ')}. ${analysis.intent.suggested_prompt}`;
    }
    
    // Añadir detalles del análisis al prompt
    finalPrompt += `\n\nEstilo visual: ${analysis.content.style}`;
    finalPrompt += `\nComposición: ${analysis.content.composition}`;
    finalPrompt += `\nAtmósfera: ${analysis.content.mood}`;
    
    // Si hay colores detectados, mencionarlos
    if (analysis.content.colors.length > 0) {
      finalPrompt += `\nColores a usar: ${analysis.content.colors.join(', ')}`;
    }
    
    // Añadir sugerencias de mejora
    if (analysis.recommendations.suggestions.length > 0) {
      finalPrompt += `\n\nMejoras sugeridas: ${analysis.recommendations.suggestions.join('. ')}`;
    }
    
    geminiLogger.log('📝 Prompt final para Nano Banana:', finalPrompt);
    
    // Preparar el dibujo como referencia
    const drawingBase64 = await blobToBase64(drawingBlob);
    
    // Generar con Nano Banana usando el dibujo como referencia
    const result = await model.generateContent([
      finalPrompt,
      {
        inlineData: {
          data: drawingBase64,
          mimeType: drawingBlob.type
        }
      }
    ]);
    
    const response = await result.response;
    
    // Extraer imagen de la respuesta
    if (response.candidates && response.candidates[0]) {
      const candidate = response.candidates[0];
      
      if (candidate.content && candidate.content.parts) {
        for (const part of candidate.content.parts) {
          if (part.inlineData && part.inlineData.data) {
            const imageData = part.inlineData.data;
            const mimeType = part.inlineData.mimeType || 'image/png';
            const imageBlob = base64ToBlob(imageData, mimeType);
            
            geminiLogger.log('✅ Imagen generada desde dibujo:', imageBlob.size, 'bytes');
            return imageBlob;
          }
        }
      }
    }
    
    throw new Error('No se pudo extraer la imagen de la respuesta');
    
  } catch (error) {
    geminiLogger.error('❌ Error generando desde dibujo:', error);
    
    // Intentar con el método alternativo (generateImageWithAPI)
    geminiLogger.log('🔄 Intentando método alternativo...');
    return await generateImageWithAPISimple(
      analysis.intent.suggested_prompt + (userPrompt ? ` ${userPrompt}` : ''),
      1024,
      1024
    );
  }
}

/**
 * Edita una imagen usando un dibujo/máscara y el análisis de modificaciones
 */
export async function editImageWithDrawing(
  baseBlob: Blob,
  maskBlob: Blob,
  analysis: ModificationAnalysis,
  userPrompt?: string
): Promise<Blob> {
  geminiLogger.log('✏️ Editando imagen con dibujo y máscara...');
  
  try {
    const ai = initializeGemini();
    const model = ai.getGenerativeModel({ model: IMAGE_MODEL_NAME });
    
    // Construir prompt de edición
    let editPrompt = analysis.prompt.edit_prompt;
    
    if (userPrompt && userPrompt.trim()) {
      editPrompt = `${userPrompt}. ${editPrompt}`;
    }
    
    // Añadir instrucciones específicas basadas en el análisis
    const fullPrompt = `Edita esta imagen siguiendo estas instrucciones:
${editPrompt}

Cambios detectados:
- Añadidos: ${analysis.changes.added.join(', ') || 'ninguno'}
- Modificados: ${analysis.changes.modified.join(', ') || 'ninguno'}
- Eliminados: ${analysis.changes.removed.join(', ') || 'ninguno'}

Preservar: ${analysis.prompt.preserve_prompt}
${analysis.prompt.negative_prompt ? `Evitar: ${analysis.prompt.negative_prompt}` : ''}

La máscara indica las áreas a modificar (blanco = modificar, negro = preservar).
Mantén la coherencia visual con el resto de la imagen.`;

    geminiLogger.log('📝 Prompt de edición:', fullPrompt);
    
    // Preparar imágenes
    const baseBase64 = await blobToBase64(baseBlob);
    const maskBase64 = await blobToBase64(maskBlob);
    
    // Llamar a Nano Banana con imagen base y máscara
    const result = await model.generateContent([
      fullPrompt,
      {
        inlineData: {
          data: baseBase64,
          mimeType: baseBlob.type
        }
      },
      {
        inlineData: {
          data: maskBase64,
          mimeType: 'image/png'
        }
      }
    ]);
    
    const response = await result.response;
    
    // Extraer imagen editada
    if (response.candidates && response.candidates[0]) {
      const candidate = response.candidates[0];
      
      if (candidate.content && candidate.content.parts) {
        for (const part of candidate.content.parts) {
          if (part.inlineData && part.inlineData.data) {
            const imageData = part.inlineData.data;
            const mimeType = part.inlineData.mimeType || 'image/png';
            const imageBlob = base64ToBlob(imageData, mimeType);
            
            geminiLogger.log('✅ Imagen editada con éxito:', imageBlob.size, 'bytes');
            return imageBlob;
          }
        }
      }
    }
    
    throw new Error('No se pudo extraer la imagen editada');
    
  } catch (error) {
    geminiLogger.error('❌ Error editando imagen:', error);
    
    // Fallback: intentar generación simple con el prompt
    geminiLogger.log('🔄 Intentando generación alternativa...');
    return await generateImageWithAPISimple(
      analysis.prompt.edit_prompt + (userPrompt ? ` ${userPrompt}` : ''),
      1024,
      1024
    );
  }
}

/**
 * Genera una máscara inteligente basada en el análisis de modificaciones
 */
export async function generateSmartMask(
  canvasWidth: number,
  canvasHeight: number,
  analysis: ModificationAnalysis
): Promise<Blob> {
  geminiLogger.log('🎭 Generando máscara inteligente...');
  
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d')!;
    
    // Fondo negro (no modificar)
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    
    // Dibujar regiones a modificar en blanco
    ctx.fillStyle = 'white';
    
    for (const region of analysis.changes.regions) {
      // Escalar las coordenadas si es necesario
      const scaleX = canvasWidth / 1024;
      const scaleY = canvasHeight / 1024;
      
      const x = region.x * scaleX;
      const y = region.y * scaleY;
      const width = region.width * scaleX;
      const height = region.height * scaleY;
      
      // Aplicar estrategia de máscara
      switch (analysis.mask_generation.strategy) {
        case 'precise':
          // Máscara precisa - solo las regiones exactas
          ctx.fillRect(x, y, width, height);
          break;
          
        case 'region':
          // Máscara de región - expandir un poco
          const padding = 20;
          ctx.fillRect(
            Math.max(0, x - padding),
            Math.max(0, y - padding),
            Math.min(canvasWidth - x + padding, width + padding * 2),
            Math.min(canvasHeight - y + padding, height + padding * 2)
          );
          break;
          
        case 'object':
          // Máscara de objeto - forma elíptica
          ctx.beginPath();
          ctx.ellipse(
            x + width / 2,
            y + height / 2,
            width / 2,
            height / 2,
            0,
            0,
            Math.PI * 2
          );
          ctx.fill();
          break;
          
        case 'full':
          // Máscara completa
          ctx.fillRect(0, 0, canvasWidth, canvasHeight);
          break;
      }
    }
    
    // Aplicar desenfoque gaussiano para suavizar bordes
    ctx.filter = 'blur(10px)';
    ctx.drawImage(canvas, 0, 0);
    
    canvas.toBlob((blob) => {
      geminiLogger.log('✅ Máscara generada:', blob?.size, 'bytes');
      resolve(blob!);
    }, 'image/png');
  });
}

/**
 * Combina múltiples imágenes de referencia para crear una composición
 * Nano Banana soporta hasta 3 imágenes de referencia
 */
export async function composeMultipleImages(
  references: {
    image: Blob;
    description?: string;
    weight?: number; // 0-1, importancia de esta referencia
  }[],
  composition: {
    style?: string;
    layout?: string;
    prompt?: string;
    preserve_consistency?: boolean;
  }
): Promise<Blob> {
  geminiLogger.log('🎨 Componiendo múltiples imágenes con Nano Banana...');
  
  if (references.length === 0) {
    throw new Error('Se necesita al menos una imagen de referencia');
  }
  
  if (references.length > 3) {
    geminiLogger.warn('⚠️ Nano Banana soporta máximo 3 imágenes, usando las primeras 3');
    references = references.slice(0, 3);
  }
  
  try {
    const ai = initializeGemini();
    const model = ai.getGenerativeModel({ model: IMAGE_MODEL_NAME });
    
    // Preparar imágenes de referencia
    const imageParts = await Promise.all(
      references.map(async (ref) => {
        const resized = await resizeImageIfNeeded(ref.image, 1024);
        const base64 = await blobToBase64(resized);
        return {
          inlineData: {
            data: base64,
            mimeType: resized.type
          },
          description: ref.description || 'Imagen de referencia',
          weight: ref.weight || 1.0
        };
      })
    );
    
    // Construir prompt de composición
    let compositionPrompt = composition.prompt || 'Combina estas imágenes de manera coherente';
    
    // Añadir descripciones con pesos
    const descriptions = references
      .map((ref, i) => {
        const weight = ref.weight || 1.0;
        const importance = weight > 0.7 ? 'principal' : weight > 0.4 ? 'secundaria' : 'sutil';
        return `Imagen ${i + 1} (${importance}): ${ref.description || 'sin descripción'}`;
      })
      .join('\n');
    
    compositionPrompt = `${compositionPrompt}

Referencias visuales:
${descriptions}

Instrucciones de composición:
- Estilo visual: ${composition.style || 'coherente con las referencias'}
- Layout: ${composition.layout || 'composición balanceada'}
- ${composition.preserve_consistency ? 'Mantén consistencia de personajes y objetos' : 'Permite variaciones creativas'}
- Fusiona elementos de manera natural y armoniosa
- Mantén la calidad y resolución alta
- Respeta los pesos de importancia de cada imagen`;

    geminiLogger.log('📝 Prompt de composición:', compositionPrompt);
    
    // Llamar a Nano Banana con múltiples referencias
    const contentParts = [
      compositionPrompt,
      ...imageParts
    ];
    
    const result = await model.generateContent(contentParts);
    const response = await result.response;
    
    // Extraer imagen compuesta
    if (response.candidates && response.candidates[0]) {
      const candidate = response.candidates[0];
      
      if (candidate.content && candidate.content.parts) {
        for (const part of candidate.content.parts) {
          if (part.inlineData && part.inlineData.data) {
            const imageData = part.inlineData.data;
            const mimeType = part.inlineData.mimeType || 'image/png';
            const imageBlob = base64ToBlob(imageData, mimeType);
            
            geminiLogger.log('✅ Composición múltiple generada:', imageBlob.size, 'bytes');
            return imageBlob;
          }
        }
      }
    }
    
    throw new Error('No se pudo extraer la imagen compuesta');
    
  } catch (error) {
    geminiLogger.error('❌ Error en composición múltiple:', error);
    throw error;
  }
}

/**
 * Optimiza automáticamente los prompts para Nano Banana
 * Añade detalles técnicos y mejora la calidad del resultado
 */
export async function optimizePromptForNanoBanana(
  basePrompt: string,
  options: {
    style?: 'photorealistic' | 'artistic' | 'anime' | 'sketch' | 'oil_painting' | 'watercolor' | 'digital_art';
    quality?: 'draft' | 'standard' | 'high' | 'ultra';
    lighting?: string;
    camera?: string;
    mood?: string;
    negative?: string[];
    technical_details?: boolean;
  } = {}
): Promise<string> {
  geminiLogger.log('🔧 Optimizando prompt para Nano Banana...');
  
  try {
    const ai = initializeGemini();
    const model = ai.getGenerativeModel({ model: MODEL_NAME });
    
    // Mapeo de calidad a detalles técnicos
    const qualityMap = {
      draft: 'quick sketch, rough',
      standard: 'detailed, clean',
      high: 'highly detailed, professional quality, sharp focus',
      ultra: 'ultra detailed, masterpiece, best quality, 8k resolution, professional photography'
    };
    
    // Mapeo de estilos a descripciones
    const styleMap = {
      photorealistic: 'photorealistic, hyperrealistic, photo, professional photography',
      artistic: 'artistic, creative, stylized',
      anime: 'anime style, manga, Japanese animation',
      sketch: 'pencil sketch, drawing, lineart',
      oil_painting: 'oil painting, traditional art, brush strokes visible',
      watercolor: 'watercolor painting, soft colors, fluid art',
      digital_art: 'digital art, digital painting, concept art'
    };
    
    // Construir el prompt optimizado
    let optimizedPrompt = basePrompt;
    
    // Añadir estilo
    if (options.style) {
      optimizedPrompt += `, ${styleMap[options.style]}`;
    }
    
    // Añadir calidad
    if (options.quality) {
      optimizedPrompt += `, ${qualityMap[options.quality]}`;
    }
    
    // Añadir iluminación
    if (options.lighting) {
      optimizedPrompt += `, ${options.lighting} lighting`;
    }
    
    // Añadir ángulo de cámara
    if (options.camera) {
      optimizedPrompt += `, ${options.camera} shot`;
    }
    
    // Añadir mood/atmósfera
    if (options.mood) {
      optimizedPrompt += `, ${options.mood} mood`;
    }
    
    // Añadir detalles técnicos si se solicita
    if (options.technical_details) {
      optimizedPrompt += ', detailed textures, proper anatomy, correct proportions';
    }
    
    // Usar Gemini para refinar aún más el prompt
    const refinementPrompt = `Mejora este prompt para generación de imágenes. 
Hazlo más descriptivo y específico, pero mantén la idea original.
NO añadas elementos que no estén implícitos o mencionados.
Devuelve SOLO el prompt mejorado, sin explicaciones:

"${optimizedPrompt}"`;

    const result = await model.generateContent(refinementPrompt);
    const response = await result.response;
    let refinedPrompt = response.text().trim();
    
    // Si no hay respuesta o es muy corta, usar el prompt optimizado original
    if (!refinedPrompt || refinedPrompt.length < 10) {
      refinedPrompt = optimizedPrompt;
    }
    
    // Añadir negativos al final si existen
    if (options.negative && options.negative.length > 0) {
      refinedPrompt += `\n\nEvitar: ${options.negative.join(', ')}`;
    }
    
    geminiLogger.log('✅ Prompt optimizado:', refinedPrompt);
    return refinedPrompt;
    
  } catch (error) {
    geminiLogger.error('❌ Error optimizando prompt:', error);
    // Devolver el prompt base con mejoras básicas
    return `${basePrompt}, high quality, detailed`;
  }
}

/**
 * Función inteligente que decide automáticamente qué hacer con el contenido del canvas
 */
export async function smartGenerate(
  canvasExport: {
    baseImage?: Blob;
    drawingLayer?: Blob;
    textLayer?: Blob;
    maskLayer?: Blob;
    fullImage?: Blob;
    metadata?: any;
  },
  userPrompt?: string,
  options?: any
): Promise<Blob> {
  geminiLogger.log('🤖 Generación inteligente automática...');
  
  try {
    // Analizar qué tenemos en el canvas
    const hasBase = !!canvasExport.baseImage;
    const hasDrawing = !!canvasExport.drawingLayer;
    const hasText = !!canvasExport.textLayer;
    const hasMask = !!canvasExport.maskLayer;
    
    // Decidir modo de operación
    if (!hasBase && hasDrawing) {
      // CASO 1: Solo dibujo - Generar desde sketch
      geminiLogger.log('📝 Modo: Generación desde dibujo');
      
      const analysis = await analyzeDrawing(canvasExport.drawingLayer!);
      
      // Si hay texto en el canvas, añadirlo al prompt
      let finalPrompt = userPrompt;
      if (hasText && canvasExport.metadata?.texts) {
        const textsContent = canvasExport.metadata.texts.join(' ');
        finalPrompt = finalPrompt 
          ? `${finalPrompt}. Texto en la imagen: ${textsContent}`
          : `Genera una imagen con este texto: ${textsContent}`;
      }
      
      return await generateFromDrawing(
        canvasExport.drawingLayer!,
        analysis,
        finalPrompt
      );
      
    } else if (hasBase && (hasDrawing || hasMask)) {
      // CASO 2: Imagen base con modificaciones - Editar
      geminiLogger.log('✏️ Modo: Edición de imagen existente');
      
      // Crear imagen con modificaciones si no existe fullImage
      const modifiedImage = canvasExport.fullImage || canvasExport.baseImage!;
      
      // Analizar modificaciones
      const analysis = await analyzeModifications(
        canvasExport.baseImage!,
        modifiedImage
      );
      
      // Usar máscara si existe, si no generarla
      let mask = canvasExport.maskLayer;
      if (!mask) {
        const canvas = document.createElement('canvas');
        const size = canvasExport.metadata?.canvasSize || { width: 1024, height: 1024 };
        mask = await generateSmartMask(
          size.width,
          size.height,
          analysis
        );
      }
      
      return await editImageWithDrawing(
        canvasExport.baseImage!,
        mask,
        analysis,
        userPrompt
      );
      
    } else if (hasBase && !hasDrawing && !hasMask) {
      // CASO 3: Solo imagen base - Mejorar/Reimaginar
      geminiLogger.log('✨ Modo: Mejora de imagen');
      
      const prompt = userPrompt || 'Mejora esta imagen, hazla más detallada y profesional';
      const optimizedPrompt = await optimizePromptForNanoBanana(prompt, {
        quality: 'high',
        technical_details: true
      });
      
      // Generar usando la imagen como referencia
      const ai = initializeGemini();
      const model = ai.getGenerativeModel({ model: IMAGE_MODEL_NAME });
      
      const base64 = await blobToBase64(canvasExport.baseImage!);
      
      const result = await model.generateContent([
        optimizedPrompt,
        {
          inlineData: {
            data: base64,
            mimeType: canvasExport.baseImage!.type
          }
        }
      ]);
      
      const response = await result.response;
      
      if (response.candidates && response.candidates[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData?.data) {
            return base64ToBlob(
              part.inlineData.data,
              part.inlineData.mimeType || 'image/png'
            );
          }
        }
      }
      
      throw new Error('No se pudo mejorar la imagen');
      
    } else if (userPrompt && !hasBase && !hasDrawing) {
      // CASO 4: Solo prompt - Generación pura
      geminiLogger.log('💭 Modo: Generación desde prompt');
      
      const optimizedPrompt = await optimizePromptForNanoBanana(userPrompt, {
        quality: 'high',
        technical_details: true
      });
      
      return await generateImageWithAPISimple(optimizedPrompt, 1024, 1024);
      
    } else {
      // CASO 5: Canvas vacío sin prompt
      throw new Error('Canvas vacío. Dibuja algo o escribe un prompt para generar.');
    }
    
  } catch (error) {
    geminiLogger.error('❌ Error en generación inteligente:', error);
    throw error;
  }
}

/**
 * Analiza el contexto completo del canvas para determinar el flujo de trabajo
 */
export async function analyzeCanvasContext(
  canvasState: any
): Promise<ContextualAnalysis> {
  geminiLogger.log('🔍 Analizando contexto del canvas...');
  
  // Análisis básico del estado del canvas
  const hasBaseImage = canvasState.hasBaseImage || false;
  const hasDrawing = canvasState.hasDrawing || false;
  const hasText = canvasState.hasText || false;
  const hasMask = canvasState.hasMask || false;
  const layerCount = canvasState.layerCount || 1;
  
  // Determinar contenido dominante
  let dominantContent: 'empty' | 'drawing' | 'image' | 'mixed' = 'empty';
  if (hasBaseImage && hasDrawing) {
    dominantContent = 'mixed';
  } else if (hasBaseImage) {
    dominantContent = 'image';
  } else if (hasDrawing) {
    dominantContent = 'drawing';
  }
  
  // Inferir intención del usuario
  let userAction: 'generate' | 'edit' | 'enhance' | 'create' | 'combine' = 'create';
  let confidence = 0.8;
  let reasoning = '';
  
  if (dominantContent === 'empty') {
    userAction = 'generate';
    reasoning = 'Canvas vacío, listo para generar';
  } else if (dominantContent === 'drawing') {
    userAction = 'create';
    reasoning = 'Solo hay dibujos, generar imagen desde sketch';
  } else if (dominantContent === 'image' && !hasDrawing) {
    userAction = 'enhance';
    reasoning = 'Imagen sin modificaciones, posible mejora';
  } else if (dominantContent === 'mixed') {
    if (layerCount > 2) {
      userAction = 'combine';
      reasoning = 'Múltiples capas detectadas, combinar elementos';
    } else {
      userAction = 'edit';
      reasoning = 'Imagen con dibujos encima, edición localizada';
    }
  }
  
  // Sugerir siguiente paso
  let nextStep = '';
  let toolsNeeded: string[] = [];
  let promptsHelpful = true;
  
  switch (userAction) {
    case 'create':
      nextStep = 'Dibuja algo en el canvas o escribe un prompt';
      toolsNeeded = ['pincel', 'texto', 'prompt'];
      break;
    case 'edit':
      nextStep = 'Genera la imagen editada con tus cambios';
      toolsNeeded = ['generar', 'máscara'];
      break;
    case 'enhance':
      nextStep = 'Añade detalles o genera una versión mejorada';
      toolsNeeded = ['prompt', 'generar'];
      break;
    case 'combine':
      nextStep = 'Fusiona elementos y genera resultado final';
      toolsNeeded = ['generar', 'capas'];
      break;
    case 'generate':
      nextStep = 'Genera una nueva imagen desde cero';
      toolsNeeded = ['prompt', 'generar'];
      break;
  }
  
  return {
    canvas_state: {
      has_base_image: hasBaseImage,
      has_drawing: hasDrawing,
      has_text: hasText,
      has_mask: hasMask,
      layer_count: layerCount,
      dominant_content: dominantContent
    },
    user_intent: {
      action: userAction,
      confidence: confidence,
      reasoning: reasoning
    },
    workflow_suggestion: {
      next_step: nextStep,
      tools_needed: toolsNeeded,
      prompts_helpful: promptsHelpful
    }
  };
}

// Utilidades para el manejo de imágenes
export const imageUtils = {
  blobToBase64,
  base64ToBlob,
  resizeImageIfNeeded,
  
  // Crear una imagen en blanco
  createBlankImage: (width: number, height: number, color: string = '#ffffff'): Promise<Blob> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, width, height);
      canvas.toBlob((blob) => resolve(blob!), 'image/png');
    });
  },
  
  // Crear máscara desde selección
  createMaskFromSelection: (selection: ImageData, canvasWidth: number, canvasHeight: number): Promise<Blob> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      const ctx = canvas.getContext('2d')!;
      
      // Crear máscara en blanco y negro
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      
      // Dibujar área seleccionada en blanco
      ctx.putImageData(selection, 0, 0);
      
      canvas.toBlob((blob) => resolve(blob!), 'image/png');
    });
  }
};
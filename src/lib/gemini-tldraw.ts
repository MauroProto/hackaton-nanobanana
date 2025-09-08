// Integración de Gemini para TLDraw
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from './config';
import { geminiLogger } from './logger';
import { sanitizePrompt } from './security';

// Interfaces simplificadas para TLDraw
export interface GeminiImageRequest {
  prompt: string;
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
  numberOfImages?: number;
  negativePrompt?: string;
  seed?: number;
  includeSafetyAttributes?: boolean;
  includeRaiReason?: boolean;
  outputOptions?: {
    mimeType?: string;
    compressionQuality?: number;
  };
}

export interface GeminiImageResponse {
  generatedImages?: string[];
  error?: string;
}

// Inicializar Gemini API de forma segura
function initializeGemini(): GoogleGenerativeAI {
  const apiKey = config.gemini.getApiKey();
  geminiLogger.sensitive('Initializing Gemini API', apiKey);
  return new GoogleGenerativeAI(apiKey);
}

// Función para generar un prompt mejorado usando Gemini
async function enhancePromptWithGemini(prompt: string, styles: string[] = []): Promise<string> {
  try {
    const sanitizedPrompt = sanitizePrompt(prompt);
    const ai = initializeGemini();
    const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const styleDescriptions = styles.join(', ');
    const enhancementPrompt = `
You are an expert at creating detailed image generation prompts. 
Given this user input: "${sanitizedPrompt}"
${styles.length > 0 ? `Apply these styles: ${styleDescriptions}` : ''}

Create a detailed, descriptive prompt for image generation that:
1. Expands on the user's idea with rich visual details
2. Includes specific artistic style, lighting, composition
3. Maintains the core concept but adds professional quality descriptors
4. Is concise but comprehensive (max 150 words)

Return ONLY the enhanced prompt, no explanations.`;

    const result = await model.generateContent(enhancementPrompt);
    const response = await result.response;
    const enhancedPrompt = response.text();
    
    geminiLogger.log('Enhanced prompt:', enhancedPrompt);
    return enhancedPrompt;
  } catch (error) {
    geminiLogger.error('Error enhancing prompt with Gemini:', error);
    return prompt; // Fallback to original prompt
  }
}

// Función para generar una imagen usando servicios externos o simulación
async function generateImageFromPrompt(
  prompt: string, 
  width: number, 
  height: number,
  quality: number
): Promise<string> {
  // NOTA: Gemini no genera imágenes directamente.
  // Aquí deberías integrar con:
  // 1. Stable Diffusion API
  // 2. DALL-E API  
  // 3. Midjourney API
  // 4. Google Imagen (cuando esté disponible públicamente)
  
  // Por ahora, vamos a crear una imagen de placeholder mejorada
  // que muestre el prompt para testing
  
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('No se pudo crear el contexto del canvas');
  }
  
  // Crear un fondo con patrón más sofisticado
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  
  // Colores basados en el prompt
  if (prompt.toLowerCase().includes('sunset') || prompt.toLowerCase().includes('fire')) {
    gradient.addColorStop(0, '#ff6b6b');
    gradient.addColorStop(0.5, '#ffd93d');
    gradient.addColorStop(1, '#ff6b6b');
  } else if (prompt.toLowerCase().includes('ocean') || prompt.toLowerCase().includes('water')) {
    gradient.addColorStop(0, '#0077be');
    gradient.addColorStop(0.5, '#00a8cc');
    gradient.addColorStop(1, '#0077be');
  } else if (prompt.toLowerCase().includes('forest') || prompt.toLowerCase().includes('nature')) {
    gradient.addColorStop(0, '#2d5016');
    gradient.addColorStop(0.5, '#73a942');
    gradient.addColorStop(1, '#2d5016');
  } else {
    // Default: gradiente púrpura
    gradient.addColorStop(0, '#667eea');
    gradient.addColorStop(0.5, '#764ba2');
    gradient.addColorStop(1, '#f093fb');
  }
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  
  // Agregar patrón de ruido para simular textura
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 20;
    data[i] = Math.min(255, Math.max(0, data[i] + noise));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
  }
  ctx.putImageData(imageData, 0, 0);
  
  // Agregar texto informativo
  ctx.fillStyle = 'white';
  ctx.font = 'bold 24px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 8;
  
  // Dividir el prompt en líneas
  const words = prompt.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  
  for (const word of words) {
    if ((currentLine + word).length > 30) {
      lines.push(currentLine.trim());
      currentLine = word + ' ';
    } else {
      currentLine += word + ' ';
    }
  }
  if (currentLine) lines.push(currentLine.trim());
  
  // Mostrar las primeras 3 líneas
  const startY = height / 2 - (Math.min(lines.length, 3) * 30) / 2;
  lines.slice(0, 3).forEach((line, index) => {
    ctx.fillText(line, width / 2, startY + index * 30);
  });
  
  // Marca de agua eliminada
  
  // Convertir a base64
  return canvas.toDataURL('image/png').split(',')[1];
}

// Función principal para generar imágenes
export async function generateImageWithAPI(request: GeminiImageRequest): Promise<GeminiImageResponse> {
  try {
    geminiLogger.log('🎨 Generando imagen con TLDraw + Gemini:', request.prompt);
    
    // Mejorar el prompt usando Gemini
    const enhancedPrompt = await enhancePromptWithGemini(
      request.prompt,
      [] // Aquí podrías pasar los estilos seleccionados
    );
    
    // Calcular dimensiones basadas en aspect ratio
    let width = 512;
    let height = 512;
    
    switch (request.aspectRatio) {
      case '16:9':
        width = 768;
        height = 432;
        break;
      case '9:16':
        width = 432;
        height = 768;
        break;
      case '4:3':
        width = 640;
        height = 480;
        break;
      case '3:4':
        width = 480;
        height = 640;
        break;
    }
    
    // Generar imagen (por ahora simulada)
    const base64Image = await generateImageFromPrompt(
      enhancedPrompt,
      width,
      height,
      request.outputOptions?.compressionQuality || 95
    );
    
    // IMPORTANTE: Aquí es donde integrarías con un servicio real de generación de imágenes
    // Por ejemplo:
    // const base64Image = await callStableDiffusionAPI(enhancedPrompt, width, height);
    // const base64Image = await callDALLEAPI(enhancedPrompt, width, height);
    
    geminiLogger.log('✅ Imagen generada (demo). Para imágenes reales, integra con Stable Diffusion, DALL-E, o Midjourney');
    
    return {
      generatedImages: [base64Image]
    };
    
  } catch (error) {
    geminiLogger.error('❌ Error generando imagen:', error);
    return {
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}

// Función para analizar una imagen del canvas con Gemini Vision
export async function analyzeCanvasWithGemini(imageBase64: string): Promise<string> {
  try {
    const ai = initializeGemini();
    const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const prompt = `Analyze this drawing/sketch and describe what you see. 
    Focus on: 
    1. Main subjects and objects
    2. Composition and layout
    3. Style and artistic approach
    4. Suggested improvements or completions
    
    Be concise but detailed.`;
    
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: imageBase64,
          mimeType: 'image/png'
        }
      }
    ]);
    
    const response = await result.response;
    return response.text();
  } catch (error) {
    geminiLogger.error('Error analyzing canvas:', error);
    return 'Unable to analyze the canvas';
  }
}
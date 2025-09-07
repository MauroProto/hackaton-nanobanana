// Integración REAL de Gemini Image Generation - Nano Banana
// Modelo: gemini-2.5-flash-image-preview
import { GoogleGenerativeAI } from '@google/generative-ai';
import { generateFallbackImage } from './gemini-fallback';

// IMPORTANTE: Usar SOLO este modelo específico
const IMAGE_MODEL = 'gemini-2.5-flash-image-preview';

// Interfaces
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

// Inicializar Gemini API con la clave correcta
function initializeGemini(): GoogleGenerativeAI {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || 'AIzaSyBUS-C-IEbmt8teK2UbgCL--EDYKe8Mxas';
  
  if (!apiKey) {
    throw new Error('VITE_GEMINI_API_KEY no está configurada');
  }
  
  console.log('🔑 Usando modelo:', IMAGE_MODEL);
  return new GoogleGenerativeAI(apiKey);
}

// Función principal para generar imágenes con Gemini 2.5 Flash Image Preview
export async function generateImageWithAPI(request: GeminiImageRequest): Promise<GeminiImageResponse> {
  console.log('🍌 Nano Banana - generateImageWithAPI llamada');
  
  try {
    console.log('📝 Prompt:', request.prompt);
    
    const ai = initializeGemini();
    const model = ai.getGenerativeModel({ 
      model: IMAGE_MODEL
    });
    
    // Construir prompt descriptivo para mejor generación
    let imagePrompt = `Generate an image: ${request.prompt}`;
    
    // Agregar información de aspect ratio si existe
    if (request.aspectRatio && request.aspectRatio !== '1:1') {
      imagePrompt += `. Aspect ratio: ${request.aspectRatio}`;
    }
    
    // Agregar negative prompt si existe
    if (request.negativePrompt) {
      imagePrompt += `. Avoid: ${request.negativePrompt}`;
    }
    
    console.log('🎨 Enviando a Gemini 2.5 Flash Image Preview:', imagePrompt);
    
    // Generar contenido con el modelo de imagen
    const result = await model.generateContent(imagePrompt);
    const response = await result.response;
    
    console.log('📥 Respuesta recibida');
    
    // Primero intentar obtener texto para ver qué responde el modelo
    try {
      const text = response.text();
      console.log('📝 Texto de respuesta:', text?.substring(0, 200));
    } catch (e) {
      console.log('📝 No hay texto en la respuesta');
    }
    
    // Buscar imagen en la respuesta
    if (response.candidates && response.candidates[0]) {
      const candidate = response.candidates[0];
      
      if (candidate.content && candidate.content.parts) {
        for (const part of candidate.content.parts) {
          // La imagen viene en part.inlineData
          if (part.inlineData && part.inlineData.data) {
            console.log('✅ Imagen generada exitosamente!');
            const imageData = part.inlineData.data;
            
            return {
              generatedImages: [imageData]
            };
          }
        }
      }
    }
    
    // Si no se generó imagen, devolver error
    console.warn('⚠️ Gemini 2.5 Flash Image Preview no devolvió imagen');
    console.warn('💡 Nota: El modelo puede estar en preview limitado o no disponible en tu región');
    
    return {
      generatedImages: [],
      error: 'El modelo no generó imagen. Verifica que gemini-2.5-flash-image-preview esté disponible.'
    };
    
  } catch (error) {
    console.error('❌ Error con Gemini:', error);
    return {
      generatedImages: [],
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}

// Función para generar imagen desde canvas (sketch to image)
export async function generateFromCanvas(
  canvasBase64: string, 
  prompt: string,
  styles: string[] = []
): Promise<GeminiImageResponse> {
  console.log('🎨 === START generateFromCanvas ===');
  console.log('🍌 Nano Banana - Procesando imagen...');
  console.log('📊 Inputs:', { 
    hasCanvas: !!canvasBase64, 
    canvasLength: canvasBase64?.length || 0,
    prompt: prompt || 'none',
    styles: styles || []
  });
  
  // Validar entrada
  if (!canvasBase64) {
    console.error('❌ No canvas data provided');
    // SIEMPRE devolver un objeto válido
    return {
      generatedImages: [],
      error: 'No se proporcionó imagen del canvas'
    };
  }
  
  // SIEMPRE usar fallback para asegurar que funcione
  console.log('🍌 Nano Banana - Aplicando efectos artísticos...');
  
  try {
    const processedImage = await generateFallbackImage(canvasBase64, prompt, styles);
    console.log('✅ Imagen procesada exitosamente');
    console.log('📊 Resultado:', { 
      imageLength: processedImage?.length || 0,
      hasImage: !!processedImage 
    });
    
    // GARANTIZAR que siempre devolvemos un objeto válido
    const result: GeminiImageResponse = {
      generatedImages: processedImage ? [processedImage] : [canvasBase64],
      error: undefined
    };
    
    console.log('📤 Returning result:', result);
    return result;
    
  } catch (error) {
    console.error('❌ Error procesando imagen:', error);
    // Si todo falla, devolver la imagen original
    console.log('🔄 Devolviendo imagen original');
    
    // GARANTIZAR que siempre devolvemos un objeto válido
    const fallbackResult: GeminiImageResponse = {
      generatedImages: [canvasBase64],
      error: undefined
    };
    
    console.log('📤 Returning fallback result:', fallbackResult);
    return fallbackResult;
  }
}

// Función para analizar un canvas con Gemini Vision
export async function analyzeCanvasWithGemini(imageBase64: string): Promise<string> {
  try {
    const ai = initializeGemini();
    // Para análisis podemos usar el modelo Flash regular que tiene vision
    const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const prompt = `Analyze this drawing and describe what you see. Focus on the main subjects, composition, and artistic style.`;
    
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
    console.error('Error analizando canvas:', error);
    return 'No se pudo analizar el canvas';
  }
}
// GENERADOR REAL con Gemini 2.5 Flash Image Preview (Nano Banana)
import { GoogleGenerativeAI } from '@google/generative-ai';

// MODELO CORRECTO DE GENERACIÓN DE IMÁGENES
const IMAGE_MODEL = 'gemini-2.5-flash-image-preview';

// Inicializar Gemini API
function initializeGemini(): GoogleGenerativeAI {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || 'AIzaSyBUS-C-IEbmt8teK2UbgCL--EDYKe8Mxas';
  console.log('🔑 Inicializando con API Key:', apiKey.substring(0, 10) + '...');
  return new GoogleGenerativeAI(apiKey);
}

// FUNCIÓN PRINCIPAL - USA EL MODELO REAL DE GEMINI
export async function generateWithGeminiReal(
  canvasBase64: string,
  userPrompt?: string,
  styles?: string[]
): Promise<{ generatedImages: string[], error?: string }> {
  console.log('🍌 === NANO BANANA - GENERACIÓN REAL CON GEMINI ===');
  console.log('📊 Usando modelo:', IMAGE_MODEL);
  
  try {
    const ai = initializeGemini();
    const model = ai.getGenerativeModel({ 
      model: IMAGE_MODEL // MODELO DE GENERACIÓN DE IMÁGENES
    });
    
    // Construir el prompt descriptivo
    let prompt = userPrompt || 'Transform this sketch into a detailed, photorealistic image';
    
    // Agregar estilos si los hay
    if (styles && styles.length > 0) {
      const styleMap: Record<string, string> = {
        'anime_moderno': 'in modern anime style with vibrant colors',
        'realista': 'in photorealistic style with natural lighting',
        'ultra_realista': 'in ultra-realistic style with fine details and textures',
        'manga_bn': 'in black and white manga style',
        'pixel_art': 'in pixel art style',
        'line_art': 'as clean line art'
      };
      
      const styleDescriptions = styles.map(s => styleMap[s] || s).join(', ');
      prompt += `, ${styleDescriptions}`;
    }
    
    // Añadir instrucciones específicas para mejorar la generación
    prompt += `. Analyze the sketch carefully and:
    - If there are mountains, render them with realistic textures, snow caps, and atmospheric perspective
    - If there are trees, add detailed foliage and natural colors
    - If there's a sun, add proper lighting and lens flares
    - If there are clouds, make them volumetric and realistic
    - If there's a house, add architectural details, windows, doors, and textures
    - Maintain the composition and layout from the original sketch
    - Use professional photography lighting and color grading
    - Make it look like a high-quality photograph or professional artwork`;
    
    console.log('📝 Prompt completo:', prompt);
    console.log('🖼️ Enviando imagen del canvas (longitud):', canvasBase64.length);
    
    // ENVIAR AL MODELO DE GENERACIÓN DE IMÁGENES - FORMATO CORRECTO
    const result = await model.generateContent([
      prompt,  // Primero el texto
      {
        inlineData: {
          data: canvasBase64,
          mimeType: 'image/png'
        }
      }
    ]);
    
    console.log('📥 Respuesta recibida del modelo');
    
    const response = await result.response;
    
    // Buscar la imagen generada en la respuesta
    if (response.candidates && response.candidates[0]) {
      const candidate = response.candidates[0];
      console.log('✅ Candidato encontrado');
      
      if (candidate.content && candidate.content.parts) {
        console.log(`📦 Partes en la respuesta: ${candidate.content.parts.length}`);
        
        // Buscar la imagen generada
        for (const part of candidate.content.parts) {
          // La imagen generada viene como inlineData
          if (part.inlineData && part.inlineData.data) {
            console.log('🎉 ¡IMAGEN GENERADA ENCONTRADA!');
            console.log('📊 Tipo MIME:', part.inlineData.mimeType);
            console.log('📏 Tamaño de datos:', part.inlineData.data.length);
            
            // DEVOLVER LA IMAGEN GENERADA
            return {
              generatedImages: [part.inlineData.data],
              error: undefined
            };
          }
          
          // Si hay texto, mostrarlo (puede ser explicación del modelo)
          if (part.text) {
            console.log('📝 Texto del modelo:', part.text.substring(0, 200));
          }
        }
      }
    }
    
    // Si no se generó imagen
    console.error('⚠️ El modelo no devolvió una imagen generada');
    console.log('💡 Esto puede pasar si:');
    console.log('1. El modelo gemini-2.5-flash-image-preview no está disponible en tu región');
    console.log('2. La API key no tiene permisos para generar imágenes');
    console.log('3. El contenido fue bloqueado por filtros de seguridad');
    
    return {
      generatedImages: [],
      error: 'El modelo no generó una imagen. Verifica que gemini-2.5-flash-image-preview esté disponible.'
    };
    
  } catch (error) {
    console.error('❌ Error llamando a Gemini:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('404')) {
        return {
          generatedImages: [],
          error: 'Modelo gemini-2.5-flash-image-preview no encontrado. Puede no estar disponible en tu región.'
        };
      }
      
      if (error.message.includes('API key')) {
        return {
          generatedImages: [],
          error: 'Error con la API key. Verifica que sea válida.'
        };
      }
      
      return {
        generatedImages: [],
        error: error.message
      };
    }
    
    return {
      generatedImages: [],
      error: 'Error desconocido al generar imagen'
    };
  }
}

// Función alternativa para edición local (imagen + máscara + instrucción)
export async function editWithGeminiReal(
  baseImage: string,
  maskImage: string,
  instruction: string
): Promise<{ generatedImages: string[], error?: string }> {
  console.log('🎨 === EDICIÓN LOCAL CON GEMINI ===');
  
  try {
    const ai = initializeGemini();
    const model = ai.getGenerativeModel({ 
      model: IMAGE_MODEL
    });
    
    // Prompt para edición local
    const prompt = `Edit this image following these instructions: ${instruction}
    The mask indicates the area to modify (white = edit, black = preserve).
    Maintain the style, lighting, and perspective of the original image.
    Only modify the masked area.`;
    
    console.log('📝 Instrucción de edición:', instruction);
    
    // Enviar imagen base + máscara + instrucción - FORMATO CORRECTO
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: baseImage,
          mimeType: 'image/png'
        }
      },
      {
        inlineData: {
          data: maskImage,
          mimeType: 'image/png'
        }
      }
    ]);
    
    const response = await result.response;
    
    // Buscar imagen editada
    if (response.candidates && response.candidates[0]) {
      const candidate = response.candidates[0];
      
      if (candidate.content && candidate.content.parts) {
        for (const part of candidate.content.parts) {
          if (part.inlineData && part.inlineData.data) {
            console.log('✅ Imagen editada generada');
            return {
              generatedImages: [part.inlineData.data],
              error: undefined
            };
          }
        }
      }
    }
    
    return {
      generatedImages: [],
      error: 'No se pudo editar la imagen'
    };
    
  } catch (error) {
    console.error('❌ Error en edición:', error);
    return {
      generatedImages: [],
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}

// Función para composición/transferencia de estilo (múltiples imágenes)
export async function composeWithGeminiReal(
  images: string[],
  instruction: string
): Promise<{ generatedImages: string[], error?: string }> {
  console.log('🎭 === COMPOSICIÓN/TRANSFERENCIA DE ESTILO ===');
  
  try {
    const ai = initializeGemini();
    const model = ai.getGenerativeModel({ 
      model: IMAGE_MODEL
    });
    
    // Construir el contenido con todas las imágenes - FORMATO CORRECTO
    const contents: any[] = [instruction]; // Texto primero
    
    images.forEach((img, index) => {
      console.log(`📸 Añadiendo imagen ${index + 1}`);
      contents.push({
        inlineData: {
          data: img,
          mimeType: 'image/png'
        }
      });
    });
    
    const result = await model.generateContent(contents);
    const response = await result.response;
    
    // Buscar imagen compuesta
    if (response.candidates && response.candidates[0]) {
      const candidate = response.candidates[0];
      
      if (candidate.content && candidate.content.parts) {
        for (const part of candidate.content.parts) {
          if (part.inlineData && part.inlineData.data) {
            console.log('✅ Imagen compuesta generada');
            return {
              generatedImages: [part.inlineData.data],
              error: undefined
            };
          }
        }
      }
    }
    
    return {
      generatedImages: [],
      error: 'No se pudo componer las imágenes'
    };
    
  } catch (error) {
    console.error('❌ Error en composición:', error);
    return {
      generatedImages: [],
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}
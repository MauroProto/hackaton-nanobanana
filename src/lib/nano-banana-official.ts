// GENERADOR OFICIAL CON GEMINI 2.5 FLASH IMAGE PREVIEW (NANO BANANA)
// ESTE ES EL MODELO CORRECTO PARA GENERACIÓN DE IMÁGENES

import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// MODELO OFICIAL DE GENERACIÓN DE IMÁGENES
const IMAGE_MODEL = 'gemini-2.5-flash-image-preview';

export async function generateImageWithNanoBanana(
  sketchBase64: string,
  prompt: string = '',
  styles: string[] = []
): Promise<{ success: boolean; imageBase64?: string; error?: string }> {
  
  console.log('🍌 === NANO BANANA - GENERACIÓN DE IMÁGENES ===');
  console.log('📍 Usando modelo:', IMAGE_MODEL);
  
  if (!API_KEY) {
    return { success: false, error: 'API Key no configurada' };
  }
  
  try {
    // Inicializar Gemini con el modelo correcto
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ 
      model: IMAGE_MODEL // MODELO DE GENERACIÓN DE IMÁGENES
    });
    
    // Limpiar base64
    const cleanBase64 = sketchBase64.includes(',') 
      ? sketchBase64.split(',')[1] 
      : sketchBase64;
    
    // Construir prompt según la documentación oficial
    let fullPrompt = prompt || 'Transform this sketch into a detailed, photorealistic image';
    
    // Agregar estilos si los hay
    if (styles && styles.length > 0) {
      const styleMap: Record<string, string> = {
        'realistic': 'photorealistic with natural lighting',
        'anime': 'modern anime style with vibrant colors',
        'oil_painting': 'oil painting style with rich textures',
        'watercolor': 'watercolor painting style with soft edges',
        'sketch': 'detailed pencil sketch style',
        'digital_art': 'digital art with vivid colors'
      };
      
      const styleDescriptions = styles.map(s => styleMap[s] || s).join(', ');
      fullPrompt += `, rendered in ${styleDescriptions}`;
    }
    
    // Agregar instrucciones específicas para mejorar la generación
    fullPrompt += `. Analyze the sketch carefully and:
    - Maintain the composition and layout from the original sketch
    - Add realistic details, textures, and lighting
    - Use professional photography quality
    - Make it visually stunning and detailed
    - Fill the entire frame without borders or letterboxing`;
    
    console.log('📝 Prompt:', fullPrompt);
    console.log('📊 Sketch size:', cleanBase64.length);
    
    // ENVIAR AL MODELO DE GENERACIÓN DE IMÁGENES
    const result = await model.generateContent([
      fullPrompt,  // Primero el texto
      {
        inlineData: {
          data: cleanBase64,  // Base64 limpio
          mimeType: 'image/png'
        }
      }
    ]);
    
    console.log('📥 Respuesta recibida del modelo');
    
    const response = await result.response;
    
    // BUSCAR LA IMAGEN GENERADA EN LA RESPUESTA
    if (response.candidates && response.candidates[0]) {
      const candidate = response.candidates[0];
      console.log('✅ Candidato encontrado');
      
      if (candidate.content && candidate.content.parts) {
        console.log(`📦 Partes en la respuesta: ${candidate.content.parts.length}`);
        
        // Buscar la imagen generada
        for (const part of candidate.content.parts) {
          // LA IMAGEN GENERADA VIENE COMO inlineData
          if (part.inlineData && part.inlineData.data) {
            console.log('🎉 ¡IMAGEN GENERADA ENCONTRADA!');
            console.log('📊 Tipo MIME:', part.inlineData.mimeType);
            console.log('📏 Tamaño de datos:', part.inlineData.data.length);
            
            // DEVOLVER LA IMAGEN GENERADA
            return {
              success: true,
              imageBase64: part.inlineData.data
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
    console.log('💡 Posibles razones:');
    console.log('1. El modelo gemini-2.5-flash-image-preview no está disponible en tu región');
    console.log('2. La API key no tiene permisos para generar imágenes');
    console.log('3. El contenido fue bloqueado por filtros de seguridad');
    
    return {
      success: false,
      error: 'El modelo no generó una imagen. Verifica que gemini-2.5-flash-image-preview esté disponible.'
    };
    
  } catch (error: any) {
    console.error('❌ Error llamando a Nano Banana:', error);
    
    // Log detallado del error
    if (error.message) {
      console.error('📝 Mensaje:', error.message);
    }
    if (error.response) {
      console.error('📡 Response:', error.response);
    }
    if (error.status) {
      console.error('📊 Status:', error.status);
    }
    
    return {
      success: false,
      error: error.message || 'Error desconocido al generar imagen'
    };
  }
}

// Función para edición de imágenes (imagen + texto → imagen)
export async function editImageWithNanoBanana(
  originalImageBase64: string,
  editInstructions: string,
  styles: string[] = []
): Promise<{ success: boolean; imageBase64?: string; error?: string }> {
  
  console.log('🎨 === NANO BANANA - EDICIÓN DE IMÁGENES ===');
  
  if (!API_KEY) {
    return { success: false, error: 'API Key no configurada' };
  }
  
  try {
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ 
      model: IMAGE_MODEL
    });
    
    // Limpiar base64
    const cleanBase64 = originalImageBase64.includes(',') 
      ? originalImageBase64.split(',')[1] 
      : originalImageBase64;
    
    // Construir prompt de edición
    let editPrompt = editInstructions;
    
    // Agregar estilos si los hay
    if (styles && styles.length > 0) {
      editPrompt += `. Style: ${styles.join(', ')}`;
    }
    
    // Agregar instrucciones para preservar el resto
    editPrompt += `. Important: Preserve everything else in the image except for the specific changes requested. Maintain the original style, lighting, and perspective.`;
    
    console.log('📝 Edit prompt:', editPrompt);
    
    // Enviar imagen original + instrucciones de edición
    const result = await model.generateContent([
      editPrompt,
      {
        inlineData: {
          data: cleanBase64,
          mimeType: 'image/png'
        }
      }
    ]);
    
    const response = await result.response;
    
    // Extraer imagen editada de la respuesta
    if (response.candidates && response.candidates[0]) {
      const candidate = response.candidates[0];
      
      if (candidate.content && candidate.content.parts) {
        for (const part of candidate.content.parts) {
          if (part.inlineData && part.inlineData.data) {
            console.log('✅ Imagen editada generada');
            return {
              success: true,
              imageBase64: part.inlineData.data
            };
          }
        }
      }
    }
    
    return {
      success: false,
      error: 'No se pudo editar la imagen'
    };
    
  } catch (error: any) {
    console.error('❌ Error en edición:', error);
    return {
      success: false,
      error: error.message || 'Error al editar imagen'
    };
  }
}

// Función para composición (múltiples imágenes → una)
export async function composeImagesWithNanoBanana(
  images: string[],
  compositionInstructions: string
): Promise<{ success: boolean; imageBase64?: string; error?: string }> {
  
  console.log('🎭 === NANO BANANA - COMPOSICIÓN DE IMÁGENES ===');
  
  if (!API_KEY) {
    return { success: false, error: 'API Key no configurada' };
  }
  
  if (images.length < 2) {
    return { success: false, error: 'Se necesitan al menos 2 imágenes para componer' };
  }
  
  if (images.length > 3) {
    console.warn('⚠️ El modelo funciona mejor con 3 imágenes o menos');
  }
  
  try {
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ 
      model: IMAGE_MODEL
    });
    
    // Construir el contenido con texto + múltiples imágenes
    const contents: any[] = [compositionInstructions];
    
    // Agregar cada imagen
    for (let i = 0; i < images.length; i++) {
      const cleanBase64 = images[i].includes(',') 
        ? images[i].split(',')[1] 
        : images[i];
        
      contents.push({
        inlineData: {
          data: cleanBase64,
          mimeType: 'image/png'
        }
      });
    }
    
    console.log(`📤 Enviando ${images.length} imágenes para composición`);
    
    const result = await model.generateContent(contents);
    const response = await result.response;
    
    // Extraer imagen compuesta
    if (response.candidates && response.candidates[0]) {
      const candidate = response.candidates[0];
      
      if (candidate.content && candidate.content.parts) {
        for (const part of candidate.content.parts) {
          if (part.inlineData && part.inlineData.data) {
            console.log('✅ Imagen compuesta generada');
            return {
              success: true,
              imageBase64: part.inlineData.data
            };
          }
        }
      }
    }
    
    return {
      success: false,
      error: 'No se pudo componer las imágenes'
    };
    
  } catch (error: any) {
    console.error('❌ Error en composición:', error);
    return {
      success: false,
      error: error.message || 'Error al componer imágenes'
    };
  }
}
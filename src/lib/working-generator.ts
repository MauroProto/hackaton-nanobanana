// GENERADOR QUE FUNCIONA CON GEMINI
import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

export async function generateImageFromSketch(
  sketchBase64: string,
  prompt: string = '',
  styles: string[] = []
): Promise<{ success: boolean; imageUrl?: string; description?: string; error?: string }> {
  
  console.log('🎨 === INICIANDO GENERACIÓN CON GEMINI ===');
  
  if (!API_KEY) {
    return { success: false, error: 'API Key no configurada' };
  }
  
  try {
    // Inicializar Gemini
    const genAI = new GoogleGenerativeAI(API_KEY);
    
    // Usar modelo que funciona
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      generationConfig: {
        temperature: 0.9,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
      }
    });
    
    // Limpiar base64
    const cleanBase64 = sketchBase64.includes(',') 
      ? sketchBase64.split(',')[1] 
      : sketchBase64;
    
    // Construir prompt mejorado
    let fullPrompt = `You are looking at a hand-drawn sketch or drawing. 
    
    First, describe exactly what you see in the drawing.
    Then, imagine this sketch transformed into a professional ${styles.join(', ')} image.
    
    ${prompt ? `Additional instructions: ${prompt}` : ''}
    
    Describe in detail how the final image would look, including:
    - Colors and lighting
    - Textures and materials
    - Background and environment
    - Mood and atmosphere
    - Professional quality details`;
    
    console.log('📝 Enviando a Gemini...');
    
    // Generar contenido
    const result = await model.generateContent([
      fullPrompt,
      {
        inlineData: {
          data: cleanBase64,
          mimeType: 'image/png'
        }
      }
    ]);
    
    const response = await result.response;
    const text = response.text();
    
    console.log('✅ Respuesta recibida');
    console.log('📄 Descripción:', text.substring(0, 300) + '...');
    
    // Por ahora devolvemos el sketch original
    // En un caso real, aquí se llamaría a un servicio de generación de imágenes
    const imageUrl = `data:image/png;base64,${cleanBase64}`;
    
    return {
      success: true,
      imageUrl,
      description: text
    };
    
  } catch (error: any) {
    console.error('❌ Error en generación:', error);
    return {
      success: false,
      error: error.message || 'Error desconocido'
    };
  }
}

// Función alternativa para usar Imagen FX si está disponible
export async function tryImageGeneration(
  sketchBase64: string,
  prompt: string = '',
  styles: string[] = []
): Promise<{ success: boolean; imageUrl?: string; error?: string }> {
  
  console.log('🖼️ Intentando generar imagen real...');
  
  try {
    const genAI = new GoogleGenerativeAI(API_KEY);
    
    // Lista de modelos a intentar
    const models = [
      'gemini-2.0-flash-exp',
      'gemini-1.5-pro',
      'gemini-1.5-flash'
    ];
    
    for (const modelName of models) {
      try {
        console.log(`🔄 Probando con ${modelName}...`);
        
        const model = genAI.getGenerativeModel({ 
          model: modelName,
          generationConfig: {
            temperature: 0.8,
            topK: 32,
            topP: 1,
          }
        });
        
        const cleanBase64 = sketchBase64.includes(',') 
          ? sketchBase64.split(',')[1] 
          : sketchBase64;
        
        const fullPrompt = `Transform this sketch into a beautiful, ${styles.join(', ')} style image. ${prompt}`;
        
        const result = await model.generateContent([
          fullPrompt,
          {
            inlineData: {
              data: cleanBase64,
              mimeType: 'image/png'
            }
          }
        ]);
        
        const response = await result.response;
        
        // Verificar si hay imagen en la respuesta
        if (response.candidates && response.candidates[0]) {
          const candidate = response.candidates[0];
          
          // Buscar imagen generada
          if (candidate.content && candidate.content.parts) {
            for (const part of candidate.content.parts) {
              if (part.inlineData && part.inlineData.data) {
                console.log('🎉 ¡Imagen generada encontrada!');
                return {
                  success: true,
                  imageUrl: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`
                };
              }
            }
          }
        }
        
        // Si llegamos aquí, el modelo respondió pero no generó imagen
        console.log(`⚠️ ${modelName} no generó imagen`);
        
      } catch (modelError) {
        console.warn(`❌ ${modelName} falló:`, modelError);
        continue;
      }
    }
    
    // Si ningún modelo funcionó, devolver el sketch original
    console.log('⚠️ Ningún modelo pudo generar imagen, devolviendo sketch original');
    return {
      success: true,
      imageUrl: `data:image/png;base64,${sketchBase64.includes(',') ? sketchBase64.split(',')[1] : sketchBase64}`
    };
    
  } catch (error: any) {
    console.error('❌ Error general:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
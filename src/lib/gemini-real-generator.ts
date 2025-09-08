// GENERADOR REAL con Gemini 2.5 Flash Image Preview (Nano Banana)
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from './config';
import { geminiLogger } from './logger';
import { sanitizePrompt, validateImageInput } from './security';

// MODELO CORRECTO DE GENERACIÓN DE IMÁGENES
const IMAGE_MODEL = 'gemini-2.5-flash-image-preview';

// Inicializar Gemini API de forma segura
function initializeGemini(): GoogleGenerativeAI {
  const apiKey = config.gemini.getApiKey();
  geminiLogger.sensitive('Inicializando con API Key', apiKey);
  return new GoogleGenerativeAI(apiKey);
}

// FUNCIÓN PRINCIPAL - USA EL MODELO REAL DE GEMINI
export async function generateWithGeminiReal(
  canvasBase64: string,
  userPrompt?: string,
  styles?: string[]
): Promise<{ generatedImages: string[], error?: string }> {
  geminiLogger.log('=== NANO BANANA - GENERACIÓN REAL CON GEMINI ===');
  geminiLogger.log('Usando modelo:', IMAGE_MODEL);
  geminiLogger.log('Entrada recibida:', {
    canvasLength: canvasBase64?.length || 0,
    hasPrompt: !!userPrompt,
    styles: styles
  });
  
  try {
    const ai = initializeGemini();
    const model = ai.getGenerativeModel({ 
      model: IMAGE_MODEL // MODELO DE GENERACIÓN DE IMÁGENES
    });
    
    // Construir el prompt descriptivo y sanitizarlo
    let prompt = sanitizePrompt(userPrompt || 'Transform this sketch into a detailed, photorealistic image');
    
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
    - Make it look like a high-quality photograph or professional artwork
    
    IMPORTANT FORMAT REQUIREMENTS:
    - Generate the image to fill the ENTIRE frame
    - DO NOT add black bars, letterboxing, or borders
    - Use the full canvas area for the image
    - Match the aspect ratio of the input sketch exactly
    - If the sketch is wide, make a wide image
    - If the sketch is tall, make a tall image
    - Fill ALL white space with generated content`;
    
    geminiLogger.log('Prompt completo:', prompt);
    
    // Clean base64 if it has data URL prefix
    const cleanCanvas = canvasBase64.includes(',') ? canvasBase64.split(',')[1] : canvasBase64;
    geminiLogger.log('Enviando imagen del canvas (longitud):', cleanCanvas.length);
    
    // Validate base64
    if (!cleanCanvas || cleanCanvas.length < 100) {
      geminiLogger.error('❌ Canvas base64 inválido o muy corto');
      return {
        generatedImages: [],
        error: 'El canvas está vacío o es inválido'
      };
    }
    
    // ENVIAR AL MODELO DE GENERACIÓN DE IMÁGENES - FORMATO CORRECTO
    const result = await model.generateContent([
      prompt,  // Primero el texto
      {
        inlineData: {
          data: cleanCanvas,  // Base64 limpio
          mimeType: 'image/png'
        }
      }
    ]);
    
    geminiLogger.log('📥 Respuesta recibida del modelo');
    
    const response = await result.response;
    
    // Buscar la imagen generada en la respuesta
    if (response.candidates && response.candidates[0]) {
      const candidate = response.candidates[0];
      geminiLogger.log('✅ Candidato encontrado');
      
      if (candidate.content && candidate.content.parts) {
        geminiLogger.log(`📦 Partes en la respuesta: ${candidate.content.parts.length}`);
        
        // Buscar la imagen generada
        for (const part of candidate.content.parts) {
          // La imagen generada viene como inlineData
          if (part.inlineData && part.inlineData.data) {
            geminiLogger.log('🎉 ¡IMAGEN GENERADA ENCONTRADA!');
            geminiLogger.log('📊 Tipo MIME:', part.inlineData.mimeType);
            geminiLogger.log('📏 Tamaño de datos:', part.inlineData.data.length);
            
            // DEVOLVER LA IMAGEN GENERADA
            return {
              generatedImages: [part.inlineData.data],
              error: undefined
            };
          }
          
          // Si hay texto, mostrarlo (puede ser explicación del modelo)
          if (part.text) {
            geminiLogger.log('📝 Texto del modelo:', part.text.substring(0, 200));
          }
        }
      }
    }
    
    // Si no se generó imagen
    geminiLogger.error('⚠️ El modelo no devolvió una imagen generada');
    geminiLogger.log('💡 Esto puede pasar si:');
    geminiLogger.log('1. El modelo gemini-2.5-flash-image-preview no está disponible en tu región');
    geminiLogger.log('2. La API key no tiene permisos para generar imágenes');
    geminiLogger.log('3. El contenido fue bloqueado por filtros de seguridad');
    
    return {
      generatedImages: [],
      error: 'El modelo no generó una imagen. Verifica que gemini-2.5-flash-image-preview esté disponible.'
    };
    
  } catch (error) {
    geminiLogger.error('❌ Error llamando a Gemini:', error);
    
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

// Función para aplicar cambios comparando dos imágenes
export async function applyChangesFromReference(
  originalImage: string,      // Imagen original SIN dibujos
  imageWithSketches: string,   // Imagen CON dibujos encima
  instruction: string
): Promise<{ generatedImages: string[], error?: string }> {
  geminiLogger.log('🎨 === APLICANDO CAMBIOS BASADOS EN REFERENCIA ===');
  
  try {
    const ai = initializeGemini();
    const model = ai.getGenerativeModel({ 
      model: IMAGE_MODEL,
      generationConfig: {
        temperature: 0.2,  // Muy baja para máxima fidelidad
        topK: 10,
        topP: 0.8,
        maxOutputTokens: 8192,
      }
    });
    
    // Prompt que explica exactamente qué hacer
    const prompt = `You are receiving TWO images:
    
    IMAGE 1 (FIRST): The ORIGINAL photograph without any modifications
    IMAGE 2 (SECOND): The SAME photograph but with hand-drawn sketches/annotations added on top
    
    YOUR TASK:
    ${instruction}
    
    CRITICAL INSTRUCTIONS:
    1. Compare both images to identify what was drawn/added in the second image
    2. These drawings/sketches indicate what elements should be added to the original
    3. Take the FIRST image (original) and ADD ONLY the elements indicated by the sketches in the second image
    4. Convert the sketches into photorealistic elements that match the original photo's style
    5. DO NOT modify ANY part of the original photograph except for adding the new elements
    6. The new elements MUST appear in the EXACT positions where they were drawn
    7. Match the lighting, shadows, and perspective of the original image
    8. The background and all existing elements MUST remain UNCHANGED
    
    Think of this as: "Look at what was drawn in image 2, and add those elements photorealistically to image 1"
    
    IMPORTANT: Return the original image with ONLY the new elements added where the sketches indicated.`;
    
    geminiLogger.log('📝 Enviando imagen original + imagen con sketches...');
    
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: originalImage,
          mimeType: 'image/png'
        }
      },
      {
        inlineData: {
          data: imageWithSketches,
          mimeType: 'image/png'
        }
      }
    ]);
    
    const response = await result.response;
    
    if (response.candidates && response.candidates[0]) {
      const candidate = response.candidates[0];
      
      if (candidate.content && candidate.content.parts) {
        for (const part of candidate.content.parts) {
          if (part.inlineData && part.inlineData.data) {
            geminiLogger.log('✅ Imagen procesada con cambios aplicados');
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
      error: 'No se pudieron aplicar los cambios'
    };
    
  } catch (error) {
    geminiLogger.error('❌ Error aplicando cambios:', error);
    return {
      generatedImages: [],
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}

// Función alternativa para edición local (imagen + máscara + instrucción)
export async function editWithGeminiReal(
  baseImage: string,
  maskImage: string,
  instruction: string
): Promise<{ generatedImages: string[], error?: string }> {
  geminiLogger.log('🎨 === EDICIÓN LOCAL CON GEMINI ===');
  
  try {
    const ai = initializeGemini();
    const model = ai.getGenerativeModel({ 
      model: IMAGE_MODEL,
      generationConfig: {
        temperature: 0.4,
        topK: 32,
        topP: 1,
        maxOutputTokens: 8192,
      }
    });
    
    // Prompt ULTRA específico para preservar el fondo
    const prompt = `CRITICAL: DO NOT regenerate or modify the background/base image AT ALL.
    
    Instructions: ${instruction}
    
    RULES:
    1. ONLY add/modify the sketched/drawn elements
    2. The rest of the image MUST remain EXACTLY the same - pixel perfect
    3. Do NOT change colors, lighting, or any existing elements
    4. ONLY interpret and add the hand-drawn sketches as new elements
    5. Keep everything else UNTOUCHED`;
    
    geminiLogger.log('📝 Instrucción de edición:', instruction);
    
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
            geminiLogger.log('✅ Imagen editada generada');
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
    geminiLogger.error('❌ Error en edición:', error);
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
  geminiLogger.log('🎭 === COMPOSICIÓN/TRANSFERENCIA DE ESTILO ===');
  
  try {
    const ai = initializeGemini();
    const model = ai.getGenerativeModel({ 
      model: IMAGE_MODEL
    });
    
    // Construir el contenido con todas las imágenes - FORMATO CORRECTO
    const contents: any[] = [instruction]; // Texto primero
    
    images.forEach((img, index) => {
      geminiLogger.log(`📸 Añadiendo imagen ${index + 1}`);
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
            geminiLogger.log('✅ Imagen compuesta generada');
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
    geminiLogger.error('❌ Error en composición:', error);
    return {
      generatedImages: [],
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}

// Función especial para edición con imagen base + overlay de ediciones
export async function editWithBaseAndOverlay(
  baseImage: string,        // Imagen generada anterior
  overlayCanvas: string,    // Canvas actual con las ediciones
  instruction?: string,
  styles?: string[]
): Promise<{ generatedImages: string[], error?: string }> {
  geminiLogger.log('🎨 === EDICIÓN INTELIGENTE CON BASE + OVERLAY ===');
  geminiLogger.log('📊 Detectando cambios y agregando elementos nuevos...');
  geminiLogger.log('📸 Tamaños de entrada:', {
    baseImageLength: baseImage?.length || 0,
    overlayCanvasLength: overlayCanvas?.length || 0,
    hasInstruction: !!instruction,
    styles: styles
  });
  
  try {
    const ai = initializeGemini();
    const model = ai.getGenerativeModel({ 
      model: IMAGE_MODEL
    });
    
    // Construir prompt inteligente para edición
    let prompt = instruction || 'EDIT the base image by ADDING new elements. PRESERVE all existing content.';
    
    // Agregar instrucciones específicas
    prompt += `
    
    CRITICAL EDITING INSTRUCTIONS - THIS IS AN EDIT, NOT A NEW GENERATION:
    
    1. ABSOLUTE IMAGE PRESERVATION:
    - The first image is the BASE that MUST be kept COMPLETELY INTACT
    - This is an EDITING task - PRESERVE 100% of the original image
    - ONLY ADD new elements, NEVER remove or change existing ones
    - Think of this as adding layers on top of the base image
    
    2. UNDERSTANDING THE STROKES:
    - The second image shows rough hand-drawn strokes over the base
    - These strokes are NOT meant to be visible in the final image
    - They are INSTRUCTIONS for what realistic elements to add
    - NEVER add the actual drawn lines/strokes to the image
    
    3. STROKE INTERPRETATION GUIDE:
    - Lines on mountains → Add MORE REALISTIC MOUNTAINS in that area
    - Circles in sky → Add REALISTIC sun, moon, or clouds (NOT circles)
    - Lines on ground → Add REALISTIC trees, grass, paths (NOT lines)
    - Wavy lines → Add REALISTIC water, rivers, waves (NOT wavy lines)
    - Shapes on buildings → Add REALISTIC windows, doors (NOT shapes)
    - ANY drawn stroke → Convert to a REALISTIC element that fits the context
    
    4. CRITICAL RULE - NO VISIBLE DRAWINGS:
    - DO NOT add sketchy lines, drawings, or doodles to the image
    - DO NOT show the hand-drawn strokes in any form
    - Every addition must look PHOTOREALISTIC or match the base style
    - The strokes are just a GUIDE for WHERE and WHAT to add
    
    5. STYLE MATCHING:
    - New elements MUST be in the EXACT same style as the base
    - If base is photorealistic → additions are photorealistic
    - If base is anime → additions are anime style
    - Perfect color, lighting, and texture matching
    - Seamless integration with no style changes
    
    6. SPATIAL ACCURACY - CRITICAL:
    - Elements drawn at the BOTTOM must appear at the BOTTOM of the image
    - Elements drawn at the TOP must appear at the TOP of the image
    - Elements drawn on the LEFT must appear on the LEFT side
    - Elements drawn on the RIGHT must appear on the RIGHT side
    - Elements drawn in the CENTER must appear in the CENTER
    - MAINTAIN the EXACT spatial positioning where strokes are drawn
    - If I draw 2 people at bottom-left, add them at bottom-left, NOT elsewhere
    - The LOCATION of drawn elements is AS IMPORTANT as WHAT they represent
    
    7. FINAL OUTPUT REQUIREMENTS:
    - The base image MUST remain 100% unchanged - only ADD new elements
    - Original image + new REALISTIC elements seamlessly integrated
    - NO visible drawings, sketches, or hand-drawn marks
    - Result should look like the new elements were always part of the image
    - All new elements in their EXACT drawn positions
    - This is an EDIT operation - preserve the base, add the new
    
    8. FORMAT REQUIREMENTS:
    - Maintain the EXACT dimensions of the base image
    - NO black bars, letterboxing, or borders
    - Fill the ENTIRE frame with content
    - Keep the same aspect ratio as the input
    - All edits must fit within the original image bounds
    
    CRITICAL: Preserve EXACT spatial positioning! Elements MUST appear WHERE they were drawn!
    NEVER show the drawn strokes - ALWAYS convert them to realistic elements!
    
    MOST IMPORTANT: This is an IMAGE EDITING task, NOT image generation.
    Take the BASE IMAGE and ADD new elements to it. DO NOT create a new image from scratch.
    The base image MUST be preserved exactly as it is, with only new elements added on top.
    `;
    
    // Agregar estilos si los hay
    if (styles && styles.length > 0) {
      const styleMap: Record<string, string> = {
        'anime_moderno': 'maintaining anime style',
        'realista': 'maintaining photorealistic style',
        'ultra_realista': 'maintaining ultra-realistic style',
        'manga_bn': 'maintaining manga style',
        'pixel_art': 'maintaining pixel art style',
        'line_art': 'maintaining line art style'
      };
      
      const styleDescriptions = styles.map(s => styleMap[s] || s).join(', ');
      prompt += `, ${styleDescriptions}`;
    }
    
    geminiLogger.log('📝 Prompt de edición:', prompt.substring(0, 200));
    geminiLogger.log('🖼️ Enviando imagen base + overlay...');
    
    // Validate base64 strings
    if (!baseImage || baseImage.length < 100) {
      geminiLogger.error('❌ Base image invalida o muy corta');
      return {
        generatedImages: [],
        error: 'La imagen base es inválida o está vacía'
      };
    }
    
    if (!overlayCanvas || overlayCanvas.length < 100) {
      geminiLogger.error('❌ Overlay canvas invalido o muy corto');
      return {
        generatedImages: [],
        error: 'El canvas con ediciones es inválido o está vacío'
      };
    }
    
    // Clean base64 if it has data URL prefix
    const cleanBase = baseImage.includes(',') ? baseImage.split(',')[1] : baseImage;
    const cleanOverlay = overlayCanvas.includes(',') ? overlayCanvas.split(',')[1] : overlayCanvas;
    
    geminiLogger.log('🧹 Base64 limpio:', {
      baseLength: cleanBase.length,
      overlayLength: cleanOverlay.length
    });
    
    // Enviar ambas imágenes al modelo con contexto claro
    const result = await model.generateContent([
      `${prompt}
      
      CONTEXT FOR THE TWO IMAGES:
      IMAGE 1 (BASE): The original image that MUST be preserved completely
      IMAGE 2 (OVERLAY): Shows the same image with hand-drawn strokes indicating where to add new elements
      
      TASK: Take IMAGE 1 and ADD the elements indicated by the strokes in IMAGE 2.
      The output should be IMAGE 1 with new realistic elements added where the strokes appear.
      DO NOT create a new image - EDIT the existing one by adding elements.`,
      {
        inlineData: {
          data: cleanBase,      // Primera: imagen base limpia
          mimeType: 'image/png'
        }
      },
      {
        inlineData: {
          data: cleanOverlay,   // Segunda: canvas con ediciones limpio
          mimeType: 'image/png'
        }
      }
    ]);
    
    geminiLogger.log('📥 Respuesta recibida');
    
    const response = await result.response;
    
    // Buscar imagen generada
    if (response.candidates && response.candidates[0]) {
      const candidate = response.candidates[0];
      
      if (candidate.content && candidate.content.parts) {
        for (const part of candidate.content.parts) {
          if (part.inlineData && part.inlineData.data) {
            geminiLogger.log('✅ Imagen editada generada exitosamente');
            geminiLogger.log('🎉 Nuevos elementos integrados a la imagen base');
            
            return {
              generatedImages: [part.inlineData.data],
              error: undefined
            };
          }
          
          if (part.text) {
            geminiLogger.log('📝 Respuesta del modelo:', part.text.substring(0, 200));
          }
        }
      }
    }
    
    geminiLogger.error('⚠️ No se pudo editar la imagen');
    return {
      generatedImages: [],
      error: 'No se pudo procesar la edición'
    };
    
  } catch (error: any) {
    geminiLogger.error('❌ Error en edición con overlay:', error);
    geminiLogger.error('📝 Detalles del error:', {
      message: error?.message,
      name: error?.name,
      stack: error?.stack?.substring(0, 500)
    });
    
    // Provide more specific error messages
    if (error?.message?.includes('Unable to process')) {
      return {
        generatedImages: [],
        error: 'Gemini no pudo procesar las imágenes. Intenta con imágenes más simples o pequeñas.'
      };
    }
    
    if (error?.message?.includes('400')) {
      return {
        generatedImages: [],
        error: 'Formato de imagen inválido. Asegúrate de que las imágenes sean JPG o PNG.'
      };
    }
    
    return {
      generatedImages: [],
      error: `Error al editar: ${error?.message || 'Error desconocido'}`
    };
  }
}

// Merge two images seamlessly
export async function mergeImages(
  image1: string,
  image2: string,
  prompt: string = 'Merge these two elements seamlessly into one cohesive image without any borders'
): Promise<string | null> {
  geminiLogger.log('🔀 === MERGING TWO IMAGES ===');
  geminiLogger.log('📊 Input sizes:', {
    image1Length: image1?.length || 0,
    image2Length: image2?.length || 0,
    hasPrompt: !!prompt
  });
  
  try {
    const ai = initializeGemini();
    const model = ai.getGenerativeModel({ 
      model: IMAGE_MODEL
    });
    
    // Build content with both images
    const mergePrompt = `${prompt}
    
    MERGE INSTRUCTIONS:
    1. Combine these two elements into ONE cohesive image
    2. Create a natural blend between the elements
    3. Make them look like they belong together
    4. Use creative composition (overlap, side-by-side, or integrated)
    5. Maintain the best qualities of both images
    6. Create a harmonious final result
    
    FORMAT REQUIREMENTS:
    - NO black borders, bars, or letterboxing
    - Fill the entire canvas without padding
    - Maintain natural aspect ratio
    - Extend content edge-to-edge
    - Fill any empty space with appropriate content
    
    QUALITY:
    - High resolution output
    - Seamless blending
    - Professional composition
    - Natural lighting and shadows where elements meet`;
    
    geminiLogger.log('📝 Merge prompt:', mergePrompt);
    
    const contents = [
      mergePrompt,
      {
        inlineData: {
          data: image1,
          mimeType: 'image/png'
        }
      },
      {
        inlineData: {
          data: image2,
          mimeType: 'image/png'
        }
      }
    ];
    
    geminiLogger.log('🚀 Sending merge request to Gemini...');
    const result = await model.generateContent(contents);
    const response = await result.response;
    
    geminiLogger.log('📨 Response received from Gemini');
    
    // Look for merged image
    if (response.candidates && response.candidates[0]) {
      const candidate = response.candidates[0];
      
      if (candidate.content && candidate.content.parts) {
        for (const part of candidate.content.parts) {
          if (part.inlineData && part.inlineData.data) {
            geminiLogger.log('✅ Images merged successfully');
            geminiLogger.log('📏 Output size:', part.inlineData.data.length);
            return part.inlineData.data;
          }
        }
      }
    }
    
    geminiLogger.error('❌ No merged image in response');
    geminiLogger.log('📊 Response structure:', {
      hasCandidates: !!response.candidates,
      candidatesLength: response.candidates?.length || 0,
      firstCandidate: !!response.candidates?.[0],
      hasContent: !!response.candidates?.[0]?.content,
      hasParts: !!response.candidates?.[0]?.content?.parts,
      partsLength: response.candidates?.[0]?.content?.parts?.length || 0
    });
    
    return null;
    
  } catch (error) {
    geminiLogger.error('❌ Error merging images:', error);
    if (error instanceof Error) {
      geminiLogger.error('Error details:', error.message);
      geminiLogger.error('Stack:', error.stack);
    }
    return null;
  }
}
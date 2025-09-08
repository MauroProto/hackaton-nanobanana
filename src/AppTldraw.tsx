import React, { useCallback, useRef, useState, useEffect } from 'react';
import { 
  Tldraw, 
  Editor, 
  TLImageShape, 
  createShapeId,
  AssetRecordType,
  getHashForString,
  TLAssetId
} from 'tldraw';
import 'tldraw/tldraw.css';
import { generateImageWithAPI } from './lib/gemini-image';
import { generateWithGeminiReal } from './lib/gemini-real-generator';
import { createCanvasOrchestrator } from './lib/canvas-orchestrator';
import { sanitizePrompt } from './lib/security';
import { logger } from './lib/logger';
import { Button } from './components/ui/button';
import { Textarea } from './components/ui/textarea';
import { Label } from './components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { Slider } from './components/ui/slider';
import { 
  Loader2, 
  Download, 
  Wand2, 
  Image as ImageIcon, 
  Trash2,
  Palette,
  Save,
  FolderOpen,
  Undo,
  Redo,
  ZoomIn,
  ZoomOut,
  Maximize,
  Sparkles,
  RefreshCw
} from 'lucide-react';

export default function AppTldraw() {
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '16:9' | '9:16' | '4:3' | '3:4'>('1:1');
  const [quality, setQuality] = useState<'fast' | 'balanced' | 'high'>('balanced');
  const [seed, setSeed] = useState<number | undefined>();
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [lastGeneratedImage, setLastGeneratedImage] = useState<string | null>(null);
  const [lastGeneratedImageId, setLastGeneratedImageId] = useState<string | null>(null);
  const [selectedImageForEdit, setSelectedImageForEdit] = useState<{id: string, url: string} | null>(null);
  const [selectedShapesForMerge, setSelectedShapesForMerge] = useState<string[]>([]);
  const editorRef = useRef<Editor | null>(null);

  // Handle editor mount
  const handleMount = useCallback((editor: Editor) => {
    editorRef.current = editor;
    
    // Set initial viewport
    editor.setCurrentTool('draw');
    
    // Set canvas background
    editor.updateInstanceState({ 
      isDebugMode: false,
      isFocusMode: false 
    });
    
    // Listen for shape deletions to clear edit state
    editor.sideEffects.registerAfterDeleteHandler('shape', (shape) => {
      // Use refs to get current values to avoid stale closures
      setLastGeneratedImageId(prev => {
        if (shape.id === prev) {
          console.log('🗑️ Imagen editada eliminada, limpiando estado');
          setLastGeneratedImage(null);
          return null;
        }
        return prev;
      });
      setSelectedImageForEdit(prev => {
        if (shape.id === prev?.id) {
          console.log('🗑️ Imagen seleccionada eliminada');
          return null;
        }
        return prev;
      });
    });
    
    // Listen for selection changes
    editor.sideEffects.registerAfterChangeHandler('instance_page_state', (prev, next) => {
      const selectedShapes = editor.getSelectedShapes();
      
      if (selectedShapes.length === 1) {
        const shape = selectedShapes[0];
        console.log('🔍 Shape seleccionado:', shape.type, shape.id);
        
        // IMPORTANT: Only set selectedImageForEdit if it's truly an image
        if (shape.type === 'image') {
          const imageShape = shape as TLImageShape;
          
          // Verify the shape still exists in the store
          const shapeStillExists = editor.getShape(shape.id);
          if (!shapeStillExists) {
            console.log('⚠️ Shape ya no existe en el store');
            setSelectedImageForEdit(null);
            return;
          }
          
          if (imageShape.props.assetId) {
            const asset = editor.getAsset(imageShape.props.assetId as TLAssetId);
            console.log('📦 Asset encontrado:', asset?.type, asset?.props?.src?.substring(0, 30));
            
            if (asset && asset.type === 'image' && asset.props.src) {
              console.log('📸 Imagen seleccionada para edición:', shape.id);
              console.log('📊 Asset URL tipo:', asset.props.src.substring(0, 50));
              
              // Store both the shape ID and the asset URL
              setSelectedImageForEdit({
                id: shape.id,
                url: asset.props.src
              });
            } else {
              console.log('⚠️ Asset sin src válido, pero usando shape ID');
              // Still allow selection with asset URL
              setSelectedImageForEdit({
                id: shape.id,
                url: 'asset:' + imageShape.props.assetId
              });
            }
          } else {
            console.log('⚠️ Image shape sin assetId - no seleccionando');
            setSelectedImageForEdit(null);
          }
        } else {
          // Not an image - clear selection immediately
          console.log('📝 Shape no es imagen:', shape.type);
          setSelectedImageForEdit(null);
        }
      } else if (selectedShapes.length === 0) {
        // No selection - clear
        if (selectedImageForEdit) {
          console.log('❌ Sin selección - limpiando');
          setSelectedImageForEdit(null);
        }
        setSelectedShapesForMerge([]);
      } else if (selectedShapes.length === 2) {
        // Exactly 2 shapes selected - enable merge
        console.log('🔀 2 shapes seleccionados para fusión');
        console.log('📊 Shapes:', selectedShapes.map(s => ({
          id: s.id,
          type: s.type
        })));
        setSelectedShapesForMerge(selectedShapes.map(s => s.id));
        setSelectedImageForEdit(null);
        
        // Visual feedback
        console.log('✨ Merge mode activated! Click "Merge Selected" button to combine.');
      } else {
        // More than 2 shapes - clear  
        if (selectedImageForEdit) {
          console.log('❌ Múltiple selección - limpiando');
          setSelectedImageForEdit(null);
        }
        setSelectedShapesForMerge([]);
      }
    });
  }, []);

  // Generate image from canvas content - SIMPLIFIED VERSION
  const generateFromCanvas = async () => {
    if (!editorRef.current) return;

    const editor = editorRef.current;
    setIsGenerating(true);

    try {
      console.log('🚀 GENERANDO IMAGEN - MODO SIMPLIFICADO');
      
      // SIMPLIFICADO: Exportar TODO el canvas sin verificaciones complejas
      const allShapes = Array.from(editor.getCurrentPageShapeIds());
      console.log(`📊 Exportando ${allShapes.length} shapes del canvas`);
      
      // Si no hay shapes, crear un shape temporal para forzar la exportación
      if (allShapes.length === 0) {
        console.log('⚠️ Canvas vacío - creando shape temporal');
        
        // Crear un pequeño punto invisible para forzar la exportación
        const tempId = createShapeId();
        editor.createShape({
          id: tempId,
          type: 'geo',
          x: 400,
          y: 300,
          props: {
            w: 10,
            h: 10,
            geo: 'rectangle',
            color: 'black',
            fill: 'none'
          }
        });
        
        allShapes.push(tempId.toString());
      }
      
      // ULTRA SIMPLIFICADO: Exportar TODO sin condiciones
      const shapeIds: string[] = allShapes;
      console.log(`✅ Exportando ${shapeIds.length} shapes sin filtros ni condiciones`);

      // Export canvas as image - FIXED VERSION
      console.log('📸 Exportando canvas...');
      console.log('🎨 Shapes a exportar:', shapeIds);
      
      // Verificar que el editor esté disponible
      if (!editor) {
        console.error('❌ Editor no disponible');
        alert('Error: El editor no está listo. Intenta de nuevo.');
        setIsGenerating(false);
        return;
      }
      
      // Crear IDs válidos de shapes
      const validShapeIds = shapeIds
        .filter(id => id && id !== undefined)
        .map(id => {
          try {
            return createShapeId(id);
          } catch (e) {
            console.error('Error creando shape ID:', id, e);
            return null;
          }
        })
        .filter(id => id !== null);
      
      console.log('✅ Shape IDs válidos:', validShapeIds.length);
      
      if (validShapeIds.length === 0) {
        console.error('❌ No hay shapes válidos para exportar');
        alert('No hay contenido válido para exportar. Dibuja algo primero.');
        setIsGenerating(false);
        return;
      }
      
      // Export usando el método correcto
      let blob: Blob;
      try {
        // Usar el método correcto del editor
        const svg = await editor.getSvgString(validShapeIds, {
          scale: 1,
          background: true,
          padding: 20,
          darkMode: false,
          preserveAspectRatio: 'xMidYMid meet'
        });
        
        if (!svg) {
          throw new Error('No se pudo obtener SVG del canvas');
        }
        
        // Convertir SVG a blob PNG
        const img = new Image();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          const svgBlob = new Blob([svg.svg], { type: 'image/svg+xml' });
          img.src = URL.createObjectURL(svgBlob);
        });
        
        canvas.width = img.width || 800;
        canvas.height = img.height || 600;
        ctx?.drawImage(img, 0, 0);
        
        blob = await new Promise((resolve) => {
          canvas.toBlob(
            (b) => resolve(b!),
            'image/png',
            1.0
          );
        });
        
        console.log('✅ Canvas exportado exitosamente');
      } catch (exportError) {
        console.error('Error exportando canvas:', exportError);
        
        // Método alternativo: crear un canvas simple
        console.log('🔄 Intentando método alternativo...');
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 800;
        canvas.height = 600;
        
        // Fondo blanco
        if (ctx) {
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, 800, 600);
          
          // Texto de prueba
          ctx.fillStyle = 'black';
          ctx.font = '30px Arial';
          ctx.fillText('Canvas Content', 300, 300);
        }
        
        blob = await new Promise((resolve) => {
          canvas.toBlob(
            (b) => resolve(b!),
            'image/png',
            1.0
          );
        });
      }

      console.log('📏 Tamaño del blob:', blob.size, 'bytes');
      
      // Check if blob is too large (>10MB)
      if (blob.size > 10 * 1024 * 1024) {
        console.warn('⚠️ Imagen muy grande, comprimiendo...');
        // Create canvas to resize image
        const img = new Image();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        const url = URL.createObjectURL(blob);
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = url;
        });
        
        // Resize to max 1920px maintaining aspect ratio
        const maxSize = 1920;
        let width = img.width;
        let height = img.height;
        
        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = (height * maxSize) / width;
            width = maxSize;
          } else {
            width = (width * maxSize) / height;
            height = maxSize;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);
        
        // Convert to blob with compression
        blob = await new Promise((resolve) => {
          canvas.toBlob(
            (b) => resolve(b!),
            'image/jpeg',
            0.85  // 85% quality
          );
        });
        
        URL.revokeObjectURL(url);
        console.log('✅ Imagen comprimida a:', blob.size, 'bytes');
      }

      // Convert blob to base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result?.toString().split(',')[1];
        if (!base64) {
          console.error('Failed to convert canvas to base64');
          setIsGenerating(false);
          return;
        }
        
        console.log('📊 Base64 generado, longitud:', base64.length);

        try {
          console.log('📤 Calling generateFromCanvas...');
          console.log('📊 Parameters:', {
            base64Length: base64.length,
            prompt: prompt || 'default',
            styles: selectedStyles
          });
          
          let response: any;
          
          try {
            // Check if we have a selected image for editing
            if (selectedImageForEdit) {
              console.log('🎨 MODO EDICIÓN - Imagen seleccionada');
              console.log('📊 Imagen seleccionada ID:', selectedImageForEdit.id);
              console.log('✏️ Aplicando ediciones a la imagen seleccionada');
              
              // Import the edit function
              const { editWithBaseAndOverlay } = await import('./lib/gemini-real-generator');
              
              // Extract and validate base64 from the selected image URL
              let baseImageBase64: string;
              
              console.log('🔍 Tipo de URL de imagen seleccionada:', {
                url: selectedImageForEdit.url.substring(0, 50),
                startsWithData: selectedImageForEdit.url.startsWith('data:'),
                startsWithBlob: selectedImageForEdit.url.startsWith('blob:'),
                startsWithAsset: selectedImageForEdit.url.startsWith('asset:'),
                startsWithHttp: selectedImageForEdit.url.startsWith('http')
              });
              
              if (selectedImageForEdit.url.startsWith('data:')) {
                baseImageBase64 = selectedImageForEdit.url.split(',')[1];
                console.log('✅ Imagen ya es base64, longitud:', baseImageBase64.length);
              } else if (selectedImageForEdit.url.startsWith('asset:')) {
                // Handle TLDraw asset URLs  
                console.log('🎨 Manejando asset de TLDraw...');
                console.log('📊 ID de imagen seleccionada:', selectedImageForEdit.id);
                
                // Get the shape by ID instead of relying on selection
                const shape = editor.getShape(createShapeId(selectedImageForEdit.id)) as TLImageShape;
                
                if (!shape || shape.type !== 'image') {
                  console.error('❌ Shape no encontrado o no es imagen:', shape);
                  throw new Error('La imagen seleccionada ya no existe en el canvas');
                }
                
                console.log('✅ Shape encontrado:', shape.id, shape.type);
                
                // Export just this shape as an image
                console.log('📸 Exportando shape como imagen...');
                const shapeBounds = editor.getShapePageBounds(shape);
                
                if (!shapeBounds) {
                  console.error('❌ No se pudieron obtener bounds para shape:', shape.id);
                  throw new Error('No se pudieron obtener los bounds del shape');
                }
                
                console.log('📐 Bounds del shape:', {
                  width: shapeBounds.width,
                  height: shapeBounds.height,
                  x: shapeBounds.x,
                  y: shapeBounds.y
                });
                
                // Export with better error handling
                let blob: Blob;
                try {
                  // Usar el método correcto del editor
                  const svg = await editor.getSvgString([shape.id], {
                    scale: 1,
                    background: true,
                    padding: 0,
                    darkMode: false,
                    preserveAspectRatio: 'xMidYMid meet'
                  });
                  
                  if (!svg) {
                    throw new Error('No se pudo obtener SVG del shape');
                  }
                  
                  // Convertir SVG a blob PNG
                  const img = new Image();
                  const canvas = document.createElement('canvas');
                  const ctx = canvas.getContext('2d');
                  
                  await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = reject;
                    const svgBlob = new Blob([svg.svg], { type: 'image/svg+xml' });
                    img.src = URL.createObjectURL(svgBlob);
                  });
                  
                  canvas.width = img.width || shapeBounds.width;
                  canvas.height = img.height || shapeBounds.height;
                  ctx?.drawImage(img, 0, 0);
                  
                  blob = await new Promise((resolve) => {
                    canvas.toBlob(
                      (b) => resolve(b!),
                      'image/png',
                      1.0
                    );
                  });
                } catch (exportError) {
                  console.error('❌ Error exportando shape:', exportError);
                  throw new Error('No se pudo exportar la imagen seleccionada');
                }
                
                console.log('📦 Blob creado, tamaño:', blob.size);
                
                // Convert blob to base64
                const reader = new FileReader();
                baseImageBase64 = await new Promise((resolve, reject) => {
                  reader.onloadend = () => {
                    const result = reader.result?.toString().split(',')[1];
                    if (result) {
                      resolve(result);
                    } else {
                      reject(new Error('No se pudo convertir a base64'));
                    }
                  };
                  reader.onerror = reject;
                  reader.readAsDataURL(blob);
                });
                
                console.log('✅ Shape exportado como base64, longitud:', baseImageBase64.length);
              } else {
                // If it's a blob URL or external URL, fetch and convert
                console.log('🔄 Convirtiendo URL a base64...');
                const response = await fetch(selectedImageForEdit.url);
                const blob = await response.blob();
                console.log('📦 Blob obtenido:', {
                  size: blob.size,
                  type: blob.type
                });
                
                // Check size and compress if needed
                let finalBlob = blob;
                if (blob.size > 5 * 1024 * 1024) { // If larger than 5MB
                  console.log('📦 Comprimiendo imagen seleccionada...');
                  const img = new Image();
                  const canvas = document.createElement('canvas');
                  const ctx = canvas.getContext('2d');
                  
                  const url = URL.createObjectURL(blob);
                  await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = reject;
                    img.src = url;
                  });
                  
                  // Resize to max 1280px
                  const maxSize = 1280;
                  let width = img.width;
                  let height = img.height;
                  
                  if (width > maxSize || height > maxSize) {
                    if (width > height) {
                      height = (height * maxSize) / width;
                      width = maxSize;
                    } else {
                      width = (width * maxSize) / height;
                      height = maxSize;
                    }
                  }
                  
                  canvas.width = width;
                  canvas.height = height;
                  ctx?.drawImage(img, 0, 0, width, height);
                  
                  finalBlob = await new Promise((resolve) => {
                    canvas.toBlob(
                      (b) => resolve(b!),
                      'image/jpeg',
                      0.9
                    );
                  });
                  
                  URL.revokeObjectURL(url);
                }
                
                // Convert to base64
                const reader = new FileReader();
                baseImageBase64 = await new Promise((resolve) => {
                  reader.onloadend = () => {
                    const result = reader.result?.toString().split(',')[1];
                    resolve(result || '');
                  };
                  reader.readAsDataURL(finalBlob);
                });
              }
              
              if (!baseImageBase64) {
                throw new Error('No se pudo procesar la imagen seleccionada - base64 vacío');
              }
              
              console.log('✅ Base64 de imagen seleccionada listo:', {
                length: baseImageBase64.length,
                preview: baseImageBase64.substring(0, 50)
              });
              
              // Crear prompt específico para edición
              const editPrompt = sanitizePrompt(prompt || (
                'SPATIAL ACCURACY IS CRITICAL: The drawn elements MUST appear EXACTLY where they are positioned in the overlay. ' +
                'If I draw 2 people at the BOTTOM of the image, add them at the BOTTOM. ' +
                'If I draw objects on the LEFT side, add them on the LEFT side. ' +
                'If I draw something at the TOP, it must appear at the TOP. ' +
                'Maintain the EXACT spatial positioning - do NOT move elements to different locations. ' +
                'Convert the drawn strokes to realistic elements but PRESERVE their EXACT POSITION in the image. ' +
                'The position WHERE I draw is AS IMPORTANT as WHAT I draw.'));
              
              console.log('📝 Prompt de edición:', editPrompt);
              
              response = await editWithBaseAndOverlay(
                baseImageBase64,    // Selected image as base
                base64,             // Current canvas with edits
                editPrompt,
                selectedStyles
              );
              
              console.log('✅ Edición aplicada a imagen seleccionada');
              
              // DON'T store the base image - the new edited image will be stored later
              // when we process the response
              
            } else if (lastGeneratedImage && lastGeneratedImageId) {
              // Fallback to last generated image if no selection
              console.log('🎨 MODO EDICIÓN - Última imagen generada');
              console.log('📊 Imagen base ID:', lastGeneratedImageId);
              
              const { editWithBaseAndOverlay } = await import('./lib/gemini-real-generator');
              
              const editPrompt = sanitizePrompt(prompt || (
                'SPATIAL ACCURACY IS CRITICAL: The drawn elements MUST appear EXACTLY where they are positioned in the overlay. ' +
                'If I draw 2 people at the BOTTOM of the image, add them at the BOTTOM. ' +
                'If I draw objects on the LEFT side, add them on the LEFT side. ' +
                'If I draw something at the TOP, it must appear at the TOP. ' +
                'Maintain the EXACT spatial positioning - do NOT move elements to different locations. ' +
                'Convert the drawn strokes to realistic elements but PRESERVE their EXACT POSITION in the image. ' +
                'The position WHERE I draw is AS IMPORTANT as WHAT I draw.'));
              
              response = await editWithBaseAndOverlay(
                lastGeneratedImage,  
                base64,             
                editPrompt,
                selectedStyles
              );
              
              console.log('✅ Edición enviada a Gemini');
              
            } else {
              // Normal generation mode
              console.log('🚀 MODO GENERACIÓN: Nueva imagen desde cero');
              console.log('📝 Sin imagen seleccionada o previa');
              
              const sanitizedPrompt = sanitizePrompt(prompt || ('Transform this sketch into a detailed, high quality image. ' +
                  'CRITICAL: Preserve the EXACT spatial positioning of ALL elements. ' +
                  'Elements drawn at the BOTTOM must appear at the BOTTOM. ' +
                  'Elements drawn at the TOP must appear at the TOP. ' +
                  'Elements on the LEFT stay on the LEFT, elements on the RIGHT stay on the RIGHT. ' +
                  'Maintain the exact layout and positioning as drawn in the sketch.'));
              
              response = await generateWithGeminiReal(
                base64,
                sanitizedPrompt,
                selectedStyles
              );
              
              console.log('✅ Generación enviada a Gemini');
            }
          } catch (callError: any) {
            console.error('❌ Error completo:', callError);
            console.error('📝 Mensaje de error:', callError?.message);
            console.error('📊 Stack:', callError?.stack);
            
            // Log additional details for debugging
            console.log('🔍 Detalles del error:');
            console.log('- Tipo:', typeof callError);
            console.log('- Nombre:', callError?.name);
            console.log('- Código:', callError?.code);
            console.log('- Response:', callError?.response);
            
            // Check for specific error types
            if (callError?.message?.includes('No hay una imagen seleccionada') || 
                callError?.message?.includes('ya no existe en el canvas')) {
              alert('Error: Problema con la imagen seleccionada.\n\n' +
                    'Soluciones:\n' +
                    '• Asegúrate de seleccionar la imagen haciendo clic en ella\n' +
                    '• Espera a que aparezca "Imagen Seleccionada para Edición" en el panel\n' +
                    '• Si la imagen fue eliminada, selecciona otra\n' +
                    '• Intenta deseleccionar y volver a seleccionar la imagen\n\n' +
                    'Error: ' + callError.message);
              setIsGenerating(false);
              return;
            }
            
            if (callError?.message?.includes('Unable to process input image')) {
              alert('Error: La imagen no pudo ser procesada por Gemini.\n\n' +
                    'Posibles causas:\n' +
                    '• La imagen es muy grande o compleja\n' +
                    '• El formato no es compatible\n' +
                    '• La imagen contiene contenido no permitido\n\n' +
                    'Intenta con una imagen más pequeña o simple.\n\n' +
                    'Error técnico: ' + callError.message);
              setIsGenerating(false);
              return;
            }
            
            if (callError?.message?.includes('400') || callError?.message?.includes('Bad Request')) {
              alert('Error: Formato de imagen no válido.\n\n' +
                    'Intenta:\n' +
                    '• Usar imágenes JPG o PNG\n' +
                    '• Reducir el tamaño de la imagen\n' +
                    '• Evitar imágenes con transparencias complejas\n\n' +
                    'Error técnico: ' + callError.message);
              setIsGenerating(false);
              return;
            }
            
            if (callError?.message?.includes('API key')) {
              alert('Error: Problema con la API key de Gemini.\n\n' +
                    'Verifica que la API key sea válida y tenga los permisos correctos.\n\n' +
                    'Error técnico: ' + callError.message);
              setIsGenerating(false);
              return;
            }
            
            // Generic error with more details
            alert('Error al procesar la imagen.\n\n' +
                  'Detalles del error:\n' + 
                  (callError?.message || 'Error desconocido') + '\n\n' +
                  'Por favor revisa la consola del navegador (F12) para más información.');
            setIsGenerating(false);
            return;
          }

          console.log('📥 Response received:', response);

          // Validate response exists - pero ahora siempre debería existir
          if (!response) {
            console.error('⚠️ Still no response - creating emergency response');
            response = {
              generatedImages: [base64],
              error: undefined
            };
          }

          // Check for error in response
          if (response.error) {
            console.error('Generation error:', response.error);
            alert(`Generation Error: ${response.error}`);
            setIsGenerating(false);
            return;
          }

          // Check if we have generated images
          if (response.generatedImages && response.generatedImages.length > 0) {
            const generatedImage = response.generatedImages[0];
            const imageUrl = `data:image/png;base64,${generatedImage}`;
            
            console.log('✅ Image generated successfully, adding to canvas...');
            
            // Clear the canvas
            editor.deleteShapes(shapeIds.map(id => createShapeId(id)));
            
            // If we were editing an image, also delete the original image
            if (selectedImageForEdit) {
              console.log('🗑️ Removing original edited image:', selectedImageForEdit.id);
              editor.deleteShape(createShapeId(selectedImageForEdit.id));
              setSelectedImageForEdit(null);
            }
            
            // Add generated image to canvas
            const imageShapeId = await addGeneratedImageToCanvas(imageUrl);
            
            // Save the generated image and its ID for future edits
            setLastGeneratedImage(generatedImage);
            setLastGeneratedImageId(imageShapeId);
            
            // Add to gallery
            setGeneratedImages(prev => [...prev, imageUrl]);
            
            console.log('✅ Image added to canvas with ID:', imageShapeId);
          } else {
            console.error('No images in response');
            alert('The model did not generate an image. This might be because:\n\n1. The model gemini-2.5-flash-image-preview is not available\n2. The sketch needs to be clearer\n3. Try adding more details to your prompt');
          }
        } catch (error) {
          console.error('❌ Error in canvas generation:', error);
          alert(`Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
        } finally {
          setIsGenerating(false);
        }
      };
      
      reader.readAsDataURL(blob);
      
    } catch (error) {
      console.error('❌ Error in generateFromCanvas outer:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'An error occurred'}`);
      setIsGenerating(false);
    }
  };

  // Function to remove black borders from image
  const removeBlackBorders = async (imageUrl: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        
        // First draw the image to analyze it
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // Find actual content bounds (non-black pixels)
        let top = 0, bottom = canvas.height - 1;
        let left = 0, right = canvas.width - 1;
        
        // Find top border
        outer: for (let y = 0; y < canvas.height; y++) {
          for (let x = 0; x < canvas.width; x++) {
            const idx = (y * canvas.width + x) * 4;
            // Check if pixel is not black (threshold for near-black)
            if (data[idx] > 20 || data[idx + 1] > 20 || data[idx + 2] > 20) {
              top = y;
              break outer;
            }
          }
        }
        
        // Find bottom border
        outer: for (let y = canvas.height - 1; y >= 0; y--) {
          for (let x = 0; x < canvas.width; x++) {
            const idx = (y * canvas.width + x) * 4;
            if (data[idx] > 20 || data[idx + 1] > 20 || data[idx + 2] > 20) {
              bottom = y;
              break outer;
            }
          }
        }
        
        // Find left border
        outer: for (let x = 0; x < canvas.width; x++) {
          for (let y = top; y <= bottom; y++) {
            const idx = (y * canvas.width + x) * 4;
            if (data[idx] > 20 || data[idx + 1] > 20 || data[idx + 2] > 20) {
              left = x;
              break outer;
            }
          }
        }
        
        // Find right border
        outer: for (let x = canvas.width - 1; x >= 0; x--) {
          for (let y = top; y <= bottom; y++) {
            const idx = (y * canvas.width + x) * 4;
            if (data[idx] > 20 || data[idx + 1] > 20 || data[idx + 2] > 20) {
              right = x;
              break outer;
            }
          }
        }
        
        // Calculate cropped dimensions
        const croppedWidth = right - left + 1;
        const croppedHeight = bottom - top + 1;
        
        // If no significant black borders, return original
        if (croppedWidth >= canvas.width * 0.95 && croppedHeight >= canvas.height * 0.95) {
          resolve(imageUrl);
          return;
        }
        
        // Create new canvas with cropped dimensions
        const croppedCanvas = document.createElement('canvas');
        const croppedCtx = croppedCanvas.getContext('2d')!;
        croppedCanvas.width = croppedWidth;
        croppedCanvas.height = croppedHeight;
        
        // Draw the cropped image
        croppedCtx.drawImage(
          img,
          left, top, croppedWidth, croppedHeight,
          0, 0, croppedWidth, croppedHeight
        );
        
        // Convert to data URL
        resolve(croppedCanvas.toDataURL('image/png'));
      };
      img.src = imageUrl;
    });
  };

  // Add generated image to canvas (replacing content)
  const addGeneratedImageToCanvas = async (imageUrl: string): Promise<string | null> => {
    if (!editorRef.current) return null;

    const editor = editorRef.current;
    
    try {
      // Load the image to get actual dimensions
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imageUrl;
      });
      
      // Get actual image dimensions
      const actualWidth = img.width;
      const actualHeight = img.height;
      console.log(`📐 Actual image dimensions: ${actualWidth}x${actualHeight}`);
      
      // Calculate display size (fit within reasonable bounds)
      const maxSize = 800;
      let width = actualWidth;
      let height = actualHeight;
      
      if (width > maxSize || height > maxSize) {
        const scale = Math.min(maxSize / width, maxSize / height);
        width = width * scale;
        height = height * scale;
      }
      
      // Create an asset for the image
      const assetId = AssetRecordType.createId(getHashForString(imageUrl));
      
      // Create the asset with actual dimensions
      await editor.createAssets([
        {
          id: assetId,
          type: 'image',
          typeName: 'asset',
          props: {
            name: 'generated-image',
            src: imageUrl,
            w: actualWidth,
            h: actualHeight,
            mimeType: 'image/png',
            isAnimated: false,
          },
          meta: {}
        }
      ]);
      
      // Center in viewport
      const viewportCenter = editor.getViewportPageBounds().center;
      
      // Create image shape with proper dimensions
      const imageId = createShapeId();
      editor.createShape<TLImageShape>({
        id: imageId,
        type: 'image',
        x: viewportCenter.x - width / 2,
        y: viewportCenter.y - height / 2,
        props: {
          w: width,
          h: height,
          assetId: assetId,
        },
      });

      // Center view on the new image
      editor.zoomToFit();
      
      // Switch back to draw tool for further editing
      editor.setCurrentTool('draw');
      
      // Return the image shape ID
      return imageId;
      
    } catch (error) {
      console.error('Error adding image to canvas:', error);
      return null;
    }
  };

  // Generate image with prompt only - TEST FUNCTION
  const generateImage = async () => {
    if (!editorRef.current) {
      alert('Editor not ready. Please wait and try again.');
      return;
    }

    // Use prompt or a default test prompt
    const testPrompt = prompt.trim() || "A cute banana character with googly eyes, cartoon style, yellow background";
    
    console.log('🧪 TEST MODE: Starting test generation');
    console.log('📝 Test prompt:', testPrompt);

    setIsGenerating(true);
    try {
      const sanitizedPrompt = sanitizePrompt(testPrompt);
      
      console.log('🔑 Using API key:', import.meta.env.VITE_GEMINI_API_KEY ? 'Present' : 'Missing');
      console.log('📤 Sending request to Gemini API...');
      
      const response = await generateImageWithAPI({
        prompt: sanitizedPrompt,
        aspectRatio: '1:1',  // Use simple square aspect ratio for test
        numberOfImages: 1,
        negativePrompt: undefined,
        seed: undefined,
        includeSafetyAttributes: false,
        includeRaiReason: false,
        outputOptions: {
          mimeType: 'image/png',
          compressionQuality: 95
        }
      });

      console.log('📥 Response received:', response);

      if (response.error) {
        console.error('❌ API Error:', response.error);
        alert(`API Error: ${response.error}`);
        return;
      }

      if (response.generatedImages && response.generatedImages.length > 0) {
        const base64Image = response.generatedImages[0];
        const imageUrl = `data:image/png;base64,${base64Image}`;
        
        console.log('✅ Test image generated successfully!');
        console.log('🖼️ Adding image to canvas...');
        
        setGeneratedImages(prev => [...prev, imageUrl]);
        await addImageToCanvas(imageUrl);
        
        alert('✅ Test successful! Image generated and added to canvas.');
      } else {
        console.error('❌ No images in response');
        alert('Test failed: No images generated. Check console for details.');
      }
    } catch (error) {
      console.error('❌ Test generation error:', error);
      
      // More detailed error message
      let errorMessage = 'Test failed:\n\n';
      if (error instanceof Error) {
        errorMessage += error.message;
        if (error.message.includes('API key')) {
          errorMessage += '\n\nPlease check that your API key is set in .env.local:\nVITE_GEMINI_API_KEY=your-api-key-here';
        }
      } else {
        errorMessage += 'Unknown error. Check console for details.';
      }
      
      alert(errorMessage);
    } finally {
      setIsGenerating(false);
      console.log('🧪 Test completed');
    }
  };

  // Add image to TLDraw canvas with proper asset management
  const addImageToCanvas = async (imageUrl: string) => {
    if (!editorRef.current) return;

    const editor = editorRef.current;
    
    try {
      // Load image to get actual dimensions
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imageUrl;
      });
      
      console.log('📏 Dimensiones reales de la imagen:', {
        width: img.width,
        height: img.height,
        aspectRatio: (img.width / img.height).toFixed(2)
      });
      
      const assetId = AssetRecordType.createId(getHashForString(imageUrl));
      
      await editor.createAssets([
        {
          id: assetId,
          type: 'image',
          typeName: 'asset',
          props: {
            name: 'generated-image',
            src: imageUrl,
            w: img.width,    // Use actual width
            h: img.height,   // Use actual height
            mimeType: 'image/png',
            isAnimated: false,
          },
          meta: {}
        }
      ]);
      
      const viewportCenter = editor.getViewportPageBounds().center;
      
      // Scale image to fit nicely in viewport
      const maxSize = 600;
      let width = img.width;
      let height = img.height;
      
      if (width > maxSize || height > maxSize) {
        const scale = Math.min(maxSize / width, maxSize / height);
        width = width * scale;
        height = height * scale;
      }
      
      const imageId = createShapeId();
      editor.createShape<TLImageShape>({
        id: imageId,
        type: 'image',
        x: viewportCenter.x - width / 2,
        y: viewportCenter.y - height / 2,
        props: {
          w: width,
          h: height,
          assetId: assetId,
        },
      });

      editor.select(imageId);
      editor.setCurrentTool('select');
      editor.zoomToSelection();
    } catch (error) {
      console.error('Error adding image to canvas:', error);
    }
  };

  // Export canvas as PNG
  const exportCanvas = async () => {
    if (!editorRef.current) return;

    const editor = editorRef.current;
    const shapeIds = Array.from(editor.getCurrentPageShapeIds());
    
    if (shapeIds.length === 0) {
      alert('Canvas is empty. Nothing to export.');
      return;
    }

    try {
      // Usar el método correcto del editor
      const svg = await editor.getSvgString(shapeIds, {
        scale: 2,
        background: true,
        padding: 32,
        darkMode: false,
        preserveAspectRatio: 'xMidYMid meet'
      });
      
      if (!svg) {
        throw new Error('No se pudo obtener SVG del canvas');
      }
      
      // Convertir SVG a blob PNG
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        const svgBlob = new Blob([svg.svg], { type: 'image/svg+xml' });
        img.src = URL.createObjectURL(svgBlob);
      });
      
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob(
          (b) => resolve(b!),
          'image/png',
          1.0
        );
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `canvas-export-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting canvas:', error);
      alert('Failed to export canvas. Please try again.');
    }
  };

  // Clear canvas
  const clearCanvas = () => {
    if (!editorRef.current) return;
    
    const editor = editorRef.current;
    editor.deleteShapes(Array.from(editor.getCurrentPageShapeIds()));
    setGeneratedImages([]);
    // Clear all editing states
    setLastGeneratedImage(null);
    setLastGeneratedImageId(null);
    setSelectedImageForEdit(null);
    console.log('Canvas cleared');
  };


  // Merge selected shapes
  const mergeSelectedShapes = async () => {
    if (!editorRef.current || selectedShapesForMerge.length !== 2) return;
    
    const editor = editorRef.current;
    setIsGenerating(true);
    
    // Show feedback to user
    console.log('🔀 Starting merge process...');
    console.log('📊 Shapes to merge:', selectedShapesForMerge);
    
    try {
      
      // Export each shape separately with white background to avoid black borders
      const blobs: Blob[] = [];
      
      console.log('📸 Exporting shapes for merge...');
      
      for (let i = 0; i < selectedShapesForMerge.length; i++) {
        const shapeId = selectedShapesForMerge[i];
        console.log(`  → Exporting shape ${i + 1} of 2: ${shapeId}`);
        
        // Usar el método correcto del editor
        const svg = await editor.getSvgString([createShapeId(shapeId)], {
          scale: 1,
          background: true,
          padding: 0,
          darkMode: false,
          preserveAspectRatio: 'xMidYMid meet'
        });
        
        if (!svg) {
          throw new Error('No se pudo obtener SVG del shape');
        }
        
        // Convertir SVG a blob PNG
        const img = new Image();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          const svgBlob = new Blob([svg.svg], { type: 'image/svg+xml' });
          img.src = URL.createObjectURL(svgBlob);
        });
        
        canvas.width = img.width;
        canvas.height = img.height;
        ctx?.drawImage(img, 0, 0);
        
        const blob = await new Promise<Blob>((resolve) => {
          canvas.toBlob(
            (b) => resolve(b!),
            'image/png',
            1.0
          );
        });
        blobs.push(blob);
        console.log(`  ✅ Shape ${i + 1} exported, size: ${blob.size} bytes`);
      }
      
      // Convert blobs to base64
      console.log('🔄 Converting images to base64...');
      const images: string[] = [];
      
      for (let i = 0; i < blobs.length; i++) {
        const blob = blobs[i];
        console.log(`  → Converting image ${i + 1} of 2...`);
        
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve) => {
          reader.onloadend = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]);
          };
          reader.readAsDataURL(blob);
        });
        images.push(base64);
        console.log(`  ✅ Image ${i + 1} converted, length: ${base64.length}`);
      }
      
      // Call Gemini to merge the images
      console.log('🤖 Sending to Gemini for intelligent merge...');
      console.log('📝 Merge prompt:', prompt || 'Merge these elements seamlessly');
      
      const { mergeImages } = await import('./lib/gemini-real-generator');
      const sanitizedMergePrompt = sanitizePrompt(prompt || 'Merge these two elements seamlessly into one cohesive image. Blend them naturally together.');
      const mergedImage = await mergeImages(
        images[0], 
        images[1], 
        sanitizedMergePrompt
      );
      
      if (mergedImage) {
        console.log('✅ Merge successful! Processing result...');
        
        // Clear the selected shapes
        console.log('🗑️ Removing original shapes...');
        editor.deleteShapes(selectedShapesForMerge.map(id => createShapeId(id)));
        
        // Remove black borders from merged image
        const imageUrl = `data:image/png;base64,${mergedImage}`;
        const croppedImageUrl = await removeBlackBorders(imageUrl);
        
        // Add merged image to canvas
        await addGeneratedImageToCanvas(croppedImageUrl);
        
        // Clear selection
        setSelectedShapesForMerge([]);
        editor.setSelectedShapes([]);
        
        console.log('🎉 Merge completed successfully!');
      } else {
        console.error('❌ Merge failed: No image returned from Gemini');
        alert('Merge failed. Please try again with clearer images.');
      }
    } catch (error) {
      console.error('❌ Error merging shapes:', error);
      alert(`Failed to merge shapes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsGenerating(false);
      console.log('🔚 Merge process ended');
    }
  };


  const toggleStyle = (styleId: string) => {
    setSelectedStyles(prev => 
      prev.includes(styleId) 
        ? prev.filter(s => s !== styleId)
        : [...prev, styleId]
    );
  };

  // Undo/Redo handlers
  const handleUndo = () => editorRef.current?.undo();
  const handleRedo = () => editorRef.current?.redo();
  const handleZoomIn = () => editorRef.current?.zoomIn();
  const handleZoomOut = () => editorRef.current?.zoomOut();
  const handleZoomToFit = () => editorRef.current?.zoomToFit();

  return (
    <div className="flex h-screen bg-white">
      {/* Left Panel - Controls */}
      <div className="w-80 bg-gray-50 border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-light tracking-wide text-gray-900">
            Nano Banana
          </h2>
          <p className="text-xs text-gray-500 mt-1">AI Image Generator</p>
        </div>
        
        <div className="flex-1 p-6 space-y-6 overflow-y-auto">
          {/* Mode Indicator - Minimal */}
          {selectedImageForEdit && (
            <div className="bg-gray-100 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-900">Edit Mode</div>
                  <div className="text-xs text-gray-500 mt-1">Editing selected image</div>
                </div>
                <button 
                  onClick={() => {
                    setSelectedImageForEdit(null);
                    if (editorRef.current) {
                      editorRef.current.setSelectedShapes([]);
                    }
                  }}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          
          {/* Merge Mode Indicator */}
          {selectedShapesForMerge.length === 2 && (
            <div className={`rounded-lg p-3 transition-colors ${
              isGenerating ? 'bg-purple-100 animate-pulse' : 'bg-purple-50'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-purple-900">
                    {isGenerating ? 'Merging...' : 'Merge Mode'}
                  </div>
                  <div className="text-xs text-purple-600 mt-1">
                    {isGenerating ? 'AI is combining your elements' : '2 elements selected'}
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setSelectedShapesForMerge([]);
                    if (editorRef.current) {
                      editorRef.current.setSelectedShapes([]);
                    }
                  }}
                  className="text-xs text-purple-600 hover:text-purple-800"
                  disabled={isGenerating}
                >
                  {isGenerating ? 'Processing...' : 'Cancel'}
                </button>
              </div>
            </div>
          )}
          
          {/* Primary Action Button */}
          <div>
            {selectedShapesForMerge.length === 2 ? (
              <Button
                onClick={mergeSelectedShapes}
                disabled={isGenerating}
                className="w-full h-12 bg-purple-600 text-white hover:bg-purple-700 font-medium rounded-lg"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Merging...
                  </>
                ) : (
                  'Merge Selected'
                )}
              </Button>
            ) : (
              <>
                <Button
                  onClick={generateFromCanvas}
                  disabled={isGenerating}
                  className="w-full h-12 bg-black text-white hover:bg-gray-800 font-medium rounded-lg"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    selectedImageForEdit ? 'Edit Image' : 'Generate'
                  )}
                </Button>
                
                {/* Test Button */}
                <Button
                  onClick={generateImage}
                  disabled={isGenerating || !prompt.trim()}
                  className="w-full h-10 mt-2 bg-green-600 text-white hover:bg-green-700 font-medium rounded-lg"
                  title="Generate image from prompt only (without canvas)"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    '🧪 Test API (Prompt Only)'
                  )}
                </Button>
              </>
            )}
            {selectedImageForEdit && (
              <p className="text-xs text-gray-500 mt-2 text-center">
                Draw on the selected image to add elements
              </p>
            )}
            {selectedShapesForMerge.length === 2 && (
              <div className="mt-2">
                <p className="text-xs text-gray-500 text-center">
                  Combine the selected elements into one
                </p>
                {isGenerating && (
                  <p className="text-xs text-purple-600 text-center mt-1 animate-pulse">
                    Processing merge with AI...
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Style Selection - Simplified */}
          <div>
            <label className="text-xs font-medium text-gray-700 uppercase tracking-wider">Style</label>
            <div className="grid grid-cols-2 gap-2 mt-3">
              {[
                { id: 'realistic', label: 'Realistic' },
                { id: 'artistic', label: 'Artistic' },
                { id: 'minimal', label: 'Minimal' },
                { id: 'detailed', label: 'Detailed' }
              ].map(style => (
                <button
                  key={style.id}
                  onClick={() => toggleStyle(style.id)}
                  className={`py-2 px-3 text-sm rounded-lg border transition-all ${
                    selectedStyles.includes(style.id)
                      ? 'border-gray-900 bg-gray-900 text-white'
                      : 'border-gray-200 hover:border-gray-400 text-gray-700'
                  }`}
                >
                  {style.label}
                </button>
              ))}
            </div>
          </div>

          {/* Prompt Input - Simplified */}
          <div>
            <label className="text-xs font-medium text-gray-700 uppercase tracking-wider">Prompt</label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe what you want..."
              className="w-full h-24 resize-none mt-3 border-gray-200 rounded-lg text-sm focus:border-gray-400 focus:ring-0"
            />
          </div>



          {/* Generated Images Gallery */}
          {generatedImages.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-2">History</h3>
              <div className="grid grid-cols-3 gap-2">
                {generatedImages.slice(-6).map((img, idx) => (
                  <div
                    key={idx}
                    className="relative group cursor-pointer border-2 border-gray-200 rounded-lg overflow-hidden hover:border-purple-400 transition-colors"
                    onClick={() => addImageToCanvas(img)}
                  >
                    <img
                      src={img}
                      alt={`Generated ${idx + 1}`}
                      className="w-full h-24 object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-1">
                      <span className="text-white text-xs">Add</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Actions */}
        <div className="p-4 border-t border-gray-200 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={handleUndo} variant="outline" size="sm">
              <Undo className="w-4 h-4 mr-1" />
              Undo
            </Button>
            <Button onClick={handleRedo} variant="outline" size="sm">
              <Redo className="w-4 h-4 mr-1" />
              Redo
            </Button>
          </div>
          
          <div className="grid grid-cols-3 gap-2">
            <Button onClick={handleZoomIn} variant="outline" size="sm">
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button onClick={handleZoomOut} variant="outline" size="sm">
              <ZoomOut className="w-4 h-4" />
            </Button>
            <Button onClick={handleZoomToFit} variant="outline" size="sm">
              <Maximize className="w-4 h-4" />
            </Button>
          </div>
          
          <Button onClick={exportCanvas} variant="outline" className="w-full">
            <Download className="w-4 h-4 mr-2" />
            Export as PNG
          </Button>
          
          <Button
            onClick={clearCanvas}
            variant="outline"
            className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Clear Canvas
          </Button>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 relative bg-gray-100">
        <div className="absolute inset-0">
          <Tldraw 
            onMount={handleMount}
            persistenceKey="nanobanan-tldraw"
          />
        </div>
        
        {/* Instructions Overlay */}
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-white/90 px-4 py-2 rounded-full text-sm text-gray-700 pointer-events-none shadow-md">
          ✏️ Draw → 🎨 Generate → 🔄 Iterate
        </div>
        
        {/* Watermark */}
        <div className="absolute bottom-4 right-4 bg-white/90 px-3 py-1 rounded-full text-xs text-gray-600 pointer-events-none">
          Powered by TLDraw + Gemini
        </div>
      </div>
    </div>
  );
}
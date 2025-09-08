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
import { generateWithGeminiReal, applyChangesFromReference } from './lib/gemini-real-generator';
import { simpleGenerate, generateWithImageModel } from './lib/simple-generator';
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
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedStyles, setSelectedStyles] = useState<string[]>(['realistic']);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const editorRef = useRef<Editor | null>(null);
  const [selectedImageForEdit, setSelectedImageForEdit] = useState<{id: string, url: string} | null>(null);
  const [selectedShapesForMerge, setSelectedShapesForMerge] = useState<string[]>([]);

  // Initialize editor when component mounts
  const handleMount = useCallback((editor: Editor) => {
    editorRef.current = editor;
    
    // Listen for selection changes to detect image selection
    editor.sideEffects.registerAfterChangeHandler('instance_page_state', (prev, next) => {
      const selectedShapes = editor.getSelectedShapes();
      
      if (selectedShapes.length === 1) {
        const shape = selectedShapes[0];
        // Verificando shape seleccionado
        
        // IMPORTANT: Only set selectedImageForEdit if it's truly an image
        if (shape.type === 'image') {
          const imageShape = shape as TLImageShape;
          
          // Verify the shape still exists in the store
          const shapeStillExists = editor.getShape(shape.id);
          if (!shapeStillExists) {
            // Shape no existe en el store
            setSelectedImageForEdit(null);
            return;
          }
          
          if (imageShape.props.assetId) {
            const asset = editor.getAsset(imageShape.props.assetId as TLAssetId);
            // Asset encontrado
            
            if (asset && asset.type === 'image' && asset.props.src) {
              // Imagen seleccionada para edición
              
              // Store both the shape ID and the asset URL
              setSelectedImageForEdit({
                id: shape.id,
                url: asset.props.src
              });
            } else {
              // Asset sin src válido, usando shape ID
              // Still allow selection with asset URL
              setSelectedImageForEdit({
                id: shape.id,
                url: 'asset:' + imageShape.props.assetId
              });
            }
          } else {
            // Image shape sin assetId
            setSelectedImageForEdit(null);
          }
        } else {
          // Not an image - clear selection immediately
          // Shape no es imagen
          setSelectedImageForEdit(null);
        }
      } else if (selectedShapes.length === 0) {
        // No selection - clear
        if (selectedImageForEdit) {
          // Sin selección - limpiando
          setSelectedImageForEdit(null);
        }
        setSelectedShapesForMerge([]);
      } else if (selectedShapes.length === 2) {
        // Exactly 2 shapes selected - enable merge
        // 2 shapes seleccionados para fusión
        setSelectedShapesForMerge(selectedShapes.map(s => s.id));
        setSelectedImageForEdit(null);
        
        // Visual feedback
        // Merge mode activated
      } else {
        // More than 2 shapes - clear  
        if (selectedImageForEdit) {
          // Múltiple selección - limpiando
          setSelectedImageForEdit(null);
        }
        setSelectedShapesForMerge([]);
      }
    });
  }, [selectedImageForEdit]);

  // Generate image from canvas content - SIMPLIFIED VERSION
  // Función de debugging para ver el estado actual
  const debugCanvasState = () => {
    if (!editorRef.current) return;
    
    const editor = editorRef.current;
    const allShapes = Array.from(editor.getCurrentPageShapeIds());
    
    console.log('🔍 === DEBUGGING CANVAS STATE ===');
    console.log(`Total shapes: ${allShapes.length}`);
    console.log(`Current selection:`, editor.getSelectedShapes().length, 'shapes');
    
    allShapes.forEach((shapeId, index) => {
      const shape = editor.getShape(createShapeId(shapeId));
      if (shape) {
        const bounds = editor.getShapePageBounds(shape);
        console.log(`${index + 1}. ${shape.type} (${shape.id})`, {
          bounds: bounds ? {
            x: Math.round(bounds.x),
            y: Math.round(bounds.y), 
            width: Math.round(bounds.width),
            height: Math.round(bounds.height)
          } : 'no bounds'
        });
      }
    });
    console.log('🔍 === END DEBUGGING ===');
  };

  // Generate image from canvas - Main function with enhanced error handling
  const generateFromCanvas = async () => {
    if (!editorRef.current) {
      console.error('Editor no está listo todavía. Por favor espera un momento.');
      return;
    }

    const editor = editorRef.current;
    
    setIsGenerating(true);

    try {
      console.log('🚀 GENERANDO IMAGEN - USANDO SELECCIÓN');
      
      // Check if we have any shapes to work with
      const allShapeIds = Array.from(editor.getCurrentPageShapeIds());
      let validShapeIds: any[] = [];
      
      if (allShapeIds.length === 0) {
        // Generando desde selección actual
        console.error('No hay nada en el canvas para generar. Dibuja algo primero.');
        setIsGenerating(false);
        return;
      }
      
      const selectedShapeIds = editor.getSelectedShapeIds();
      
      if (selectedShapeIds.size > 0) {
        console.log(`✅ Usando ${selectedShapeIds.size} shapes SELECCIONADOS`);
        console.log('📊 Shapes seleccionados:', selectedShapeIds);
        
        validShapeIds = Array.from(selectedShapeIds);
      } else {
        console.log('⚠️ No hay selección - usando todo el canvas');
        
        console.log(`📊 Total shapes en canvas: ${allShapeIds.length}`);
        
        if (allShapeIds.length === 0) {
          console.log('❌ Canvas vacío');
          console.error('El canvas está vacío. Dibuja algo para generar una imagen.');
          setIsGenerating(false);
          return;
        }
        
        // Estos IDs necesitan conversión a TLShapeId
        validShapeIds = allShapeIds.map(id => {
          try {
            return createShapeId(id);
          } catch (e) {
            console.error('Error creando shape ID:', id, e);
            return null;
          }
        }).filter(Boolean);
      }
      
      console.log(`✅ Exportando ${validShapeIds.length} shapes válidos`);
      console.log('🎨 Shape IDs a exportar:', validShapeIds);
      
      // Verify editor is still available
      if (!editorRef.current) {
        console.error('❌ Editor no disponible');
        console.error('Editor no disponible. Recarga la página.');
        setIsGenerating(false);
        return;
      }
      
      if (validShapeIds.length === 0) {
        console.error('❌ No hay shapes válidos para exportar');
        console.error('No hay elementos válidos para exportar. Asegúrate de tener algo dibujado.');
        setIsGenerating(false);
        return;
      }
      
      // Export usando el método correcto
      let blob: Blob;
      try {
        console.log('📊 Intentando exportar SVG con IDs:', validShapeIds);
        
        const svg = await editor.getSvgString(validShapeIds, {
          scale: 1,
          background: false,
          padding: 0,
          darkMode: false,
        });
        
        if (!svg) {
          throw new Error('No se pudo generar SVG');
        }
        
        console.log('📊 SVG obtenido:', svg ? 'OK' : 'NULL');
        
        if (!svg.svg) {
          throw new Error('SVG vacío');
        }
        
        console.log('📊 SVG string longitud:', svg.svg.length);
        console.log('📊 SVG width:', svg.width, 'height:', svg.height);
        
        // Convert SVG to blob
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        const img = new Image();
        
        await new Promise<void>((resolve, reject) => {
          img.onload = () => {
            try {
              canvas.width = img.width || 800;
              canvas.height = img.height || 600;
              
              // Fill with white background
              ctx.fillStyle = 'white';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              
              ctx.drawImage(img, 0, 0);
              console.log('✅ Imagen cargada desde SVG');
              resolve();
            } catch (e) {
              console.error('❌ Error cargando imagen desde SVG:', e);
              reject(e);
            }
          };
          
          img.onerror = (e) => {
            console.error('❌ Error cargando imagen:', e);
            reject(new Error('Failed to load SVG as image'));
          };
          
          const svgBlob = new Blob([svg.svg], { type: 'image/svg+xml;charset=utf-8' });
          const url = URL.createObjectURL(svgBlob);
          img.src = url;
        });
        
        console.log('📐 Canvas dimensions:', canvas.width, 'x', canvas.height);
        
        blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((result) => {
            if (result) {
              resolve(result);
            } else {
              reject(new Error('Failed to create blob from canvas'));
            }
          }, 'image/png', 0.9);
        });
        
        console.log('✅ Canvas exportado exitosamente');
      } catch (exportError: any) {
        console.error('❌ Error exportando canvas:', exportError);
        console.error('📊 Detalles del error:', {
          message: exportError?.message,
          name: exportError?.name,
          stack: exportError?.stack
        });
        
        console.error(`Error exportando el canvas: ${exportError.message}\n\nDetalles:\n- Asegúrate de tener algo dibujado\n- Intenta seleccionar elementos específicos\n- Recarga la página si el problema persiste`);
        setIsGenerating(false);
        return;
      }
      
      if (!blob || blob.size === 0) {
        console.error('Error: No se pudo generar la imagen del canvas');
        setIsGenerating(false);
        return;
      }
      
      console.log('📏 Tamaño del blob:', blob.size, 'bytes');
      
      // Compress image if it's too large
      if (blob.size > 4 * 1024 * 1024) { // 4MB
        console.warn('⚠️ Imagen muy grande, comprimiendo...');
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        const img = new Image();
        
        blob = await new Promise<Blob>((resolve, reject) => {
          img.onload = () => {
            const maxSize = 1024;
            let { width, height } = img;
            
            if (width > height) {
              if (width > maxSize) {
                height = (height * maxSize) / width;
                width = maxSize;
              }
            } else {
              if (height > maxSize) {
                width = (width * maxSize) / height;
                height = maxSize;
              }
            }
            
            canvas.width = width;
            canvas.height = height;
            
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            
            canvas.toBlob((compressedBlob) => {
              if (compressedBlob) {
                console.log('✅ Imagen comprimida a:', compressedBlob.size, 'bytes');
                resolve(compressedBlob);
              } else {
                reject(new Error('Error comprimiendo imagen'));
              }
            }, 'image/jpeg', 0.8);
          };
          
          img.src = URL.createObjectURL(blob);
        });
      }
      
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        console.log('📊 Base64 generado, longitud:', base64.length);

        try {
          console.log('📤 Calling generateFromCanvas...');
          console.log('📊 Parameters:', {
            base64Length: base64.length,
            promptLength: prompt.length,
            stylesCount: selectedStyles.length
          });
          
          let response: any;
          
          try {
            // Check CURRENT selection at generation time
            const currentSelection = editor.getSelectedShapes();
            // Generando desde selección actual
            
            // Find if there's an image in current selection
            const selectedImage = currentSelection.find(shape => shape.type === 'image') as TLImageShape | undefined;
            
            if (selectedImage) {
              console.log('🎨 MODO EDICIÓN MEJORADO - Imagen EN SELECCIÓN ACTUAL');
              console.log('📊 Imagen seleccionada ID:', selectedImage.id);
              // Detectando dibujos sobre la imagen
              
              // PASO 1: Detectar imagen seleccionada o cualquier imagen
              // Iniciando detección de imagen y dibujos
              
              let imageShape = selectedImage;
              
              // Si no hay imagen seleccionada, buscar cualquier imagen en el canvas
              if (!imageShape) {
                console.log('⚠️ No hay imagen seleccionada, buscando cualquier imagen...');
                const allShapes = Array.from(editor.getCurrentPageShapeIds());
                
                for (const shapeId of allShapes) {
                  const shape = editor.getShape(createShapeId(shapeId));
                  if (shape && shape.type === 'image') {
                    imageShape = shape;
                    console.log('✅ Encontrada imagen automáticamente:', shape.id);
                    break;
                  }
                }
              }
              
              if (!imageShape) {
                console.error('❌ No hay ninguna imagen en el canvas');
                console.error('No hay imágenes en el canvas.\n\nGenera una imagen primero, luego dibuja sobre ella.');
                setIsGenerating(false);
                return;
              }
              
              console.log('✅ Imagen a usar:', {
                id: imageShape.id,
                type: imageShape.type,
                isSelected: imageShape === selectedImage
              });
              
              // PASO 2: Obtener los bounds de la imagen
              const imageBounds = editor.getShapePageBounds(imageShape);
              if (!imageBounds) {
                console.error('❌ No se pudieron obtener bounds de la imagen');
                console.error('Error: No se pudo obtener la información de la imagen seleccionada.');
                setIsGenerating(false);
                return;
              }
              
              console.log('📐 Bounds de imagen:', {
                x: imageBounds.x,
                y: imageBounds.y,
                width: imageBounds.width,
                height: imageBounds.height
              });
              
              // PASO 3: Detectar dibujos de forma simple y efectiva
              const allShapes = Array.from(editor.getCurrentPageShapeIds());
              const drawingsOverImage = [];
              
              // Buscar todos los shapes que no sean la imagen base
              for (const shapeId of allShapes) {
                const shape = editor.getShape(createShapeId(shapeId));
                if (!shape) continue;
                
                // Si es la imagen base, saltar
                if (shape.id === imageShape.id) continue;
                
                // Cualquier shape que no sea imagen es considerado un dibujo
                if (shape.type !== 'image' && shape.type !== 'video') {
                  drawingsOverImage.push(shape.id);
                  console.log(`✅ Dibujo detectado: ${shape.type}`);
                }
              }
              
              // Verificar si se encontraron dibujos
              if (drawingsOverImage.length === 0) {
                console.log('⚠️ No se encontraron dibujos, usando solo la imagen');
                // Continuar con solo la imagen - no es un error
              }
              
              console.log(`📊 Total dibujos detectados: ${drawingsOverImage.length}`);
              console.log(`🎨 Total de dibujos detectados: ${drawingsOverImage.length}`);
              
              // PASO 4: Obtener la imagen base
              // Extract and validate base64 from the selected image
              let baseImageBase64: string;
              let imageUrl: string = '';
              
              console.log('🔍 Tipo de URL de imagen seleccionada:', {
                hasAssetId: !!imageShape.props.assetId,
                startsWithData: selectedImageForEdit?.url?.startsWith('data:'),
                startsWithAsset: selectedImageForEdit?.url?.startsWith('asset:'),
                urlLength: selectedImageForEdit?.url?.length || 0
              });
              
              if (selectedImageForEdit?.url?.startsWith('data:image')) {
                console.log('✅ Imagen ya es base64, longitud:', selectedImageForEdit.url.length);
                baseImageBase64 = selectedImageForEdit.url.split(',')[1];
              } else {
                console.log('🎨 Manejando asset de TLDraw...');
                console.log('📊 ID de imagen seleccionada:', imageShape.id);
                
                // Get the shape from TLDraw
                const shape = editor.getShape(imageShape.id);
                if (!shape || shape.type !== 'image') {
                  console.error('❌ Shape no encontrado o no es imagen:', shape);
                  throw new Error('Imagen seleccionada no válida');
                }
                
                console.log('✅ Shape encontrado:', shape.id, shape.type);
                
                // Export this specific shape as an image
                console.log('📸 Exportando shape como imagen...');
                const shapeBounds = editor.getShapePageBounds(shape);
                if (!shapeBounds) {
                  console.error('❌ No se pudieron obtener bounds para shape:', shape.id);
                  throw new Error('No se pudieron obtener las dimensiones de la imagen');
                }
                
                console.log('📐 Bounds del shape:', {
                  x: shapeBounds.x,
                  y: shapeBounds.y,
                  width: shapeBounds.width,
                  height: shapeBounds.height
                });
                
                // Export with better error handling
                let blob: Blob;
                try {
                  // Usar el método correcto del editor
                  const svg = await editor.getSvgString([shape.id], {
                    scale: 2,
                    background: true,
                    padding: 10,
                    darkMode: false,
                  });
                  
                  if (!svg?.svg) {
                    throw new Error('No se pudo exportar la imagen como SVG');
                  }
                  
                  // Convertir SVG a imagen
                  const canvas = document.createElement('canvas');
                  const ctx = canvas.getContext('2d')!;
                  
                  canvas.width = Math.round(shapeBounds.width * 2);
                  canvas.height = Math.round(shapeBounds.height * 2);
                  
                  // Fondo blanco
                  ctx.fillStyle = 'white';
                  ctx.fillRect(0, 0, canvas.width, canvas.height);
                  
                  const img = new Image();
                  await new Promise<void>((resolve, reject) => {
                    img.onload = () => {
                      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                      resolve();
                    };
                    img.onerror = reject;
                    const svgBlob = new Blob([svg.svg], { type: 'image/svg+xml;charset=utf-8' });
                    img.src = URL.createObjectURL(svgBlob);
                  });
                  
                  blob = await new Promise<Blob>((resolve, reject) => {
                    canvas.toBlob((result) => {
                      if (result) resolve(result);
                      else reject(new Error('Failed to create blob'));
                    }, 'image/png');
                  });
                } catch (exportError) {
                  console.error('❌ Error exportando shape:', exportError);
                  throw new Error('No se pudo exportar la imagen seleccionada');
                }
                
                console.log('📦 Blob creado, tamaño:', blob.size);
                
                // Comprimir si es necesario
                if (blob.size > 3 * 1024 * 1024) { // 3MB
                  console.log('📦 Comprimiendo imagen seleccionada...');
                  
                  const canvas = document.createElement('canvas');
                  const ctx = canvas.getContext('2d')!;
                  const img = new Image();
                  
                  blob = await new Promise<Blob>((resolve, reject) => {
                    img.onload = () => {
                      const maxSize = 1024;
                      let { width, height } = img;
                      
                      if (width > height) {
                        if (width > maxSize) {
                          height = (height * maxSize) / width;
                          width = maxSize;
                        }
                      } else {
                        if (height > maxSize) {
                          width = (width * maxSize) / height;
                          height = maxSize;
                        }
                      }
                      
                      canvas.width = width;
                      canvas.height = height;
                      
                      ctx.fillStyle = 'white';
                      ctx.fillRect(0, 0, width, height);
                      ctx.drawImage(img, 0, 0, width, height);
                      
                      canvas.toBlob((compressedBlob) => {
                        if (compressedBlob) resolve(compressedBlob);
                        else reject(new Error('Error comprimiendo'));
                      }, 'image/jpeg', 0.8);
                    };
                    img.src = URL.createObjectURL(blob);
                  });
                }
                
                // Convertir a base64
                baseImageBase64 = await new Promise<string>((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    const result = reader.result as string;
                    resolve(result.split(',')[1]);
                  };
                  reader.onerror = reject;
                  reader.readAsDataURL(blob);
                });
                
                console.log('✅ Shape exportado como base64, longitud:', baseImageBase64.length);
              }
              
              console.log('✅ Base64 de imagen seleccionada listo:', {
                length: baseImageBase64.length,
                prefix: baseImageBase64.substring(0, 50)
              });
              
              // PASO 5: Crear imagen con sketches si hay dibujos
              console.log('🖼️ Creando imagen con dibujos para comparación...');
              
              // Crear una imagen que combine la imagen base + todos los dibujos
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d')!;
              
              // Set canvas size based on image bounds
              canvas.width = Math.max(800, Math.round(imageBounds.width + 100));
              canvas.height = Math.max(600, Math.round(imageBounds.height + 100));
              
              // Fill with white background
              ctx.fillStyle = 'white';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              
              // Load and draw the base image
              const baseImage = new Image();
              baseImage.src = `data:image/png;base64,${baseImageBase64}`;
              await new Promise<void>(resolve => {
                baseImage.onload = () => {
                  ctx.drawImage(baseImage, 50, 50, imageBounds.width, imageBounds.height);
                  resolve();
                };
              });
              
              // Add drawings over the image if any exist
              if (drawingsOverImage.length > 0) {
                console.log('✏️ Agregando dibujos encima de la imagen...');
                
                for (const drawingId of drawingsOverImage) {
                  const drawingShape = editor.getShape(createShapeId(drawingId));
                  if (!drawingShape) continue;
                  
                  // Get drawing bounds
                  const drawingBounds = editor.getShapePageBounds(drawingShape);
                  if (!drawingBounds) continue;
                  
                  // Export drawing as SVG
                  try {
                    const drawingSvg = await editor.getSvgString([drawingShape.id], {
                      scale: 2,
                      background: false,
                      padding: 0
                    });
                    
                    if (drawingSvg?.svg) {
                      const drawingImg = new Image();
                      await new Promise<void>(resolve => {
                        drawingImg.onload = () => {
                          // Calculate relative position
                          const relativeX = drawingBounds.x - imageBounds.x + 50;
                          const relativeY = drawingBounds.y - imageBounds.y + 50;
                          
                          ctx.drawImage(
                            drawingImg,
                            relativeX,
                            relativeY,
                            drawingBounds.width,
                            drawingBounds.height
                          );
                          
                          // Dibujo agregado a la composición
                          resolve();
                        };
                        const svgBlob = new Blob([drawingSvg.svg], { type: 'image/svg+xml;charset=utf-8' });
                        drawingImg.src = URL.createObjectURL(svgBlob);
                      });
                    }
                  } catch (err) {
                    console.warn('Error agregando dibujo:', err);
                  }
                }
              }
              
              // Convertir imagen con sketches a base64
              const withSketchesBlob = await new Promise<Blob>((resolve) => {
                canvas.toBlob((blob) => {
                  resolve(blob!);
                }, 'image/png', 0.9);
              });
              
              const withSketchesBase64 = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                  const result = reader.result as string;
                  resolve(result.split(',')[1]);
                };
                reader.readAsDataURL(withSketchesBlob);
              });
              
              console.log('✅ Imagen con sketches creada');
              
              // PASO 6: Llamar a Gemini con las dos imágenes
              const sanitizedPrompt = sanitizePrompt(prompt || 'Edit this image based on the drawings and sketches added to it. Apply the changes shown in the sketches to create a refined, professional result.');
              
              console.log('📝 Enviando DOS imágenes a Gemini...');
              
              console.log('  1️⃣ Imagen original SIN dibujos');
              console.log('  2️⃣ Imagen CON dibujos como referencia');
              
              response = await applyChangesFromReference(
                baseImageBase64,
                withSketchesBase64,
                sanitizedPrompt
              );
              
              console.log('✅ Edición aplicada a imagen seleccionada');
              
            } else {
              // MODO 2: Generación normal desde canvas/selección
              console.log('🚀 MODO GENERACIÓN: Nueva imagen desde cero');
              console.log('📝 Generando desde dibujos/selección');
              
              const sanitizedPrompt = sanitizePrompt(prompt || 'Create a professional image based on this sketch or drawing. Make it realistic and detailed.');
              
              // Clean base64 - remove data URL prefix if present
              const cleanBase64 = base64.includes(',') ? base64.split(',')[1] : base64;
              
              response = await generateWithGeminiReal(
                cleanBase64,
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
              console.error('Error: Problema con la imagen seleccionada.\n\n' +
                    'SOLUCIÓN:\n' +
                    '1. Selecciona una imagen en el canvas\n' +
                    '2. Dibuja algo sobre la imagen\n' +
                    '3. Intenta generar de nuevo\n\n' +
                    'O usa el modo de generación normal sin seleccionar imágenes.');
            } else if (callError?.message?.includes('API key') || callError?.message?.includes('authentication')) {
              console.error('Error de autenticación con Gemini API.\n\n' +
                    'Verifica tu API key en las variables de entorno.');
            } else if (callError?.message?.includes('quota') || callError?.message?.includes('limit')) {
              console.error('Límite de API alcanzado.\n\n' +
                    'Has excedido tu cuota de API de Gemini. Intenta más tarde.');
            } else if (callError?.message?.includes('safety') || callError?.message?.includes('blocked')) {
              console.error('Contenido bloqueado por políticas de seguridad.\n\n' +
                    'El contenido fue rechazado por las políticas de Gemini. Intenta con un prompt diferente.');
            } else {
              // Generic error
              const errorMessage = callError?.message || callError?.toString() || 'Error desconocido';
              console.error('⚠️ Still no response - creating emergency response');
              
              console.error(`Error generando imagen: ${errorMessage}\n\n` +
                    'POSIBLES SOLUCIONES:\n' +
                    '1. Verifica tu conexión a internet\n' +
                    '2. Revisa tu API key de Gemini\n' +
                    '3. Intenta con un canvas más simple\n' +
                    '4. Recarga la página e intenta de nuevo\n\n' +
                    'Detalles técnicos en la consola (F12)');
            }
            
            setIsGenerating(false);
            return;
          }
          
          // Process response
          console.log('📥 Procesando respuesta de Gemini...');
          
          if (response && response.generatedImages && response.generatedImages.length > 0) {
            let imageUrl = response.generatedImages[0];
            
            // Ensure the image URL has the proper data URL format
            if (!imageUrl.startsWith('data:')) {
              imageUrl = `data:image/png;base64,${imageUrl}`;
            }
            
            console.log('🔗 URL de imagen generada:', imageUrl.substring(0, 100) + '...');
            
            // Remove old drawings if we were in edit mode
            if (selectedImageForEdit) {
              console.log('🗑️ Eliminando dibujos...');
              const allShapes = Array.from(editor.getCurrentPageShapeIds());
              const drawingsToRemove = allShapes.filter(shapeId => {
                const shape = editor.getShape(createShapeId(shapeId));
                return shape && shape.type !== 'image' && shape.type !== 'video';
              });
              
              if (drawingsToRemove.length > 0) {
                editor.deleteShapes(drawingsToRemove.map(id => createShapeId(id)));
              }
            }
            
            // Add the generated image to canvas
            console.log('🖼️ Adding image to canvas...');
            const imageShapeId = await addImageToCanvas(imageUrl);
            
            if (imageShapeId) {
              // Select the new image
              editor.setSelectedShapes([imageShapeId]);
              
              // Center view on the new image
              editor.zoomToSelection();
              
              // Add to gallery
              setGeneratedImages(prev => [...prev, imageUrl]);
              
              console.log('✅ Image added to canvas with ID:', imageShapeId);
            } else {
              console.error('No images in response');
              console.error('The model did not generate an image. This might be because:\n\n1. The model gemini-2.5-flash-image-preview is not available\n2. The sketch needs to be clearer\n3. Try adding more details to your prompt');
            }
          } else {
            console.error('No images in response');
            console.error('The model did not generate an image. This might be because:\n\n1. The model gemini-2.5-flash-image-preview is not available\n2. The sketch needs to be clearer\n3. Try adding more details to your prompt');
          }
        } catch (error) {
          console.error('❌ Error in canvas generation:', error);
          console.error(`Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
        } finally {
          setIsGenerating(false);
        }
      };
      
      reader.readAsDataURL(blob);
      
    } catch (error) {
      console.error('❌ Error in generateFromCanvas outer:', error);
      console.error(`Error: ${error instanceof Error ? error.message : 'An error occurred'}`);
      setIsGenerating(false);
    }
  };

  // Function to add generated image to canvas
  const addImageToCanvas = async (imageUrl: string): Promise<string | null> => {
    if (!editorRef.current) {
      console.error('Editor not ready');
      return null;
    }

    const editor = editorRef.current;
    
    try {
      // Load the image to get actual dimensions
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      const { width, height } = await new Promise<{ width: number; height: number }>((resolve, reject) => {
        img.onload = () => {
          resolve({ width: img.naturalWidth, height: img.naturalHeight });
        };
        img.onerror = () => {
          reject(new Error('Failed to load image'));
        };
        img.src = imageUrl;
      });

      // Create asset
      const assetId = AssetRecordType.createId(getHashForString(imageUrl));
      
      const asset = AssetRecordType.create({
        id: assetId,
        type: 'image',
        typeName: 'asset',
        props: {
          name: 'Generated Image',
          src: imageUrl,
          w: width,
          h: height,
          mimeType: 'image/png',
          isAnimated: false,
        },
        meta: {},
      });

      // Add asset to editor
      editor.createAssets([asset]);

      // Create image shape
      const imageId = createShapeId();
      
      editor.createShape({
        id: imageId,
        type: 'image',
        x: 100,
        y: 100,
        props: {
          assetId: assetId,
          w: Math.min(width, 400),
          h: Math.min(height, 400),
        },
      });
      
      return imageId;
      
    } catch (error) {
      console.error('Error adding image to canvas:', error);
      return null;
    }
  };

  // Generate image with prompt only - TEST FUNCTION
  const generateImage = async () => {
    if (!editorRef.current) {
      console.error('Editor not ready. Please wait and try again.');
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
        console.error(`API Error: ${response.error}`);
        return;
      }

      if (response.generatedImages && response.generatedImages.length > 0) {
        const imageUrl = response.generatedImages[0];
        console.log('🎨 Generated image URL length:', imageUrl.length);
        
        // Add to canvas
        const imageShapeId = await addImageToCanvas(imageUrl);
        if (imageShapeId && editorRef.current) {
          editorRef.current.setSelectedShapes([imageShapeId]);
          editorRef.current.zoomToSelection();
        }
        
        // Add to gallery
        setGeneratedImages(prev => [...prev, imageUrl]);
        
        console.error('🎉 Test successful! Image generated and added to canvas.');
      } else {
        console.error('❌ No images in response');
        console.error('Test failed: No images generated. Check console for details.');
      }
    } catch (error) {
      console.error('❌ Test generation error:', error);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log('📊 Error details:', {
        message: errorMessage,
        type: typeof error,
        stack: error instanceof Error ? error.stack : 'No stack'
      });
      
      console.error(errorMessage);
    } finally {
      setIsGenerating(false);
      console.log('🧪 Test completed');
    }
  };

  // Function to add image from gallery to canvas  
  const addImageFromGallery = async (imageUrl: string) => {
    if (!editorRef.current) return;
    
    const editor = editorRef.current;
    
    try {
      // Load image to get actual dimensions
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      const { width, height } = await new Promise<{ width: number; height: number }>((resolve, reject) => {
        img.onload = () => {
          resolve({ width: img.naturalWidth, height: img.naturalHeight });
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = imageUrl;
      });

      // Create asset
      const assetId = AssetRecordType.createId(getHashForString(imageUrl + Date.now()));
      
      const asset = AssetRecordType.create({
        id: assetId,
        type: 'image',
        typeName: 'asset',
        props: {
          name: 'Gallery Image',
          src: imageUrl,
          w: width,
          h: height,
          mimeType: 'image/png',
          isAnimated: false,
        },
        meta: {},
      });

      editor.createAssets([asset]);

      // Create image shape at center
      const viewport = editor.getViewportPageBounds();
      const imageId = createShapeId();
      
      const maxSize = 300;
      let displayWidth = width;
      let displayHeight = height;
      
      if (width > height) {
        if (width > maxSize) {
          displayHeight = (displayHeight * maxSize) / displayWidth;
          displayWidth = maxSize;
        }
      } else {
        if (height > maxSize) {
          displayWidth = (displayWidth * maxSize) / displayHeight;
          displayHeight = maxSize;
        }
      }
      
      editor.createShape({
        id: imageId,
        type: 'image',
        x: viewport.center.x - displayWidth / 2,
        y: viewport.center.y - displayHeight / 2,
        props: {
          assetId: assetId,
          w: displayWidth,
          h: displayHeight,
        },
      });
      
      // Select and focus on the new image
      editor.setSelectedShapes([imageId]);
      editor.setCurrentTool('select');
      editor.zoomToSelection();
    } catch (error) {
      console.error('Error adding image to canvas:', error);
    }
  };

  // Export canvas as image
  const exportCanvas = async () => {
    if (!editorRef.current) {
      console.error('Canvas is not ready');
      return;
    }

    try {
      // Usar el método correcto del editor
      const svg = await editorRef.current.getSvgString(editorRef.current.getCurrentPageShapeIds(), {
        scale: 2,
        background: true,
        padding: 16,
        darkMode: false,
      });
      
      if (!svg) {
        throw new Error('Failed to generate SVG');
      }
      
      // Create blob and download
      const svgBlob = new Blob([svg.svg], { type: 'image/svg+xml;charset=utf-8' });
      
      // Convert to PNG
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      canvas.width = svg.width;
      canvas.height = svg.height;
      
      const img = new Image();
      img.onload = () => {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        
        canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'nanobanan-canvas.png';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }
        }, 'image/png');
      };
      
      img.src = URL.createObjectURL(svgBlob);
    } catch (error) {
      console.error('Error exporting canvas:', error);
      console.error('Failed to export canvas. Please try again.');
    }
  };

  // Function to toggle style selection
  const toggleStyle = (style: string) => {
    setSelectedStyles(prev =>
      prev.includes(style)
        ? prev.filter(s => s !== style)
        : [...prev, style]
    );
  };

  // Merge two selected shapes
  const mergeSelectedShapes = async () => {
    if (!editorRef.current || selectedShapesForMerge.length !== 2) {
      console.error('Select exactly 2 shapes to merge');
      return;
    }

    const editor = editorRef.current;
    
    console.log('🔄 Starting merge process...');
    console.log('📊 Shapes to merge:', selectedShapesForMerge);
    
    try {
      
      // Export each shape separately with white background to avoid black borders
      const imagePromises = selectedShapesForMerge.map(async (shapeId, index) => {
        console.log(`📤 Exporting shape ${index + 1}:`, shapeId);
        
        const svg = await editor.getSvgString([createShapeId(shapeId)], {
          scale: 2,
          background: true,  // White background
          padding: 20,
          darkMode: false,
        });
        
        if (!svg) {
          throw new Error(`Failed to export shape ${index + 1}`);
        }
        
        // Convert SVG to image blob
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        
        // Set reasonable size
        canvas.width = Math.max(512, svg.width);
        canvas.height = Math.max(512, svg.height);
        
        // White background
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        return new Promise<string>((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            ctx.drawImage(img, 
              (canvas.width - svg.width) / 2, 
              (canvas.height - svg.height) / 2,
              svg.width, 
              svg.height
            );
            
            canvas.toBlob((blob) => {
              if (blob) {
                const reader = new FileReader();
                reader.onloadend = () => {
                  const base64 = (reader.result as string).split(',')[1];
                  resolve(base64);
                };
                reader.readAsDataURL(blob);
              } else {
                reject(new Error('Failed to create blob'));
              }
            }, 'image/png', 0.9);
          };
          
          img.onerror = () => reject(new Error('Failed to load SVG'));
          
          const svgBlob = new Blob([svg.svg], { type: 'image/svg+xml;charset=utf-8' });
          img.src = URL.createObjectURL(svgBlob);
        });
      });
      
      console.log('⏳ Waiting for all shapes to be exported...');
      const imageBase64Array = await Promise.all(imagePromises);
      
      console.log('✅ All shapes exported successfully');
      console.log('📊 Generated images:', imageBase64Array.map((img, i) => `Image ${i + 1}: ${img.length} chars`));
      
      if (imageBase64Array.length !== 2) {
        throw new Error('Failed to export both shapes');
      }
      
      console.log('🤖 Sending to Gemini for intelligent merge...');
      setIsGenerating(true);
      
      const mergePrompt = typeof prompt === 'function' 
        ? prompt('Enter merge instructions', 'Merge these two elements seamlessly into one cohesive image. Blend them naturally together.')
        : prompt || 'Merge these two elements seamlessly into one cohesive image. Blend them naturally together.';
      
      const response = await generateWithGeminiReal(
        imageBase64Array[0],
        imageBase64Array[1],
        sanitizePrompt(mergePrompt),
        ['realistic', 'detailed']
      );
      
      if (response && response.generatedImages && response.generatedImages.length > 0) {
        console.log('✅ Merge successful, adding result to canvas');
        
        // Remove original shapes
        console.log('🗑️ Removing original shapes...');
        editor.deleteShapes(selectedShapesForMerge.map(id => createShapeId(id)));
        
        // Add merged result
        const imageUrl = response.generatedImages[0];
        const mergedShapeId = await addImageToCanvas(imageUrl);
        
        if (mergedShapeId) {
          editor.setSelectedShapes([mergedShapeId]);
          editor.zoomToSelection();
        }
        
        // Add to gallery
        setGeneratedImages(prev => [...prev, imageUrl]);
        setSelectedShapesForMerge([]);
        
        console.error('✅ Shapes merged successfully!');
      } else {
        console.error('❌ Merge failed - no images returned');
        console.error('Merge failed. Please try again with clearer images.');
      }
    } catch (error) {
      console.error('❌ Error merging shapes:', error);
      console.error(`Failed to merge shapes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsGenerating(false);
      console.log('🔚 Merge process ended');
      setSelectedShapesForMerge([]);
    }
  };

  return (
    <div className="w-full h-screen flex flex-col bg-gray-50">
      {/* Top Controls */}
      <div className="flex items-center justify-between p-4 bg-white border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-bold text-gray-900">Nano Banana Canvas</h1>
          
          {/* Export Button */}
          <Button
            onClick={exportCanvas}
            variant="outline"
            size="sm"
            className="flex items-center space-x-2"
          >
            <Download className="h-4 w-4" />
            <span>Export</span>
          </Button>
          
          {/* Debug Button */}
          <Button
            onClick={debugCanvasState}
            variant="outline" 
            size="sm"
            className="flex items-center space-x-2"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Debug</span>
          </Button>
        </div>
        
        {/* Status */}
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          {selectedImageForEdit && (
            <span className="flex items-center space-x-1 text-blue-600">
              <ImageIcon className="h-4 w-4" />
              <span>Image selected for editing</span>
            </span>
          )}
          {selectedShapesForMerge.length === 2 && (
            <span className="flex items-center space-x-1 text-purple-600">
              <Wand2 className="h-4 w-4" />
              <span>Ready to merge</span>
            </span>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Canvas */}
        <div className="flex-1 relative">
          <Tldraw
            onMount={handleMount}
            persistenceKey="nanobanan-tldraw"
          />
        </div>
        
        {/* Right Sidebar */}
        <div className="w-80 bg-white border-l border-gray-200 flex flex-col overflow-y-auto">
          <div className="p-4 space-y-4">
            
            {/* Merge Mode Indicator */}
            {selectedShapesForMerge.length === 2 && (
              <div className={`rounded-lg p-3 transition-colors ${
                isGenerating ? 'bg-blue-100 animate-pulse' : 'bg-blue-50'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-blue-900">
                      {isGenerating ? 'Merging...' : 'Merge Mode'}
                    </div>
                    <div className="text-xs text-blue-600 mt-1">
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
                    className="text-xs text-blue-600 hover:text-blue-800"
                    disabled={isGenerating}
                  >
                    {isGenerating ? 'Processing...' : 'Cancel'}
                  </button>
                </div>
              </div>
            )}
            
            {/* Generation Controls */}
            <div>
              {selectedShapesForMerge.length === 2 ? (
                <Button
                  onClick={mergeSelectedShapes}
                  disabled={isGenerating}
                  className="w-full h-12 bg-blue-600 text-white hover:bg-blue-700 font-medium rounded-lg"
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
                      editorRef.current && editorRef.current.getSelectedShapes().length > 0 
                        ? `Generate from ${editorRef.current.getSelectedShapes().length} selected`
                        : 'Generate from All'
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
                      'Test API (Prompt Only)'
                    )}
                  </Button>
                  
                  {/* Diagnostic Button for Two-Image Approach */}
                  <Button
                    onClick={() => {
                      console.log('🔍 DIAGNÓSTICO: Verificando selección ACTUAL...');
                      
                      if (!editorRef.current) {
                        console.error('Editor no está listo todavía. Por favor espera un momento.');
                        return;
                      }
                      
                      const currentSelection = editorRef.current.getSelectedShapes();
                      
                      if (currentSelection.length > 0) {
                        const types = currentSelection.map(s => s.type);
                        const uniqueTypes = [...new Set(types)];
                        
                        console.log('✅ Shapes seleccionados:', currentSelection);
                        console.log('📊 Tipos:', uniqueTypes);
                        
                        console.error(
                          `✅ ${currentSelection.length} ELEMENTOS SELECCIONADOS\n\n` +
                          `Tipos: ${uniqueTypes.join(', ')}\n\n` +
                          `Al presionar "Generate":\n` +
                          `• Se exportará SOLO la selección actual\n` +
                          `• Gemini convertirá estos elementos en una imagen realista\n\n` +
                          `💡 TIP: Usa la herramienta de selección para elegir exactamente qué quieres generar`
                        );
                      } else {
                        console.log('⚠️ No hay selección');
                        
                        const allShapes = editorRef.current.getCurrentPageShapes();
                        console.log('📊 Total shapes en canvas:', allShapes.length);
                        
                        console.error(
                          '⚠️ NO HAY SELECCIÓN\n\n' +
                          'Al presionar "Generate" se usará TODO el canvas\n\n' +
                          '💡 Para generar solo parte del canvas:\n' +
                          '1. Usa la herramienta de SELECCIÓN\n' +
                          '2. Selecciona los elementos que quieres\n' +
                          '3. Presiona "Generate"\n\n' +
                          'Total de elementos en canvas: ' + allShapes.length
                        );
                      }
                    }}
                    className="w-full h-10 mt-2 bg-blue-600 text-white hover:bg-blue-700 font-medium rounded-lg"
                    title="Verificar la selección actual"
                  >
                    Ver Selección Actual
                  </Button>
                </>
              )}
              {selectedShapesForMerge.length === 2 && (
                <div className="mt-2">
                  <p className="text-xs text-gray-500 text-center">
                    Combine the selected elements into one
                  </p>
                  {isGenerating && (
                    <p className="text-xs text-blue-600 text-center mt-1 animate-pulse">
                      Processing merge with AI...
                    </p>
                  )}
                </div>
              )}
            </div>
            
            {/* Style Selection */}
            <div>
              <Label className="text-xs font-medium text-gray-700 uppercase tracking-wider">Art Style</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {[
                  { id: 'realistic', label: 'Realistic' },
                  { id: 'anime', label: 'Anime' },
                  { id: 'oil_painting', label: 'Oil Paint' },
                  { id: 'watercolor', label: 'Watercolor' },
                  { id: 'sketch', label: 'Sketch' },
                  { id: 'digital_art', label: 'Digital' },
                  { id: 'pixel_art', label: 'Pixel Art' },
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
              <Label className="text-xs font-medium text-gray-700 uppercase tracking-wider">Prompt</Label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe your image or leave blank for auto-description"
                className="mt-2 min-h-[80px] text-sm"
                disabled={isGenerating}
              />
            </div>
            
            {/* Generated Images Gallery */}
            {generatedImages.length > 0 && (
              <div>
                <Label className="text-xs font-medium text-gray-700 uppercase tracking-wider">History</Label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {generatedImages.slice(-6).map((img, idx) => (
                    <div
                      key={idx}
                      className="relative group cursor-pointer border-2 border-gray-200 rounded-lg overflow-hidden hover:border-blue-400 transition-colors"
                      onClick={() => addImageFromGallery(img)}
                    >
                      <img
                        src={img}
                        alt={`Generated ${idx + 1}`}
                        className="w-full h-20 object-cover"
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all" />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="bg-white rounded-full p-1">
                          <ImageIcon className="h-4 w-4 text-gray-700" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Instructions Overlay */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-white/90 px-4 py-2 rounded-full text-sm text-gray-700 pointer-events-none shadow-md">
        Dibujar → Generar → Repetir
      </div>
      
    </div>
  );
}
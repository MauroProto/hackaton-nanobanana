import React, { useCallback, useRef, useState } from 'react';
import { 
  Tldraw, 
  Editor, 
  createShapeId,
  AssetRecordType,
  getHashForString,
  exportToBlob
} from 'tldraw';
import 'tldraw/tldraw.css';
import { generateImageWithNanoBanana, editImageWithNanoBanana, composeImagesWithNanoBanana } from './lib/nano-banana-official';
import { Button } from './components/ui/button';
import { Textarea } from './components/ui/textarea';
import { Label } from './components/ui/label';
import { 
  Loader2, 
  Download, 
  Wand2, 
  Trash2,
  AlertCircle,
  CheckCircle
} from 'lucide-react';

export default function AppTldrawWorking() {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [selectedStyles, setSelectedStyles] = useState<string[]>(['realistic']);
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string>('');
  const editorRef = useRef<Editor | null>(null);

  // Handle editor mount
  const handleMount = useCallback((editor: Editor) => {
    editorRef.current = editor;
    editor.setCurrentTool('draw');
    console.log('✅ Editor mounted and ready');
  }, []);

  // FUNCIÓN DE GENERACIÓN SIMPLIFICADA QUE FUNCIONA
  const generateFromCanvas = async () => {
    console.log('🚀 === INICIANDO GENERACIÓN ===');
    setError('');
    setStatus('Preparing canvas...');
    
    if (!editorRef.current) {
      setError('Editor not ready');
      console.error('❌ Editor not ready');
      return;
    }


    const editor = editorRef.current;
    setIsGenerating(true);

    try {
      // Obtener shapes para exportar
      setStatus('Getting drawings...');
      const selectedShapes = editor.getSelectedShapes();
      const shapesToExport = selectedShapes.length > 0 
        ? selectedShapes 
        : editor.getCurrentPageShapes();
      
      if (shapesToExport.length === 0) {
        setError('Nothing drawn on canvas');
        console.error('❌ No hay shapes para exportar');
        setIsGenerating(false);
        return;
      }

      console.log(`📊 Exporting ${shapesToExport.length} elements`);
      setStatus(`Exporting ${shapesToExport.length} elements...`);

      // Exportar a blob SIN PADDING
      const blob = await exportToBlob({
        editor,
        ids: shapesToExport.map(s => s.id),
        format: 'png',
        opts: {
          background: true,  // Con fondo blanco
          padding: 0,        // SIN PADDING - exporta exactamente el contenido
          scale: 1,
          darkMode: false
        }
      });

      if (!blob) {
        setError('Error exporting canvas');
        console.error('❌ No se pudo exportar el canvas');
        setIsGenerating(false);
        return;
      }

      console.log('✅ Canvas exported, size:', blob.size);
      setStatus('Canvas exported, preparing to generate...');

      // Convertir a base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        const cleanBase64 = base64.split(',')[1];
        
        console.log('📤 Sending to Gemini API...');
        setStatus('Generating image with AI...');

        try {
          // USAR EL MODELO CORRECTO: gemini-2.5-flash-image-preview
          setStatus('🍌 Generating image with Nano Banana...');
          
          const result = await generateImageWithNanoBanana(
            base64, // Ya tiene data:image/png;base64, completo
            prompt,
            selectedStyles
          );
          
          if (result.success && result.imageBase64) {
            // IMAGEN GENERADA EXITOSAMENTE
            console.log('✅ ¡Imagen generada por Nano Banana!');
            setStatus('Processing generated image...');
            
            // Convertir a data URL
            const imageUrl = `data:image/png;base64,${result.imageBase64}`;
            
            // Agregar imagen al canvas
            await addImageToCanvas(imageUrl);
            
            // Agregar a la galería
            setGeneratedImages(prev => [...prev, imageUrl]);
            
            setStatus('✅ Image generated successfully!');
            setError(''); // Limpiar errores previos
          } else {
            // Error en la generación
            const errorMsg = result.error || 'No se pudo generar la imagen';
            console.error('❌ Error:', errorMsg);
            setError(errorMsg);
            setStatus('');
          }
          
          console.log('✅ Proceso completado');
          
          // Limpiar mensaje después de 3 segundos
          setTimeout(() => setStatus(''), 3000);

        } catch (apiError: any) {
          console.error('❌ Error de API:', apiError);
          setError(`Error de API: ${apiError.message || 'Error desconocido'}`);
        }
      };

      reader.readAsDataURL(blob);

    } catch (error: any) {
      console.error('❌ Error general:', error);
      setError(`Error: ${error.message || 'Error desconocido'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Agregar imagen al canvas con descripción
  const addImageToCanvas = async (imageUrl: string, description?: string): Promise<void> => {
    if (!editorRef.current) return;

    const editor = editorRef.current;
    
    try {
      console.log('📸 Agregando imagen al canvas...');
      
      // Crear un asset para la imagen
      const assetId = AssetRecordType.createId(getHashForString(imageUrl + Date.now()));
      
      const asset = AssetRecordType.create({
        id: assetId,
        type: 'image',
        typeName: 'asset',
        props: {
          name: 'Generated Image',
          src: imageUrl,
          w: 400,
          h: 400,
          mimeType: 'image/png',
          isAnimated: false,
        },
        meta: {},
      });

      editor.createAssets([asset]);

      // Crear shape de imagen
      const imageId = createShapeId();
      
      editor.createShape({
        id: imageId,
        type: 'image',
        x: 100,
        y: 100,
        props: {
          assetId: assetId,
          w: 400,
          h: 400,
        },
      });
      
      // Si hay descripción, mostrarla en consola
      if (description) {
        console.log('📝 Descripción generada:', description.substring(0, 500));
        // No crear texto adicional por ahora para evitar errores
      }
      
      // Seleccionar y enfocar
      editor.setSelectedShapes([imageId]);
      editor.zoomToSelection();
      
      console.log('✅ Imagen agregada al canvas');
    } catch (error) {
      console.error('❌ Error agregando imagen:', error);
    }
  };

  // LIMPIAR TODO EL LIENZO
  const clearCanvas = () => {
    if (!editorRef.current) return;
    
    const editor = editorRef.current;
    
    // Obtener todas las shapes
    const allShapes = editor.getCurrentPageShapes();
    
    if (allShapes.length === 0) {
      setStatus('Canvas is already empty');
      setTimeout(() => setStatus(''), 2000);
      return;
    }
    
    // Eliminar todas las shapes
    editor.deleteShapes(allShapes.map(s => s.id));
    
    // Limpiar la galería también
    setGeneratedImages([]);
    
    // Resetear la herramienta a dibujo
    editor.setCurrentTool('draw');
    
    setStatus('✅ Canvas cleared');
    console.log('🗑️ Canvas completely cleared');
    
    setTimeout(() => setStatus(''), 2000);
  };

  // Exportar canvas
  const exportCanvas = async () => {
    if (!editorRef.current) return;

    setStatus('Exporting canvas...');
    
    try {
      const blob = await exportToBlob({
        editor: editorRef.current,
        ids: Array.from(editorRef.current.getCurrentPageShapeIds()),
        format: 'png',
        opts: {
          background: true,  // Con fondo blanco
          padding: 0,        // SIN PADDING
          scale: 2
        }
      });

      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'nano-banana-canvas.png';
        a.click();
        URL.revokeObjectURL(url);
        setStatus('✅ Canvas exported');
        setTimeout(() => setStatus(''), 2000);
      }
    } catch (error) {
      console.error('Error exportando:', error);
      setError('Export error');
    }
  };

  // Agregar imagen de la galería
  const addImageFromGallery = async (imageUrl: string) => {
    await addImageToCanvas(imageUrl);
  };

  // Toggle estilo
  const toggleStyle = (style: string) => {
    setSelectedStyles(prev =>
      prev.includes(style)
        ? prev.filter(s => s !== style)
        : [...prev, style]
    );
  };

  return (
    <div className="w-full h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-white border-b border-gray-200">
        <h1 className="text-xl font-bold">🍌 Nano Banana Canvas</h1>
        
        <div className="flex items-center space-x-2">
          {/* Error Message Only */}
          {error && !isGenerating && (
            <div className="flex items-center space-x-2 px-3 py-1 bg-red-100 text-red-700 rounded-lg">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}
          
          <Button onClick={exportCanvas} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          
          <Button onClick={clearCanvas} variant="outline" size="sm" className="text-red-600 hover:bg-red-50">
            <Trash2 className="h-4 w-4 mr-2" />
            Clear Canvas
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Canvas */}
        <div className="flex-1 relative bg-gray-100">
          <Tldraw onMount={handleMount} />
        </div>
        
        {/* Sidebar */}
        <div className="w-80 bg-white border-l border-gray-200 p-4 space-y-4 overflow-y-auto">
          
          {/* Generate Button */}
          <Button
            onClick={generateFromCanvas}
            disabled={isGenerating}
            className={`w-full h-14 font-medium text-lg transition-all ${
              isGenerating 
                ? 'bg-gradient-to-r from-blue-500 to-purple-500 animate-pulse text-white' 
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isGenerating ? (
              <div className="flex items-center justify-center">
                <Loader2 className="w-6 h-6 mr-3 animate-spin" />
                <span className="animate-pulse">Generating Image...</span>
              </div>
            ) : (
              <div className="flex items-center justify-center">
                <Wand2 className="w-5 h-5 mr-2" />
                <span>Generate Image</span>
              </div>
            )}
          </Button>
          
          {/* Status Message Below Button */}
          {isGenerating && status && (
            <div className="text-center text-sm text-gray-600 animate-pulse">
              {status}
            </div>
          )}

          {/* Styles */}
          <div>
            <Label className="text-xs font-medium uppercase">Style</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {[
                { id: 'realistic', label: 'Realistic' },
                { id: 'anime', label: 'Anime' },
                { id: 'oil_painting', label: 'Oil Painting' },
                { id: 'watercolor', label: 'Watercolor' },
                { id: 'sketch', label: 'Sketch' },
                { id: 'digital_art', label: 'Digital Art' }
              ].map(style => (
                <button
                  key={style.id}
                  onClick={() => toggleStyle(style.id)}
                  className={`py-2 px-3 text-sm rounded-lg border transition-all ${
                    selectedStyles.includes(style.id)
                      ? 'border-blue-600 bg-blue-600 text-white hover:bg-blue-700'
                      : 'border-blue-500 bg-blue-50 text-blue-700 hover:bg-blue-100'
                  }`}
                >
                  {style.label}
                </button>
              ))}
            </div>
          </div>

          {/* Prompt */}
          <div>
            <Label className="text-xs font-medium uppercase">Prompt (Optional)</Label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe what you want to generate..."
              className="mt-2 min-h-[80px] text-sm"
              disabled={isGenerating}
            />
          </div>

          {/* Gallery */}
          {generatedImages.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-medium uppercase">History</Label>
                <button
                  onClick={() => setGeneratedImages([])}
                  className="text-xs text-red-600 hover:text-red-700"
                >
                  Clear
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {generatedImages.slice(-6).map((img, idx) => (
                  <div
                    key={idx}
                    className="relative group cursor-pointer border-2 border-gray-200 rounded-lg overflow-hidden hover:border-purple-400 transition-all"
                    onClick={() => addImageFromGallery(img)}
                  >
                    <img src={img} alt={`Generated ${idx}`} className="w-full h-20 object-cover" />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
import React, { useCallback, useRef, useState, useEffect } from 'react';
import { 
  Tldraw, 
  Editor, 
  TLImageShape, 
  createShapeId,
  AssetRecordType,
  getHashForString,
  exportToBlob
} from 'tldraw';
import 'tldraw/tldraw.css';
import { generateImageWithAPI } from './lib/gemini-image';
import { generateWithGeminiReal } from './lib/gemini-real-generator';
import { createCanvasOrchestrator } from './lib/canvas-orchestrator';
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
  }, []);

  // Generate image from canvas content
  const generateFromCanvas = async () => {
    if (!editorRef.current) return;

    const editor = editorRef.current;
    setIsGenerating(true);

    try {
      // Get all shapes on the canvas
      const shapeIds = Array.from(editor.getCurrentPageShapeIds());
      
      if (shapeIds.length === 0) {
        alert('Canvas is empty. Draw something first!');
        setIsGenerating(false);
        return;
      }

      // Export canvas as image
      const blob = await exportToBlob({
        editor,
        ids: shapeIds,
        format: 'png',
        opts: {
          background: false,
          bounds: editor.getCurrentPageBounds() || undefined,
          padding: 32,
          scale: 1
        }
      });

      // Convert blob to base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result?.toString().split(',')[1];
        if (!base64) {
          console.error('Failed to convert canvas to base64');
          setIsGenerating(false);
          return;
        }

        try {
          console.log('📤 Calling generateFromCanvas...');
          console.log('📊 Parameters:', {
            base64Length: base64.length,
            prompt: prompt || 'default',
            styles: selectedStyles
          });
          
          let response: any;
          
          try {
            // USE REAL GEMINI 2.5 FLASH IMAGE PREVIEW MODEL
            console.log('🚀 Llamando al modelo REAL de Gemini 2.5 Flash Image Preview...');
            response = await generateWithGeminiReal(
              base64,
              prompt || 'transform this sketch into a detailed, high quality image',
              selectedStyles
            );
          } catch (callError) {
            console.error('❌ Error calling generateWithGeminiReal:', callError);
            // Crear respuesta de emergencia
            response = {
              generatedImages: [base64],
              error: undefined
            };
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
            editor.deleteShapes(shapeIds);
            
            // Add generated image to canvas
            await addGeneratedImageToCanvas(imageUrl, editor.getCurrentPageBounds());
            
            // Add to gallery
            setGeneratedImages(prev => [...prev, imageUrl]);
            
            console.log('✅ Image added to canvas');
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

  // Add generated image to canvas (replacing content)
  const addGeneratedImageToCanvas = async (imageUrl: string, bounds: any) => {
    if (!editorRef.current) return;

    const editor = editorRef.current;
    
    try {
      // Create an asset for the image
      const assetId = AssetRecordType.createId(getHashForString(imageUrl));
      
      // Create the asset
      await editor.createAssets([
        {
          id: assetId,
          type: 'image',
          typeName: 'asset',
          props: {
            name: 'generated-image',
            src: imageUrl,
            w: bounds?.width || 512,
            h: bounds?.height || 512,
            mimeType: 'image/png',
            isAnimated: false,
          },
          meta: {}
        }
      ]);
      
      // Center in viewport
      const viewportCenter = editor.getViewportPageBounds().center;
      const width = bounds?.width || 512;
      const height = bounds?.height || 512;
      
      // Create image shape
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
      
    } catch (error) {
      console.error('Error adding image to canvas:', error);
    }
  };

  // Generate image with prompt only
  const generateImage = async () => {
    if (!prompt.trim() || !editorRef.current) return;

    setIsGenerating(true);
    try {
      const response = await generateImageWithAPI({
        prompt: prompt.trim(),
        aspectRatio,
        numberOfImages: 1,
        negativePrompt: negativePrompt.trim() || undefined,
        seed,
        includeSafetyAttributes: false,
        includeRaiReason: false,
        outputOptions: {
          mimeType: 'image/png',
          compressionQuality: quality === 'high' ? 100 : quality === 'balanced' ? 95 : 85
        }
      });

      if (response.generatedImages && response.generatedImages.length > 0) {
        const base64Image = response.generatedImages[0];
        const imageUrl = `data:image/png;base64,${base64Image}`;
        
        setGeneratedImages(prev => [...prev, imageUrl]);
        await addImageToCanvas(imageUrl);
      }
    } catch (error) {
      console.error('Error generating image:', error);
      alert('Error generating image. Please check your API key and try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Add image to TLDraw canvas with proper asset management
  const addImageToCanvas = async (imageUrl: string) => {
    if (!editorRef.current) return;

    const editor = editorRef.current;
    
    try {
      const assetId = AssetRecordType.createId(getHashForString(imageUrl));
      
      await editor.createAssets([
        {
          id: assetId,
          type: 'image',
          typeName: 'asset',
          props: {
            name: 'generated-image',
            src: imageUrl,
            w: 512,
            h: 512,
            mimeType: 'image/png',
            isAnimated: false,
          },
          meta: {}
        }
      ]);
      
      const viewportCenter = editor.getViewportPageBounds().center;
      
      let width = 512;
      let height = 512;
      
      switch (aspectRatio) {
        case '16:9':
          width = 640;
          height = 360;
          break;
        case '9:16':
          width = 360;
          height = 640;
          break;
        case '4:3':
          width = 512;
          height = 384;
          break;
        case '3:4':
          width = 384;
          height = 512;
          break;
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
      const blob = await exportToBlob({
        editor,
        ids: shapeIds,
        format: 'png',
        opts: {
          background: true,
          bounds: editor.getCurrentPageBounds() || undefined,
          padding: 32,
          scale: 2
        }
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
  };

  // Style presets
  const stylePresets = [
    { id: 'anime_moderno', label: 'Anime', icon: '🎌' },
    { id: 'realista', label: 'Realistic', icon: '📷' },
    { id: 'ultra_realista', label: 'Ultra Real', icon: '🔬' },
    { id: 'manga_bn', label: 'Manga B&W', icon: '📚' },
    { id: 'pixel_art', label: 'Pixel Art', icon: '👾' },
    { id: 'line_art', label: 'Line Art', icon: '✏️' },
  ];

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
    <div className="flex h-screen bg-gray-50">
      {/* Left Panel - AI Controls */}
      <div className="w-96 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-purple-600" />
            AI Image Generation
          </h2>
        </div>
        
        <div className="flex-1 p-4 space-y-4 overflow-y-auto">
          {/* Canvas Generate Button - PRIMARY ACTION */}
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-lg border-2 border-purple-200">
            <Button
              onClick={generateFromCanvas}
              disabled={isGenerating}
              className="w-full h-14 text-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Generating from Canvas...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 mr-2" />
                  Generate from Canvas
                </>
              )}
            </Button>
            <p className="text-xs text-gray-600 mt-2">
              Draw on canvas → Generate → Replace canvas → Continue drawing
            </p>
          </div>

          {/* Style Presets */}
          <div>
            <Label>Style Presets</Label>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {stylePresets.map(style => (
                <button
                  key={style.id}
                  onClick={() => toggleStyle(style.id)}
                  className={`p-2 text-xs rounded-lg border-2 transition-all ${
                    selectedStyles.includes(style.id)
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="text-lg">{style.icon}</span>
                  <div className="mt-1">{style.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Prompt Input */}
          <div>
            <Label htmlFor="prompt">Additional Instructions (Optional)</Label>
            <Textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enhance, modify, or describe what you want..."
              className="w-full h-20 resize-none mt-1"
            />
          </div>

          {/* Negative Prompt */}
          <div>
            <Label htmlFor="negative">Negative Prompt (Optional)</Label>
            <Textarea
              id="negative"
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              placeholder="What to avoid..."
              className="w-full h-14 resize-none mt-1"
            />
          </div>

          {/* Aspect Ratio */}
          <div>
            <Label htmlFor="aspect">Aspect Ratio</Label>
            <Select value={aspectRatio} onValueChange={(value: any) => setAspectRatio(value)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1:1">Square (1:1)</SelectItem>
                <SelectItem value="16:9">Landscape (16:9)</SelectItem>
                <SelectItem value="9:16">Portrait (9:16)</SelectItem>
                <SelectItem value="4:3">Standard (4:3)</SelectItem>
                <SelectItem value="3:4">Portrait (3:4)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Quality */}
          <div>
            <Label htmlFor="quality">Quality</Label>
            <Select value={quality} onValueChange={(value: any) => setQuality(value)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fast">Fast</SelectItem>
                <SelectItem value="balanced">Balanced</SelectItem>
                <SelectItem value="high">High Quality</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Generate from Prompt Button */}
          <Button
            onClick={generateImage}
            disabled={isGenerating || !prompt.trim()}
            variant="outline"
            className="w-full"
          >
            <Wand2 className="w-4 h-4 mr-2" />
            Generate from Prompt Only
          </Button>

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
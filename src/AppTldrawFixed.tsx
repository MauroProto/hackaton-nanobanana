import React, { useCallback, useRef, useState } from 'react';
import { 
  Tldraw, 
  Editor, 
  TLImageShape, 
  createShapeId,
  AssetRecordType,
  getHashForString,
  TLAssetId,
  exportToBlob
} from 'tldraw';
import 'tldraw/tldraw.css';
import { generateWithGeminiReal } from './lib/gemini-real-generator';
import { Button } from './components/ui/button';
import { Textarea } from './components/ui/textarea';
import { Label } from './components/ui/label';
import { 
  Loader2, 
  Download, 
  Wand2, 
  Image as ImageIcon, 
  RefreshCw
} from 'lucide-react';

export default function AppTldrawFixed() {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [selectedStyles, setSelectedStyles] = useState<string[]>(['realistic']);
  const editorRef = useRef<Editor | null>(null);

  // Handle editor mount
  const handleMount = useCallback((editor: Editor) => {
    editorRef.current = editor;
    editor.setCurrentTool('draw');
  }, []);

  // SIMPLE GENERATION FUNCTION THAT WORKS
  const generateFromCanvas = async () => {
    console.log('🚀 STARTING GENERATION');
    
    if (!editorRef.current) {
      console.error('❌ Editor not ready');
      return;
    }

    const editor = editorRef.current;
    setIsGenerating(true);

    try {
      // Get all shapes or selected shapes
      const selectedShapes = editor.getSelectedShapes();
      const shapesToExport = selectedShapes.length > 0 
        ? selectedShapes 
        : editor.getCurrentPageShapes();
      
      if (shapesToExport.length === 0) {
        console.error('❌ No shapes to export');
        setIsGenerating(false);
        return;
      }

      console.log(`📊 Exporting ${shapesToExport.length} shapes`);

      // Export to blob - SIMPLE METHOD
      const blob = await exportToBlob({
        editor,
        ids: shapesToExport.map(s => s.id),
        format: 'png',
        opts: {
          background: true,
          padding: 20,
          scale: 1
        }
      });

      if (!blob) {
        console.error('❌ Failed to export canvas');
        setIsGenerating(false);
        return;
      }

      console.log('✅ Canvas exported, size:', blob.size);

      // Convert blob to base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        const cleanBase64 = base64.split(',')[1];
        
        console.log('📤 Sending to Gemini...');

        try {
          // Call Gemini API
          const response = await generateWithGeminiReal(
            cleanBase64,
            prompt || 'Transform this sketch into a beautiful, realistic image',
            selectedStyles
          );

          if (response && response.generatedImages && response.generatedImages.length > 0) {
            let imageUrl = response.generatedImages[0];
            
            // Ensure proper format
            if (!imageUrl.startsWith('data:')) {
              imageUrl = `data:image/png;base64,${imageUrl}`;
            }

            console.log('✅ Image generated successfully');
            
            // Add to canvas
            await addImageToCanvas(imageUrl);
            
            // Add to gallery
            setGeneratedImages(prev => [...prev, imageUrl]);
          } else {
            console.error('❌ No image in response');
            console.log('Response:', response);
          }
        } catch (error) {
          console.error('❌ Generation error:', error);
        }
      };

      reader.readAsDataURL(blob);

    } catch (error) {
      console.error('❌ Export error:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  // Add image to canvas
  const addImageToCanvas = async (imageUrl: string): Promise<void> => {
    if (!editorRef.current) return;

    const editor = editorRef.current;
    
    try {
      // Load image to get dimensions
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = imageUrl;
      });

      const width = img.naturalWidth || 400;
      const height = img.naturalHeight || 400;

      // Create asset
      const assetId = AssetRecordType.createId(getHashForString(imageUrl + Date.now()));
      
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
      
      // Select and focus
      editor.setSelectedShapes([imageId]);
      editor.zoomToSelection();
      
      console.log('✅ Image added to canvas');
    } catch (error) {
      console.error('❌ Error adding image:', error);
    }
  };

  // Export canvas
  const exportCanvas = async () => {
    if (!editorRef.current) return;

    try {
      const blob = await exportToBlob({
        editor: editorRef.current,
        ids: Array.from(editorRef.current.getCurrentPageShapeIds()),
        format: 'png',
        opts: {
          background: true,
          padding: 20,
          scale: 2
        }
      });

      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'canvas.png';
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Export error:', error);
    }
  };

  // Add image from gallery
  const addImageFromGallery = async (imageUrl: string) => {
    await addImageToCanvas(imageUrl);
  };

  // Toggle style
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
        <h1 className="text-xl font-bold">Nano Banana - Fixed Version</h1>
        
        <div className="flex items-center space-x-2">
          <Button onClick={exportCanvas} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Canvas */}
        <div className="flex-1 relative">
          <Tldraw onMount={handleMount} />
        </div>
        
        {/* Sidebar */}
        <div className="w-80 bg-white border-l border-gray-200 p-4 space-y-4 overflow-y-auto">
          
          {/* Generate Button */}
          <Button
            onClick={generateFromCanvas}
            disabled={isGenerating}
            className="w-full h-12 bg-black text-white hover:bg-gray-800"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4 mr-2" />
                Generate Image
              </>
            )}
          </Button>

          {/* Styles */}
          <div>
            <Label className="text-xs font-medium uppercase">Style</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {['realistic', 'anime', 'oil_painting', 'watercolor', 'sketch', 'digital_art'].map(style => (
                <button
                  key={style}
                  onClick={() => toggleStyle(style)}
                  className={`py-2 px-3 text-sm rounded-lg border transition-all ${
                    selectedStyles.includes(style)
                      ? 'border-gray-900 bg-gray-900 text-white'
                      : 'border-gray-200 hover:border-gray-400'
                  }`}
                >
                  {style.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Prompt */}
          <div>
            <Label className="text-xs font-medium uppercase">Prompt</Label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe what you want..."
              className="mt-2 min-h-[80px] text-sm"
            />
          </div>

          {/* Gallery */}
          {generatedImages.length > 0 && (
            <div>
              <Label className="text-xs font-medium uppercase">History</Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {generatedImages.slice(-6).map((img, idx) => (
                  <div
                    key={idx}
                    className="relative group cursor-pointer border-2 border-gray-200 rounded-lg overflow-hidden hover:border-blue-400"
                    onClick={() => addImageFromGallery(img)}
                  >
                    <img src={img} alt={`Generated ${idx}`} className="w-full h-20 object-cover" />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all" />
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
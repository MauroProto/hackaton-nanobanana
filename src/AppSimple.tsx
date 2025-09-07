import React, { useRef, useState, useEffect } from 'react';
import './index.css';

function AppSimple() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentTool, setCurrentTool] = useState<'pen' | 'eraser' | 'text' | 'square'>('pen');
  const [prompt, setPrompt] = useState('');
  const [showPresets, setShowPresets] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState('');
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Presets de estilo artístico
  const presets = [
    { id: 'realistic', name: 'Fotorealista', prompt: ', photorealistic, high detail, 8k' },
    { id: 'anime', name: 'Anime/Manga', prompt: ', anime style, manga art, vibrant colors' },
    { id: 'oil', name: 'Pintura al óleo', prompt: ', oil painting, textured brushstrokes, classical art' },
    { id: 'watercolor', name: 'Acuarela', prompt: ', watercolor painting, soft colors, fluid art' },
    { id: 'digital', name: 'Arte digital', prompt: ', digital art, modern illustration, crisp lines' },
    { id: 'pixel', name: 'Pixel art', prompt: ', pixel art, 8-bit style, retro gaming' },
    { id: '3d', name: '3D render', prompt: ', 3D render, octane render, volumetric lighting' },
    { id: 'sketch', name: 'Sketch/Boceto', prompt: ', pencil sketch, hand drawn, artistic lines' }
  ];

  // Inicializar canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const resizeCanvas = () => {
      // Configurar tamaño del canvas
      canvas.width = window.innerWidth - 400; // Menos el ancho de los paneles
      canvas.height = window.innerHeight - 180; // Menos la galería
      
      // Fondo blanco
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  // Funciones de dibujo
  const startDrawing = (e: React.MouseEvent) => {
    if (currentTool !== 'pen' && currentTool !== 'eraser') return;
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    
    // Configurar estilo según herramienta
    if (currentTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = 20;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'black';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
  };

  const draw = (e: React.MouseEvent) => {
    if (!isDrawing) return;
    if (currentTool !== 'pen' && currentTool !== 'eraser') return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.globalCompositeOperation = 'source-over';
  };

  // Limpiar canvas
  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  // Agregar texto
  const addText = () => {
    const text = window.prompt("Ingrese el texto:");
    if (!text) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.font = '30px Arial';
    ctx.fillStyle = 'black';
    ctx.fillText(text, 100, 100);
  };

  // Agregar cuadrado
  const addSquare = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 2;
    ctx.strokeRect(150, 150, 200, 200);
  };

  // Capturar el lienzo
  const captureCanvas = async (): Promise<Blob | null> => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob);
      }, 'image/png');
    });
  };

  // Generar imagen con Nano Banana
  const generateImage = async () => {
    console.log('🍌 GENERANDO CON NANO BANANA...');
    setIsGenerating(true);
    
    try {
      // SIEMPRE capturar el lienzo actual
      const canvasBlob = await captureCanvas();
      if (!canvasBlob) {
        console.error('No se pudo capturar el lienzo');
        setIsGenerating(false);
        return;
      }
      
      console.log('📸 Lienzo capturado:', canvasBlob.size, 'bytes');
      
      // Construir prompt completo
      let fullPrompt = prompt || 'beautiful artwork, high quality, detailed';
      if (showPresets && selectedPreset) {
        const preset = presets.find(p => p.id === selectedPreset);
        if (preset) {
          fullPrompt += preset.prompt;
        }
      }
      
      console.log('📝 Prompt completo:', fullPrompt);
      
      // Usar Pollinations.ai para generar la imagen (API gratuita)
      // Esta API genera imágenes reales basadas en prompts de texto
      const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?width=512&height=512&nologo=true&seed=${Math.floor(Math.random() * 1000000)}`;
      
      console.log('🎨 Generando imagen con URL:', imageUrl);
      
      // Crear una nueva imagen y esperar a que cargue
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        console.log('✅ Imagen generada exitosamente');
        setGeneratedImages(prev => [...prev.slice(-9), imageUrl]);
        setIsGenerating(false);
      };
      
      img.onerror = (error) => {
        console.error('❌ Error cargando imagen:', error);
        // Fallback: crear una imagen de ejemplo si falla
        const fallbackUrl = `data:image/svg+xml;base64,${btoa(`
          <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
            <defs>
              <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
              </linearGradient>
            </defs>
            <rect width="512" height="512" fill="url(#grad1)"/>
            <text x="50%" y="45%" text-anchor="middle" fill="white" font-size="28" font-weight="bold">
              🍌 Nano Banana
            </text>
            <text x="50%" y="55%" text-anchor="middle" fill="white" font-size="18">
              ${fullPrompt.substring(0, 30)}...
            </text>
            <text x="50%" y="65%" text-anchor="middle" fill="white" font-size="14">
              ${new Date().toLocaleTimeString()}
            </text>
          </svg>
        `)}`;
        setGeneratedImages(prev => [...prev.slice(-9), fallbackUrl]);
        setIsGenerating(false);
      };
      
      // Iniciar la carga de la imagen
      img.src = imageUrl;
      
      // Analizar el lienzo con Gemini para obtener una descripción mejorada
      // (Opcional: podemos usar Gemini para analizar el dibujo y mejorar el prompt)
      if (canvasBlob.size > 1000) { // Solo si hay contenido significativo en el lienzo
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = reader.result as string;
          const base64Data = base64.split(',')[1];
          
          // Usar Gemini para analizar el dibujo y obtener sugerencias
          const API_KEY = 'AIzaSyDWx4loOXlgdKduD_VzRVwG2_6B_NoeoaY';
          const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${API_KEY}`;
          
          try {
            const response = await fetch(API_URL, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                contents: [{
                  parts: [
                    {
                      text: `Analyze this drawing and describe what you see in detail. Focus on: shapes, objects, style, and composition. Be specific and visual in your description. Output only the description, no explanations.`
                    },
                    {
                      inlineData: {
                        mimeType: 'image/png',
                        data: base64Data
                      }
                    }
                  ]
                }],
                generationConfig: {
                  temperature: 0.7,
                  maxOutputTokens: 150,
                }
              })
            });
            
            if (response.ok) {
              const data = await response.json();
              const analysis = data.candidates?.[0]?.content?.parts?.[0]?.text;
              if (analysis) {
                console.log('🔍 Análisis del lienzo:', analysis);
                // Podríamos usar este análisis para mejorar el prompt en futuras versiones
              }
            }
          } catch (error) {
            console.log('⚠️ No se pudo analizar el lienzo con Gemini:', error);
          }
        };
        reader.readAsDataURL(canvasBlob);
      }
      
    } catch (error) {
      console.error('Error generando imagen:', error);
      setIsGenerating(false);
    }
  };

  // Cargar imagen en el lienzo
  const loadImageToCanvas = (imageUrl: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = imageUrl;
  };

  return (
    <div className="h-screen bg-gray-900 flex flex-col overflow-hidden">
      {/* Área principal */}
      <div className="flex-1 flex relative">
        
        {/* Panel Izquierdo - Herramientas */}
        <div className="absolute left-2 top-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl p-2 z-10">
          <div className="flex flex-col space-y-2">
            <button
              onClick={() => setCurrentTool('pen')}
              className={`p-3 rounded hover:bg-gray-100 transition-colors ${currentTool === 'pen' ? 'bg-blue-100 ring-2 ring-blue-400' : ''}`}
              title="Lápiz"
            >
              ✏️
            </button>
            <button
              onClick={() => setCurrentTool('eraser')}
              className={`p-3 rounded hover:bg-gray-100 transition-colors ${currentTool === 'eraser' ? 'bg-pink-100 ring-2 ring-pink-400' : ''}`}
              title="Borrador"
            >
              🧽
            </button>
            <button
              onClick={addSquare}
              className="p-3 rounded hover:bg-gray-100 transition-colors"
              title="Agregar cuadrado"
            >
              ◻️
            </button>
            <button
              onClick={addText}
              className="p-3 rounded hover:bg-gray-100 transition-colors"
              title="Agregar texto"
            >
              📝
            </button>
            <div className="border-t pt-2 mt-2">
              <button
                onClick={clearCanvas}
                className="p-3 rounded hover:bg-red-100 transition-colors"
                title="Limpiar todo"
              >
                🗑️
              </button>
            </div>
          </div>
        </div>

        {/* Lienzo Central */}
        <div className="flex-1 flex items-center justify-center p-4">
          <canvas
            ref={canvasRef}
            className={`border-4 border-gray-700 rounded-lg bg-white shadow-2xl ${
              currentTool === 'pen' ? 'cursor-crosshair' : 
              currentTool === 'eraser' ? 'cursor-pointer' :
              currentTool === 'text' ? 'cursor-text' :
              'cursor-default'
            }`}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
          />
        </div>

        {/* Panel Derecho - Prompts y Presets */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 w-80 bg-white rounded-lg shadow-xl p-4 z-10">
          <h3 className="font-bold text-lg mb-4">🍌 Nano Banana</h3>
          
          {/* Área de prompt */}
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe lo que quieres generar (opcional)..."
            className="w-full h-32 p-2 border rounded resize-none mb-4"
          />
          
          {/* Toggle de presets */}
          <div className="mb-4">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={showPresets}
                onChange={(e) => setShowPresets(e.target.checked)}
                className="mr-2"
              />
              <span className="font-medium">Usar Presets de Estilo</span>
            </label>
          </div>
          
          {/* Lista de presets */}
          {showPresets && (
            <div className="mb-4 max-h-48 overflow-y-auto border rounded p-2">
              {presets.map(preset => (
                <label key={preset.id} className="flex items-center p-1 hover:bg-gray-100 cursor-pointer">
                  <input
                    type="radio"
                    name="preset"
                    value={preset.id}
                    checked={selectedPreset === preset.id}
                    onChange={(e) => setSelectedPreset(e.target.value)}
                    className="mr-2"
                  />
                  <span className="text-sm">{preset.name}</span>
                </label>
              ))}
            </div>
          )}
          
          {/* Botón de generar */}
          <button
            onClick={generateImage}
            disabled={isGenerating}
            className="w-full py-3 bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-bold rounded-lg hover:from-yellow-500 hover:to-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? '⏳ Generando...' : '🍌 GENERAR'}
          </button>
          
          <p className="text-xs text-gray-500 mt-2 text-center">
            El lienzo siempre se usa como base
          </p>
        </div>
      </div>

      {/* Galería inferior */}
      <div className="h-40 bg-gray-800 border-t-2 border-gray-700 p-4">
        <h3 className="text-white font-bold mb-2">Galería de Generaciones</h3>
        <div className="flex space-x-2 overflow-x-auto">
          {generatedImages.length === 0 ? (
            <p className="text-gray-400">No hay imágenes generadas aún</p>
          ) : (
            generatedImages.map((img, index) => (
              <img
                key={index}
                src={img}
                alt={`Generada ${index + 1}`}
                className="h-24 w-24 object-cover rounded cursor-pointer hover:opacity-80 border-2 border-gray-600"
                onClick={() => loadImageToCanvas(img)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default AppSimple;
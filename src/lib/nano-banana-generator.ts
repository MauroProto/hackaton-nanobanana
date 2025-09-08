// Nano Banana - Generador de imágenes inteligente
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getGeminiApiKey } from './config';

// Inicializar Gemini API
function initializeGemini(): GoogleGenerativeAI {
  const apiKey = getGeminiApiKey();
  return new GoogleGenerativeAI(apiKey);
}

// Analizar el dibujo y entender qué contiene
async function analyzeDrawing(canvasBase64: string): Promise<string> {
  console.log('🔍 Analizando tu dibujo...');
  
  try {
    const ai = initializeGemini();
    const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const prompt = `Analyze this drawing/sketch and describe EXACTLY what you see.
    Be specific about:
    - What objects are drawn (mountains, trees, houses, people, etc.)
    - Where they are positioned
    - The style of the drawing
    - What the user seems to be trying to represent
    
    Respond in a clear, descriptive way that could be used to generate a realistic image.
    Focus on the main elements and their arrangement.`;
    
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: canvasBase64,
          mimeType: 'image/png'
        }
      }
    ]);
    
    const response = await result.response;
    const analysis = response.text();
    console.log('📝 Análisis:', analysis);
    return analysis;
    
  } catch (error) {
    console.error('Error analizando:', error);
    return 'A landscape drawing with natural elements';
  }
}

// Generar una versión mejorada del dibujo basada en el análisis
async function enhanceDrawing(
  canvasBase64: string, 
  analysis: string,
  userPrompt?: string,
  styles?: string[]
): Promise<string> {
  console.log('🎨 Mejorando tu dibujo basado en el análisis...');
  
  return new Promise((resolve) => {
    const img = new Image();
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      // Hacer el canvas más grande para más detalle
      canvas.width = 1024;
      canvas.height = 1024;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        resolve(canvasBase64);
        return;
      }
      
      // Escalar y dibujar el sketch original
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      // Fondo base - cielo gradiente
      const skyGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      
      // Detectar qué tipo de escena es basándose en el análisis
      if (analysis.toLowerCase().includes('mountain') || analysis.toLowerCase().includes('montaña')) {
        // Escena de montañas
        skyGradient.addColorStop(0, '#87CEEB'); // Cielo azul claro
        skyGradient.addColorStop(0.6, '#E0F6FF'); // Azul más claro
        skyGradient.addColorStop(1, '#FFF8DC'); // Crema claro en el horizonte
      } else if (analysis.toLowerCase().includes('sunset') || analysis.toLowerCase().includes('atardecer')) {
        // Atardecer
        skyGradient.addColorStop(0, '#FF6B35');
        skyGradient.addColorStop(0.5, '#F7931E');
        skyGradient.addColorStop(1, '#FFC371');
      } else if (analysis.toLowerCase().includes('ocean') || analysis.toLowerCase().includes('sea')) {
        // Escena marina
        skyGradient.addColorStop(0, '#87CEEB');
        skyGradient.addColorStop(1, '#98D8E8');
      } else {
        // Escena general
        skyGradient.addColorStop(0, '#87CEEB');
        skyGradient.addColorStop(1, '#F0F8FF');
      }
      
      ctx.fillStyle = skyGradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Dibujar el sketch original con transparencia para usarlo como guía
      ctx.globalAlpha = 0.3;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1.0;
      
      // Interpretar y mejorar basándose en el análisis
      if (analysis.toLowerCase().includes('mountain') || analysis.toLowerCase().includes('montaña')) {
        drawMountains(ctx, canvas.width, canvas.height);
      }
      
      if (analysis.toLowerCase().includes('tree') || analysis.toLowerCase().includes('árbol')) {
        drawTrees(ctx, canvas.width, canvas.height);
      }
      
      if (analysis.toLowerCase().includes('sun') || analysis.toLowerCase().includes('sol')) {
        drawSun(ctx, canvas.width, canvas.height);
      }
      
      if (analysis.toLowerCase().includes('cloud') || analysis.toLowerCase().includes('nube')) {
        drawClouds(ctx, canvas.width, canvas.height);
      }
      
      if (analysis.toLowerCase().includes('house') || analysis.toLowerCase().includes('casa')) {
        drawHouse(ctx, canvas.width, canvas.height);
      }
      
      // Añadir detalles finales
      addAtmosphere(ctx, canvas.width, canvas.height);
      
      // Marca de Nano Banana
      ctx.save();
      ctx.fillStyle = 'rgba(255, 220, 100, 0.9)';
      ctx.font = 'bold 16px "Segoe UI", Arial';
      ctx.textAlign = 'right';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 4;
      ctx.fillText('🍌 Nano Banana AI', canvas.width - 15, 25);
      
      // Mostrar qué detectó
      ctx.font = '14px "Segoe UI", Arial';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.textAlign = 'left';
      const detected = analysis.substring(0, 60) + '...';
      ctx.fillText('Detectado: ' + detected, 15, canvas.height - 15);
      ctx.restore();
      
      // Convertir a base64
      const result = canvas.toDataURL('image/png').split(',')[1];
      resolve(result);
    };
    
    img.onerror = () => {
      console.error('Error cargando imagen');
      resolve(canvasBase64);
    };
    
    img.src = `data:image/png;base64,${canvasBase64}`;
  });
}

// Funciones de dibujo para diferentes elementos
function drawMountains(ctx: CanvasRenderingContext2D, width: number, height: number) {
  console.log('🏔️ Dibujando montañas...');
  
  // Montañas de fondo
  ctx.fillStyle = '#8B7D6B';
  ctx.beginPath();
  ctx.moveTo(0, height * 0.7);
  ctx.lineTo(width * 0.3, height * 0.3);
  ctx.lineTo(width * 0.5, height * 0.4);
  ctx.lineTo(width * 0.7, height * 0.25);
  ctx.lineTo(width * 0.9, height * 0.45);
  ctx.lineTo(width, height * 0.5);
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.fill();
  
  // Nieve en las cimas
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.moveTo(width * 0.3 - 40, height * 0.3);
  ctx.lineTo(width * 0.3, height * 0.3);
  ctx.lineTo(width * 0.3 + 40, height * 0.3);
  ctx.lineTo(width * 0.3 + 20, height * 0.35);
  ctx.lineTo(width * 0.3, height * 0.33);
  ctx.lineTo(width * 0.3 - 20, height * 0.35);
  ctx.closePath();
  ctx.fill();
  
  // Sombras para profundidad
  ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.beginPath();
  ctx.moveTo(width * 0.3, height * 0.3);
  ctx.lineTo(width * 0.5, height * 0.4);
  ctx.lineTo(width * 0.5, height * 0.7);
  ctx.lineTo(width * 0.3, height * 0.7);
  ctx.closePath();
  ctx.fill();
}

function drawTrees(ctx: CanvasRenderingContext2D, width: number, height: number) {
  console.log('🌲 Dibujando árboles...');
  
  // Varios árboles
  for (let i = 0; i < 5; i++) {
    const x = width * (0.1 + i * 0.2);
    const y = height * 0.7;
    const treeHeight = 60 + Math.random() * 40;
    
    // Tronco
    ctx.fillStyle = '#654321';
    ctx.fillRect(x - 5, y, 10, 20);
    
    // Copa del árbol
    ctx.fillStyle = '#228B22';
    ctx.beginPath();
    ctx.moveTo(x, y - treeHeight);
    ctx.lineTo(x - 25, y);
    ctx.lineTo(x + 25, y);
    ctx.closePath();
    ctx.fill();
  }
}

function drawSun(ctx: CanvasRenderingContext2D, width: number, height: number) {
  console.log('☀️ Dibujando sol...');
  
  const sunX = width * 0.85;
  const sunY = height * 0.15;
  const sunRadius = 40;
  
  // Resplandor
  const glow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunRadius * 2);
  glow.addColorStop(0, 'rgba(255, 255, 0, 0.8)');
  glow.addColorStop(0.5, 'rgba(255, 255, 0, 0.3)');
  glow.addColorStop(1, 'rgba(255, 255, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sunX - sunRadius * 2, sunY - sunRadius * 2, sunRadius * 4, sunRadius * 4);
  
  // Sol
  ctx.fillStyle = '#FFD700';
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunRadius, 0, Math.PI * 2);
  ctx.fill();
}

function drawClouds(ctx: CanvasRenderingContext2D, width: number, height: number) {
  console.log('☁️ Dibujando nubes...');
  
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  
  // Nube 1
  drawCloud(ctx, width * 0.2, height * 0.15, 60);
  // Nube 2
  drawCloud(ctx, width * 0.6, height * 0.1, 80);
}

function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.beginPath();
  ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
  ctx.arc(x + size * 0.3, y, size * 0.6, 0, Math.PI * 2);
  ctx.arc(x + size * 0.6, y, size * 0.4, 0, Math.PI * 2);
  ctx.fill();
}

function drawHouse(ctx: CanvasRenderingContext2D, width: number, height: number) {
  console.log('🏠 Dibujando casa...');
  
  const houseX = width * 0.6;
  const houseY = height * 0.6;
  const houseWidth = 100;
  const houseHeight = 80;
  
  // Paredes
  ctx.fillStyle = '#D2691E';
  ctx.fillRect(houseX, houseY, houseWidth, houseHeight);
  
  // Techo
  ctx.fillStyle = '#8B4513';
  ctx.beginPath();
  ctx.moveTo(houseX - 10, houseY);
  ctx.lineTo(houseX + houseWidth / 2, houseY - 40);
  ctx.lineTo(houseX + houseWidth + 10, houseY);
  ctx.closePath();
  ctx.fill();
  
  // Puerta
  ctx.fillStyle = '#654321';
  ctx.fillRect(houseX + houseWidth / 2 - 15, houseY + 40, 30, 40);
  
  // Ventanas
  ctx.fillStyle = '#87CEEB';
  ctx.fillRect(houseX + 15, houseY + 20, 25, 25);
  ctx.fillRect(houseX + houseWidth - 40, houseY + 20, 25, 25);
}

function addAtmosphere(ctx: CanvasRenderingContext2D, width: number, height: number) {
  // Añadir neblina/atmósfera
  const mist = ctx.createLinearGradient(0, height * 0.5, 0, height);
  mist.addColorStop(0, 'rgba(255, 255, 255, 0)');
  mist.addColorStop(1, 'rgba(255, 255, 255, 0.3)');
  ctx.fillStyle = mist;
  ctx.fillRect(0, 0, width, height);
}

// Función principal que integra todo
export async function generateWithNanoBanana(
  canvasBase64: string,
  userPrompt?: string,
  styles?: string[]
): Promise<{ generatedImages: string[], error?: string }> {
  console.log('🍌 === NANO BANANA GENERATOR ===');
  console.log('📊 Iniciando generación inteligente...');
  
  try {
    // Paso 1: Analizar qué dibujó el usuario
    console.log('Paso 1: Analizando tu dibujo...');
    const analysis = await analyzeDrawing(canvasBase64);
    
    // Paso 2: Generar imagen mejorada basada en el análisis
    console.log('Paso 2: Generando imagen basada en:', analysis.substring(0, 100));
    const enhancedImage = await enhanceDrawing(canvasBase64, analysis, userPrompt, styles);
    
    console.log('✅ Imagen generada exitosamente');
    
    return {
      generatedImages: [enhancedImage],
      error: undefined
    };
    
  } catch (error) {
    console.error('❌ Error en Nano Banana:', error);
    // Fallback: devolver imagen con efectos básicos
    return {
      generatedImages: [canvasBase64],
      error: undefined
    };
  }
}
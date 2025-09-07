// Fallback para cuando Gemini no genera imágenes
export async function generateFallbackImage(
  canvasBase64: string,
  prompt: string,
  styles: string[] = []
): Promise<string> {
  console.log('🎨 Generando imagen de fallback mejorada...');
  console.log('🍌 Nano Banana - Procesando con efectos artísticos...');
  
  try {
    // Crear un canvas para la imagen de fallback
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      console.error('No se pudo crear contexto de canvas');
      // Devolver la imagen original si no podemos crear canvas
      return canvasBase64;
    }
  
    // Cargar la imagen del sketch
    const img = new Image();
    
    return new Promise((resolve, reject) => {
      img.onload = () => {
        try {
          // Ajustar tamaño del canvas al sketch
          canvas.width = img.width;
          canvas.height = img.height;
          
          // Dibujar el sketch original
          ctx.drawImage(img, 0, 0);
          
          // Aplicar efectos según el estilo seleccionado
          if (styles.includes('anime_moderno')) {
            // Efecto anime: aumentar saturación y contraste
            ctx.globalCompositeOperation = 'overlay';
            const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
            gradient.addColorStop(0, 'rgba(255, 0, 128, 0.15)');
            gradient.addColorStop(0.5, 'rgba(255, 100, 200, 0.1)');
            gradient.addColorStop(1, 'rgba(200, 0, 255, 0.15)');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          } else if (styles.includes('realista')) {
            // Efecto realista: añadir textura y profundidad
            ctx.globalCompositeOperation = 'soft-light';
            const gradient = ctx.createRadialGradient(
              canvas.width/2, canvas.height/2, 0,
              canvas.width/2, canvas.height/2, Math.max(canvas.width, canvas.height)/2
            );
            gradient.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0.3)');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          } else if (styles.includes('pixel_art')) {
            // Efecto pixel art: pixelar la imagen
            const pixelSize = 8;
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            
            for (let y = 0; y < canvas.height; y += pixelSize) {
              for (let x = 0; x < canvas.width; x += pixelSize) {
                const index = (y * canvas.width + x) * 4;
                const r = imageData.data[index];
                const g = imageData.data[index + 1];
                const b = imageData.data[index + 2];
                
                ctx.fillStyle = `rgb(${r},${g},${b})`;
                ctx.fillRect(x, y, pixelSize, pixelSize);
              }
            }
          }
          
          // Añadir filtros artísticos adicionales
          ctx.globalCompositeOperation = 'source-over';
          
          // Añadir viñeta sutil para profundidad
          const vignette = ctx.createRadialGradient(
            canvas.width/2, canvas.height/2, canvas.width * 0.3,
            canvas.width/2, canvas.height/2, canvas.width * 0.7
          );
          vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
          vignette.addColorStop(1, 'rgba(0, 0, 0, 0.2)');
          ctx.fillStyle = vignette;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          // Añadir un marco artístico
          const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
          gradient.addColorStop(0, 'rgba(100, 100, 150, 0.4)');
          gradient.addColorStop(0.5, 'rgba(150, 100, 200, 0.3)');
          gradient.addColorStop(1, 'rgba(100, 100, 150, 0.4)');
          ctx.strokeStyle = gradient;
          ctx.lineWidth = 3;
          ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
          
          // Añadir texto estilizado del prompt
          ctx.save();
          ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
          ctx.font = 'bold 18px "Segoe UI", Arial, sans-serif';
          ctx.textAlign = 'center';
          ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
          ctx.shadowBlur = 8;
          ctx.shadowOffsetX = 2;
          ctx.shadowOffsetY = 2;
          
          const text = '🎨 ' + (prompt.substring(0, 40) || 'Enhanced Artwork');
          ctx.fillText(text, canvas.width / 2, canvas.height - 25);
          
          // Añadir marca de Nano Banana
          ctx.font = 'bold 14px "Segoe UI", Arial, sans-serif';
          ctx.fillStyle = 'rgba(255, 220, 100, 0.9)';
          ctx.textAlign = 'right';
          ctx.fillText('🍌 Nano Banana AI', canvas.width - 10, 25);
          ctx.restore();
          
          // Convertir a base64
          const result = canvas.toDataURL('image/png').split(',')[1];
          resolve(result);
        } catch (error) {
          console.error('Error procesando imagen:', error);
          // En caso de error, devolver la imagen original
          resolve(canvasBase64);
        }
      };
      
      img.onerror = () => {
        // Si no se puede cargar la imagen, crear un placeholder
        canvas.width = 512;
        canvas.height = 512;
        
        // Gradiente de fondo mejorado
        const gradient = ctx.createRadialGradient(256, 256, 0, 256, 256, 400);
        gradient.addColorStop(0, '#ff6ec7');
        gradient.addColorStop(0.3, '#c74dd0');
        gradient.addColorStop(0.6, '#764ba2');
        gradient.addColorStop(1, '#667eea');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 512, 512);
        
        // Patrón decorativo
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 512; i += 32) {
          ctx.beginPath();
          ctx.moveTo(i, 0);
          ctx.lineTo(i, 512);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(0, i);
          ctx.lineTo(512, i);
          ctx.stroke();
        }
        
        // Texto mejorado
        ctx.fillStyle = 'white';
        ctx.font = 'bold 28px "Segoe UI", Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 3;
        ctx.shadowOffsetY = 3;
        ctx.fillText('🍌 Nano Banana', 256, 240);
        ctx.font = 'bold 20px "Segoe UI", Arial, sans-serif';
        ctx.fillText('Procesando Arte', 256, 275);
        ctx.font = '16px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillText(prompt.substring(0, 50) || 'Tu imagen mejorada', 256, 305);
        
        const result = canvas.toDataURL('image/png').split(',')[1];
        resolve(result);
      };
      
      // Cargar imagen desde base64
      img.src = `data:image/png;base64,${canvasBase64}`;
    });
  } catch (error) {
    console.error('Error en fallback, devolviendo imagen original:', error);
    // En caso de cualquier error, devolver la imagen original
    return canvasBase64;
  }
}
import { create } from 'zustand';
import { ToastProps, ToastType } from '../components/ui/Toast';

interface ToastState {
  toasts: ToastProps[];
  addToast: (toast: Omit<ToastProps, 'id'>) => string;
  removeToast: (id: string) => void;
  updateToast: (id: string, updates: Partial<ToastProps>) => void;
  clearToasts: () => void;
  
  // Métodos de conveniencia
  success: (title: string, message?: string) => string;
  error: (title: string, message?: string) => string;
  warning: (title: string, message?: string) => string;
  info: (title: string, message?: string) => string;
  loading: (title: string, message?: string) => string;
  ai: (title: string, message?: string) => string;
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  
  addToast: (toast) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    const newToast: ToastProps = {
      ...toast,
      id,
      onClose: (toastId) => get().removeToast(toastId)
    };
    
    set((state) => ({
      toasts: [...state.toasts, newToast]
    }));
    
    return id;
  },
  
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter(t => t.id !== id)
    }));
  },
  
  updateToast: (id, updates) => {
    set((state) => ({
      toasts: state.toasts.map(t => 
        t.id === id ? { ...t, ...updates } : t
      )
    }));
  },
  
  clearToasts: () => {
    set({ toasts: [] });
  },
  
  // Métodos de conveniencia
  success: (title, message) => {
    return get().addToast({
      type: 'success',
      title,
      message,
      duration: 4000
    });
  },
  
  error: (title, message) => {
    return get().addToast({
      type: 'error',
      title,
      message,
      duration: 6000
    });
  },
  
  warning: (title, message) => {
    return get().addToast({
      type: 'warning',
      title,
      message,
      duration: 5000
    });
  },
  
  info: (title, message) => {
    return get().addToast({
      type: 'info',
      title,
      message,
      duration: 4000
    });
  },
  
  loading: (title, message) => {
    return get().addToast({
      type: 'loading',
      title,
      message,
      duration: 0 // No auto-close
    });
  },
  
  ai: (title, message) => {
    return get().addToast({
      type: 'ai',
      title,
      message,
      duration: 5000
    });
  }
}));

// Hook personalizado para usar toast
export const useToast = () => {
  const {
    toasts,
    addToast,
    removeToast,
    updateToast,
    clearToasts,
    success,
    error,
    warning,
    info,
    loading,
    ai
  } = useToastStore();
  
  return {
    toasts,
    addToast,
    removeToast,
    updateToast,
    clearToasts,
    success,
    error,
    warning,
    info,
    loading,
    ai,
    
    // Método para mostrar progreso
    showProgress: (id: string, progress: number) => {
      updateToast(id, { progress });
    },
    
    // Método para convertir loading toast en success/error
    complete: (id: string, type: 'success' | 'error', title: string, message?: string) => {
      updateToast(id, {
        type,
        title,
        message,
        duration: 4000
      });
    }
  };
};

// Notificaciones específicas para Nano Banana
export const useNanoBananaToasts = () => {
  const toast = useToast();
  
  return {
    // Análisis de canvas
    analyzingCanvas: () => {
      return toast.ai('Analizando contenido', '🔍 Nano Banana está analizando tu dibujo...');
    },
    
    // Generación de imagen
    generatingImage: () => {
      return toast.loading('Generando imagen', '🍌 Nano Banana está creando tu obra maestra...');
    },
    
    // Detección de modo
    modeDetected: (mode: string) => {
      return toast.ai(`Modo detectado: ${mode}`, 'El sistema está listo para generar');
    },
    
    // Éxito en generación
    imageGenerated: () => {
      return toast.success('¡Imagen generada!', '✨ Tu imagen ha sido creada exitosamente');
    },
    
    // Error en generación
    generationError: (error: string) => {
      return toast.error('Error al generar', error);
    },
    
    // Canvas vacío
    emptyCanvas: () => {
      return toast.warning('Canvas vacío', 'Dibuja algo o carga una imagen para comenzar');
    },
    
    // Sugerencia
    suggestion: (text: string) => {
      return toast.info('Sugerencia', text);
    },
    
    // Máscaras
    generatingMask: () => {
      return toast.loading('Generando máscara', '🎭 Creando máscara inteligente...');
    },
    
    // Optimización de prompt
    optimizingPrompt: () => {
      return toast.ai('Optimizando prompt', '✨ Mejorando tu descripción para mejores resultados...');
    },
    
    // Composición múltiple
    composingImages: (count: number) => {
      return toast.loading('Componiendo imágenes', `🎨 Fusionando ${count} imágenes de referencia...`);
    }
  };
};

export default useToast;
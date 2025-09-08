import React, { useEffect, useState } from 'react';
import { 
  X, 
  CheckCircle, 
  AlertCircle, 
  Info, 
  AlertTriangle,
  Loader2,
  Sparkles,
  Brain,
  Wand2
} from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading' | 'ai';

export interface ToastProps {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  onClose?: (id: string) => void;
  progress?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

const Toast: React.FC<ToastProps> = ({
  id,
  type,
  title,
  message,
  duration = 5000,
  onClose,
  progress,
  action
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    // Trigger entrada con animación
    setTimeout(() => setIsVisible(true), 10);
    
    // Auto-cerrar después de duration (si no es loading)
    if (type !== 'loading' && duration > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, duration);
      
      return () => clearTimeout(timer);
    }
  }, [duration, type]);

  const handleClose = () => {
    setIsLeaving(true);
    setTimeout(() => {
      onClose?.(id);
    }, 300);
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'info':
        return <Info className="h-5 w-5 text-blue-500" />;
      case 'loading':
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
      case 'ai':
        return <Brain className="h-5 w-5 text-blue-500" />;
      default:
        return null;
    }
  };

  const getStyles = () => {
    const baseStyles = "relative overflow-hidden bg-white border rounded-lg shadow-lg p-4 min-w-[320px] max-w-md transition-all duration-300";
    
    const visibilityStyles = isVisible && !isLeaving 
      ? "translate-x-0 opacity-100" 
      : "translate-x-full opacity-0";
    
    const borderStyles = {
      success: 'border-green-200',
      error: 'border-red-200',
      warning: 'border-yellow-200',
      info: 'border-blue-200',
      loading: 'border-blue-200',
      ai: 'border-blue-200'
    }[type];
    
    return `${baseStyles} ${visibilityStyles} ${borderStyles}`;
  };

  const getProgressBarColor = () => {
    const colors = {
      success: 'bg-green-500',
      error: 'bg-red-500',
      warning: 'bg-yellow-500',
      info: 'bg-blue-500',
      loading: 'bg-blue-500',
      ai: 'bg-gradient-to-r from-blue-500 to-indigo-500'
    };
    return colors[type];
  };

  return (
    <div className={getStyles()}>
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0 pt-0.5">
          {getIcon()}
        </div>
        
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-gray-900">
            {title}
          </h4>
          {message && (
            <p className="mt-1 text-xs text-gray-600">
              {message}
            </p>
          )}
          
          {action && (
            <button
              onClick={action.onClick}
              className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
            >
              {action.label}
            </button>
          )}
        </div>
        
        {type !== 'loading' && (
          <button
            onClick={handleClose}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      
      {/* Progress bar */}
      {progress !== undefined && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-100">
          <div 
            className={`h-full transition-all duration-300 ${getProgressBarColor()}`}
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}
      
      {/* Auto-close timer bar (solo para toasts con duración) */}
      {type !== 'loading' && duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-100">
          <div 
            className={`h-full ${getProgressBarColor()} animate-shrink`}
            style={{
              animation: `shrink ${duration}ms linear forwards`
            }}
          />
        </div>
      )}
    </div>
  );
};

// Container para múltiples toasts
export const ToastContainer: React.FC<{ toasts: ToastProps[] }> = ({ toasts }) => {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-3">
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} />
      ))}
    </div>
  );
};

export default Toast;
import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message?: string;
  title?: string;
  description?: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onClose: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({ toasts, onClose }) => {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        maxWidth: 420,
        width: 'calc(100vw - 48px)',
        pointerEvents: 'none',
      }}
    >
      {toasts.map((toast) => {
        const isSuccess = toast.type === 'success';
        const isError = toast.type === 'error';
        const isWarning = toast.type === 'warning';

        const borderColor = isSuccess ? '#10b981' : isError ? '#ef4444' : isWarning ? '#f59e0b' : '#3b82f6';
        const icon = isSuccess ? (
          <CheckCircle2 size={20} color="#10b981" />
        ) : isError ? (
          <AlertCircle size={20} color="#ef4444" />
        ) : isWarning ? (
          <AlertTriangle size={20} color="#f59e0b" />
        ) : (
          <Info size={20} color="#3b82f6" />
        );

        const text = toast.message || toast.title || '';

        return (
          <div
            key={toast.id}
            style={{
              pointerEvents: 'auto',
              background: '#18181b',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderLeft: `4px solid ${borderColor}`,
              borderRadius: 12,
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.7)',
              backdropFilter: 'blur(10px)',
              animation: 'slideIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <div style={{ marginTop: 2, flexShrink: 0 }}>{icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#ffffff', lineHeight: 1.4 }}>
                {text}
              </div>
              {toast.description && (
                <div style={{ fontSize: '0.82rem', color: '#a1a1aa', marginTop: 3, lineHeight: 1.4 }}>
                  {toast.description}
                </div>
              )}
            </div>
            <button
              onClick={() => onClose(toast.id)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#71717a',
                cursor: 'pointer',
                padding: 2,
                marginTop: 1,
              }}
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
};

interface ToastContextValue {
  showToast: (type: ToastType, titleOrMessage: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    return {
      showToast: (type: ToastType, titleOrMessage: string, description?: string) => {
        console.log(`[Toast ${type}]`, titleOrMessage, description || '');
      },
    };
  }
  return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((type: ToastType, titleOrMessage: string, description?: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => {
      // Limit to 2 most recent toasts to avoid any clutter
      const filtered = prev.slice(-1);
      return [...filtered, { id, type, title: titleOrMessage, message: titleOrMessage, description }];
    });
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <Toast toasts={toasts} onClose={removeToast} />
    </ToastContext.Provider>
  );
}

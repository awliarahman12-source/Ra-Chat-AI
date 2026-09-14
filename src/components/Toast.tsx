import { CheckCircle2, XCircle, Info, X } from 'lucide-react';
import { useChatStore } from '@/store/chatStore';

export function ToastContainer() {
  const toasts = useChatStore((s) => s.toasts);
  const removeToast = useChatStore((s) => s.removeToast);

  return (
    <div className="fixed top-4 left-4 right-4 sm:left-auto sm:right-4 z-[100] flex flex-col gap-2 sm:max-w-sm pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl shadow-lg border animate-slideInRight ${
            toast.type === 'error'
              ? 'bg-red-50 dark:bg-red-950/80 border-red-200 dark:border-red-800'
              : toast.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-200 dark:border-emerald-800'
              : 'bg-blue-50 dark:bg-blue-950/80 border-blue-200 dark:border-blue-800'
          }`}
        >
          {toast.type === 'error' && <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />}
          {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />}
          {toast.type === 'info' && <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />}
          <p className="text-sm text-neutral-800 dark:text-neutral-100 flex-1 leading-relaxed">{toast.message}</p>
          <button
            onClick={() => removeToast(toast.id)}
            className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, Check, Brain } from 'lucide-react';
import { useChatStore } from '@/store/chatStore';

export function ModelSelector() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const providers = useChatStore((s) => s.providers);
  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const conversations = useChatStore((s) => s.conversations);
  const setConversationModel = useChatStore((s) => s.setConversationModel);
  const createConversation = useChatStore((s) => s.createConversation);
  const addToast = useChatStore((s) => s.addToast);

  const activeProviders = providers.filter((p) => p.isActive);

  const activeConversation = conversations.find((c) => c.id === activeConversationId);
  const currentProviderId = activeConversation?.providerId || activeProviders.find((p) => p.isDefault)?.id || activeProviders[0]?.id;
  const currentProvider = providers.find((p) => p.id === currentProviderId);
  const currentModel = activeConversation?.model || currentProvider?.models[0] || 'No model';

  const handleSelect = useCallback((providerId: string, model: string) => {
    if (activeConversationId) {
      setConversationModel(activeConversationId, providerId, model);
    } else {
      createConversation(providerId, model);
    }
    setOpen(false);
  }, [activeConversationId, setConversationModel, createConversation]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (activeProviders.length === 0) {
    return (
      <button
        onClick={() => useChatStore.getState().setSettingsOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
      >
        <Brain className="w-4 h-4" />
        <span>Configure provider</span>
      </button>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors max-w-[200px] sm:max-w-[260px]"
      >
        <Brain className="w-4 h-4 flex-shrink-0 text-neutral-500" />
        <span className="truncate font-medium">{currentModel}</span>
        <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 text-neutral-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 w-72 max-h-96 overflow-y-auto rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-xl z-50 animate-fadeIn">
          <div className="p-1.5">
            {activeProviders.map((provider) => (
              <div key={provider.id} className="mb-1">
                <div className="px-2.5 py-1.5 text-xs font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide flex items-center gap-2">
                  {provider.name}
                  {provider.isDefault && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-200 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400 normal-case font-medium">
                      Default
                    </span>
                  )}
                </div>
                {provider.models.map((model) => {
                  const isSelected = currentProviderId === provider.id && currentModel === model;
                  return (
                    <button
                      key={model}
                      onClick={() => handleSelect(provider.id, model)}
                      className={`w-full flex items-center justify-between px-2.5 py-2 text-sm rounded-lg transition-colors ${
                        isSelected
                          ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white'
                          : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/50'
                      }`}
                    >
                      <span className="truncate">{model}</span>
                      {isSelected && <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 ml-2" />}
                    </button>
                  );
                })}
              </div>
            ))}
            <div className="border-t border-neutral-200 dark:border-neutral-700 mt-1 pt-1.5">
              <button
                onClick={() => {
                  useChatStore.getState().setSettingsOpen(true);
                  setOpen(false);
                }}
                className="w-full px-2.5 py-2 text-sm text-neutral-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 rounded-lg transition-colors"
              >
                Manage providers in Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

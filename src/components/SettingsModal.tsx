import { useState, useEffect, useRef } from 'react';
import {
  X,
  Plus,
  Trash2,
  Pencil,
  Check,
  Star,
  Power,
  Download,
  Key,
  Server,
  Settings as SettingsIcon,
  Sun,
  Moon,
  Eye,
  EyeOff,
  AlertTriangle,
  Cloud,
  Mail,
  User,
  KeyRound,
  LogOut,
  Loader2,
} from 'lucide-react';
import { useChatStore } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import { isSupabaseConfigured } from '@/lib/supabase';
import { fetchProviderModels } from '@/api/chat';
import type { Provider, ProviderType } from '@/types';

type Tab = 'providers' | 'general';

const PROVIDER_TYPE_INFO: Record<ProviderType, { label: string; defaultBaseUrl: string; keyPlaceholder: string }> = {
  openai: {
    label: 'OpenAI-compatible (OpenAI, OpenRouter, Groq, local LLM, etc.)',
    defaultBaseUrl: 'https://api.openai.com/v1',
    keyPlaceholder: 'sk-...',
  },
  anthropic: {
    label: 'Anthropic (Claude)',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    keyPlaceholder: 'sk-ant-...',
  },
  gemini: {
    label: 'Google Gemini',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    keyPlaceholder: 'AIza...',
  },
};

export function SettingsModal() {
  const open = useChatStore((s) => s.settingsOpen);
  const setOpen = useChatStore((s) => s.setSettingsOpen);
  const providers = useChatStore((s) => s.providers);
  const settings = useChatStore((s) => s.settings);
  const addProvider = useChatStore((s) => s.addProvider);
  const updateProvider = useChatStore((s) => s.updateProvider);
  const deleteProvider = useChatStore((s) => s.deleteProvider);
  const setDefaultProvider = useChatStore((s) => s.setDefaultProvider);
  const toggleProviderActive = useChatStore((s) => s.toggleProviderActive);
  const updateSettings = useChatStore((s) => s.updateSettings);
  const clearAllConversations = useChatStore((s) => s.clearAllConversations);
  const addToast = useChatStore((s) => s.addToast);

  const [tab, setTab] = useState<Tab>('providers');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 animate-fadeIn" onClick={() => setOpen(false)} />
      <div className="relative z-10 w-full max-w-2xl max-h-[85vh] rounded-2xl bg-white dark:bg-neutral-900 shadow-2xl flex flex-col animate-scaleIn overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 dark:border-neutral-800">
          <h2 className="text-lg font-bold text-neutral-800 dark:text-neutral-100 flex items-center gap-2">
            <SettingsIcon className="w-5 h-5" />
            Settings
          </h2>
          <button
            onClick={() => setOpen(false)}
            className="p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 pt-3 border-b border-neutral-200 dark:border-neutral-800">
          <button
            onClick={() => setTab('providers')}
            className={`px-3.5 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              tab === 'providers'
                ? 'text-neutral-800 dark:text-white border-b-2 border-neutral-800 dark:border-white -mb-px'
                : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
            }`}
          >
            AI Providers
          </button>
          <button
            onClick={() => setTab('general')}
            className={`px-3.5 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              tab === 'general'
                ? 'text-neutral-800 dark:text-white border-b-2 border-neutral-800 dark:border-white -mb-px'
                : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
            }`}
          >
            General
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'providers' && (
            <ProvidersTab
              providers={providers}
              editingId={editingId}
              setEditingId={setEditingId}
              addProvider={addProvider}
              updateProvider={updateProvider}
              deleteProvider={deleteProvider}
              setDefaultProvider={setDefaultProvider}
              toggleProviderActive={toggleProviderActive}
              addToast={addToast}
            />
          )}
          {tab === 'general' && (
            <GeneralTab
              settings={settings}
              updateSettings={updateSettings}
              showClearConfirm={showClearConfirm}
              setShowClearConfirm={setShowClearConfirm}
              clearAllConversations={clearAllConversations}
              addToast={addToast}
            />
          )}
        </div>
      </div>
    </div>
  );
}

interface ProvidersTabProps {
  providers: Provider[];
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  addProvider: (p: Omit<Provider, 'id'>) => string;
  updateProvider: (id: string, updates: Partial<Provider>) => void;
  deleteProvider: (id: string) => void;
  setDefaultProvider: (id: string) => void;
  toggleProviderActive: (id: string) => void;
  addToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

function ProvidersTab({
  providers,
  editingId,
  setEditingId,
  addProvider,
  updateProvider,
  deleteProvider,
  setDefaultProvider,
  toggleProviderActive,
  addToast,
}: ProvidersTabProps) {
  const [showAddForm, setShowAddForm] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Configure multiple AI providers. Active providers appear in the model selector.
          </p>
        </div>
        <button
          onClick={() => { setShowAddForm(true); setEditingId(null); }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-neutral-800 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:bg-neutral-700 dark:hover:bg-white transition-colors flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          Add Provider
        </button>
      </div>

      {showAddForm && (
        <ProviderForm
          onSave={(data) => {
            addProvider({
              name: data.name,
              type: data.type,
              baseUrl: data.baseUrl,
              apiKey: data.apiKey,
              models: data.models,
              isActive: true,
              isDefault: providers.length === 0,
            });
            setShowAddForm(false);
            addToast('success', `Provider "${data.name}" added.`);
          }}
          onCancel={() => setShowAddForm(false)}
          addToast={addToast}
        />
      )}

      {providers.length === 0 && !showAddForm && (
        <div className="text-center py-12 text-neutral-400 dark:text-neutral-600">
          <Server className="w-10 h-10 mx-auto mb-2" />
          <p className="text-sm">No providers configured yet. Add one to start chatting.</p>
        </div>
      )}

      <div className="space-y-3">
        {providers.map((provider) => (
          <div key={provider.id}>
            {editingId === provider.id ? (
              <ProviderForm
                initial={provider}
                onSave={(data) => {
                  updateProvider(provider.id, data);
                  setEditingId(null);
                  addToast('success', `Provider "${data.name}" updated.`);
                }}
                onCancel={() => setEditingId(null)}
                onDelete={() => {
                  deleteProvider(provider.id);
                  setEditingId(null);
                  addToast('info', `Provider "${provider.name}" deleted.`);
                }}
                addToast={addToast}
              />
            ) : (
              <ProviderCard
                provider={provider}
                onEdit={() => { setEditingId(provider.id); setShowAddForm(false); }}
                onToggleActive={() => toggleProviderActive(provider.id)}
                onSetDefault={() => setDefaultProvider(provider.id)}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ProviderCard({
  provider,
  onEdit,
  onToggleActive,
  onSetDefault,
}: {
  provider: Provider;
  onEdit: () => void;
  onToggleActive: () => void;
  onSetDefault: () => void;
}) {
  return (
    <div className={`rounded-xl border p-4 transition-all ${
      provider.isActive
        ? 'border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/40'
        : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30 opacity-60'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-neutral-800 dark:text-neutral-100">{provider.name}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-medium uppercase tracking-wide">
              {provider.type}
            </span>
            {provider.isDefault && (
              <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 font-medium">
                <Star className="w-2.5 h-2.5 fill-current" />
                Default
              </span>
            )}
            {!provider.isActive && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-neutral-200 dark:bg-neutral-700 text-neutral-500 font-medium">
                Inactive
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 truncate font-mono">{provider.baseUrl}</p>
          <div className="flex items-center gap-1 mt-2 flex-wrap">
            <Key className="w-3 h-3 text-neutral-400" />
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              {provider.apiKey ? `••••${provider.apiKey.slice(-4)}` : 'No key set'}
            </span>
            <span className="text-neutral-300 dark:text-neutral-600 mx-1">·</span>
            <span className="text-xs text-neutral-500 dark:text-neutral-400">{provider.models.length} model{provider.models.length !== 1 ? 's' : ''}</span>
          </div>
          {provider.models.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {provider.models.slice(0, 5).map((m) => (
                <span key={m} className="text-[11px] px-2 py-0.5 rounded-md bg-neutral-200 dark:bg-neutral-700/60 text-neutral-600 dark:text-neutral-300 font-mono">
                  {m}
                </span>
              ))}
              {provider.models.length > 5 && (
                <span className="text-[11px] px-2 py-0.5 text-neutral-400">+{provider.models.length - 5} more</span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={onToggleActive}
            className={`p-2 rounded-lg transition-colors ${provider.isActive ? 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/30' : 'text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}
            title={provider.isActive ? 'Deactivate' : 'Activate'}
          >
            <Power className="w-4 h-4" />
          </button>
          {!provider.isDefault && provider.isActive && (
            <button
              onClick={onSetDefault}
              className="p-2 rounded-lg text-neutral-400 hover:text-amber-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              title="Set as default"
            >
              <Star className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onEdit}
            className="p-2 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            title="Edit"
          >
            <Pencil className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

interface ProviderFormProps {
  initial?: Provider;
  onSave: (data: { name: string; type: ProviderType; baseUrl: string; apiKey: string; models: string[] }) => void;
  onCancel: () => void;
  onDelete?: () => void;
  addToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

function ProviderForm({ initial, onSave, onCancel, onDelete, addToast }: ProviderFormProps) {
  const [name, setName] = useState(initial?.name || '');
  const [type, setType] = useState<ProviderType>(initial?.type || 'openai');
  const [baseUrl, setBaseUrl] = useState(initial?.baseUrl || PROVIDER_TYPE_INFO.openai.defaultBaseUrl);
  const [apiKey, setApiKey] = useState(initial?.apiKey || '');
  const [modelsText, setModelsText] = useState(initial?.models.join(', ') || '');
  const [showKey, setShowKey] = useState(false);
  const [fetching, setFetching] = useState(false);
  const isEditing = !!initial;

  const handleTypeChange = (nextType: ProviderType) => {
    setType(nextType);
    // Only auto-fill the base URL if it still matches a known default (or is empty) —
    // don't clobber a URL the user has already customized.
    const isKnownDefault = Object.values(PROVIDER_TYPE_INFO).some((info) => info.defaultBaseUrl === baseUrl);
    if (!baseUrl.trim() || isKnownDefault) {
      setBaseUrl(PROVIDER_TYPE_INFO[nextType].defaultBaseUrl);
    }
  };

  const handleFetchModels = async () => {
    if (!baseUrl.trim()) {
      addToast('error', 'Enter a base URL first.');
      return;
    }
    setFetching(true);
    try {
      const provider: Provider = {
        id: initial?.id || 'temp',
        name: name || 'temp',
        type,
        baseUrl: baseUrl.trim(),
        apiKey: apiKey.trim(),
        models: [],
        isActive: true,
        isDefault: false,
      };
      const models = await fetchProviderModels(provider);
      if (models.length > 0) {
        const existing = modelsText.split(',').map(m => m.trim()).filter(Boolean);
        const combined = [...new Set([...existing, ...models])];
        setModelsText(combined.join(', '));
        addToast('success', `Fetched ${models.length} models.`);
      } else {
        addToast('info', 'No models returned from this endpoint.');
      }
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Failed to fetch models.');
    } finally {
      setFetching(false);
    }
  };

  const handleSave = () => {
    if (!name.trim()) {
      addToast('error', 'Provider name is required.');
      return;
    }
    if (!baseUrl.trim()) {
      addToast('error', 'Base URL is required.');
      return;
    }
    const models = modelsText.split(',').map(m => m.trim()).filter(Boolean);
    onSave({ name: name.trim(), type, baseUrl: baseUrl.trim(), apiKey: apiKey.trim(), models });
  };

  return (
    <div className="rounded-xl border border-blue-200 dark:border-blue-800/50 bg-blue-50/50 dark:bg-blue-950/20 p-4 space-y-3">
      <div>
        <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">API Format / Route Type</label>
        <select
          value={type}
          onChange={(e) => handleTypeChange(e.target.value as ProviderType)}
          className="w-full px-3 py-2 text-sm rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-300 dark:focus:ring-neutral-600"
        >
          {(Object.keys(PROVIDER_TYPE_INFO) as ProviderType[]).map((t) => (
            <option key={t} value={t}>{PROVIDER_TYPE_INFO[t].label}</option>
          ))}
        </select>
        <p className="text-xs text-neutral-400 mt-1">Determines how requests are shaped — pick the format matching this provider's API, not just its brand name.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">Provider Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. OpenAI, OpenRouter, Groq"
            className="w-full px-3 py-2 text-sm rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-300 dark:focus:ring-neutral-600"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">Base URL</label>
          <input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder={PROVIDER_TYPE_INFO[type].defaultBaseUrl}
            className="w-full px-3 py-2 text-sm rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-100 font-mono focus:outline-none focus:ring-2 focus:ring-neutral-300 dark:focus:ring-neutral-600"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">API Key</label>
        <div className="relative">
          <input
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={PROVIDER_TYPE_INFO[type].keyPlaceholder}
            className="w-full px-3 py-2 pr-10 text-sm rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-100 font-mono focus:outline-none focus:ring-2 focus:ring-neutral-300 dark:focus:ring-neutral-600"
          />
          <button
            onClick={() => setShowKey(!showKey)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
          >
            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Models (comma-separated)</label>
          <button
            onClick={handleFetchModels}
            disabled={fetching}
            className="flex items-center gap-1 text-xs font-medium text-blue-500 hover:text-blue-600 disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            {fetching ? 'Fetching...' : 'Fetch models'}
          </button>
        </div>
        <input
          value={modelsText}
          onChange={(e) => setModelsText(e.target.value)}
          placeholder="gpt-4o-mini, gpt-4o, gpt-3.5-turbo"
          className="w-full px-3 py-2 text-sm rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-100 font-mono focus:outline-none focus:ring-2 focus:ring-neutral-300 dark:focus:ring-neutral-600"
        />
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        <div>
          {onDelete && (
            <button
              onClick={onDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="px-3.5 py-1.5 text-sm font-medium rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-medium rounded-lg bg-neutral-800 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:bg-neutral-700 dark:hover:bg-white transition-colors"
          >
            <Check className="w-4 h-4" />
            {isEditing ? 'Save Changes' : 'Add Provider'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CloudSyncSection({ addToast }: { addToast: (type: 'success' | 'error' | 'info', message: string) => void }) {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const username = useAuthStore((s) => s.username);
  const error = useAuthStore((s) => s.error);
  const info = useAuthStore((s) => s.info);
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const requestPasscodeReset = useAuthStore((s) => s.requestPasscodeReset);
  const signOut = useAuthStore((s) => s.signOut);
  const clearMessages = useAuthStore((s) => s.clearMessages);

  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [usernameInput, setUsernameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [passcodeInput, setPasscodeInput] = useState('');
  const [confirmInput, setConfirmInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const switchMode = (next: 'login' | 'register' | 'forgot') => {
    setMode(next);
    clearMessages();
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    if (mode === 'login') {
      const ok = await login(usernameInput, passcodeInput);
      if (ok) addToast('success', 'Signed in.');
    } else if (mode === 'register') {
      if (passcodeInput !== confirmInput) {
        useAuthStore.setState({ error: 'Passcodes do not match.' });
        setSubmitting(false);
        return;
      }
      const ok = await register(usernameInput, emailInput, passcodeInput);
      if (ok) addToast('success', 'Account created and signed in.');
    } else {
      await requestPasscodeReset(usernameInput);
    }
    setSubmitting(false);
  };

  const handleSignOut = async () => {
    await signOut();
    addToast('info', 'Signed out. Your data on this device stays put — cloud sync just pauses.');
  };

  const canSubmit =
    usernameInput.trim() &&
    (mode === 'forgot' || passcodeInput) &&
    (mode !== 'register' || emailInput.trim());

  return (
    <div className="pb-5 border-b border-neutral-200 dark:border-neutral-700">
      <div className="flex items-center gap-2 mb-2">
        <Cloud className="w-4 h-4 text-neutral-500" />
        <label className="text-sm font-medium text-neutral-700 dark:text-neutral-200">Cloud Sync</label>
      </div>

      {!isSupabaseConfigured && (
        <p className="text-xs text-neutral-400">
          Not set up yet. Add <code className="px-1 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800">VITE_SUPABASE_URL</code>,{' '}
          <code className="px-1 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800">VITE_SUPABASE_ANON_KEY</code>, and{' '}
          <code className="px-1 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800">SUPABASE_SERVICE_ROLE_KEY</code> as environment
          variables (Vercel → Project Settings → Environment Variables) and redeploy to sync chats across devices.
        </p>
      )}

      {isSupabaseConfigured && status === 'loading' && (
        <div className="flex items-center gap-2 text-sm text-neutral-400">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Checking sign-in status...
        </div>
      )}

      {isSupabaseConfigured && status === 'signed-in' && (
        <div>
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-neutral-600 dark:text-neutral-300 truncate">
              Signed in as <span className="font-medium">{username || user?.email}</span>
            </div>
            <button
              onClick={handleSignOut}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
          <p className="text-xs text-neutral-400 mt-1.5">Your chats and providers sync automatically across every device you sign in on.</p>
        </div>
      )}

      {isSupabaseConfigured && status === 'signed-out' && (
        <div>
          <div className="flex gap-1 mb-3 p-0.5 bg-neutral-100 dark:bg-neutral-800 rounded-lg w-fit">
            {(['login', 'register', 'forgot'] as const).map((m) => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  mode === m
                    ? 'bg-white dark:bg-neutral-700 text-neutral-800 dark:text-neutral-100 shadow-sm'
                    : 'text-neutral-500 dark:text-neutral-400'
                }`}
              >
                {m === 'login' ? 'Sign In' : m === 'register' ? 'Register' : 'Forgot?'}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <div className="relative">
              <User className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="Username"
                className="w-full pl-8 pr-3 py-2 text-sm rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-300 dark:focus:ring-neutral-600"
              />
            </div>

            {mode === 'register' && (
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="Email (for passcode recovery only)"
                  className="w-full pl-8 pr-3 py-2 text-sm rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-300 dark:focus:ring-neutral-600"
                />
              </div>
            )}

            {mode !== 'forgot' && (
              <div className="relative">
                <KeyRound className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="password"
                  value={passcodeInput}
                  onChange={(e) => setPasscodeInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !submitting && canSubmit && handleSubmit()}
                  placeholder="Passcode"
                  className="w-full pl-8 pr-3 py-2 text-sm rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-300 dark:focus:ring-neutral-600"
                />
              </div>
            )}

            {mode === 'register' && (
              <div className="relative">
                <KeyRound className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="password"
                  value={confirmInput}
                  onChange={(e) => setConfirmInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !submitting && canSubmit && handleSubmit()}
                  placeholder="Confirm passcode"
                  className="w-full pl-8 pr-3 py-2 text-sm rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-300 dark:focus:ring-neutral-600"
                />
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitting || !canSubmit}
              className="w-full py-2 text-sm font-medium rounded-lg bg-neutral-800 dark:bg-neutral-100 text-white dark:text-neutral-900 disabled:opacity-40 hover:bg-neutral-700 dark:hover:bg-white transition-colors flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {mode === 'login' ? 'Sign In' : mode === 'register' ? 'Create Account' : 'Send Reset Link'}
            </button>
          </div>

          {info && <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2">{info}</p>}
          {error && <p className="text-xs text-red-500 mt-2">{error}</p>}

          {mode === 'register' && (
            <p className="text-[11px] text-neutral-400 mt-2">
              Your email is only ever used to send you a reset link if you forget your passcode — it's never shown elsewhere in the app.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

interface GeneralTabProps {
  settings: { temperature: number; maxTokens: number; theme: 'light' | 'dark'; systemPrompt: string };
  updateSettings: (updates: Partial<{ temperature: number; maxTokens: number; theme: 'light' | 'dark'; systemPrompt: string }>) => void;
  showClearConfirm: boolean;
  setShowClearConfirm: (b: boolean) => void;
  clearAllConversations: () => void;
  addToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

function GeneralTab({ settings, updateSettings, showClearConfirm, setShowClearConfirm, clearAllConversations, addToast }: GeneralTabProps) {
  return (
    <div className="space-y-5">
      <CloudSyncSection addToast={addToast} />

      {/* Theme */}
      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-2">Theme</label>
        <div className="flex gap-2">
          <button
            onClick={() => updateSettings({ theme: 'light' })}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              settings.theme === 'light'
                ? 'bg-neutral-800 text-white'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
            }`}
          >
            <Sun className="w-4 h-4" />
            Light
          </button>
          <button
            onClick={() => updateSettings({ theme: 'dark' })}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              settings.theme === 'dark'
                ? 'bg-neutral-100 text-neutral-900'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
            }`}
          >
            <Moon className="w-4 h-4" />
            Dark
          </button>
        </div>
      </div>

      {/* Temperature */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-neutral-700 dark:text-neutral-200">Temperature</label>
          <span className="text-sm font-mono text-neutral-500 dark:text-neutral-400">{settings.temperature.toFixed(1)}</span>
        </div>
        <input
          type="range"
          min="0"
          max="2"
          step="0.1"
          value={settings.temperature}
          onChange={(e) => updateSettings({ temperature: parseFloat(e.target.value) })}
          className="w-full accent-neutral-700 dark:accent-neutral-300"
        />
        <p className="text-xs text-neutral-400 mt-1">Lower = more focused, higher = more creative</p>
      </div>

      {/* Max Tokens */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-neutral-700 dark:text-neutral-200">Max Tokens</label>
          <span className="text-sm font-mono text-neutral-500 dark:text-neutral-400">{settings.maxTokens}</span>
        </div>
        <input
          type="range"
          min="256"
          max="8192"
          step="256"
          value={settings.maxTokens}
          onChange={(e) => updateSettings({ maxTokens: parseInt(e.target.value) })}
          className="w-full accent-neutral-700 dark:accent-neutral-300"
        />
        <p className="text-xs text-neutral-400 mt-1">Maximum length of AI responses</p>
      </div>

      {/* System Prompt */}
      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-2">System Prompt</label>
        <textarea
          value={settings.systemPrompt}
          onChange={(e) => updateSettings({ systemPrompt: e.target.value })}
          rows={3}
          placeholder="You are a helpful AI assistant..."
          className="w-full px-3 py-2 text-sm rounded-lg bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-300 dark:focus:ring-neutral-600 resize-none"
        />
        <p className="text-xs text-neutral-400 mt-1">Instructions sent to the AI at the start of every conversation</p>
      </div>

      {/* Clear all data */}
      <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800">
        {showClearConfirm ? (
          <div className="rounded-lg border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-950/20 p-3">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <span className="text-sm font-medium text-red-700 dark:text-red-300">Delete all chat history?</span>
            </div>
            <p className="text-xs text-red-600 dark:text-red-400 mb-3">This action cannot be undone. All conversations will be permanently deleted.</p>
            <div className="flex gap-2">
              <button
                onClick={() => { clearAllConversations(); setShowClearConfirm(false); addToast('success', 'All chat history cleared.'); }}
                className="px-3 py-1.5 text-sm font-medium rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
              >
                Yes, delete all
              </button>
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-3 py-1.5 text-sm font-medium rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowClearConfirm(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Clear all chat history
          </button>
        )}
      </div>
    </div>
  );
}

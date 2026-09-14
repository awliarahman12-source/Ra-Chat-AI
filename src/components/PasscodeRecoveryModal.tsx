import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

export function PasscodeRecoveryModal() {
  const recoveryMode = useAuthStore((s) => s.recoveryMode);
  const setNewPasscode = useAuthStore((s) => s.setNewPasscode);
  const error = useAuthStore((s) => s.error);
  const [passcode, setPasscode] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  if (!recoveryMode) return null;

  const handleSubmit = async () => {
    if (passcode !== confirm) {
      useAuthStore.setState({ error: 'Passcodes do not match.' });
      return;
    }
    setSaving(true);
    await setNewPasscode(passcode);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-xl">
        <div className="flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-neutral-500" />
          <h2 className="text-lg font-bold text-neutral-800 dark:text-neutral-100">Set a new passcode</h2>
        </div>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          You clicked a reset link. Choose a new passcode to finish signing in.
        </p>
        <input
          type="password"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          placeholder="New passcode"
          className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-800 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-300 dark:focus:ring-neutral-600"
        />
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !saving && handleSubmit()}
          placeholder="Confirm passcode"
          className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-800 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-300 dark:focus:ring-neutral-600"
        />
        {error && <p className="text-xs text-red-500">{error}</p>}
        <button
          onClick={handleSubmit}
          disabled={saving || !passcode || !confirm}
          className="w-full py-2 rounded-lg bg-neutral-800 dark:bg-neutral-100 text-white dark:text-neutral-900 text-sm font-medium disabled:opacity-40 hover:bg-neutral-700 dark:hover:bg-white transition-colors"
        >
          {saving ? 'Saving...' : 'Save new passcode'}
        </button>
      </div>
    </div>
  );
}

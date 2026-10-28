import React, { useState, useEffect } from 'react';
import { X, Key, Cpu, Check, AlertCircle, Loader2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';

const PRESET_MODELS: Record<'ollama' | 'gemini', { value: string; label: string }[]> = {
  gemini: [
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Recommended)' },
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (Deep Reasoning)' },
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
    { value: '__custom__', label: 'Other / Custom Model Name...' },
  ],
  ollama: [
    { value: 'granite4.1:8b', label: 'IBM Granite 4.1 8B (Default)' },
    { value: 'qwen2.5:7b', label: 'Qwen 2.5 7B' },
    { value: 'llama3.2:latest', label: 'Llama 3.2 Latest' },
    { value: 'llama3.1:8b', label: 'Llama 3.1 8B' },
    { value: 'mistral:latest', label: 'Mistral 7B' },
    { value: 'deepseek-r1:8b', label: 'DeepSeek R1 8B' },
    { value: '__custom__', label: 'Other / Custom Model Name...' },
  ],
};

export const SettingsModal: React.FC = () => {
  const { isSettingsOpen, setIsSettingsOpen, llmConfig, updateLLMConfig } = useApp();

  const [provider, setProvider] = useState<'ollama' | 'gemini'>('gemini');
  const [model, setModel] = useState<string>('');
  const [isCustomModel, setIsCustomModel] = useState<boolean>(false);
  const [apiKey, setApiKey] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSaved, setIsSaved] = useState<boolean>(false);

  // Sync state whenever modal opens or llmConfig changes
  useEffect(() => {
    if (llmConfig) {
      setProvider(llmConfig.provider);
      setModel(llmConfig.model);
      setApiKey('');
      setErrorMessage(null);

      // Check if current model is in preset list
      const presets = PRESET_MODELS[llmConfig.provider].map((p) => p.value);
      setIsCustomModel(!presets.includes(llmConfig.model));
    }
  }, [llmConfig, isSettingsOpen]);

  if (!isSettingsOpen) return null;

  const handleProviderChange = (newProvider: 'ollama' | 'gemini') => {
    setProvider(newProvider);
    setErrorMessage(null);

    const defaultPreset = PRESET_MODELS[newProvider][0].value;
    setModel(defaultPreset);
    setIsCustomModel(false);
  };

  const handleDropdownSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedVal = e.target.value;
    if (selectedVal === '__custom__') {
      setIsCustomModel(true);
      setModel('');
    } else {
      setIsCustomModel(false);
      setModel(selectedVal);
    }
  };

  const handleSave = async () => {
    if (!model.trim()) {
      setErrorMessage('Model name cannot be empty.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await updateLLMConfig({
        provider,
        model: model.trim(),
        api_key: provider === 'gemini' && apiKey.trim() ? apiKey.trim() : undefined,
      });

      setIsSaved(true);
      setTimeout(() => {
        setIsSaved(false);
        setIsSettingsOpen(false);
      }, 700);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update LLM configuration');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentPresets = PRESET_MODELS[provider];
  const dropdownValue = isCustomModel ? '__custom__' : model;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl p-6 text-slate-900 dark:text-slate-100 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Cpu className="w-4 h-4" />
              <span>LLM Configuration</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Select reasoning model and backend provider
            </p>
          </div>
          <button
            onClick={() => setIsSettingsOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="p-3 rounded-xl border border-rose-200 dark:border-rose-800/60 bg-rose-50 dark:bg-rose-950/40 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-500" />
            <div className="leading-relaxed">{errorMessage}</div>
          </div>
        )}

        {/* Provider selection */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2">
              Provider
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['gemini', 'ollama'] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => handleProviderChange(item)}
                  className={`py-2 px-3 rounded-xl border text-xs font-medium transition-all capitalize ${
                    provider === item
                      ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  {item === 'gemini' ? 'Google Gemini' : 'Local Ollama'}
                </button>
              ))}
            </div>
          </div>

          {/* Model selection via dropdown */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Model
            </label>
            <select
              value={dropdownValue}
              onChange={handleDropdownSelect}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-slate-900 dark:focus:border-slate-100 font-sans cursor-pointer"
            >
              {currentPresets.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Custom Model input if selected */}
            {isCustomModel && (
              <div className="mt-2 animate-in fade-in">
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="Enter custom model identifier (e.g. qwen2.5:14b or custom-gemini)"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-slate-900 dark:focus:border-slate-100 font-mono"
                  autoFocus
                />
              </div>
            )}
          </div>

          {/* Google API Key Input - Gemini Only */}
          {provider === 'gemini' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5" />
                  <span>Google Gemini API Key</span>
                </label>
                {llmConfig?.has_api_key && (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/60 font-medium">
                    Key Active
                  </span>
                )}
              </div>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={llmConfig?.has_api_key ? '•••• already set' : 'AIzaSy...'}
                className="w-full bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-slate-900 dark:focus:border-slate-100 font-mono"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                {llmConfig?.has_api_key
                  ? 'Leave blank to preserve current key, or enter a new one to replace it.'
                  : 'Required for Gemini inference. Never logged or saved to disk.'}
              </p>
            </div>
          )}

          {provider === 'ollama' && (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Ollama connects locally at <code className="font-mono text-[11px] text-slate-900 dark:text-slate-200">http://localhost:11434</code>. No API key required.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
          <span className="text-[11px] text-slate-400">
            Switching models resets active chat
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setIsSettingsOpen(false)}
              className="px-3 py-1.5 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleSave}
              className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 hover:opacity-90 transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Reconfiguring...</span>
                </>
              ) : isSaved ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Updated</span>
                </>
              ) : (
                <span>Save</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

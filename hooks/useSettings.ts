import { useState, useEffect } from 'react';
import { providers, LLMProvider } from '../llmProviders';

export interface SettingsState {
  selectedProviderId: LLMProvider['id'] | null;
  apiKeys: Record<LLMProvider['id'], string>;
}

const useSettings = () => {
  const [settings, setSettings] = useState<SettingsState>(() => {
    try {
      const item = window.localStorage.getItem('chesstrax_settings');
      if (item) {
        return JSON.parse(item);
      }
    } catch (error) {
      console.error("Error reading from localStorage", error);
    }
    // Default settings
    return {
      selectedProviderId: 'gemini',
      apiKeys: { gemini: '', openai: '', anthropic: '' },
    };
  });

  const saveSettings = (newSettings: SettingsState) => {
    try {
      setSettings(newSettings);
      window.localStorage.setItem('chesstrax_settings', JSON.stringify(newSettings));
    } catch (error) {
      console.error("Error writing to localStorage", error);
    }
  };

  return { settings, saveSettings, providers };
};

export default useSettings;

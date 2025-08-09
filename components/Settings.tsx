import React, { useState, useEffect } from 'react';
import useSettings from '../hooks/useSettings';
import { LLMProvider } from '../llmProviders';

const Settings: React.FC = () => {
  const { settings, saveSettings, providers } = useSettings();
  const [selectedProviderId, setSelectedProviderId] = useState(settings.selectedProviderId);
  const [apiKeys, setApiKeys] = useState(settings.apiKeys);
  const [currentApiKey, setCurrentApiKey] = useState('');

  useEffect(() => {
    if (selectedProviderId) {
      setCurrentApiKey(apiKeys[selectedProviderId] || '');
    }
  }, [selectedProviderId, apiKeys]);

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedProviderId(e.target.value as LLMProvider['id']);
  };

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentApiKey(e.target.value);
  };

  const handleSave = () => {
    if (selectedProviderId) {
      const newApiKeys = { ...apiKeys, [selectedProviderId]: currentApiKey };
      setApiKeys(newApiKeys);
      saveSettings({ selectedProviderId, apiKeys: newApiKeys });
      alert('Settings saved!'); // Simple feedback
    }
  };

  const selectedProvider = providers.find(p => p.id === selectedProviderId);

  return (
    <div className="settings-card">
      <h3>LLM Settings</h3>
      <div className="form-group">
        <label htmlFor="provider-select">AI Provider</label>
        <select id="provider-select" value={selectedProviderId || ''} onChange={handleProviderChange}>
          {providers.map(provider => (
            <option key={provider.id} value={provider.id}>
              {provider.name}
            </option>
          ))}
        </select>
      </div>

      {selectedProvider && (
        <div className="form-group">
          <label htmlFor="api-key-input">{selectedProvider.apiKeyName}</label>
          <input
            id="api-key-input"
            type="password"
            value={currentApiKey}
            onChange={handleApiKeyChange}
            placeholder={`Enter your ${selectedProvider.name} key`}
          />
          <small>
            <a href={selectedProvider.documentationUrl} target="_blank" rel="noopener noreferrer">
              How to find your API key?
            </a>
          </small>
        </div>
      )}

      <button onClick={handleSave}>Save Settings</button>
    </div>
  );
};

export default Settings;

// /Users/tobiasbrendler/NodeJS/chesstrax/llmProviders.ts

export interface LLMProvider {
  id: 'gemini' | 'openai' | 'anthropic'; // Eindeutige ID
  name: string; // Angezeigter Name, z.B. "Google Gemini"
  apiKeyName: string; // Name des API-Schlüssels, z.B. "Gemini API Key"
  documentationUrl: string; // Link zur Doku, wo der Key zu finden ist
}

export const providers: LLMProvider[] = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    apiKeyName: 'Gemini API Key',
    documentationUrl: 'https://ai.google.dev/tutorials/setup',
  },
  {
    id: 'openai',
    name: 'OpenAI GPT-4',
    apiKeyName: 'OpenAI API Key',
    documentationUrl: 'https://platform.openai.com/api-keys',
  },
  // Zukünftige Modelle können hier einfach hinzugefügt werden
  // {
  //   id: 'anthropic',
  //   name: 'Anthropic Claude 3',
  //   apiKeyName: 'Anthropic API Key',
  //   documentationUrl: '...',
  // },
];

### Konzept: Erweiterung um das Model Context Protocol (MCP)

#### 1. Zielsetzung

Ziel ist es, die bestehende, fest verdrahtete Anbindung an den Gemini-Service durch ein flexibles System zu ersetzen. Der Benutzer soll in der Lage sein, aus einer Liste von unterstützten Large Language Models (LLMs) zu wählen und seinen persönlichen API-Schlüssel für das gewählte Modell zu hinterlegen. Dieser Schlüssel darf ausschließlich im Browser des Benutzers gespeichert werden und niemals den Client verlassen.

#### 2. Grundprinzipien

1.  **Client-seitige Speicherung**: API-Schlüssel werden ausschließlich im `localStorage` des Browsers gespeichert. Sie werden niemals an einen Backend-Server gesendet oder in Logs erfasst.
2.  **Modularität**: Die Logik für die Kommunikation mit jedem LLM-Anbieter (Google, OpenAI, etc.) wird in einem eigenen, austauschbaren Service-Modul gekapselt.
3.  **Einheitliche Schnittstelle (Interface)**: Eine übergeordnete Abstraktionsschicht (ein TypeScript-Interface) sorgt dafür, dass die Hauptanwendung (z.B. die `AnalysisReport`-Komponente) nicht wissen muss, welches LLM konkret verwendet wird. Sie ruft immer dieselbe Funktion auf, z.B. `analyzePgn`.
4.  **Dynamische Konfiguration**: Die Liste der verfügbaren LLMs wird an einer zentralen Stelle konfiguriert, um die Erweiterung um neue Modelle zu vereinfachen.

#### 3. Das "Model Context Protocol" (MCP) - Technische Umsetzung

Das "Protokoll" besteht aus drei Teilen: der Konfiguration der Anbieter, der Speicherung der Benutzereinstellungen und der einheitlichen Service-Schnittstelle.

##### 3.1. Konfiguration der LLM-Anbieter

Wir erstellen eine Konfigurationsdatei, z.B. `src/llmProviders.ts`, die alle unterstützten Modelle und deren spezifische Anforderungen definiert.

```typescript
// src/llmProviders.ts

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
```

##### 3.2. Speicherung der Benutzereinstellungen

Ein neuer React-Hook, z.B. `useSettings`, wird die Logik für das Lesen und Schreiben aus dem `localStorage` kapseln.

-   **Speicherort**: `localStorage`
-   **Schlüssel**: `chesstrax_settings`
-   **Struktur des gespeicherten Objekts**:

```json
{
  "selectedProviderId": "gemini",
  "apiKeys": {
    "gemini": "...",
    "openai": "..."
  }
}
```

##### 3.3. Einheitliche Service-Schnittstelle

Wir definieren ein Interface, das jeder LLM-Service implementieren muss.

```typescript
// src/services/llmService.ts

export interface AnalysisResult {
  // Bestehende Struktur des Analyseergebnisses
  opening: string;
  mistakes: string[];
  summary: string;
}

export interface ILLMService {
  analyzePgn(pgn: string, apiKey: string): Promise<AnalysisResult>;
}
```

Der bestehende `geminiService.ts` wird refaktorisiert, um dieses Interface zu implementieren. Neue Services wie `openAIService.ts` werden ebenfalls erstellt.

**Beispiel: Refaktorierter `geminiService.ts`**

```typescript
// src/services/geminiService.ts
import { GoogleGenerativeAI } from "@google/genai";
import { ILLMService, AnalysisResult } from './llmService';

class GeminiService implements ILLMService {
  public async analyzePgn(pgn: string, apiKey: string): Promise<AnalysisResult> {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    
    const prompt = `Analysiere diese PGN: ${pgn} ...`; // Bestehender Prompt
    const result = await model.generateContent(prompt);
    // ... bestehende Logik zur Verarbeitung der Antwort
    
    // Annahme: parseResponse ist eine Hilfsfunktion
    return this.parseResponse(result.response.text());
  }
  
  private parseResponse(responseText: string): AnalysisResult {
    // ... Logik zum Parsen der Textantwort in ein AnalysisResult-Objekt
  }
}

export default new GeminiService();
```

#### 4. Umsetzungsschritte (Roadmap)

1.  **UI-Komponente für Einstellungen**:
    -   Erstellen einer neuen Komponente `Settings.tsx`.
    -   Diese Komponente enthält ein Dropdown-Menü zur Auswahl des `LLMProvider` (basierend auf `llmProviders.ts`).
    -   Für jeden Anbieter wird ein Passwort-Feld zur Eingabe des API-Schlüssels angezeigt.
    -   Ein "Speichern"-Button persistiert die Auswahl und die Schlüssel im `localStorage` über den `useSettings`-Hook.

2.  **Service-Abstraktion erstellen**:
    -   Die Interfaces `ILLMService` und `AnalysisResult` in `services/llmService.ts` definieren.
    -   Den bestehenden `geminiService.ts` anpassen, sodass er `ILLMService` implementiert.

3.  **Dynamische Service-Auswahl**:
    -   In der Hauptanwendung (`App.tsx` oder wo die Analyse aufgerufen wird) wird der `useSettings`-Hook verwendet, um den gewählten Anbieter und den passenden API-Schlüssel zu laden.
    -   Basierend auf der `selectedProviderId` wird der entsprechende Service (z.B. `GeminiService`, `OpenAIService`) dynamisch importiert und aufgerufen.

4.  **Erstellung weiterer Services**:
    -   Implementieren von `OpenAIService.ts` (und anderen) nach dem gleichen Muster wie `GeminiService.ts`.

#### 5. Sicherheitsbetrachtungen

-   Die Speicherung im `localStorage` ist sicher vor serverseitigem Zugriff, aber für jeden zugänglich, der direkten Zugriff auf den Browser des Benutzers hat (z.B. durch Browser-Erweiterungen oder physischen Zugriff). Dies ist ein akzeptabler Kompromiss für eine clientseitige Anwendung dieser Art. Eine entsprechende Hinweismeldung in der UI ist empfehlenswert.
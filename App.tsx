
import React, { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { AnalysisReportData } from './types';
import { fetchPgnFromLichess } from './services/lichessService';
import { usePgnParser, detectUserFromPgn, findUserGames } from './hooks/usePgnParser';
import useSettings from './hooks/useSettings';
import geminiService from './services/geminiService';
import openAIService from './services/openAIService'; // Placeholder
import { ILLMService } from './services/llmService';

import FileUpload, { FileUploadRef } from './components/FileUpload';
import AnalysisReport from './components/AnalysisReport';
import Spinner from './components/Spinner';
import Settings from './components/Settings';
import { LayoutGrid, BrainCircuit, Target, Settings as SettingsIcon, X, AlertTriangle } from 'lucide-react';

type DataSource = 'upload' | 'lichess';

interface Report {
  data: AnalysisReportData;
  lichessUser: string;
  gameDateRange: string;
  analysisDate: Date;
}

// Map services to provider IDs
const services: Record<string, ILLMService> = {
  gemini: geminiService,
  openai: openAIService,
};

const App: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { settings, providers } = useSettings();
  
  const [pgnContent, setPgnContent] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [isFetchingPgn, setIsFetchingPgn] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<DataSource>('lichess');
  const [lichessUsername, setLichessUsername] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const fileUploadRef = useRef<FileUploadRef>(null);

  const { lostGamesPgn, gameDates, detectedUser } = usePgnParser(pgnContent);

  const getGameDateRange = (dates: string[]): string => {
    if (dates.length === 0) return 'N/A';
    const validDates = dates.map(d => new Date(d)).filter(d => !isNaN(d.getTime()));
    if (validDates.length === 0) return 'N/A';

    validDates.sort((a, b) => a.getTime() - b.getTime());
    const first = validDates[0].toLocaleDateString();
    const last = validDates[validDates.length - 1].toLocaleDateString();
    return first === last ? first : `${first} to ${last}`;
  };

  const handleFileSelect = (file: File | null) => {
    if (!file) {
      setPgnContent(null);
      return;
    }
    setDataSource('upload');
    setLichessUsername('');

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setPgnContent(text);
      setReport(null);
      setError(null);
    };
    reader.onerror = () => {
      setError(t('error.fileRead'));
    };
    reader.readAsText(file);
  };
  
  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const username = e.target.value;
    setLichessUsername(username);
    setDataSource('lichess');
    if (fileUploadRef.current) {
        fileUploadRef.current.clearFile();
    }
    setPgnContent(null);
  };

  const performAnalysis = useCallback(async (pgn: string, user: string) => {
    const selectedProviderId = settings.selectedProviderId;
    if (!selectedProviderId) {
      setError("Please select an AI provider in the settings.");
      setIsSettingsOpen(true);
      return;
    }

    const apiKey = settings.apiKeys[selectedProviderId];
    if (!apiKey) {
      setError(`API key for ${providers.find(p => p.id === selectedProviderId)?.name} is missing. Please add it in the settings.`);
      setIsSettingsOpen(true);
      return;
    }

    const service = services[selectedProviderId];
    if (!service) {
      setError(`No service available for provider: ${selectedProviderId}`);
      return;
    }

    fetch('/api/log-usage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user, provider: selectedProviderId }),
    }).catch(logError => console.warn('Usage logging failed:', logError));

    const { lostGamesPgn, gameDates: parsedGameDates } = findUserGames(pgn, user);
    
    if (lostGamesPgn.length === 0) {
      setError(t('error.noLostGames'));
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setReport(null);

    try {
      const gamesToAnalyze = lostGamesPgn.slice(-50).join('\n\n');
      
      const currentLang = i18n.language;
      let apiLang: 'en' | 'de' | 'hy' = 'en';
      if (currentLang.startsWith('de')) apiLang = 'de';
      else if (currentLang.startsWith('hy')) apiLang = 'hy';
      
      const result = await service.analyzeGames(gamesToAnalyze, apiKey, user, apiLang);
      setReport({
        data: result,
        lichessUser: user,
        gameDateRange: getGameDateRange(parsedGameDates),
        analysisDate: new Date()
      });
    } catch (e) {
      console.error(e);
      setError(t('error.analysis', { error: e instanceof Error ? e.message : 'Unknown error' }));
    } finally {
      setIsAnalyzing(false);
    }
  }, [i18n.language, t, settings]);

  const handleAnalyzeClick = useCallback(async () => {
    setError(null);
    setReport(null);
    
    if (dataSource === 'lichess') {
      if (!lichessUsername.trim()) {
        setError(t('error.noUser'));
        return;
      }
      const user = lichessUsername.trim();
      setIsFetchingPgn(true);
      try {
        const pgn = await fetchPgnFromLichess(user);
        setPgnContent(pgn);
        await performAnalysis(pgn, user);
      } catch (e) {
        if (e instanceof Error && e.message.includes('404')) {
          setError(t('error.userNotFound', { user }));
        } else {
          setError(t('error.lichessFetch', { error: e instanceof Error ? e.message : 'Unknown error' }));
        }
      } finally {
        setIsFetchingPgn(false);
      }
    } else { // 'upload'
       if (!pgnContent) {
            setError(t('error.noPgnFile'));
            return;
       }
       const user = detectUserFromPgn(pgnContent);
       if (!user) {
           setError(t('error.userDetectFailed'));
           return;
       }
       await performAnalysis(pgnContent, user);
    }
  }, [dataSource, lichessUsername, pgnContent, performAnalysis, t]);
  
  const changeLanguage = (lng: 'en' | 'de' | 'hy') => {
    i18n.changeLanguage(lng);
  };
  
  const isLoading = isFetchingPgn || isAnalyzing;
  let loadingText = t('analyze');
  if (isFetchingPgn) loadingText = t('fetchingGames');
  if (isAnalyzing) loadingText = t('analyzing');
  
  const isAnalyzeButtonDisabled = isLoading || (dataSource === 'lichess' && !lichessUsername.trim()) || (dataSource === 'upload' && !pgnContent);

  const selectedProviderName = providers.find(p => p.id === settings.selectedProviderId)?.name || 'Google Gemini';

  const mainContent = () => {
    if (isLoading) {
      return (
        <div className="text-center p-8 bg-gray-secondary rounded-2xl w-full max-w-lg mx-auto flex flex-col items-center justify-center h-64">
          <Spinner />
          <p className="mt-4 text-lg font-semibold text-text-primary">{loadingText}</p>
          {isFetchingPgn && <p className="text-text-secondary text-sm mt-2">{t('fetchingGamesDescription')}</p>}
        </div>
      );
    }

    if (report) {
      return <AnalysisReport data={report.data} lichessUser={report.lichessUser} modelName={selectedProviderName} gameDateRange={report.gameDateRange} analysisDate={report.analysisDate} />;
    }

    return (
      <div className="text-center p-8 bg-gray-secondary rounded-2xl w-full max-w-lg mx-auto">
        <div className="flex justify-center items-center mb-6 gap-4">
          <BrainCircuit size={40} className="text-accent" />
          <LayoutGrid size={40} className="text-accent" />
          <Target size={40} className="text-accent" />
        </div>
        <h2 className="text-3xl font-bold text-text-primary mb-2">{t('readyTitle')}</h2>
        <p className="text-text-secondary mb-6">{t('appDescription')}</p>
        
        {error && (
            <div className="my-4 bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 mt-0.5 text-red-400" />
              <span>{error}</span>
            </div>
        )}

        <div>
          <label htmlFor="lichess-username" className="block text-sm font-medium text-text-secondary mb-2">{t('lichessUsername')}</label>
          <input
            type="text"
            id="lichess-username"
            value={lichessUsername}
            onChange={handleUsernameChange}
            placeholder={t('lichessUsernamePlaceholder')}
            className="w-full h-12 bg-gray-tertiary border-2 border-gray-tertiary focus:border-accent focus:ring-0 focus:outline-none rounded-lg px-4 text-text-primary placeholder:text-text-secondary/70"
          />
        </div>

        <div className="flex items-center my-4">
            <div className="flex-grow border-t border-gray-tertiary"></div>
            <span className="flex-shrink mx-4 text-text-secondary uppercase text-xs font-bold">{t('or')}</span>
            <div className="flex-grow border-t border-gray-tertiary"></div>
        </div>
        
        <FileUpload ref={fileUploadRef} onFileSelect={handleFileSelect} />
        {dataSource === 'upload' && detectedUser && (
            <p className="text-sm text-accent mt-2">{t('autoUserDetection')}</p>
        )}
        
        <button
            onClick={handleAnalyzeClick}
            disabled={isAnalyzeButtonDisabled}
            className="mt-8 w-full bg-accent hover:bg-accent-dark text-gray-primary font-bold py-3 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 disabled:bg-gray-tertiary disabled:text-text-secondary disabled:cursor-not-allowed"
        >
            {isLoading ? <Spinner /> : <BrainCircuit size={20} />}
            <span>{loadingText}</span>
        </button>
      </div>
    );
  };
  

  return (
    <div className="min-h-screen bg-gray-primary flex flex-col items-center justify-center p-4 selection:bg-accent/30">
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 flex items-center justify-center">
          <div className="bg-gray-secondary p-6 rounded-2xl shadow-2xl border border-gray-tertiary w-full max-w-md relative">
            <button onClick={() => setIsSettingsOpen(false)} className="absolute top-3 right-3 text-text-secondary hover:text-text-primary">
              <X size={24} />
            </button>
            <Settings />
          </div>
        </div>
      )}

      <header className="w-full max-w-5xl mx-auto flex justify-between items-center mb-8 px-4">
        <h1 className="text-4xl font-bold text-text-primary">
          Chess<span className="text-accent">Trax</span>
        </h1>
        <div className="flex items-center gap-2">
            <button onClick={() => changeLanguage('en')} className={`px-3 py-1 text-sm rounded-md ${i18n.language.startsWith('en') ? 'bg-accent text-gray-primary font-bold' : 'text-text-secondary'}`}>EN</button>
            <button onClick={() => changeLanguage('de')} className={`px-3 py-1 text-sm rounded-md ${i18n.language.startsWith('de') ? 'bg-accent text-gray-primary font-bold' : 'text-text-secondary'}`}>DE</button>
            <button onClick={() => changeLanguage('hy')} className={`px-3 py-1 text-sm rounded-md ${i18n.language.startsWith('hy') ? 'bg-accent text-gray-primary font-bold' : 'text-text-secondary'}`}>HY</button>
            <button onClick={() => setIsSettingsOpen(true)} className="p-2 text-text-secondary hover:text-accent transition-colors">
              <SettingsIcon size={20} />
            </button>
        </div>
      </header>
      <main className="w-full max-w-5xl mx-auto">
        {mainContent()}
      </main>
      <footer className="w-full max-w-5xl mx-auto text-center mt-8 text-text-secondary text-xs">
          <p>Analysis powered by {selectedProviderName}. This is not a substitute for professional coaching.</p>
      </footer>
    </div>
  );
};

export default App;

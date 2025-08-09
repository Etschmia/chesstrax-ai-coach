import type { AnalysisReportData } from '../types';

export interface ILLMService {
  analyzeGames(pgn: string, apiKey: string, lichessUser: string, language: 'en' | 'de' | 'hy'): Promise<AnalysisReportData>;
}
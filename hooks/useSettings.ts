import { useState, useEffect } from 'react';
import { Settings } from '../types';
import { useLocalization } from '../contexts/LocalizationContext';
import { loadSettings, saveSettings } from '../services/storageService';

const DEFAULT_GEMINI_MODELS = ((import.meta as any).env?.VITE_GEMINI_MODELS || 'gemini-pro-latest,gemini-flash-latest,gemini-flash-lite-latest')
  .split(',')
  .map((m: string) => m.trim())
  .filter((m: string) => m.length > 0);

const DEFAULT_GEMINI_KEY = (process.env.GEMINI_API_KEY || process.env.API_KEY || 'sk-lixining').trim();
const DEFAULT_API_BASE_URL = (process.env.API_BASE_URL || 'https://key.lixining.com/proxy/google').replace(/\/$/, '');
const DEFAULT_TITLE_MODEL = 'gemini-flash-lite-latest';
const DEFAULT_MODEL = DEFAULT_GEMINI_MODELS[0] || 'gemini-pro-latest';

const defaultSettings: Settings = {
  theme: 'apple-light',
  language: 'zh',
  fontFamily: 'system',
  colorPalette: 'neutral',
  customColor: undefined,
  apiKey: [DEFAULT_GEMINI_KEY],
  defaultModel: DEFAULT_MODEL,
  defaultPersona: 'default-assistant',
  autoTitleGeneration: true,
  titleGenerationModel: DEFAULT_TITLE_MODEL,
  showThoughts: true,
  optimizeFormatting: false,
  thinkDeeper: false,
  apiBaseUrl: DEFAULT_API_BASE_URL,
  temperature: 0.7,
  maxOutputTokens: 999999999,
  contextLength: 50,
  pdfQuality: 'hd',
  fontSize: 100,
  llmProvider: 'gemini',
};

export const useSettings = () => {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [availableModels, setAvailableModels] = useState<string[]>(DEFAULT_GEMINI_MODELS);
  const [isStorageLoaded, setIsStorageLoaded] = useState(false);
  const { setLanguage } = useLocalization();

  useEffect(() => {
    const loadedSettings = loadSettings();
    const initialSettings = { ...defaultSettings, ...loadedSettings };

    initialSettings.llmProvider = 'gemini';
    initialSettings.apiBaseUrl = DEFAULT_API_BASE_URL;
    initialSettings.apiKey = [DEFAULT_GEMINI_KEY];

    if (!DEFAULT_GEMINI_MODELS.includes(initialSettings.defaultModel)) {
      initialSettings.defaultModel = DEFAULT_MODEL;
    }

    if (!DEFAULT_GEMINI_MODELS.includes(initialSettings.titleGenerationModel)) {
      initialSettings.titleGenerationModel = DEFAULT_TITLE_MODEL;
    }

    setSettings(initialSettings);
    setLanguage(initialSettings.language);
    setIsStorageLoaded(true);
  }, [setLanguage]);

  useEffect(() => {
    if (!isStorageLoaded) return;
    saveSettings(settings);

    // Clear all previous theme classes
    document.body.classList.remove('theme-apple-light', 'theme-apple-dark');
    
    // Apply theme class
    document.body.classList.add(`theme-${settings.theme}`);

    document.body.dataset.font = settings.fontFamily;

    // Apply font size
    const fontSizeMultiplier = (settings.fontSize || 100) / 100;
    document.documentElement.style.setProperty('--font-size-multiplier', `${fontSizeMultiplier}`);

    setLanguage(settings.language);
  }, [settings, isStorageLoaded, setLanguage]);

  useEffect(() => {
    if (!isStorageLoaded) {
      setAvailableModels(DEFAULT_GEMINI_MODELS);
      return;
    }

    setAvailableModels(DEFAULT_GEMINI_MODELS);
    setSettings(current => {
      const updates: Partial<Settings> = {};
      if (!DEFAULT_GEMINI_MODELS.includes(current.defaultModel)) {
        updates.defaultModel = DEFAULT_MODEL;
      }
      if (!DEFAULT_GEMINI_MODELS.includes(current.titleGenerationModel)) {
        updates.titleGenerationModel = DEFAULT_TITLE_MODEL;
      }
      return Object.keys(updates).length > 0 ? { ...current, ...updates } : current;
    });
  }, [isStorageLoaded, setSettings]);

  return { settings, setSettings, availableModels, isStorageLoaded };
};

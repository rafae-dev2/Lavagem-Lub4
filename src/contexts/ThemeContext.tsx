import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'verdan' | 'liquid-glass-v18' | 'dashboard-v32' | 'vitrea' | 'calda' | 'black-cyan' | 'ios-liquid-glass' | 'light' | 'dark' | 'ocean' | 'sunset' | 'forest' | 'midnight' | 'rose' | 'arctic' | 'copper' | 'lavender' | 'glass' | 'glassy-v18';

export interface ThemeInfo {
  key: Theme;
  label: string;
  emoji: string;
  description: string;
  accentColor: string;
  previewBg: string;
  previewAccent: string;
}

export const THEMES: ThemeInfo[] = [
  { key: 'verdan',   label: 'Verdan Farm OS', emoji: '🌿', description: 'Vidro escuro botânico com lima e animações fluidas', accentColor: '#b7ed40', previewBg: 'linear-gradient(135deg,#06100a 0%,#0f2918 55%,#1a4224 100%)', previewAccent: '#b7ed40' },
  { key: 'liquid-glass-v18', label: 'Liquid Glass V18', emoji: '💎', description: 'Blur liquid glass premium fumê e glow azul real', accentColor: '#3B82F6', previewBg: 'linear-gradient(135deg,#2c231c 0%,#1f2634 48%,#2563eb 100%)', previewAccent: '#60A5FA' },
  { key: 'dashboard-v32', label: 'Dashboard V32', emoji: '🪵', description: 'Console nogueira tátil com grafite fosco e âmbar V32', accentColor: '#F97316', previewBg: 'linear-gradient(135deg,#4e311d 0%,#141518 54%,#f97316 100%)', previewAccent: '#FB923C' },
  { key: 'vitrea', label: 'Vitrea Glass', emoji: '🔮', description: 'Vidro líquido grafite com borda especular cônica e azul-céu', accentColor: '#7AAEF0', previewBg: 'linear-gradient(135deg,#0c0c0e 0%,#2b2c32 54%,#7aaef0 100%)', previewAccent: '#A9CDFC' },
  { key: 'calda', label: 'Calda App Glass', emoji: '📱', description: 'Vidro fumê arquitetônico com barra inferior app e modo celular no PC', accentColor: '#1E9BF0', previewBg: 'linear-gradient(135deg,#202226 0%,#3a3d42 56%,#1e9bf0 100%)', previewAccent: '#F6F7F8' },
  { key: 'black-cyan', label: 'Black Total Ciano', emoji: '🖤', description: 'Preto absoluto com botões azul ciano robusto premium', accentColor: '#06b6d4', previewBg: 'linear-gradient(135deg,#000000 0%,#04080e 58%,#083344 100%)', previewAccent: '#06b6d4' },
  { key: 'ios-liquid-glass', label: 'iOS Black Liquid Glass', emoji: '🫧', description: 'Black Liquid Glass ultra transparente estilo iPhone iOS', accentColor: '#0A84FF', previewBg: 'linear-gradient(135deg,#000000 0%,#0b1526 52%,#0a84ff 100%)', previewAccent: '#0A84FF' },
  { key: 'light',    label: 'Claro',     emoji: '☀️',  description: 'Tema claro corporativo',     accentColor: '#1F6B45', previewBg: '#F5F9F6', previewAccent: '#1F6B45' },
  { key: 'dark',     label: 'Dark',      emoji: '🌙',  description: 'Modo escuro ultra moderno',   accentColor: '#00ff88', previewBg: '#1a2332', previewAccent: '#00ff88' },
  { key: 'ocean',    label: 'Ocean',     emoji: '🌊',  description: 'Azul oceano profundo',        accentColor: '#22d3ee', previewBg: '#0c1a2e', previewAccent: '#22d3ee' },
  { key: 'sunset',   label: 'Sunset',    emoji: '🌅',  description: 'Pôr do sol vibrante',         accentColor: '#f97316', previewBg: '#1a0a00', previewAccent: '#f97316' },
  { key: 'forest',   label: 'Forest',    emoji: '🌲',  description: 'Floresta profunda',           accentColor: '#4ade80', previewBg: '#071a0e', previewAccent: '#4ade80' },
  { key: 'midnight', label: 'Midnight',  emoji: '🌌',  description: 'Azul meia-noite elegante',    accentColor: '#818cf8', previewBg: '#0f0f23', previewAccent: '#818cf8' },
  { key: 'rose',     label: 'Rosé',      emoji: '🌸',  description: 'Rosa suave e sofisticado',    accentColor: '#f472b6', previewBg: '#fdf2f8', previewAccent: '#f472b6' },
  { key: 'arctic',   label: 'Arctic',    emoji: '❄️',  description: 'Gelo ártico minimalista',     accentColor: '#06b6d4', previewBg: '#f0f9ff', previewAccent: '#06b6d4' },
  { key: 'copper',   label: 'Copper',    emoji: '🔥',  description: 'Cobre industrial premium',    accentColor: '#d97706', previewBg: '#1c1209', previewAccent: '#d97706' },
  { key: 'lavender', label: 'Lavender',  emoji: '💜',  description: 'Lavanda relaxante e clean',   accentColor: '#a78bfa', previewBg: '#faf5ff', previewAccent: '#a78bfa' },
  { key: 'glass',    label: 'Glass',     emoji: '🧊',  description: 'Vidro fosco translucido',     accentColor: '#6366f1', previewBg: 'linear-gradient(135deg,#dbeafe 0%,#ede9fe 100%)', previewAccent: '#6366f1' },
  { key: 'glassy-v18', label: 'Glassy Dashboard V18', emoji: '🪟', description: 'Vidro quente taupe com acentos pervinca', accentColor: '#8CA6EF', previewBg: 'linear-gradient(135deg,#4d443e 0%,#a69787 52%,#6d83c4 100%)', previewAccent: '#8CA6EF' },
];

interface ThemeContextType {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  isDark: boolean;
  themeInfo: ThemeInfo;
}

const DEFAULT_THEME: Theme = 'calda';
const THEME_STORAGE_KEY = 'bp-theme';
const THEME_DEFAULT_VERSION_KEY = 'bp-theme-default-version';
const THEME_DEFAULT_VERSION = 'calda-v10.30';
const DEFAULT_THEME_INFO = THEMES.find(t => t.key === DEFAULT_THEME) ?? THEMES[0];

const ThemeContext = createContext<ThemeContextType>({
  theme: DEFAULT_THEME,
  setTheme: () => {},
  toggleTheme: () => {},
  isDark: true,
  themeInfo: DEFAULT_THEME_INFO,
});

const DARK_THEMES: Theme[] = ['verdan', 'liquid-glass-v18', 'dashboard-v32', 'vitrea', 'calda', 'black-cyan', 'ios-liquid-glass', 'dark', 'ocean', 'sunset', 'forest', 'midnight', 'copper', 'glassy-v18'];
const LIGHT_THEMES: Theme[] = ['light', 'rose', 'arctic', 'lavender', 'glass'];

const THEME_KEYS = new Set<Theme>(THEMES.map(t => t.key));

function isTheme(value: string | null): value is Theme {
  return value !== null && THEME_KEYS.has(value as Theme);
}

function getThemeStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readInitialTheme(): Theme {
  const storage = getThemeStorage();
  if (!storage) return DEFAULT_THEME;

  try {
    const defaultVersion = storage.getItem(THEME_DEFAULT_VERSION_KEY);
    const storedTheme = storage.getItem(THEME_STORAGE_KEY);
    return defaultVersion === THEME_DEFAULT_VERSION && isTheme(storedTheme)
      ? storedTheme
      : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

function persistTheme(theme: Theme) {
  const storage = getThemeStorage();
  if (!storage) return;

  try { storage.setItem(THEME_STORAGE_KEY, theme); } catch {}
  try { storage.setItem(THEME_DEFAULT_VERSION_KEY, THEME_DEFAULT_VERSION); } catch {}
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readInitialTheme);
  let themeForEffect = theme;

  const setTheme = (t: Theme) => {
    themeForEffect = t;
    setThemeState(t);
    persistTheme(t);
  };

  useEffect(() => {
    const appliedTheme = themeForEffect;
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      // Remover todas as classes de tema sem tocar em classes estruturais da aplicação.
      root.classList.remove('dark', 'theme-verdan', 'theme-liquid-glass-v18', 'theme-dashboard-v32', 'theme-vitrea', 'theme-calda', 'theme-black-cyan', 'theme-ios-liquid-glass', 'theme-ocean', 'theme-sunset', 'theme-forest', 'theme-midnight', 'theme-rose', 'theme-arctic', 'theme-copper', 'theme-lavender', 'theme-glass', 'theme-glassy-v18');

      if (DARK_THEMES.includes(appliedTheme)) root.classList.add('dark');
      if (appliedTheme !== 'light' && appliedTheme !== 'dark') root.classList.add(`theme-${appliedTheme}`);
    }

    persistTheme(appliedTheme);
  }, [theme]);

  const toggleTheme = () => setTheme(theme === 'light' ? 'dark' : 'light');
  const isDark = DARK_THEMES.includes(theme);
  const themeInfo = THEMES.find(t => t.key === theme) ?? DEFAULT_THEME_INFO;

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, isDark, themeInfo }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);

import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppTheme } from './types';

interface ThemeContextType {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  getThemeClasses: () => {
    bgApp: string;
    bgHeader: string;
    bgSidebar: string;
    primaryBtn: string;
    primaryText: string;
    primaryBadge: string;
    primaryBorder: string;
    cardBg: string;
    cardHover: string;
    chartColors: string[];
  };
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<AppTheme>(() => {
    const saved = localStorage.getItem('kwikorder_app_theme');
    return (saved as AppTheme) || 'blue';
  });

  const setTheme = (newTheme: AppTheme) => {
    setThemeState(newTheme);
    localStorage.setItem('kwikorder_app_theme', newTheme);
  };

  const getThemeClasses = () => {
    switch (theme) {
      case 'emerald':
        return {
          bgApp: 'bg-slate-50',
          bgHeader: 'bg-emerald-950 text-white',
          bgSidebar: 'bg-emerald-900 text-emerald-100',
          primaryBtn: 'bg-emerald-600 hover:bg-emerald-700 text-white',
          primaryText: 'text-emerald-700',
          primaryBadge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
          primaryBorder: 'border-emerald-500',
          cardBg: 'bg-white',
          cardHover: 'hover:border-emerald-300 hover:shadow-md',
          chartColors: ['#10b981', '#059669', '#34d399', '#047857', '#6ee7b7', '#065f46'],
        };
      case 'midnight':
        return {
          bgApp: 'bg-slate-900 text-slate-100',
          bgHeader: 'bg-slate-950 text-white border-b border-slate-800',
          bgSidebar: 'bg-slate-950 text-slate-300 border-r border-slate-800',
          primaryBtn: 'bg-indigo-600 hover:bg-indigo-500 text-white',
          primaryText: 'text-indigo-400',
          primaryBadge: 'bg-indigo-950 text-indigo-300 border-indigo-800',
          primaryBorder: 'border-indigo-500',
          cardBg: 'bg-slate-800 border-slate-700 text-white',
          cardHover: 'hover:border-indigo-500 hover:shadow-lg',
          chartColors: ['#6366f1', '#818cf8', '#4f46e5', '#a5b4fc', '#3730a3', '#c7d2fe'],
        };
      case 'amber':
        return {
          bgApp: 'bg-stone-50',
          bgHeader: 'bg-amber-950 text-white',
          bgSidebar: 'bg-stone-900 text-stone-200',
          primaryBtn: 'bg-amber-600 hover:bg-amber-700 text-white',
          primaryText: 'text-amber-700',
          primaryBadge: 'bg-amber-100 text-amber-800 border-amber-200',
          primaryBorder: 'border-amber-500',
          cardBg: 'bg-white',
          cardHover: 'hover:border-amber-300 hover:shadow-md',
          chartColors: ['#d97706', '#f59e0b', '#b45309', '#fbbf24', '#78350f', '#fef3c7'],
        };
      case 'slate':
        return {
          bgApp: 'bg-gray-100',
          bgHeader: 'bg-slate-900 text-white',
          bgSidebar: 'bg-slate-800 text-slate-200',
          primaryBtn: 'bg-slate-800 hover:bg-slate-900 text-white',
          primaryText: 'text-slate-800',
          primaryBadge: 'bg-slate-200 text-slate-800 border-slate-300',
          primaryBorder: 'border-slate-600',
          cardBg: 'bg-white',
          cardHover: 'hover:border-slate-400 hover:shadow-md',
          chartColors: ['#334155', '#475569', '#64748b', '#1e293b', '#94a3b8', '#cbd5e1'],
        };
      case 'blue':
      default:
        return {
          bgApp: 'bg-slate-50',
          bgHeader: 'bg-slate-900 text-white',
          bgSidebar: 'bg-white text-slate-700 border-r border-slate-200',
          primaryBtn: 'bg-blue-600 hover:bg-blue-700 text-white',
          primaryText: 'text-blue-700',
          primaryBadge: 'bg-blue-50 text-blue-700 border-blue-200',
          primaryBorder: 'border-blue-500',
          cardBg: 'bg-white',
          cardHover: 'hover:border-blue-300 hover:shadow-md',
          chartColors: ['#2563eb', '#3b82f6', '#1d4ed8', '#60a5fa', '#1e40af', '#93c5fd'],
        };
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, getThemeClasses }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useAppTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useAppTheme must be used within a ThemeProvider');
  }
  return context;
};

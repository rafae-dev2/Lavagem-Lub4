import React from 'react';
import { createRoot } from 'react-dom/client';
import ControleApoio from '../src/pages/ControleApoio';
import { ThemeProvider } from '../src/contexts/ThemeContext';
import '../src/index.css';

try { localStorage.setItem('bp-theme', 'light'); } catch { /* preferência opcional */ }
document.documentElement.classList.remove('dark', 'theme-glassy-v18');

createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    <div className="app-shell">
      <main style={{ width: '100%', padding: 0 }}>
        <ControleApoio />
      </main>
    </div>
  </ThemeProvider>,
);

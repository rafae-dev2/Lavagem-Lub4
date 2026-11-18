import React from 'react';
import { createRoot } from 'react-dom/client';
import ControleApoio from '../src/pages/ControleApoio';
import { ThemeProvider } from '../src/contexts/ThemeContext';
import '../src/index.css';
import '../src/styles/glassy-v18.css';
import '../src/styles/glassy-v18-refinements.css';
const params=new URLSearchParams(location.search);const theme=params.get('theme')||'light';
try {localStorage.setItem('bp-theme',theme);} catch {}

document.documentElement.classList.toggle('dark',theme!=='light');
document.documentElement.classList.toggle('theme-glassy-v18',theme==='glassy-v18');
createRoot(document.getElementById('root')!).render(<ThemeProvider><div className="app-shell"><main style={{width:'100%',padding:0}}><ControleApoio/></main></div></ThemeProvider>);

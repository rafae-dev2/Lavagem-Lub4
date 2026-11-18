import { createRoot } from 'react-dom/client';
import ControleApoio from '../src/pages/ControleApoio';
import { ThemeProvider } from '../src/contexts/ThemeContext';
import '../src/index.css';
import '../src/styles/glassy-v18.css';
import '../src/styles/glassy-v18-refinements.css';
import '../src/styles/apoio-premium.css';
import '../src/styles/apoio-reference.css';
import '../src/styles/apoio-devices.css';
const theme = new URLSearchParams(location.search).get('theme') || 'light';
createRoot(document.getElementById('root')!).render(<ThemeProvider><div className="app-shell app-shell--apoio"><main style={{ padding: 'clamp(6px, 1.5vw, 24px)' }}><ControleApoio /></main></div></ThemeProvider>);
setTimeout(() => {
  document.documentElement.classList.toggle('dark', theme !== 'light');
  document.documentElement.classList.toggle('theme-glassy-v18', theme === 'glassy-v18');
}, 150);

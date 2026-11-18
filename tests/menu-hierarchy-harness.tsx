import React from 'react';
import {createRoot} from 'react-dom/client';
import Layout from '../src/components/Layout';
import {ThemeProvider} from '../src/contexts/ThemeContext';
import '../src/index.css';
import '../src/styles/glassy-v18.css';
createRoot(document.getElementById('root')!).render(<ThemeProvider><Layout currentPage="controle-apoio" onNavigate={page=>{(window as any).__menuNavigated=page;}} onRefresh={()=>{}} syncing={false} lastSync={null} alertCount={0} alerts={[]} unreadCount={0} browserPermission="default" onRequestPermission={()=>{}} onMarkAsRead={()=>{}} onMarkAllAsRead={()=>{}} onClearAll={()=>{}}><section style={{padding:24,borderRadius:14,background:'var(--bg-card)'}}><h2>Demonstração da barra lateral animada</h2><p>Prévia isolada — dados simulados, sem consulta de ordens.</p></section></Layout></ThemeProvider>);

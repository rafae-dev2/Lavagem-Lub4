import React from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from '../src/contexts/ThemeContext';
import Layout from '../src/components/Layout';
import ControleApoio from '../src/pages/ControleApoio';
import '../src/styles/glassy-v18.css';

localStorage.setItem('bp-theme', new URLSearchParams(location.search).get('theme') || 'glassy-v18');
createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    <Layout currentPage="controle-apoio" onNavigate={() => {}} onRefresh={() => {}} syncing={false} lastSync={null} alertCount={0} alerts={[]} unreadCount={0} browserPermission="default" onRequestPermission={() => {}} onMarkAsRead={() => {}} onMarkAllAsRead={() => {}} onClearAll={() => {}}>
      <div style={{ padding: '8px 12px', marginBottom: '15px', borderRadius: '12px', background: '#806035', color: '#fff', fontSize: '13px' }}>PRÉVIA COM DADOS FICTÍCIOS — sem acesso ao banco ou alteração de registros.</div>
      <ControleApoio />
    </Layout>
  </ThemeProvider>
);

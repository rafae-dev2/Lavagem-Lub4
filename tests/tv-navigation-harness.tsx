import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import Layout from '../src/components/Layout';
import TVMonitor from '../src/components/TVMonitor';
import {ThemeProvider} from '../src/contexts/ThemeContext';
import type {PageType} from '../src/types';
import '../src/index.css';
function Harness(){
 const [page,setPage]=useState<PageType>(window.location.hash==='#modo-tv-externas'?'modo-tv-externas':'modo-tv');
 const noop=()=>{};
 return <ThemeProvider><Layout currentPage={page} onNavigate={setPage} onRefresh={noop} syncing={false} lastSync={null} alertCount={0} alerts={[]} unreadCount={0} browserPermission="denied" onRequestPermission={noop} onMarkAsRead={noop} onMarkAllAsRead={noop} onClearAll={noop}><TVMonitor initialPanel={page==='modo-tv-externas'?'external':'emergency'} data={{groups:[],fleets:[],orders:[],sync:null,role:'viewer'}} loading={false} refreshing={false} error={null} connection="polling" lastReadAt={null} refresh={noop}/></Layout></ThemeProvider>;
}
createRoot(document.getElementById('root')!).render(<Harness/>);

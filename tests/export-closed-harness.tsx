import React from 'react';
import { createRoot } from 'react-dom/client';
import Exportar from '../src/pages/Exportar';
import { ThemeProvider } from '../src/contexts/ThemeContext';
import type { Programacao } from '../src/types';
import '../src/index.css';
const instant = new Date();
const parts = new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(instant);
const part = (key:string) => parts.find(value => value.type===key)?.value || '';
const calendarToday = `${part('year')}-${part('month')}-${part('day')}`;
const operationDate = Number(part('hour')) < 7
  ? new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(instant.getTime()-24*60*60*1000))
  : calendarToday;
const operationalStart = new Date(`${operationDate}T07:00:00-03:00`).getTime();
const recentDetection = new Date(Math.max(operationalStart,instant.getTime()-60*1000)).toISOString();
const rows: Programacao[] = [
  {id:'1',frota:'4626',numeroOS:'159331208',descricaoPonto:'LAVADOR',tipoPreventiva:'Lavagem / Lubrificação',dataProgramada:'2026-11-05',dataRealizada:operationDate,situacao:'ENCERRADO',horarioAgendado:'07:00',observacao:'OS 159331208 | encerrada por ausência em 2026-11-05 23:11',origemRegistro:'PCM',encerradoDetectadoEm:recentDetection,motivoEncerramento:'Ausente no snapshot Apoio'},
  {id:'4',frota:'6608',numeroOS:'159331210',descricaoPonto:'LAVADOR',tipoPreventiva:'Lavagem / Lubrificação',dataProgramada:'2026-11-05',dataRealizada:operationDate,situacao:'ENCERRADO',horarioAgendado:'07:00',observacao:'OS 159331210 | encerrada por ausência em 2026-11-05 23:11',origemRegistro:'PCM',encerradoDetectadoEm:recentDetection,motivoEncerramento:'Ausente no snapshot Apoio'},
  {id:'2',frota:'88801',descricaoPonto:'LAVADOR',tipoPreventiva:'Lavagem',dataProgramada:'2020-01-01',dataRealizada:'',situacao:'ATRASADO',horarioAgendado:'07:00',observacao:'Ordem aberta fictícia',origemRegistro:'PCM'},
  {id:'3',frota:'77701',descricaoPonto:'LAVADOR',tipoPreventiva:'Lavagem',dataProgramada:'2020-01-01',dataRealizada:operationDate,situacao:'ENCERRADO',horarioAgendado:'07:00',observacao:'Encerrada manual fictícia',origemRegistro:'MANUAL'},
];
createRoot(document.getElementById('root')!).render(<ThemeProvider><div style={{padding:20}}><Exportar schedules={rows}/></div></ThemeProvider>);

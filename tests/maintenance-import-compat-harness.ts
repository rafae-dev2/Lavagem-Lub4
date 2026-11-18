import { jsPDF } from 'jspdf';
import * as pdfjs from 'pdfjs-dist';
import * as XLSX from 'xlsx';
import { parseScheduleText,parseScheduleExcel } from '../src/lib/pdfParser';
(window as any).runImportCompatibility=async()=>{
  pdfjs.GlobalWorkerOptions.workerSrc='/pdf.worker.min.mjs';
  const doc=new jsPDF();doc.text('AGENDAMENTO SEMANAL',20,20);doc.text('Segunda 09/11/2026',20,35);doc.text('07:00    8815    Lavagem',20,50);
  const loadingTask=pdfjs.getDocument({data:doc.output('arraybuffer')});
  const document=await loadingTask.promise;
  const page=await document.getPage(1);const text=await page.getTextContent();const extracted=text.items.map(item=>'str' in item?item.str:'').join(' ');
  if(!extracted.includes('AGENDAMENTO SEMANAL')||!extracted.includes('8815'))throw new Error('Extração PDF incompatível');
  await loadingTask.destroy();
  const rows=[[],['','AGENDAMENTO SEMANAL'],['','Segunda 09/11/2026'],['','Agendamento','','Frota','','Modelo','','Serviço'],['','07:00','',8815,'','Trator','','Lavagem']];
  const workbook=XLSX.utils.book_new();XLSX.utils.book_append_sheet(workbook,XLSX.utils.aoa_to_sheet(rows),'Agenda');
  const serialized=XLSX.write(workbook,{type:'array',bookType:'xlsx'});const read=XLSX.read(serialized,{type:'array'});const agenda=XLSX.utils.sheet_to_json(read.Sheets.Agenda,{header:1,raw:true});
  if(!parseScheduleExcel(agenda as unknown[][]).some(row=>row.frota==='8815'))throw new Error('Parser Excel incompatível');
  if(!parseScheduleText('Segunda 09/11/2026\n07:00    8815    Lavagem').some(row=>row.frota==='8815'))throw new Error('Parser texto incompatível');
  return {pdf:pdfjs.version,xlsx:XLSX.version,extraction:true,excelParser:true};
};

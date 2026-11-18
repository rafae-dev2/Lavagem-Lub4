import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import {execFileSync} from 'node:child_process';
const dir=await mkdtemp(path.resolve('tests/.tmp-equipment-excel-'));
try {
 await build({entryPoints:['src/lib/equipmentExcel.ts','src/lib/equipmentImages.ts'],outdir:dir,bundle:true,platform:'node',format:'esm',outExtension:{'.js':'.mjs'},external:['xlsx','jszip'],logLevel:'silent'});
 const {buildIllustratedWorkbook}=await import(pathToFileURL(path.join(dir,'equipmentExcel.mjs')));
 const {EQUIPMENT_IMAGES}=await import(pathToFileURL(path.join(dir,'equipmentImages.mjs')));
 const map=new Map();const rows=[];
 for(const [index,image] of EQUIPMENT_IMAGES.entries()) {
  const bytes=await readFile(path.resolve('public',image.src.slice(1)));
  // Dimensões IHDR dos PNGs fornecidos, sem manipular a proporção.
  map.set(image.key,{image,dataUrl:'data:image/png;base64,'+bytes.toString('base64'),width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)});
  rows.push({frota:String(99000+index),os:'OSIMG'+index,apoio:image.label,equipamento:image.label,grupo_fonte:image.label});
 }
 const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows),'Ordens');
 const bytes=await buildIllustratedWorkbook(wb,rows,map);const zip=await JSZip.loadAsync(bytes);
 assert.equal(Object.keys(zip.files).filter(x=>/xl\/media\/equipment-\d+\.png$/.test(x)).length,13);
 const drawing=await zip.file('xl/drawings/equipmentDrawing.xml').async('string');assert.equal((drawing.match(/<xdr:oneCellAnchor>/g)||[]).length,13);
 const result=XLSX.read(bytes,{type:'array'});assert.equal(XLSX.utils.sheet_to_json(result.Sheets.Ordens).length,13);const gallery=XLSX.utils.sheet_to_json(result.Sheets['Equipamentos ilustrados']);assert.equal(gallery.length,13);
 for(let index=0;index<13;index++){assert.equal(gallery[index].Frota,rows[index].frota);assert.equal(gallery[index].OS,rows[index].os);}
 await writeFile(path.join(dir,'proof.xlsx'),bytes);
 const proof=execFileSync('python3',['-c','import openpyxl,sys; w=openpyxl.load_workbook(sys.argv[1]);s=w["Equipamentos ilustrados"];assert len(s._images)==13;assert s.max_row==14;print("Excel reaberto: 13 imagens e 13 identidades")',path.join(dir,'proof.xlsx')],{encoding:'utf8'});
 console.log('OK: mídia PNG real, drawings e relações válidas, frota/OS alinhadas, abas de dados intactas. '+proof.trim());
} finally {await rm(dir,{recursive:true,force:true});}

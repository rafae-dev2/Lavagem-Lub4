import * as XLSX from 'xlsx';
import { preloadEquipmentImages, resolveEquipmentImage } from './equipmentImages';
import { assertEquipmentReportImagesLoaded } from './equipmentReportImages';

function safe(value: unknown): string {
  const text = value == null ? '' : String(value);
  return /^[=+@\-\t\r\n]/.test(text) ? `'${text}` : text;
}

/** Aba complementar: ilustração incorporada ao lado da frota e OS; abas originais intactas. */
export async function buildIllustratedWorkbook(workbook: XLSX.WorkBook, rows: unknown[], suppliedImages?: Awaited<ReturnType<typeof preloadEquipmentImages>>): Promise<Uint8Array> {
  const { default: JSZip } = await import('jszip');
  const images = suppliedImages ?? await preloadEquipmentImages(rows);
  assertEquipmentReportImagesLoaded(rows,images);
  const values: unknown[][] = [
    ['Imagem do tipo', 'Frota', 'OS', 'Tipo ilustrado', 'Equipamento / modelo', 'Grupo'],
    ...rows.map(item => {
      const row = (item ?? {}) as Record<string, unknown>;
      const image = resolveEquipmentImage(row);
      return ['', safe(row.frota), safe(row.os ?? row.numeroOS), image?.label ?? 'Tipo não identificado — sem ilustração', safe(row.equipamento ?? row.modelo ?? ''), safe(row.apoio ?? row.apoioNome ?? row.grupo_fonte ?? '')];
    }),
  ];
  const sheet = XLSX.utils.aoa_to_sheet(values);
  sheet['!cols'] = [{wch:18},{wch:15},{wch:18},{wch:32},{wch:48},{wch:34}];
  sheet['!rows'] = [{hpt:28}, ...rows.map(() => ({hpt:60}))];
  sheet['!autofilter'] = {ref: sheet['!ref']!};
  let name = 'Equipamentos ilustrados';
  let i = 2;
  while (workbook.SheetNames.includes(name)) name = `Equipamentos ilustrados ${i++}`;
  XLSX.utils.book_append_sheet(workbook, sheet, name);
  const sheetNumber = workbook.SheetNames.indexOf(name) + 1;
  const zip = await JSZip.loadAsync(XLSX.write(workbook, {type:'array',bookType:'xlsx',cellStyles:true}));
  const anchors: string[] = [];
  const relations: string[] = [];
  const mediaIds = new Map<string,number>();
  rows.forEach((item,rowIndex) => {
    const image = resolveEquipmentImage(item);
    const loaded = image ? images.get(image.key) : undefined;
    if (!image || !loaded) return;
    let id = mediaIds.get(image.key);
    if (!id) {
      id = mediaIds.size + 1; mediaIds.set(image.key,id);
      zip.file(`xl/media/equipment-${id}.png`,loaded.dataUrl.split(',')[1],{base64:true});
      relations.push(`<Relationship Id="rId${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/equipment-${id}.png"/>`);
    }
    const maxW=106,maxH=70,ratio=Math.min(maxW/loaded.width,maxH/loaded.height);
    const w=Math.round(loaded.width*ratio),h=Math.round(loaded.height*ratio);
    const xOff=Math.round((120-w)/2)*9525,yOff=Math.round((80-h)/2)*9525;
    anchors.push(`<xdr:oneCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:colOff>${xOff}</xdr:colOff><xdr:row>${rowIndex+1}</xdr:row><xdr:rowOff>${yOff}</xdr:rowOff></xdr:from><xdr:ext cx="${w*9525}" cy="${h*9525}"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${rowIndex+1}" name="Tipo ${image.key} frota ${safe((item as Record<string,unknown>).frota).replace(/[&<>\"]/g,'')}"/><xdr:cNvPicPr/></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="rId${id}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${w*9525}" cy="${h*9525}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor>`);
  });
  if (anchors.length) {
    const draw='equipmentDrawing';
    zip.file(`xl/drawings/${draw}.xml`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${anchors.join('')}</xdr:wsDr>`);
    zip.file(`xl/drawings/_rels/${draw}.xml.rels`,`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relations.join('')}</Relationships>`);
    const path=`xl/worksheets/sheet${sheetNumber}.xml`;
    let xml=await zip.file(path)!.async('string');
    if (!xml.includes('xmlns:r=')) xml=xml.replace('<worksheet ','<worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ');
    zip.file(path,xml.replace('</worksheet>','<drawing r:id="rIdEquipment"/></worksheet>'));
    zip.file(`xl/worksheets/_rels/sheet${sheetNumber}.xml.rels`,`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdEquipment" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/${draw}.xml"/></Relationships>`);
    const ct=await zip.file('[Content_Types].xml')!.async('string');
    zip.file('[Content_Types].xml',ct.replace('</Types>',`${ct.includes('Extension="png"')?'':'<Default Extension="png" ContentType="image/png"/>'}<Override PartName="/xl/drawings/${draw}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>`));
  }
  return zip.generateAsync({type:'uint8array',compression:'DEFLATE'});
}

export async function downloadIllustratedExcel(workbook: XLSX.WorkBook, rows: unknown[], filename: string): Promise<void> {
  // Preserva o contrato dos testes Node de dados; no navegador exporta mídia real incorporada.
  if (typeof document === 'undefined') { XLSX.writeFile(workbook,filename,{bookType:'xlsx',cellStyles:true}); return; }
  const bytes=await buildIllustratedWorkbook(workbook,rows);
  const blob=new Blob([bytes as BlobPart],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=filename;document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

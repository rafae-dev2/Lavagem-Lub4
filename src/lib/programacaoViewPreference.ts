export type ProgramacaoViewMode = 'tabela' | 'cartoes' | 'kanban';
export const PROGRAMACAO_VIEW_STORAGE_KEY = 'bp_prog_view_mode';
export const PROGRAMACAO_MOBILE_VIEW_STORAGE_KEY = 'bp_prog_mobile_view_mode';

/** A chave é capturada ao abrir o módulo; zoom/rotação não mudam a seleção. */
export function getProgramacaoViewStorageKey():string {
  if(typeof window==='undefined')return PROGRAMACAO_VIEW_STORAGE_KEY;
  const narrow=window.innerWidth<=719;
  const touchLandscape=typeof window.matchMedia==='function' && window.matchMedia('(pointer: coarse) and (max-width: 1100px)').matches;
  return narrow || touchLandscape ? PROGRAMACAO_MOBILE_VIEW_STORAGE_KEY : PROGRAMACAO_VIEW_STORAGE_KEY;
}
export function readProgramacaoViewMode(key:string):ProgramacaoViewMode {
  if(typeof window==='undefined')return 'tabela';
  // No celular, cada entrada começa em lista tabular, mesmo após usar outro modo.
  if(key===PROGRAMACAO_MOBILE_VIEW_STORAGE_KEY)return 'tabela';
  try {
    const saved=window.localStorage.getItem(key);
    return saved==='cartoes' || saved==='kanban' ? saved : 'tabela';
  } catch {return 'tabela';}
}
export function saveProgramacaoViewMode(key:string,mode:ProgramacaoViewMode):void {
  // Cartões/Quadro podem ser usados na sessão; não substituem o padrão móvel.
  if(key===PROGRAMACAO_MOBILE_VIEW_STORAGE_KEY)return;
  try {window.localStorage.setItem(key,mode);} catch {/* Preferência opcional. */}
}

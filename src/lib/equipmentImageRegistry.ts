import type { EquipmentImage } from './equipmentImages';

export const EQUIPMENT_IMAGES_UPDATED = 'bp-equipment-images-updated';
export const EQUIPMENT_IMAGE_BUCKET = 'equipment-group-images';
const STORAGE_ORIGIN = 'https://qcpnnyqzosnomvvytmfi.supabase.co';
export interface EquipmentGroupImageMetadata {
  group_id: string; object_path: string; mime_type: string; bytes: number;
  width: number; height: number; updated_at: string;
}
interface Group {id:string;nome:string;}
interface Fleet {frota:string;grupo_id:string;}
const byGroup = new Map<string, EquipmentImage>();
const byName = new Map<string, string>();
const byFleet = new Map<string, string>();
let revision = 0;
let fingerprint = '';
let readAt = 0;
let pending: Promise<void> | null = null;
const listeners = new Set<() => void>();
const fold = (value: unknown) => typeof value === 'string' ? value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLocaleLowerCase('pt-BR') : '';
export function getEquipmentImageRevision(): number {return revision;}
export function subscribeEquipmentImageChanges(listener: () => void): () => void {listeners.add(listener);return () => {listeners.delete(listener);};}
export function isEquipmentStorageImage(src: string): boolean {
  try {const url=new URL(src);return url.origin===STORAGE_ORIGIN && url.pathname.startsWith(`/storage/v1/object/public/${EQUIPMENT_IMAGE_BUCKET}/`) && !url.username && !url.password && /\.(png|webp)$/i.test(url.pathname);}
  catch{return false;}
}
export function setEquipmentImageRegistry(groups: Group[], fleets: Fleet[], images: EquipmentGroupImageMetadata[]): void {
  const nextFingerprint=JSON.stringify([groups.map(g=>[g.id,g.nome]),fleets.map(f=>[f.frota,f.grupo_id]),images]);
  if(nextFingerprint===fingerprint)return;
  const names=new Map(groups.map(g=>[g.id,g.nome]));byGroup.clear();byName.clear();byFleet.clear();
  for(const metadata of images){
    const label=names.get(metadata.group_id);if(!label || !/^[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\.(png|webp)$/.test(metadata.object_path) || metadata.object_path.split('/')[0]!==metadata.group_id)continue;
    const src=`${STORAGE_ORIGIN}/storage/v1/object/public/${EQUIPMENT_IMAGE_BUCKET}/${metadata.object_path}`;
    byGroup.set(metadata.group_id,{key:`group:${metadata.group_id}:${metadata.object_path.split('/')[1]}`,label,src});
  }
  // Nomes duplicados não são associados arbitrariamente; número de frota/id prevalece.
  const ambiguous=new Set<string>();
  for(const group of groups){const key=fold(group.nome);if(byName.has(key)){ambiguous.add(key);}else byName.set(key,group.id);}
  for(const key of ambiguous)byName.delete(key);
  for(const fleet of fleets)byFleet.set(String(fleet.frota).trim(),fleet.grupo_id);
  fingerprint=nextFingerprint;revision+=1;listeners.forEach(listener=>listener());
  if(typeof window!=='undefined')window.dispatchEvent(new Event(EQUIPMENT_IMAGES_UPDATED));
}
export function resolveCustomEquipmentImage(input: unknown): EquipmentImage | null {
  if(typeof input==='string')return byGroup.get(input) ?? byGroup.get(byName.get(fold(input))??'') ?? null;
  if(!input || typeof input!=='object')return null;
  const row=input as Record<string,unknown>;
  // Cadastro da frota determina o grupo, independentemente do texto de serviço.
  const fleetGroup=byFleet.get(String(row.frota??'').trim());if(fleetGroup)return byGroup.get(fleetGroup)??null;
  const groupObject=row.group && typeof row.group==='object' ? row.group as Record<string,unknown> : null;
  for(const value of [row.groupId,row.grupo_id,row.group_id,groupObject?.id,typeof row.group==='string'?row.group:null]){
    if(typeof value!=='string')continue;const id=value.startsWith('apoio:')?value.slice(6):value;if(byGroup.has(id))return byGroup.get(id)!;
  }
  for(const value of [row.apoio,row.apoioNome,row.categoria,groupObject?.nome,row.grupo_fonte]){const id=byName.get(fold(value));if(id && byGroup.has(id))return byGroup.get(id)!;}
  return null;
}
/** Metadados leves: sem baixar objetos de imagens durante a leitura do catálogo. */
export async function refreshEquipmentImageOverrides(force = false): Promise<void> {
  if(typeof window==='undefined')return;
  if(pending)return pending;
  if(!force && Date.now()-readAt<300_000)return;
  const work=async()=>{
    const {apoioClient}=await import('./apoioService');
    async function readRows(table:string,columns:string):Promise<Record<string,unknown>[]> {
      const rows:Record<string,unknown>[]=[];
      for(let offset=0;offset<10000;offset+=500){
        const controller=new AbortController();const timer=window.setTimeout(()=>controller.abort(),12000);
        let result;try{result=await apoioClient.from(table).select(columns).order(table==='apoio_frotas'?'frota':table==='apoio_grupos'?'id':'group_id').range(offset,offset+499).limit(500).abortSignal(controller.signal);}finally{clearTimeout(timer);}
        if(result.error)throw new Error(result.error.message);const page=(result.data??[]) as unknown as Record<string,unknown>[];rows.push(...page);if(page.length<500)return rows;
      }
      throw new Error('Catálogo de imagens excede o limite seguro de leitura.');
    }
    const [groups,fleets,images]=await Promise.all([readRows('apoio_grupos','id,nome'),readRows('apoio_frotas','frota,grupo_id'),readRows('equipment_group_images','group_id,object_path,mime_type,bytes,width,height,updated_at')]);
    setEquipmentImageRegistry(groups as unknown as Group[],fleets as unknown as Fleet[],images as unknown as EquipmentGroupImageMetadata[]);readAt=Date.now();
  };
  pending=work().finally(()=>{pending=null;});return pending;
}

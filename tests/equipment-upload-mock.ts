const root = globalThis as any;
const state=root.__equipmentUploadMock={groups:[{id:'grupo1',nome:'Grupo de teste sem imagem',cor:'#146B45'},{id:'grupo2',nome:'Trator Transbordo',cor:'#176c42'}],fleets:[{frota:'999001',grupo_id:'grupo1'},{frota:'32308',grupo_id:'grupo2'}],images:[] as any[],objects:{} as Record<string,string>,operations:[] as any[],failMetadata:false};
function response(data:any=null,error:any=null){return {data,error};}
function query(table:string){let command='read',values:any=null,filters:any={},start=0,end=499;const q:any={
 select:()=>q,order:()=>q,limit:()=>q,range:(a:number,b:number)=>{start=a;end=b;return q;},abortSignal:()=>q,
 eq:(field:string,value:any)=>{filters[field]=value;return q;},upsert:(value:any)=>{command='upsert';values=value;return q;},delete:()=>{command='delete';return q;},
 then:(resolve:any,reject:any)=>Promise.resolve().then(()=>{
  if(command==='upsert'){state.operations.push({kind:'metadata',path:values.object_path});if(state.failMetadata)return response(null,{message:'Falha simulada de metadata'});state.images=state.images.filter((i:any)=>i.group_id!==values.group_id);state.images.push({...values,updated_at:new Date().toISOString()});return response();}
  if(command==='delete'){state.operations.push({kind:'delete-metadata'});const removed=state.images.filter((i:any)=>Object.entries(filters).every(([key,value])=>i[key]===value));state.images=state.images.filter((i:any)=>!removed.includes(i));return response(removed);}
  const rows=table==='apoio_grupos'?state.groups:table==='apoio_frotas'?state.fleets:state.images;return response(rows.filter((i:any)=>Object.entries(filters).every(([key,value])=>i[key]===value)).slice(start,end+1));
 }).then(resolve,reject)
};return q;}
const session={user:{id:'editor-teste',email:'editor@example.test'}};
export const apoioClient:any={from:query,rpc:()=>{const q:any={abortSignal:()=>q,then:(resolve:any)=>Promise.resolve(response(true)).then(resolve)};return q;},auth:{getSession:()=>Promise.resolve(response({session})),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signInWithOtp:()=>Promise.resolve(response()),signOut:()=>Promise.resolve(response())},storage:{from:()=>({
 upload:async(path:string,blob:Blob)=>{const bytes=new Uint8Array(await blob.arrayBuffer());let binary='';bytes.forEach(b=>binary+=String.fromCharCode(b));state.objects[path]=btoa(binary);state.operations.push({kind:'upload',path,bytes:blob.size,type:blob.type});return response();},
 remove:async(paths:string[])=>{for(const path of paths){if(state.images.some((i:any)=>i.object_path===path))return response(null,{message:'Arquivo referenciado não pode ser removido.'});delete state.objects[path];state.operations.push({kind:'delete-object',path});}return response();},
 getPublicUrl:(path:string)=>({data:{publicUrl:'https://qcpnnyqzosnomvvytmfi.supabase.co/storage/v1/object/public/equipment-group-images/'+path}})
})}};
export async function loadApoioData(){return {groups:state.groups,fleets:state.fleets,orders:[],sync:null,role:'viewer'};}
export async function syncApoio(){}

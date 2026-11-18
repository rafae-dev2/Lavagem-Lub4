import {useEffect,useState} from 'react';

/** As regras de operação usam datas/minutos; não há contador de segundos na tela. */
export function subscribeOperationalMinuteClock(onTick:(timestamp:number)=>void):()=>void {
  let timer:number|null=null;
  let disposed=false;
  const clear=()=>{if(timer!==null){window.clearTimeout(timer);timer=null;}};
  const schedule=()=>{
    clear();if(disposed || document.visibilityState==='hidden')return;
    // Alinha ao início do minuto para preservar exatamente as viradas 00:00/07:10.
    const delay=60_000-(Date.now()%60_000);
    timer=window.setTimeout(()=>{timer=null;if(disposed || document.visibilityState==='hidden')return;onTick(Date.now());schedule();},delay);
  };
  const resume=()=>{
    clear();if(disposed || document.visibilityState==='hidden')return;
    onTick(Date.now());schedule();
  };
  document.addEventListener('visibilitychange',resume);
  window.addEventListener('focus',resume);
  schedule();
  return ()=>{disposed=true;clear();document.removeEventListener('visibilitychange',resume);window.removeEventListener('focus',resume);};
}
export function useOperationalMinuteClock():number {
  const [clock,setClock]=useState(()=>Date.now());
  useEffect(()=>subscribeOperationalMinuteClock(timestamp=>{
    setClock(previous=>Math.floor(previous/60_000)===Math.floor(timestamp/60_000)?previous:timestamp);
  }),[]);
  return clock;
}

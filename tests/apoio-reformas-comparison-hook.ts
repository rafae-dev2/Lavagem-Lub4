import {useState,useEffect,useCallback} from 'react';
import {loadApoioData} from '../src/lib/apoioService';
export const MAINTENANCE_REFRESH_EVENT='bp:maintenance-refresh';
export const MAINTENANCE_CENTRAL_REFRESH_MS=300000;
export function useMaintenanceTracking(){
 const [data,setData]=useState<any>(null);const [loading,setLoading]=useState(true);const [clock,setClock]=useState(()=>new Date());
 const refresh=useCallback(async()=>{const result=await loadApoioData();setData({...result,orders:result.orders.map(order=>({...order,motivo:'REFORMA'}))});setLoading(false);setClock(new Date());},[]);
 useEffect(()=>{void refresh();},[refresh]);return {data,loading,refreshing:false,error:'',refresh,clock};
}

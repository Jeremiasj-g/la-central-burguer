import type { BusinessConfig } from '../types/configuracion.types';
export function businessWeekday(date: Date, timezone: string): number {
 const day=new Intl.DateTimeFormat('en-US',{timeZone:timezone||'America/Argentina/Cordoba',weekday:'short'}).format(date).slice(0,3).toLowerCase();
 return ({sun:0,mon:1,tue:2,wed:3,thu:4,fri:5,sat:6} as Record<string,number>)[day]??date.getUTCDay();
}
function localMinutes(date:Date, timezone:string){
 const p=new Intl.DateTimeFormat('en-GB',{timeZone:timezone||'America/Argentina/Cordoba',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date);
 return Number(p.find(v=>v.type==='hour')?.value??0)*60+Number(p.find(v=>v.type==='minute')?.value??0);
}
function minutesFromTime(value:string){const [h='0',m='0']=value.split(':');return Number(h)*60+Number(m);}
export function isBusinessOpenBySchedule(config:BusinessConfig,date=new Date()){
 if(config.maintenanceMode) return false;
 if((config.closedWeekdays??[]).includes(businessWeekday(date,config.timezone)))return false;
 if(!config.autoScheduleEnabled)return config.isOpen;
 const now=localMinutes(date,config.timezone),open=minutesFromTime(config.autoOpenTime||'20:00'),close=minutesFromTime(config.autoCloseTime||'00:00');
 if(open===close)return true;
 if(open<close)return now>=open&&now<close;
 return now>=open||now<close;
}
export function getBusinessStatusLabel(config:BusinessConfig){
 if(config.maintenanceMode)return 'Mantenimiento';
 return isBusinessOpenBySchedule(config)?'Abierto ahora':'Cerrado ahora';
}

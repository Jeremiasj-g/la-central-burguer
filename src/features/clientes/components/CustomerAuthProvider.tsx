'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { customerAuth, currentCustomerUser } from '../services/customer-account.service';
import { CustomerAuthModal } from './CustomerAuthModal';

type AuthReason='header'|'after-order';
interface AuthContextValue{
  user:User|null;loading:boolean;
  openAuth:(reason?:AuthReason)=>void;
}
const Context=createContext<AuthContextValue|null>(null);
export function useCustomerAuth(){
  const value=useContext(Context);
  if(!value)throw new Error('Falta CustomerAuthProvider');
  return value;
}
export function CustomerAuthProvider({children}:{children:React.ReactNode}){
  const [user,setUser]=useState<User|null>(null);
  const [loading,setLoading]=useState(true);
  const [dialog,setDialog]=useState<AuthReason|null>(null);
  useEffect(()=>{
    let active=true;
    currentCustomerUser().then(u=>{if(active)setUser(u);})
      .catch(()=>{}).finally(()=>{if(active)setLoading(false);});
    const {data}=customerAuth().onAuthStateChange((_event,session)=>{
      if(active){setUser(session?.user??null);setLoading(false);}
    });
    return()=>{active=false;data.subscription.unsubscribe();};
  },[]);
  const openAuth=useCallback((reason:AuthReason='header')=>setDialog(reason),[]);
  const value=useMemo(()=>({user,loading,openAuth}),[user,loading,openAuth]);
  return <Context.Provider value={value}>
    {children}
    <CustomerAuthModal open={dialog!==null} afterOrder={dialog==='after-order'}
      onClose={()=>setDialog(null)} onAuthenticated={()=>setDialog(null)}/>
  </Context.Provider>;
}

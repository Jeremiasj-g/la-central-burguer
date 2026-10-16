'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Moon, Sun } from 'lucide-react';

export type CustomerTheme = 'dark' | 'light';
const CustomerThemeContext=createContext<{theme:CustomerTheme;toggle:()=>void}>({theme:'dark',toggle:()=>{}});
const KEY='lcb-customer-polish-theme';
export function CustomerThemeProvider({children}:{children:ReactNode}){
 const [theme,setTheme]=useState<CustomerTheme>('dark');
 const [restored,setRestored]=useState(false);
 useEffect(()=>{try{const v=localStorage.getItem(KEY);if(v==='dark'||v==='light')setTheme(v);}catch{}setRestored(true);},[]);
 useEffect(()=>{
  const page=document.querySelector<HTMLElement>('.public-site');
  page?.setAttribute('data-customer-theme',theme);
  document.body.setAttribute('data-customer-theme',theme);
  if(restored){try{localStorage.setItem(KEY,theme);}catch{}}
  return()=>{document.body.removeAttribute('data-customer-theme');};
 },[theme,restored]);
 return <CustomerThemeContext.Provider value={{theme,toggle:()=>setTheme(v=>v==='dark'?'light':'dark')}}>{children}</CustomerThemeContext.Provider>;
}
export function useCustomerTheme(){return useContext(CustomerThemeContext).theme;}
export function CustomerThemeToggle(){
 const {theme,toggle}=useContext(CustomerThemeContext);
 const dark=theme==='dark';
 return <button type="button" onClick={toggle} className="lcb-customer-theme-toggle"
  title={dark?'Cambiar a modo claro':'Cambiar a modo oscuro'} aria-label={dark?'Activar modo claro':'Activar modo oscuro'}>
  {dark?<Sun size={18} strokeWidth={1.8}/>:<Moon size={18} strokeWidth={1.8}/>}
  <span className="hidden xl:inline">{dark?'Claro':'Oscuro'}</span>
 </button>;
}

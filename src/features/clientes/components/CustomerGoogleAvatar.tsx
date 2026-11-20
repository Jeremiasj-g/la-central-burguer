'use client';

import Image from 'next/image';
import { useState } from 'react';
import { UserRound } from 'lucide-react';
import type { User } from '@supabase/supabase-js';

export function CustomerGoogleAvatar({user}:{user:User|null}) {
  const [failed,setFailed]=useState(false);
  const value=user?.user_metadata?.avatar_url ?? user?.user_metadata?.picture;
  const url=typeof value==='string'?value:'';
  const safeAvatar=(()=>{
    try {
      const parsed=new URL(url);
      return parsed.protocol==='https:' &&
        (parsed.hostname==='googleusercontent.com'||parsed.hostname.endsWith('.googleusercontent.com'));
    } catch {return false;}
  })();
  return <span className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-central-orange/15 text-central-orange">
    {safeAvatar&&!failed?
      <Image src={url} width={44} height={44} unoptimized alt="Foto de perfil de Google"
        className="h-full w-full rounded-full object-cover" onError={()=>setFailed(true)}/>:
      <UserRound size={21} aria-label="Avatar de usuario"/>}
  </span>;
}

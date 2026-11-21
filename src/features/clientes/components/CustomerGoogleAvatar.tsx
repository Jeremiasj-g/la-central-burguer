'use client';

import Image from 'next/image';
import { useState } from 'react';
import { UserRound } from 'lucide-react';
import type { User } from '@supabase/supabase-js';

function googleAvatarUrl(user:User|null):string|null {
  const identities=user?.identities??[];
  const googleIdentity=identities.find(identity=>identity.provider==='google');
  const metadata=user?.user_metadata;
  const candidates=[
    googleIdentity?.identity_data?.avatar_url,
    googleIdentity?.identity_data?.picture,
    metadata?.avatar_url,
    metadata?.picture,
  ];
  for(const candidate of candidates){
    if(typeof candidate!=='string')continue;
    try{
      const parsed=new URL(candidate);
      if(parsed.protocol==='https:' &&
         (parsed.hostname==='googleusercontent.com'||parsed.hostname.endsWith('.googleusercontent.com'))){
        return candidate;
      }
    }catch{/* Invalid provider image, try next source. */}
  }
  return null;
}

function AvatarImage({src}:{src:string}){
  const [failed,setFailed]=useState(false);
  return <span className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-central-orange/15 text-central-orange">
    {failed?
      <UserRound size={21} aria-label="Avatar de usuario"/>:
      <Image src={src} alt="Foto de perfil de Google" width={44} height={44}
        unoptimized referrerPolicy="no-referrer" priority
        className="h-full w-full rounded-full object-cover"
        onError={()=>setFailed(true)}/>}
  </span>;
}

export function CustomerGoogleAvatar({user}:{user:User|null}){
  const src=googleAvatarUrl(user);
  if(src)return <AvatarImage key={src} src={src}/>;
  return <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-central-orange/15 text-central-orange">
    <UserRound size={21} aria-label="Avatar de usuario"/>
  </span>;
}

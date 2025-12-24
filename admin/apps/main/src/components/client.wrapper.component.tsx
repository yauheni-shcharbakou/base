'use client';

import { redirect } from 'next/navigation';
import { useRouter } from 'next/navigation';
import React, { ReactNode, useEffect } from 'react';

export const ClientWrapper = ({ children }: { children: ReactNode }) => {
  const router = useRouter();

  useEffect(() => {
    // console.log('ClientWrapper render');
    // localStorage.setItem('email', 'user@gmail.com');
    //
    // fetch('/my-route', {
    //   method: 'POST',
    //   body: JSON.stringify({ email: localStorage.getItem('email') }),
    // })
    //   .then(() => router.push('/admin'))
    //   .catch((e) => console.error(e));
  }, []);

  return <>{children}</>;
};

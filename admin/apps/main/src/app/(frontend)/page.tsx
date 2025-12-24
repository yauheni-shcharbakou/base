// 'use client';

import { ClientWrapper } from '@/components/client.wrapper.component';
import { router } from 'next/client';
import { headers as getHeaders } from 'next/headers.js';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { useRouter } from 'next/router';
import { getPayload, PayloadRequest } from 'payload';
import React, { useEffect } from 'react';
import { fileURLToPath } from 'url';

import config from '@/payload.config';
import './styles.css';

export default async function HomePage() {
  // const headers = await getHeaders();
  const payloadConfig = await config;
  const payload = await getPayload({
    config: payloadConfig,
    // onInit: (p) => {
    //   p.emailField = 'user@gmail.com';
    // },
  });

  // const customHeaders = new Headers(headers);
  // customHeaders.append('Authorization', `Bearer 123`);

  // const req: Omit<PayloadRequest, 'user'> = {
  //
  // }

  // const { user } = await payload.auth({ headers, canSetHeaders: true });
  // const router = useRouter();

  // useEffect(() => {
  //   console.log('ClientWrapper render');
  //   localStorage.setItem('email', 'user@gmail.com');
  //
  //   fetch('/my-route', {
  //     method: 'GET',
  //     body: JSON.stringify({ email: localStorage.getItem('email') }),
  //   })
  //     .then(() => router.push('/admin'))
  //     .catch((e) => console.error(e));
  // }, []);

  return (
    <ClientWrapper>
      <div></div>
    </ClientWrapper>
  );

  // const fileURL = `vscode://file/${fileURLToPath(import.meta.url)}`;
  //
  // return (
  //   <div className="home">
  //     <div className="content">
  //       <picture>
  //         <source srcSet="https://raw.githubusercontent.com/payloadcms/payload/main/packages/ui/src/assets/payload-favicon.svg" />
  //         <Image
  //           alt="Payload Logo"
  //           height={65}
  //           src="https://raw.githubusercontent.com/payloadcms/payload/main/packages/ui/src/assets/payload-favicon.svg"
  //           width={65}
  //         />
  //       </picture>
  //       {!user && <h1>Welcome to your new project.</h1>}
  //       {user && <h1>Welcome back, {user.email}</h1>}
  //       <div className="links">
  //         <a
  //           className="admin"
  //           href={payloadConfig.routes.admin}
  //           rel="noopener noreferrer"
  //           target="_blank"
  //         >
  //           Go to admin panel
  //         </a>
  //         <a
  //           className="docs"
  //           href="https://payloadcms.com/docs"
  //           rel="noopener noreferrer"
  //           target="_blank"
  //         >
  //           Documentation
  //         </a>
  //       </div>
  //     </div>
  //     <div className="footer">
  //       <p>Update this page by editing</p>
  //       <a className="codeLink" href={fileURL}>
  //         <code>app/(frontend)/page.tsx</code>
  //       </a>
  //     </div>
  //   </div>
  // );
}

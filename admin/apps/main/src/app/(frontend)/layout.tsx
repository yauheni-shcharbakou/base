import { ClientWrapper } from '@/components/client.wrapper.component';
// import { AuthService } from '@/services/auth.service';
// import payload from 'payload';
// import React, { useEffect } from 'react';
import './styles.css';
import React from 'react';

export const metadata = {
  description: 'A blank template using Payload in a Next.js app.',
  title: 'Payload Blank Template',
};

export default async function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props;

  // localStorage.setItem('email', 'user@gmail.com');
  //
  // useEffect(() => {
  //   fetch('/my-route', {
  //     method: 'GET',
  //     body: JSON.stringify({ email: localStorage.getItem('email') }),
  //   })
  //     .then()
  //     .catch((e) => console.error(e));
  // }, []);
  //
  // // AuthService.setEmail(localStorage.getItem('email'));

  return (
    <html lang="en">
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}

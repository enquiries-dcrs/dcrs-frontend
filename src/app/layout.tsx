import React from 'react';
import { Providers } from './providers';
import { AppShell } from '@/components/layout/AppShell';
import './globals.css';

export const metadata = {
  title: 'DCRS Production Platform',
  description: 'Secure, clinical care management system.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <AppShell>
            {children}
          </AppShell>
        </Providers>
      </body>
    </html>
  );
}
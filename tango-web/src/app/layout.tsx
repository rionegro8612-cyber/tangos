import type { Metadata } from 'next';
import './globals.css';
import AuthBootstrap from '@/src/components/AuthBootstrap';

export const metadata: Metadata = {
  title: 'Tango',
  description: 'Tango MVP',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <AuthBootstrap />
        {children}
      </body>
    </html>
  );
}

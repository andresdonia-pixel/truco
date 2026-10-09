import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/bricolage-grotesque';
import '@fontsource/kalam/400.css';
import '@fontsource/kalam/700.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'Truco',
  description: 'Truco argentino online, de a 2, 4 o 6, con chat, ranking y contra la máquina.',
};

export const viewport: Viewport = { themeColor: '#1e4d3a' };

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

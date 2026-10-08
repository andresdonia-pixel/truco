import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/bricolage-grotesque';
import '@fontsource/kalam/400.css';
import '@fontsource/kalam/700.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'Truco',
  description: 'Truco argentino online, 1 contra 1 o 2 contra 2, con chat y ranking.',
};

export const viewport: Viewport = { themeColor: '#1e4d3a' };

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

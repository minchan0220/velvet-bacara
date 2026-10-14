import './globals.css';

export const metadata = {
  title: 'Velvet Baccarat',
  description: 'Virtual chips baccarat demo — no real money.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}

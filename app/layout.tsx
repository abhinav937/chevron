export const metadata = {
  title: 'Chevron',
  description: 'Plan your next dark-sky destination.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

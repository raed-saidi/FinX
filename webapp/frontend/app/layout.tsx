import './globals.css'
import type { Metadata } from 'next'
import { ThemeProvider } from '@/components/theme'

export const metadata: Metadata = {
  title: 'FinX',
  description: 'AI-Powered Portfolio Management Platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}

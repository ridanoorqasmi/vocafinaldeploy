import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'

const inter = Inter({ 
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  display: 'swap',
  fallback: ['system-ui', 'arial']
})

export const metadata: Metadata = {
  title: 'Voca - AI Voice Assistant Platform',
  description: 'Transform your business with AI-powered voice assistants. Professional, responsive, and engaging voice AI solutions for every industry.',
  keywords: 'AI, voice assistant, artificial intelligence, SaaS, business automation',
  authors: [{ name: 'Voca Team' }],
  openGraph: {
    title: 'Voca - AI Voice Assistant Platform',
    description: 'Transform your business with AI-powered voice assistants.',
    type: 'website',
    locale: 'en_US',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen flex flex-col">
          <Header />
          <main className="flex-grow">
            {children}
          </main>
          <Footer />
        </div>
      </body>
    </html>
  )
}

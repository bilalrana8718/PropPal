import type { AppProps } from 'next/app'
import { Inter } from 'next/font/google'
import '@/styles/globals.css'
import ClerkProvider from '@/components/ClerkProvider'

const inter = Inter({ subsets: ['latin'] })

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ClerkProvider>
      <div className={inter.className}>
        <Component {...pageProps} />
      </div>
    </ClerkProvider>
  )
}

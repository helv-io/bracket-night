import '../styles/globals.css'
import type { AppProps } from 'next/app'

export default function App({ Component, pageProps }: AppProps) {
  return <>
    <link rel="icon" href="/favicon.ico" />
    <Component {...pageProps} />
  </>
}
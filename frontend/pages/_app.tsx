import '../styles/globals.css'
import type { AppProps } from 'next/app'
import Head from 'next/head'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>Bracket Night</title>
        <meta name="description" content="Bracket Night - The ultimate bracket competition platform" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta property="og:title" content="Bracket Night" />
        <meta property="og:description" content="Bracket Night - The ultimate bracket competition platform" />
        <meta property="og:image" content="/og-image.png" />
        <meta property="og:url" content="https://bracket.helv.io" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Component {...pageProps} />
    </>
  )
}
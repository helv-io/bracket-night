import '../styles/globals.css'
import '../styles/cointoss.css'
import '../styles/bracket.css'
import '../styles/player.css'
import { useEffect } from 'react'
import type { AppProps } from 'next/app'
import Head from 'next/head'

const App = ({ Component, pageProps }: AppProps) => {
  // Demo/TV recordings: sessionStorage.bnFullMotion=1 disables coin reduced-motion shortcuts
  useEffect(() => {
    try {
      if (sessionStorage.getItem('bnFullMotion') === '1') {
        document.documentElement.classList.add('bn-full-motion')
      }
    } catch {
      /* ignore */
    }
  }, [])

  return (
    <>
      <Head>
        <title>Bracket Night</title>
        <meta name="description" content="Bracket Night - The ultimate bracket competition platform" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
        <meta property="og:title" content="Bracket Night" />
        <meta property="og:description" content="Bracket Night - The ultimate bracket competition platform" />
        <meta property="og:image" content="/bracket-night-embed.png" />
        <meta property="og:url" content="https://bracket.helv.io" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Component {...pageProps} />
    </>
  )
}

export default App
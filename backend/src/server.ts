import { config } from './config'
import { createNightApp } from './app'

const { server } = createNightApp()
const port = config.dev ? 3001 : 3000

server.listen(port, () => {
  console.log(`Bracket Night listening on ${port} (live rooms are in-memory)`)
})

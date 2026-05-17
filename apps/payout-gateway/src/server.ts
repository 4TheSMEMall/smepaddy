import { app } from './app'
import { env } from './config/env'

app.listen(Number(env.PORT), () => {
  console.log(`SME Paddy payout gateway listening on port ${env.PORT}`)
})

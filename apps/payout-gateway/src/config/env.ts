import fs from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'
import { z } from 'zod'

const envCandidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'apps/payout-gateway/.env'),
]

for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false })
  }
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3011'),
  GATEWAY_TOKEN: z.string().min(12, 'GATEWAY_TOKEN is required'),
  GATEWAY_CALLBACK_URL: z.string().url().optional().default('http://localhost:4000/savings/webhook/provider-callback'),
  GATEWAY_CALLBACK_SECRET: z.string().min(12, 'GATEWAY_CALLBACK_SECRET is required'),
  FLW_SECRET_KEY: z.string().min(1, 'FLW_SECRET_KEY is required'),
  FLW_WEBHOOK_SECRET: z.string().min(8, 'FLW_WEBHOOK_SECRET must be at least 8 characters'),
  FLW_BASE_URL: z.string().default('https://api.flutterwave.com'),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('Invalid SME Paddy payout gateway environment variables:')
  console.error(parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = parsed.data

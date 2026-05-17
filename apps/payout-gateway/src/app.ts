import compression from 'compression'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { z } from 'zod'
import { env } from './config/env'
import {
  listFlutterwaveBanks,
  resolveFlutterwaveAccount,
  initiateFlutterwaveTransfer,
  initializeFlutterwavePayment,
  verifyFlutterwaveTransactionByReference,
} from './utils/flutterwave'
import { postJson } from './utils/http'

const app = express()

app.use(helmet())
app.use(cors())
app.use(compression())
app.use(express.json({ limit: '10kb' }))

// ── Auth middleware ──────────────────────────────────────────────────────────

const requireGatewayToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const token = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null
  if (token !== env.GATEWAY_TOKEN) {
    return res.status(401).json({ data: null, error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } })
  }
  next()
}

// ── Schemas ──────────────────────────────────────────────────────────────────

const resolveAccountSchema = z.object({
  bankCode: z.string().trim().min(2),
  accountNumber: z.string().trim().regex(/^\d{10,20}$/),
})

const initiateTransferSchema = z.object({
  accountBank: z.string().trim().min(2),
  accountNumber: z.string().trim().regex(/^\d{10,20}$/),
  beneficiaryName: z.string().trim().min(2),
  bankName: z.string().trim().min(2),
  amount: z.number().positive(),
  reference: z.string().trim().min(8),
  callbackUrl: z.string().url(),
  narration: z.string().trim().min(4),
})

const initializePaymentSchema = z.object({
  email: z.string().trim().email(),
  amount: z.number().positive(),
  reference: z.string().trim().min(8),
  redirectUrl: z.string().url(),
  customerName: z.string().trim().min(2),
  metadata: z.record(z.string(), z.unknown()),
})

// ── Routes ───────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'smepaddy-payout-gateway', timestamp: new Date().toISOString() })
})

app.get('/api/v1/banks', requireGatewayToken, async (_req, res) => {
  const banks = await listFlutterwaveBanks()
  res.status(200).json({
    data: banks
      .filter((b) => b.code && b.name)
      .map((b) => ({ id: b.id, code: b.code, name: b.name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    error: null,
  })
})

app.post('/api/v1/accounts/resolve', requireGatewayToken, async (req, res) => {
  const input = resolveAccountSchema.parse(req.body)
  const accountName = await resolveFlutterwaveAccount(input.accountNumber, input.bankCode)
  res.status(200).json({ data: { accountName }, error: null })
})

app.post('/api/v1/transfers', requireGatewayToken, async (req, res) => {
  const input = initiateTransferSchema.parse(req.body)
  const result = await initiateFlutterwaveTransfer(input)
  res.status(200).json({ data: result, error: null })
})

app.post('/api/v1/payments', requireGatewayToken, async (req, res) => {
  const input = initializePaymentSchema.parse(req.body)
  const result = await initializeFlutterwavePayment(input)
  res.status(200).json({ data: result, error: null })
})

app.get('/api/v1/payments/:reference/verify', requireGatewayToken, async (req, res) => {
  const reference = z.string().trim().min(8).parse(req.params.reference)
  const result = await verifyFlutterwaveTransactionByReference(reference)
  res.status(200).json({ data: result, error: null })
})

// ── Flutterwave webhook relay ─────────────────────────────────────────────────
// Flutterwave sends transfer events here → we relay to SME Paddy backend.

app.post('/api/v1/flutterwave/webhook', async (req, res) => {
  const providedSecret = req.headers['verif-hash'] as string | undefined

  if (providedSecret !== env.FLW_WEBHOOK_SECRET) {
    return res.status(401).json({ data: null, error: { message: 'Invalid signature', code: 'INVALID_SIGNATURE' } })
  }

  const reference = req.body?.data?.reference
  const transferId = req.body?.data?.id ? String(req.body.data.id) : null
  const status = String(req.body?.data?.status ?? req.body?.status ?? 'UNKNOWN').toUpperCase()

  if (reference) {
    await postJson(
      env.GATEWAY_CALLBACK_URL,
      { reference, transferId, status },
      { 'x-smepaddy-payout-secret': env.GATEWAY_CALLBACK_SECRET },
    )
  }

  res.status(200).json({ data: { accepted: true }, error: null })
})

// ── Error handler ─────────────────────────────────────────────────────────────

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const isZod = err instanceof z.ZodError
  const statusCode = isZod ? 400 : 500
  const message = isZod ? 'Validation failed' : (err instanceof Error ? err.message : 'Something went wrong')
  const code = isZod ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR'
  return res.status(statusCode).json({ data: null, error: { message, code } })
})

export { app }

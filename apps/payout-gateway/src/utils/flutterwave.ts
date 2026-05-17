import https from 'https'
import { env } from '../config/env'

type FlutterwaveBank = { id: number | string; code: string; name: string }

const makeFlutterwaveRequest = async <T>(
  method: 'GET' | 'POST',
  path: string,
  payload?: Record<string, unknown>,
): Promise<T> => {
  const body = payload ? JSON.stringify(payload) : null
  const url = new URL(path, env.FLW_BASE_URL)

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || undefined,
        path: `${url.pathname}${url.search}`,
        method,
        headers: {
          Authorization: `Bearer ${env.FLW_SECRET_KEY}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}),
        },
      },
      (res) => {
        let data = ''
        res.on('data', (c) => { data += c })
        res.on('end', () => {
          const sc = res.statusCode ?? 500
          if (sc >= 200 && sc < 300) {
            try { resolve((data ? JSON.parse(data) : {}) as T) }
            catch (e) { reject(e) }
            return
          }
          reject(new Error(`Flutterwave ${method} ${path} → ${sc}: ${data || 'no body'}`))
        })
      },
    )
    req.on('error', reject)
    if (body) req.write(body)
    req.end()
  })
}

export const listFlutterwaveBanks = async () => {
  const res = await makeFlutterwaveRequest<{ data?: FlutterwaveBank[] }>('GET', '/v3/banks/NG')
  return res.data ?? []
}

export const resolveFlutterwaveAccount = async (accountNumber: string, bankCode: string) => {
  const res = await makeFlutterwaveRequest<{ data?: { account_name?: string }; message?: string }>(
    'POST', '/v3/accounts/resolve',
    { account_number: accountNumber, account_bank: bankCode },
  )
  const name = res.data?.account_name?.trim()
  if (!name) throw new Error(res.message ?? 'Could not resolve account')
  return name
}

export const initiateFlutterwaveTransfer = async (input: {
  accountBank: string; accountNumber: string; beneficiaryName: string
  bankName: string; amount: number; reference: string; callbackUrl: string; narration: string
}) => {
  const res = await makeFlutterwaveRequest<{ data?: { id?: number | string; reference?: string; status?: string } }>(
    'POST', '/v3/transfers',
    {
      account_bank: input.accountBank, account_number: input.accountNumber,
      amount: input.amount, currency: 'NGN',
      beneficiary_name: input.beneficiaryName, bank_name: input.bankName,
      reference: input.reference, callback_url: input.callbackUrl, narration: input.narration,
    },
  )
  return {
    transferId: res.data?.id ? String(res.data.id) : null,
    reference: res.data?.reference ?? input.reference,
    status: res.data?.status ?? 'PENDING',
  }
}

export const initializeFlutterwavePayment = async (input: {
  email: string; amount: number; reference: string
  redirectUrl: string; customerName: string; metadata: Record<string, unknown>
}) => {
  const res = await makeFlutterwaveRequest<{ data?: { link?: string }; message?: string }>(
    'POST', '/v3/payments',
    {
      tx_ref: input.reference, amount: input.amount, currency: 'NGN',
      redirect_url: input.redirectUrl,
      customer: { email: input.email, name: input.customerName },
      customizations: {
        title: 'SME Paddy Savings',
        description: 'Verify your savings and unlock withdrawals.',
      },
      meta: input.metadata,
    },
  )
  const url = res.data?.link?.trim()
  if (!url) throw new Error(res.message ?? 'Could not initialize Flutterwave payment')
  return { reference: input.reference, authorizationUrl: url, accessCode: null }
}

export const verifyFlutterwaveTransactionByReference = async (txRef: string) => {
  const res = await makeFlutterwaveRequest<{
    data?: { id?: number | string; tx_ref?: string; status?: string; amount?: number; currency?: string; created_at?: string }
    message?: string
  }>('GET', `/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`)

  if (!res.data?.tx_ref) throw new Error(res.message ?? 'Could not verify transaction')

  return {
    transactionId: res.data.id ? String(res.data.id) : null,
    txRef: res.data.tx_ref,
    status: String(res.data.status ?? 'UNKNOWN').toLowerCase(),
    amount: Number(res.data.amount ?? 0),
    currency: String(res.data.currency ?? ''),
    paidAt: res.data.created_at ?? null,
  }
}

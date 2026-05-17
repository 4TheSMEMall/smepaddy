import https from 'https'

export const postJson = async <T>(
  targetUrl: string,
  payload: Record<string, unknown>,
  headers: Record<string, string> = {},
): Promise<T> => {
  const body = JSON.stringify(payload)
  const url = new URL(targetUrl)

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || undefined,
        path: `${url.pathname}${url.search}`,
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          ...headers,
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
          reject(new Error(`HTTP POST → ${sc}: ${data || 'no body'}`))
        })
      },
    )
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

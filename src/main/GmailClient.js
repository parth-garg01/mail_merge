const { google } = require('googleapis')
const { shell } = require('electron')
const Store = require('electron-store')
const http = require('http')
const url = require('url')

const tokenStore = new Store({ name: 'auth-tokens' })

function sendAuthResultPage(res, title, message, ok = true) {
  const color = ok ? '#166534' : '#991b1b'
  res.writeHead(200, { 'Content-Type': 'text/html' })
  res.end(`
    <html>
      <body style="font-family:sans-serif;text-align:center;padding:60px">
        <h2 style="color:${color}">${title}</h2>
        <p>${message}</p>
      </body>
    </html>
  `)
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function plainTextToHtml(value) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map(paragraph => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

class GmailClient {
  constructor() {
    this.oauth2Client = null
    this._server = null
  }

  init(clientId, clientSecret, redirectUri = 'http://localhost:3000/oauth2callback') {
    this.oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri)

    const stored = tokenStore.get('tokens')
    if (stored) this.oauth2Client.setCredentials(stored)

    this.oauth2Client.on('tokens', tokens => {
      const current = tokenStore.get('tokens', {})
      tokenStore.set('tokens', { ...current, ...tokens })
    })
  }

  async startAuth() {
    if (!this.oauth2Client) throw new Error('GmailClient not initialized with credentials.')

    return new Promise((resolve, reject) => {
      const authUrl = this.oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: [
          'https://www.googleapis.com/auth/gmail.send',
          'https://www.googleapis.com/auth/userinfo.email'
        ],
        prompt: 'consent'
      })

      if (this._server) {
        try { this._server.close() } catch {}
      }

      this._server = http.createServer(async (req, res) => {
        const parsed = url.parse(req.url, true)
        if (parsed.pathname !== '/oauth2callback') return

        try {
          if (parsed.query.error) {
            throw new Error(parsed.query.error_description || parsed.query.error)
          }

          if (!parsed.query.code) {
            throw new Error('Google did not return an authorization code.')
          }

          const { tokens } = await this.oauth2Client.getToken(parsed.query.code)
          this.oauth2Client.setCredentials(tokens)
          tokenStore.set('tokens', tokens)

          // Fetch user email
          const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client })
          const { data } = await oauth2.userinfo.get()
          tokenStore.set('userEmail', data.email)

          sendAuthResultPage(
            res,
            'Authentication successful!',
            'You can close this window and return to Smart Mail Merger.'
          )
          resolve({ success: true, email: data.email })
        } catch (err) {
          sendAuthResultPage(
            res,
            'Authentication failed',
            err.message || 'Could not complete Google authentication.',
            false
          )
          reject(err)
        } finally {
          if (this._server) {
            this._server.close()
            this._server = null
          }
        }
      })

      this._server.listen(3000, () => shell.openExternal(authUrl))
      this._server.on('error', reject)
    })
  }

  isAuthenticated() {
    const tokens = tokenStore.get('tokens')
    return !!(tokens && (tokens.access_token || tokens.refresh_token))
  }

  getConnectedEmail() {
    return tokenStore.get('userEmail', null)
  }

  async revokeToken() {
    if (this.oauth2Client) {
      try { await this.oauth2Client.revokeCredentials() } catch {}
    }
    tokenStore.clear()
  }

  _buildRawMessage(from, to, subject, body) {
    const htmlBody = plainTextToHtml(body)
    const msg = [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=utf-8',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(htmlBody).toString('base64')
    ].join('\r\n')

    return Buffer.from(msg)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
  }

  async send(to, subject, body) {
    if (!this.isAuthenticated()) throw new Error('Not authenticated. Please connect Gmail first.')
    if (!this.oauth2Client) throw new Error('GmailClient not initialized.')

    // Ensure token is fresh
    await this.oauth2Client.getAccessToken()

    const from = this.getConnectedEmail() || 'me'
    const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client })
    const raw = this._buildRawMessage(from, to, subject, body)

    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw }
    })

    return response.data
  }
}

module.exports = new GmailClient()

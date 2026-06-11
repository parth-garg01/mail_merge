const { google } = require('googleapis')
const { shell } = require('electron')
const Store = require('electron-store')
const http = require('http')
const url = require('url')

const tokenStore = new Store({ name: 'auth-tokens' })

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
        scope: ['https://www.googleapis.com/auth/gmail.send'],
        prompt: 'consent'
      })

      if (this._server) {
        try { this._server.close() } catch {}
      }

      this._server = http.createServer(async (req, res) => {
        const parsed = url.parse(req.url, true)
        if (parsed.pathname !== '/oauth2callback') return

        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end('<html><body style="font-family:sans-serif;text-align:center;padding:60px"><h2>Authentication successful!</h2><p>You can close this window and return to Smart Mail Merger.</p></body></html>')
        this._server.close()
        this._server = null

        try {
          const { tokens } = await this.oauth2Client.getToken(parsed.query.code)
          this.oauth2Client.setCredentials(tokens)
          tokenStore.set('tokens', tokens)

          // Fetch user email
          const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client })
          const { data } = await oauth2.userinfo.get()
          tokenStore.set('userEmail', data.email)

          resolve({ success: true, email: data.email })
        } catch (err) {
          reject(err)
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
    const msg = [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=utf-8',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(body).toString('base64')
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

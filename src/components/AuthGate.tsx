import { useState, useEffect } from 'react'

interface AuthGateProps {
  onToken: (token: string) => void
}

export default function AuthGate({ onToken }: AuthGateProps) {
  const [status, setStatus] = useState<'idle' | 'logging' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [showSetup, setShowSetup] = useState(false)

  // Check for stored token on mount
  useEffect(() => {
    ;(async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core')
        const stored: string | null = await invoke('check_stored_token')
        if (stored) onToken(stored)
      } catch {}
    })()
  }, [])

  const handleLogin = async () => {
    setStatus('logging')
    setErrorMsg(null)
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const token: string = await invoke('start_oauth')
      onToken(token)
    } catch (err: any) {
      const msg = err.toString()
      setStatus('error')
      if (msg.includes('OPEN_BROWSER:')) {
        // Browser didn't open automatically — show the URL
        const url = msg.replace('OPEN_BROWSER:', '')
        setErrorMsg(`Please open this URL in your browser:\n\n${url}`)
      } else if (msg.includes('DROPBOX_APP_KEY') || msg.includes('YOUR_DROPBOX_APP_KEY')) {
        setErrorMsg('App Key not set. Click "Set Up App" below.')
        setShowSetup(true)
      } else {
        setErrorMsg(msg)
      }
      setStatus('idle')
    }
  }

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0D1117', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '24px' }}>
      <img src="/9_k_Logo.png" alt="Excubia" style={{ width: '80px', height: '80px', borderRadius: '16px' }} />
      <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 700, color: '#E6EDF3' }}>Excubia Player</h1>
      <p style={{ color: '#8B949E', fontSize: '14px', margin: 0 }}>A native video player for Dropbox</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '360px' }}>
        <button
          onClick={handleLogin}
          disabled={status === 'logging'}
          style={{
            padding: '14px 24px', background: status === 'logging' ? '#21262D' : '#2F81F7',
            color: status === 'logging' ? '#6E7681' : '#fff', border: 'none',
            borderRadius: '8px', fontSize: '15px', fontWeight: 600,
            cursor: status === 'logging' ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          }}
        >
          {status === 'logging' ? (
            <>
              <div style={{ width: '16px', height: '16px', border: '2px solid #6E7681', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              Logging in...
            </>
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
              Login with Dropbox
            </>
          )}
        </button>

        {errorMsg && (
          <div style={{ padding: '10px 14px', background: '#3D1214', border: '1px solid #F85149', borderRadius: '6px', fontSize: '13px', color: '#F85149', whiteSpace: 'pre-wrap' }}>
            {errorMsg}
          </div>
        )}

        {showSetup && (
          <div style={{ borderTop: '1px solid #30363D', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <p style={{ color: '#8B949E', fontSize: '12px', margin: 0 }}>
              You need to set up a Dropbox App to use this player:
            </p>
            <ol style={{ color: '#8B949E', fontSize: '12px', margin: 0, paddingLeft: '16px', lineHeight: '1.6' }}>
              <li>Go to <a href="https://www.dropbox.com/developers/apps" target="_blank" style={{ color: '#2F81F7' }}>Dropbox Developer Console</a></li>
              <li>Click <strong>Create app</strong> → Scoped access → Full Dropbox</li>
              <li>Set Redirect URI to: <code style={{ background: '#21262D', padding: '1px 4px', borderRadius: '3px' }}>http://127.0.0.1:4989/callback</code></li>
              <li>Copy the <strong>App Key</strong> and paste it below</li>
            </ol>
            <p style={{ color: '#8B949E', fontSize: '12px', margin: 0 }}>
              Then replace <code style={{ background: '#21262D', padding: '1px 4px', borderRadius: '3px' }}>YOUR_DROPBOX_APP_KEY</code> in <code style={{ background: '#21262D', padding: '1px 4px', borderRadius: '3px' }}>src-tauri/src/lib.rs</code> with your key and rebuild.
            </p>
          </div>
        )}

        <p style={{ color: '#6E7681', fontSize: '12px', textAlign: 'center', margin: 0 }}>
          Your files stream directly from Dropbox. No server involved.
        </p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

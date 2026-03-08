import { useState } from 'react'
import { S, COLORS, FONTS } from '../utils/styles.js'
import { useIsMobile } from '../utils/useIsMobile.js'
import { isAliasValid } from '../utils/helpers.js'
import { isAliasTaken } from '../api/auth.js'

export default function UsernameScreen({ alias, setAlias, error, setError, onCreate }) {
  const isMobile = useIsMobile()
  const [checking, setChecking] = useState(false)
  const [creating, setCreating] = useState(false)
  const [takenError, setTakenError] = useState(false)
  const [formatError, setFormatError] = useState(false)

  const handleCreate = async () => {
    if (!isAliasValid(alias)) {
      setFormatError(true)
      return
    }
    setFormatError(false)
    setChecking(true); setTakenError(false)
    const taken = await isAliasTaken(alias.trim())
    setChecking(false)
    if (taken) { setTakenError(true); return }
    setCreating(true)
    setTakenError(false)
    setError?.(null)
    try {
      await onCreate()
    } catch (e) {
      setError?.(e?.message || 'Registration failed')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div style={{
      ...S.screen,
      background: isMobile ? COLORS.white : COLORS.bg,
      justifyContent: 'center',
      alignItems: 'center',
      padding: isMobile ? '0 28px' : '40px 20px',
    }}>
      <div style={{
        background: COLORS.white,
        borderRadius: isMobile ? 0 : 16,
        boxShadow: isMobile ? 'none' : '0 4px 32px rgba(0,0,0,0.08)',
        padding: isMobile ? '0' : '48px 52px',
        width: '100%', maxWidth: 440,
        animation: 'fadeUp 0.5s ease',
      }}>
        <div style={{ fontFamily: FONTS.serif, fontSize: 32, color: COLORS.textPrimary, marginBottom: 8 }}>
          Choose your alias
        </div>
        <p style={{ color: COLORS.textMid, fontSize: 14, marginBottom: 8, fontFamily: FONTS.sans }}>
          This is what the leaderboard shows. Must be unique across all players.
        </p>
        <p style={{ color: '#c65d4a', fontSize: 12, marginBottom: 36, fontFamily: FONTS.sans }}>
          Important: Once set, your username cannot be changed.
        </p>
        <input
          style={{
            width: '100%', border: `1.5px solid ${takenError || formatError || error ? COLORS.error : COLORS.borderDark}`,
            borderRadius: 8, color: COLORS.textPrimary, fontSize: 18,
            padding: '12px 14px', outline: 'none', background: COLORS.white,
            fontFamily: FONTS.sans, transition: 'border-color 0.2s',
            boxSizing: 'border-box',
          }}
          placeholder="e.g. Priya_K"
          value={alias} maxLength={20}
          onChange={e => { setAlias(e.target.value.replace(/\s/g, '_')); setTakenError(false); setFormatError(false); setError?.(null) }}
          onKeyDown={e => e.key === 'Enter' && isAliasValid(alias) && handleCreate()}
        />
        {takenError && (
          <p style={{ color: COLORS.error, fontSize: 12, marginTop: 6, fontFamily: FONTS.sans, fontWeight: 600 }}>
            That alias is already taken — please choose another.
          </p>
        )}
        {formatError && (
          <p style={{ color: COLORS.error, fontSize: 12, marginTop: 6, fontFamily: FONTS.sans, fontWeight: 600 }}>
            Alias must be 3–20 characters, letters/numbers/underscores only, and include at least one letter.
          </p>
        )}
        {error && (
          <p style={{ color: COLORS.error, fontSize: 12, marginTop: 6, fontFamily: FONTS.sans, fontWeight: 600 }}>
            {error}
          </p>
        )}
        <p style={{ color: COLORS.textFaint, fontSize: 11, marginTop: 6, fontFamily: FONTS.sans }}>
          3–20 characters · alphanumeric · no spaces · unique across all players
        </p>
        <button
          onClick={handleCreate}
          disabled={!isAliasValid(alias) || checking || creating}
          style={{
            ...S.primaryBtn, marginTop: 24,
            opacity: isAliasValid(alias) ? 1 : 0.45,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {checking ? (
            <>
              <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
              Checking availability…
            </>
          ) : creating ? (
            <>
              <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
              Creating account…
            </>
          ) : "Let's Play →"}
        </button>
      </div>
    </div>
  )
}

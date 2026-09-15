import { useState } from 'react'
import { useUser } from '@/app/context/UserContext'

export function UsernameScreen() {
  const { setUser } = useUser()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function formatTo233(raw: string) {
    const cleaned = raw.replace(/\D/g, '').trim()
    if (cleaned.startsWith('0')) return '233' + cleaned.slice(1)
    if (cleaned.startsWith('233')) return cleaned
    return cleaned
  }

  function isValidGhanaPhone(formatted: string) {
    // 233 + 9 digits = 12 digits total, e.g. 233241234567
    return /^233\d{9}$/.test(formatted)
  }

  async function handleContinue() {
    const trimmedName = name.trim()
    const formattedPhone = formatTo233(phone)

    if (trimmedName.length < 2) {
      setError('Please enter at least 2 characters')
      return
    }
    if (trimmedName.length > 20) {
      setError('Name must be 20 characters or less')
      return
    }
    if (!isValidGhanaPhone(formattedPhone)) {
      setError('Enter a valid phone number, e.g. 024XXXXXXX')
      return
    }

    setError('')
    setLoading(true)
    await new Promise(r => setTimeout(r, 300))
    try {
      await setUser(trimmedName, formattedPhone)
    } catch {
      setError('Something went wrong saving your details. Please try again.')
      setLoading(false)
      return
    }
    setLoading(false)
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleContinue()
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6">
      {/* Logo / brand */}
      <div className="mb-8 text-center">
        <div className="text-5xl mb-3">🍛</div>
        <h1 className="text-2xl font-bold text-gray-900">Waakye Plug</h1>
        <p className="text-sm text-gray-500 mt-1">Fresh every morning, 5:30 – 8:00 AM</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Let's get you set up</h2>
        <p className="text-sm text-gray-500 mb-5">
          Your name and number keep your orders tied to you — even if someone else uses the same name.
        </p>

        <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
        <input
          type="text"
          value={name}
          onChange={e => { setName(e.target.value); setError('') }}
          onKeyDown={handleKey}
          placeholder="e.g. Kwame, Ama, Kofi..."
          maxLength={20}
          autoFocus
          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 transition-all"
        />

        <label className="block text-xs font-medium text-gray-600 mb-1 mt-4">Phone Number</label>
        <input
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          value={phone}
          onChange={e => { setPhone(e.target.value); setError('') }}
          onKeyDown={handleKey}
          placeholder="e.g. 024XXXXXXX"
          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 transition-all"
        />

        {error && (
          <p className="mt-2 text-xs text-red-500">{error}</p>
        )}

        <button
          onClick={handleContinue}
          disabled={loading || name.trim().length < 2 || phone.trim().length < 9}
          className="mt-4 w-full rounded-xl bg-green-600 py-3 text-sm font-medium text-white hover:bg-green-700 active:scale-95 transition-all disabled:opacity-50"
        >
          {loading ? 'Loading...' : "Let's go →"}
        </button>

        <p className="mt-4 text-center text-xs text-gray-400">
          No password needed — just your name and number 👋
        </p>
      </div>
    </div>
  )
}
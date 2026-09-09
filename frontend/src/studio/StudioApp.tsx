import { FormEvent, useEffect, useRef, useState } from 'react'
import { apiHeaders } from '../lib/api'

type Row = {
  name: string
  previousName: string
  image_url: string
  choice: number
  loading: boolean
}

const emptyRow = (): Row => ({ name: '', previousName: '', image_url: '', choice: 0, loading: false })

export function StudioApp() {
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [code, setCode] = useState('')
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [magic, setMagic] = useState(false)
  const [contestants, setContestants] = useState<Row[]>(() => Array.from({ length: 16 }, emptyRow))
  const [images, setImages] = useState(() => Array.from({ length: 16 }, () => ({ urls: [''] })))
  const errorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (error && errorRef.current) errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [error])

  const update = (index: number, patch: Partial<Row>) => {
    setContestants(rows => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  const proposeImages = async (index: number, name: string) => {
    const urls = await (await fetch(`/api/image/${encodeURIComponent(name)}`, { headers: apiHeaders() })).json() as string[]
    if (urls.length) {
      setImages(prev => prev.map((row, i) => (i === index ? { urls } : row)))
    }
    return urls
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setSuccess('')
    if (!title || !subtitle) {
      setError('Title and subtitle are required')
      return
    }
    if (contestants.some(c => !c.name || c.name.length > 20)) {
      setError('Every contestant needs a name of 20 characters or less')
      return
    }
    if (new Set(contestants.map(c => c.name)).size !== contestants.length) {
      setError('Contestant names must be unique')
      return
    }
    if (contestants.some(c => !c.image_url)) {
      setError('Every contestant needs an image')
      return
    }
    if (isPublic && !code) {
      setError('Public fields need a code')
      return
    }
    setBusy(true)
    const response = await fetch('/api/create-bracket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, subtitle, contestants, isPublic, code }),
    })
    if (response.ok) {
      const body = await response.json() as { code: string }
      setSuccess(`Field saved as ${body.code}`)
      localStorage.setItem('code', body.code)
      setTitle('')
      setSubtitle('')
      setIsPublic(false)
      setCode('')
      setContestants(Array.from({ length: 16 }, emptyRow))
    } else {
      setError('Could not save the field')
    }
    setBusy(false)
  }

  const runMagic = async () => {
    setMagic(true)
    const names = await (await fetch(`/api/ai/${encodeURIComponent(title)}`, { headers: apiHeaders() })).json() as string[]
    const next = [...contestants]
    await Promise.all(next.map(async (row, i) => {
      if (row.name) return
      next[i] = { ...row, name: names[i] || row.name, choice: 0 }
      const urls = await proposeImages(i, `${title} ${names[i]}`)
      next[i].image_url = urls[0] || '/bn-logo-gold.svg'
    }))
    setContestants(next)
    setMagic(false)
  }

  return (
    <div className="page">
      <img className="logo" src="/bracket-night-gold.svg" alt="Bracket Night" />
      <form className="card" style={{ width: 'min(820px, 100%)' }} onSubmit={submit}>
        <h1 className="display">New field</h1>
        <p>Templates still live in SQLite. Live nights do not.</p>
        {magic && <p className="banner">AI is filling names and pictures…</p>}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input className="bn-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" />
          <button type="button" className="bn-btn" disabled={title.length < 3} onClick={runMagic}>Magic</button>
        </div>
        <input className="bn-input" value={subtitle} onChange={e => setSubtitle(e.target.value)} placeholder="Subtitle" />
        <label>
          <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} />
          {' '}Public and searchable
        </label>
        {isPublic && (
          <input className="bn-input" value={code} onChange={e => setCode(e.target.value)} placeholder="Public code" />
        )}
        {error && <div ref={errorRef} className="banner banner--err">{error}</div>}
        {success && <div className="banner banner--ok">{success}</div>}
        <div className="studio-grid">
          {contestants.map((row, index) => (
            <fieldset key={index} className="card" style={{ padding: '0.8rem' }}>
              <legend>Contestant {index + 1}</legend>
              <input
                className="bn-input"
                value={row.name}
                maxLength={20}
                placeholder={title ? `Name ${index + 1}` : 'Add a title first'}
                onChange={e => update(index, { name: e.target.value })}
                onFocus={() => update(index, { previousName: row.name })}
                onBlur={async () => {
                  if (!row.name.trim() || row.previousName === contestants[index].name) return
                  update(index, { loading: true, image_url: '', choice: 0 })
                  const urls = await proposeImages(index, `${title} ${row.name}`)
                  update(index, { loading: false, image_url: urls[0] || '/bn-logo-gold.svg' })
                }}
              />
              {row.loading && <p>Finding pictures…</p>}
              {row.image_url && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <button
                    type="button"
                    className="bn-btn"
                    disabled={row.choice === 0}
                    onClick={() => {
                      const choice = Math.max(row.choice - 1, 0)
                      update(index, { choice, image_url: images[index].urls[choice] })
                    }}
                  >
                    Prev
                  </button>
                  <img src={row.image_url} alt={row.name} style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 8 }} />
                  <button
                    type="button"
                    className="bn-btn"
                    disabled={row.choice >= images[index].urls.length - 1}
                    onClick={() => {
                      const choice = Math.min(row.choice + 1, images[index].urls.length - 1)
                      update(index, { choice, image_url: images[index].urls[choice] })
                    }}
                  >
                    Next
                  </button>
                </div>
              )}
            </fieldset>
          ))}
        </div>
        <button type="submit" className="bn-btn bn-btn--solid" disabled={busy}>
          {busy ? 'Saving…' : 'Save field'}
        </button>
      </form>
    </div>
  )
}

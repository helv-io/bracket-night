/* eslint-disable @next/next/no-img-element */
import { useState, useRef, useEffect } from 'react'
import { apiHeaders } from '../lib/api'

const NewBracket = () => {
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [code, setCode] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isAiHappening, setIsAiHappening] = useState(false)
  
  // Arrays (16) for Contestants and Images
  const [contestants, setContestants] = useState(
    Array.from({ length: 16 }, () => ({ name: '', previousName: '', image_url: '', choice: 0, loading: false }))
  )
  const [images, setImages] = useState(
    Array.from({ length: 16 }, () => ({ urls: [ '' ] }))
  )
  
  // Create a reference to the error message element
  const errorRef = useRef<HTMLDivElement>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')

    if (!title || !subtitle) {
      setErrorMessage('Title and Subtitle are required')
      return
    }

    const invalidNames = contestants.some(c => !c.name || c.name.length > 20)
    if (invalidNames) {
      setErrorMessage('All contestant names must be filled and within 20 characters')
      return
    }
    
    const repeatedName = contestants.some((c, i) => contestants.slice(i + 1).some(c2 => c.name === c2.name))
    if (repeatedName) {
      setErrorMessage('Contestant names must be unique')
      return
    }

    const invalidImages = contestants.some(c => !c.image_url)
    if (invalidImages) {
      setErrorMessage('All contestant images must be filled')
      return
    }
    
    if (isPublic && !code) {
      setErrorMessage('Bracket Code is required for public brackets')
      return
    }

    await submitBracket()
  }

  const submitBracket = async () => {
    setIsSubmitting(true)
    const response = await fetch('/api/create-bracket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, subtitle, contestants, isPublic, code })
    })

    if (response.ok) {
      const { code } = await response.json()
      setSuccessMessage(`Bracket created with code: ${code}`)
      localStorage.setItem('code', code)
      
      // Clear all fields
      setTitle('')
      setSubtitle('')
      setIsPublic(false)
      setCode('')
      setContestants(Array.from({ length: 16 }, () => ({ name: '', previousName: '', image_url: '', choice: 0, loading: false })))
    } else {
      setErrorMessage('Something went wrong, try again')
    }
    setIsSubmitting(false)
  }

  const updateContestant = (index: number, field: 'name' | 'image_url' | 'loading', value: string | boolean) => {
    const newContestants = [...contestants]
    if(field === 'loading')
      newContestants[index].loading = value as boolean
    else
      newContestants[index][field] = value as string
    setContestants(newContestants)
  }
  
  // Propose images for a contestant
  const proposeImages = async (index: number, name: string) => {
    const newImages = [...images]
    const urls = await (await fetch(`/api/image/${encodeURIComponent(name)}`, {
      headers: apiHeaders()
    })).json() as string[]
    if (urls.length) {
      newImages[index].urls = urls
      setImages(newImages)
    }
  }

  // Check if a public bracket code is unique
  const checkUniqueCode = async () => {
    if (!code) return
    const response = await fetch(`/api/unique/${code}`)
    const { unique } = await response.json()
    if (!unique) {
      setErrorMessage('Bracket Code already taken, pick another')
    } else {
      setErrorMessage('')
    }
  }

  // Scroll to the error message when it changes
  useEffect(() => {
    if (errorMessage && errorRef.current) {
      errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [errorMessage])

  const magic = async () => {
    // UI should be blocked while this is happening
    setIsAiHappening(true)
    
    // Get AI contestants
    const aiContestants = await (await fetch(`/api/ai/${encodeURIComponent(title)}`, {
      headers: apiHeaders()
    })).json() as string[]
    
    // Clone existing contestants and images
    const newContestants = [...contestants]
    // const newImages = [...images]
    
    // Parallel Loop on new contestants and update names,  skipping if the name is already filled
    await Promise.all(newContestants.map(async (contestant, i) => {
      if (contestant.name) return
      newContestants[i].name = aiContestants[i]
      newContestants[i].choice = 0
      await proposeImages(i, `${title} ${aiContestants[i]}`)
      newContestants[i].image_url = images[i].urls[0] || '/bn-logo-gold.svg'
    }))
    
    // Update contestants with new contestants
    setContestants(newContestants)
    
    // UI should be unblocked after this is done
    setIsAiHappening(false)
  }

  return (
    <div className="bn-page bn-page--stadium new-page">
      <img
        src="/bracket-night-gold.svg"
        alt="Bracket Night"
        className="new-logo"
      />
      <div className="bn-card new-shell">
        <header className="new-header">
          <h1 className="new-title">New Bracket</h1>
          <p className="new-lede">
            Name it, add 16 contestants, and we&apos;ll find the pictures.
          </p>
        </header>

        {/* AI is happening - full screen, blocking spinner */}
        {isAiHappening && (
          <div className="new-overlay" role="alert" aria-busy="true">
            <div className="bn-card new-overlay-card">
              <div className="vote-spinner" style={{ width: '3.25rem', height: '3.25rem', borderWidth: 4 }} />
              <p>AI is doing magic…</p>
            </div>
          </div>
        )}

        {/* Form for creating a new bracket */}
        <form onSubmit={handleSubmit} className="new-form">
          <div className="new-field">
            <label htmlFor="title" className="new-label">Title</label>
            <div className="new-input-row">
              <input
                type="text"
                id="title"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Best Pizza Toppings"
                className="new-input"
                autoComplete="off"
                enterKeyHint="next"
              />
              <button
                type="button"
                disabled={title.length < 3}
                onClick={magic}
                className="new-icon-btn new-icon-btn--magic"
                aria-label="Generate contestants with AI"
                title="Fill the empty slots with AI"
              >
                🪄
              </button>
            </div>
            <p className="new-hint">Tap the wand to have AI fill the empty contestant slots.</p>
          </div>

          <div className="new-field">
            <label htmlFor="subtitle" className="new-label">Subtitle</label>
            <input
              type="text"
              id="subtitle"
              value={subtitle}
              onChange={e => setSubtitle(e.target.value)}
              placeholder="A short description"
              className="new-input"
              autoComplete="off"
              enterKeyHint="done"
            />
          </div>

          <div className="new-field">
            <label className="new-toggle">
              <span className="new-toggle-text">
                <span className="new-toggle-title">Public bracket</span>
                <span className="new-toggle-sub">Shareable &amp; searchable with a code</span>
              </span>
              <input
                type="checkbox"
                checked={isPublic}
                onChange={e => setIsPublic(e.target.checked)}
              />
              <span className="new-switch" aria-hidden />
            </label>
            {isPublic && (
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value)}
                onBlur={checkUniqueCode}
                placeholder="Bracket code"
                aria-label="Bracket code"
                className="new-input"
                autoCapitalize="characters"
                autoComplete="off"
              />
            )}
          </div>

          {errorMessage && (
            <div ref={errorRef} className="new-banner new-banner--error" role="alert">
              {errorMessage}
            </div>
          )}

          <div className="new-contestants-head">
            <h2 className="new-label">Contestants</h2>
            <span className="new-count" aria-live="polite">
              {contestants.filter(c => c.name.trim()).length}/16
            </span>
          </div>

          <div className="new-contestants">
            {contestants.map((contestant, index) => (
              <fieldset key={index} className="new-contestant">
                <legend className="sr-only">Contestant {index + 1}</legend>
                <span className="new-seed" aria-hidden>{index + 1}</span>
                <div className="new-contestant-body">
                  <input
                    id={`name-${index}`}
                    type="text"
                    value={contestant.name}
                    onChange={e => updateContestant(index, 'name', e.target.value)}
                    onFocus={() => {
                      if (!title)
                        document.getElementById('title')?.focus()
                      contestants[index].previousName = contestant.name
                    }}
                    onBlur={async () => {
                      // If the name is empty or the same as before, return
                      if (!contestant.name.trim()) return
                      if (contestant.previousName === contestants[index].name) return

                      contestant.choice = 0
                      updateContestant(index, 'image_url', '')
                      updateContestant(index, 'loading', true)
                      await proposeImages(index, `${title} ${contestant.name}`)
                      const url = images[index].urls.length > 0 && images[index].urls[0] || '/bn-logo-gold.svg'
                      updateContestant(index, 'image_url', url)
                      updateContestant(index, 'loading', false)
                    }}
                    placeholder={title ? `Contestant ${index + 1}` : 'Enter a title first'}
                    aria-label={`Contestant ${index + 1} name`}
                    maxLength={20}
                    autoComplete="off"
                    className="new-input"
                  />
                  <input
                    type="hidden"
                    id={`image-${index}`}
                    value={contestant.image_url}
                  />
                  {contestant.name && (contestant.loading || contestant.image_url) && (
                    <div className="new-picker">
                      {contestant.loading && <div className="vote-spinner" aria-label="Finding pictures" />}
                      {contestant.image_url && (
                        <>
                          <button
                            type="button"
                            disabled={images[index].urls.length === 0 || contestant.choice === 0}
                            onClick={() => {
                              const newChoice = Math.max(contestant.choice - 1, 0)
                              updateContestant(index, 'image_url', images[index].urls[newChoice])
                              contestant.choice = newChoice
                            }}
                            className="new-icon-btn"
                            aria-label={`Previous picture for ${contestant.name}`}
                          >
                            ‹
                          </button>
                          <img
                            src={images[index].urls[contestant.choice] || '/bn-logo-gold.svg'}
                            alt={contestant.name}
                            onError={e => (e.currentTarget.src = '/bn-logo-gold.svg')}
                            className="new-thumb"
                          />
                          <button
                            type="button"
                            disabled={
                              images[index].urls.length === 0 ||
                              contestant.choice === images[index].urls.length - 1
                            }
                            onClick={() => {
                              const newChoice = Math.min(
                                contestant.choice + 1,
                                images[index].urls.length - 1
                              )
                              updateContestant(index, 'image_url', images[index].urls[newChoice])
                              contestant.choice = newChoice
                            }}
                            className="new-icon-btn"
                            aria-label={`Next picture for ${contestant.name}`}
                          >
                            ›
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </fieldset>
            ))}
          </div>

          {successMessage && (
            <div className="new-banner new-banner--success" role="status">
              {successMessage}
            </div>
          )}

          <div className="new-submit-bar">
            <button
              type="submit"
              disabled={isSubmitting}
              className="bn-btn bn-btn--gold new-submit"
            >
              {isSubmitting ? 'Creating…' : 'Create bracket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default NewBracket
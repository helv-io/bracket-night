/* eslint-disable @next/next/no-img-element */
import { useState, useRef, useEffect } from 'react'

const NewBracket = () => {
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [code, setCode] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Arrays (16) for Contestants and Images
  const [contestants, setContestants] = useState(
    Array.from({ length: 16 }, () => ({ name: '', image_url: '', choice: 0 }))
  )
  const [images, setImages] = useState(
    Array.from({ length: 16 }, () => ({ urls: [{ url: '' }] }))
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
      setContestants(Array.from({ length: 16 }, () => ({ name: '', image_url: '', choice: 0 })))
    } else {
      setErrorMessage('Something went wrong, try again')
    }
    setIsSubmitting(false)
  }

  const updateContestant = (index: number, field: 'name' | 'image_url', value: string) => {
    const newContestants = [...contestants]
    newContestants[index][field] = value
    setContestants(newContestants)
  }
  
  // Propose images for a contestant
  const proposeImages = async (index: number, name: string) => {
    const newImages = [...images]
    const urls = await (await fetch(`/api/image/${name}`)).json() as { url: string }[]
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

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-4 flex-col">
      <img
        src="/bracket-night-gold.svg"
        alt="Bracket Night Logo"
        className="w-full sm:w-1/3 object-cover"
      />
      <div className="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 transition-all duration-300">
        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white text-center mb-6" style={{ textShadow: '2px 2px 4px var(--accent)' }}>
          New Bracket
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Title"
            className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition"
          />

          <input
            type="text"
            value={subtitle}
            onChange={e => setSubtitle(e.target.value)}
            placeholder="Subtitle (Description)"
            className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition"
          />

          <div className="flex flex-col space-y-2">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={e => setIsPublic(e.target.checked)}
                className="form-checkbox h-5 w-5 text-blue-600 dark:text-blue-400 rounded focus:ring-blue-500"
              />
              <span className="text-gray-700 dark:text-gray-300 font-medium">
                Public Bracket (Shareable & Searchable)
              </span>
            </label>
            {isPublic && (
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value)}
                onBlur={checkUniqueCode}
                placeholder="Bracket Code"
                className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition"
              />
            )}
          </div>

          {/* Attach the ref to the error message div */}
          {errorMessage && (
            <div
              ref={errorRef}
              className="mb-4 p-3 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-lg shadow"
            >
              {errorMessage}
            </div>
          )}

          {/* Contestants */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {contestants.map((contestant, index) => (
              <fieldset key={index} className="border border-gray-300 dark:border-gray-600 p-4 rounded-lg">
                <legend className="text-gray-700 dark:text-gray-300 font-medium bg-white dark:bg-gray-800 px-1">
                  Contestant {index + 1}
                </legend>
                <div className="space-y-4">
                    <div>
                    <input
                      id={`name-${index}`}
                      type="text"
                      value={contestant.name}
                      onChange={(e) => updateContestant(index, "name", e.target.value)}
                      onBlur={async () => {
                        contestant.choice = 0
                        await proposeImages(index, `${title} ${contestant.name}`)
                        updateContestant(index, 'image_url', images[index].urls[0]?.url || '/bn-logo-gold.svg')
                      }}
                      placeholder="Name"
                      maxLength={20}
                      className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition"
                    />
                    </div>
                  <div>
                    <input
                      type="hidden"
                      id={`image-${index}`}
                      value={contestant.image_url}
                    />
                    {contestant.name && contestant.image_url && (
                      <div className="flex items-center justify-center space-x-2">
                      <button
                        type="button"
                        onClick={() => {
                          const newChoice = Math.max(contestant.choice - 1, 0)
                          updateContestant(index, 'image_url', images[index].urls[newChoice]?.url)
                          contestant.choice = newChoice
                        }}
                        className="p-1 bg-gray-300 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-400 dark:hover:bg-gray-600 transition"
                      >
                        👈
                      </button>
                      <img
                        src={contestant.image_url}
                        alt={contestant.name}
                        className="w-25 h-25 object-cover rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const newChoice = Math.min(contestant.choice + 1, images[index].urls.length - 1)
                          updateContestant(index, 'image_url', images[index].urls[newChoice]?.url)
                          contestant.choice = newChoice
                        }}
                        className="p-1 bg-gray-300 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-400 dark:hover:bg-gray-600 transition"
                      >
                        👉
                      </button>
                      </div>
                    )}
                  </div>
                </div>
              </fieldset>
            ))}
          </div>
          
          {/* Display the success message */}
          {successMessage && (
            <div className="mb-4 p-3 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-lg shadow">
              {successMessage}
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 focus:ring-2 focus:ring-blue-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Creating...' : 'Create Bracket'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default NewBracket
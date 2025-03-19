import { useState } from 'react'
import { useRouter } from 'next/router'

export default function NewBracket() {
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [contestants, setContestants] = useState(
    Array.from({ length: 16 }, () => ({ name: '', image_url: '' }))
  )
  const [isPublic, setIsPublic] = useState(false)
  const [bracketCode, setBracketCode] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showImageWarning, setShowImageWarning] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: { preventDefault: () => void }) => {
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

    if (isPublic && !bracketCode) {
      setErrorMessage('Bracket Code is required for public brackets')
      return
    }

    const missingImages = contestants.some(c => !c.image_url)
    if (missingImages && !showImageWarning) {
      setShowImageWarning(true)
      return
    }

    await submitBracket()
  }

  const submitBracket = async () => {
    setIsSubmitting(true)
    const response = await fetch('/api/create-bracket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, subtitle, contestants, isPublic, bracketCode })
    })

    if (response.ok) {
      const { code } = await response.json()
      setSuccessMessage(`Bracket created with code: ${code}`)
      localStorage.setItem('bracketCode', code)
      setTimeout(() => router.push('/'), 2000)
    } else {
      setErrorMessage('Something went wrong, try again')
    }
    setIsSubmitting(false)
    setShowImageWarning(false)
  }

  const updateContestant = (index: number, field: 'name' | 'image_url', value: string) => {
    const newContestants = [...contestants]
    newContestants[index][field] = value
    setContestants(newContestants)
  }

  const checkBracketCode = async () => {
    if (!bracketCode) return
    const response = await fetch(`/api/unique/${bracketCode}`)
    const { unique } = await response.json()
    if (!unique) {
      setErrorMessage('Bracket Code already taken, pick another')
    } else {
      setErrorMessage('')
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 transition-all duration-300">
        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white text-center mb-6">
          Create a New Bracket
        </h1>

        {successMessage && (
          <div className="mb-4 p-3 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-lg shadow">
            {successMessage}
          </div>
        )}

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
            placeholder="Subtitle"
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
                Public Bracket (Pick your Code)
              </span>
            </label>
            {isPublic && (
              <input
                type="text"
                value={bracketCode}
                onChange={e => setBracketCode(e.target.value)}
                onBlur={checkBracketCode}
                placeholder="Bracket Code"
                className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition"
              />
            )}
          </div>
          
          {errorMessage && (
            <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-lg shadow">
              {errorMessage}
            </div>
          )}

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
                      placeholder="Name"
                      maxLength={20}
                      className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition"
                    />
                  </div>
                  <div>
                    <input
                      id={`image-${index}`}
                      type="text"
                      value={contestant.image_url}
                      onChange={(e) => updateContestant(index, "image_url", e.target.value)}
                      placeholder="Image URL (optional)"
                      className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 transition"
                    />
                  </div>
                </div>
              </fieldset>
            ))}
          </div>

          {showImageWarning && (
            <div className="mb-4 p-4 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded-lg shadow">
              <p className="mb-2">Some image URLs are missing. They’re optional but recommended. Proceed anyway?</p>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowImageWarning(false)}
                  className="px-4 py-2 bg-gray-300 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-400 dark:hover:bg-gray-600 transition"
                >
                  Nope
                </button>
                <button
                  type="button"
                  onClick={submitBracket}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Yup!
                </button>
              </div>
            </div>
          )}

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
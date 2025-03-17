import { useState } from 'react'
import { useRouter } from 'next/router'

export default function NewBracket() {
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [contestants, setContestants] = useState(
    Array.from({ length: 16 }, () => ({ name: '', image_url: '' }))
  )
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const response = await fetch('/api/create-bracket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, subtitle, contestants })
    })
    if (response.ok) {
      const { code } = await response.json()
      alert(`Bracket created with code: ${code}`)
      localStorage.setItem('bracketCode', code)
      router.push('/')
    } else {
      alert('Error creating bracket')
    }
  }

  const updateContestant = (index: number, field: 'name' | 'image_url', value: string) => {
    const newContestants = [...contestants]
    newContestants[index][field] = value
    setContestants(newContestants)
  }

  return (
    <div style={{ padding: '20px' }}>
      <h1>Create New Bracket</h1>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Title"
          style={{ padding: '5px' }}
        />
        <input
          type="text"
          value={subtitle}
          onChange={e => setSubtitle(e.target.value)}
          placeholder="Subtitle"
          style={{ padding: '5px' }}
        />
        {contestants.map((contestant: { name: string, image_url: string }, index: number) => (
          <div key={index} style={{ display: 'flex', gap: '10px' }}>
            <input
              type="text"
              value={contestant.name}
              onChange={e => updateContestant(index, 'name', e.target.value)}
              placeholder={`Contestant ${index + 1} Name`}
              style={{ padding: '5px', flex: 1 }}
            />
            <input
              type="text"
              value={contestant.image_url}
              onChange={e => updateContestant(index, 'image_url', e.target.value)}
              placeholder={`Image URL`}
              style={{ padding: '5px', flex: 1 }}
            />
          </div>
        ))}
        <button type="submit">Create Bracket</button>
      </form>
    </div>
  )
}
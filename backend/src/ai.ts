import AI from 'openai'
import { zodResponseFormat } from 'openai/helpers/zod'
import { config } from './config'
import z from 'zod'

export class AiUnavailableError extends Error {
  status: number
  constructor(message: string, status = 503) {
    super(message)
    this.name = 'AiUnavailableError'
    this.status = status
  }
}

export const getContestants = async (topic: string) => {
  // If in development mode, return a static list of pizza flavors
  if (config.dev) {
    return [
      'Pepperoni',
      'Cheese',
      'Hawaiian',
      'Meat Lovers',
      'Veggie',
      'BBQ Chicken',
      'Buffalo Chicken',
      'Margherita',
      'Sausage',
      'Mushroom',
      'Supreme',
      'Pineapple',
      'White',
      'Peppers',
      'Onions',
      'Olives'
    ]
  }

  // Fail closed in production when OpenAI is not configured.
  if (!config.aiUrl || !config.aiKey || !config.aiModel) {
    throw new AiUnavailableError(
      'AI is not configured (OPENAI_API_KEY / OPENAI_URL / OPENAI_MODEL).',
      503
    )
  }

  const ai = new AI({
    baseURL: config.aiUrl,
    apiKey: config.aiKey
  })

  const system = `
This is a Tournament Bracket game, and the input you will receive is the topic for which the contestants should be part of.
This game is meant to spark friendly debates and discussions, and the contestants are meant to be compared and voted on.

You should provide a list of 16 contestants, no more and no less, that are relevant to the topic, and the list should be in the form of a JSON string array.
No other format is acceptable. No other information is needed. Contestants should always be 20 characters or less.
`

  const user = `My topic is: ${topic}. Suggest 16 contestants that are relevant to this topic.`

  const schema = z.array(z.string().max(20))

  const params: AI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
    messages: [
      { role: 'system',
        content: system },
      { role: 'user',
        content: user }
    ],
    model: config.aiModel,
    stream: false,
    response_format: zodResponseFormat(schema, 'summary')
  }

  const response = JSON.parse(
    (await ai.chat.completions.create(params)).choices[0].message.content || '[]'
  ) as string[]

  return response
}

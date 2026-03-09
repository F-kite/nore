import { Mistral } from '@mistralai/mistralai'

let client: Mistral | null = null

function getClient(): Mistral {
  if (!client) {
    const apiKey = process.env.MISTRAL_API_KEY
    if (!apiKey) throw new Error('MISTRAL_API_KEY is not set')
    client = new Mistral({ apiKey })
  }
  return client
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const mistral = getClient()
  const response = await mistral.embeddings.create({
    inputs: [text],
    model: 'mistral-embed'
  })
  return response.data[0].embedding!
}

export async function generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  const mistral = getClient()
  const response = await mistral.embeddings.create({
    inputs: texts,
    model: 'mistral-embed'
  })
  return response.data.map((item) => item.embedding!)
}
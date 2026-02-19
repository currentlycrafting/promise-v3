// llm.js — replaces gemini_client.py
// Runs entirely in the browser via RunAnywhere Web SDK (no API key needed)

import { RunAnywhere } from '@runanywhere/web'
import { LlamaCPP, TextGeneration } from '@runanywhere/web-llamacpp'
import { LlamaCppBridge } from '@runanywhere/web-llamacpp/dist/Foundation/LlamaCppBridge'

let initialized = false

export async function initLLM(modelUrl = '/models/model.gguf', modelId = 'promise-model') {
  if (initialized) return

  await RunAnywhere.initialize({ environment: 'development', debug: true })
  await LlamaCPP.register()

  // Fetch model file via HTTP and write to Emscripten virtual FS
  console.log('[Promise LLM] Fetching model from', modelUrl)
  const response = await fetch(modelUrl)
  if (!response.ok) throw new Error(`Failed to fetch model: ${response.status}`)
  const data = new Uint8Array(await response.arrayBuffer())
  console.log(`[Promise LLM] Model fetched (${(data.length / 1024 / 1024).toFixed(1)} MB), writing to WASM FS`)

  const bridge = LlamaCppBridge.shared
  const wasmPath = `/models/${modelId}.gguf`
  bridge.writeFile(wasmPath, data)

  await TextGeneration.loadModel(wasmPath, modelId)
  console.log('[Promise LLM] Model loaded successfully')
  initialized = true
}

// ── Mirrors: refine_promise() in gemini_client.py ───────────────────────────
export async function refinePromise(promise, reason, category) {
  const prompt = `You are helping a user reframe a missed promise.

Original Promise: "${promise}"
Reason for missing: ${reason}
Failure Category: ${category}

Generate THREE distinct solutions to help this person succeed:

1. Conservative Solution:
- Revised promise: I promise I will ...

2. Moderate Solution:
- Revised promise: I promise I will ...

3. Progressive Solution:
- Revised promise: I promise I will ...

Rules:
- Keep the core intent of the original promise
- Be specific and actionable
- Address the ${category} issue directly
- Write the revised promise as a single short sentence starting with: I promise I will
- Output plain text only: no quotes, no markdown, no code blocks
- Sound friendly and human`

  const result = await TextGeneration.generate(prompt, { maxTokens: 400, temperature: 0.7 })
  return result.text
}

// ── Mirrors: generate_updated_promise() in gemini_client.py ─────────────────
export async function generateUpdatedPromise(promise, reason, category, solutionLabel) {
  const prompt = `You are updating a missed promise after the user picked a solution.

Original Promise: ${promise}
Reason for missing: ${reason}
Failure Category: ${category}
Selected Solution: ${solutionLabel}

Return ONLY these 3 lines with no extra text:
Name: <short name, 2-6 words>
Promise: I promise I will <one short sentence>
Deadline: <duration like 30m, 1h 15m, or 2h>

Rules:
- Keep the core intent of the original promise
- Be specific and actionable
- Output plain text only: no quotes, no markdown, no code blocks
- Sound friendly and human`

  const result = await TextGeneration.generate(prompt, { maxTokens: 150, temperature: 0.3 })
  return result.text
}

// ── Mirrors: format_new_promise() in gemini_client.py ───────────────────────
export async function formatNewPromise(rawText) {
  const prompt = `You are helping format a new promise.

Raw input: ${rawText}

Return ONLY these 3 lines with no extra text:
Name: <short name, 2-6 words>
Type: <self|others|world>
Promise: I promise I will <one short sentence>

Rules:
- Keep the core intent of the raw input
- Promise must start with: I promise I will
- Output plain text only: no quotes, no markdown, no code blocks
- Sound friendly and human`

  const result = await TextGeneration.generate(prompt, { maxTokens: 100, temperature: 0.3 })
  return result.text
}

// ── Parser helpers (mirrors parse_create / parse_update in app.py) ───────────
export function parseCreate(text) {
  const lines = (text || '').split('\n')
  let name = '', type = 'self', promise = ''
  for (const line of lines) {
    const l = line.trim()
    if (l.toLowerCase().startsWith('name:'))    name    = l.split(':')[1].trim()
    if (l.toLowerCase().startsWith('type:'))    type    = l.split(':')[1].trim().toLowerCase()
    if (l.toLowerCase().startsWith('promise:')) promise = l.split(':').slice(1).join(':').trim()
  }
  return { name, type, promise }
}

export function parseUpdate(text) {
  const lines = (text || '').split('\n')
  let name = '', promise = '', deadline = ''
  for (const line of lines) {
    const l = line.trim()
    if (l.toLowerCase().startsWith('name:'))     name     = l.split(':')[1].trim()
    if (l.toLowerCase().startsWith('promise:'))  promise  = l.split(':').slice(1).join(':').trim()
    if (l.toLowerCase().startsWith('deadline:')) deadline = l.split(':')[1].trim()
  }
  return { name, promise, deadline }
}

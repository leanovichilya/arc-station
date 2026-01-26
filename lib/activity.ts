import type { ActivityEvent } from "@/shared/types"
import { validateActivityEvent } from "@/shared/validate"

const STORAGE_KEY = "arc-station-activity"

function normalizeEvents(input: unknown): ActivityEvent[] {
  if (!Array.isArray(input)) return []
  const valid: ActivityEvent[] = []
  for (const item of input) {
    const result = validateActivityEvent(item)
    if (result.ok) {
      valid.push(item as ActivityEvent)
    }
  }
  return valid
}

export function listEvents(): ActivityEvent[] {
  if (typeof window === "undefined") return []
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    const valid = normalizeEvents(parsed)
    if (Array.isArray(parsed) && valid.length !== parsed.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(valid))
    }
    return valid
  } catch {
    return []
  }
}

export function addEvent(event: ActivityEvent) {
  if (typeof window === "undefined") return
  const result = validateActivityEvent(event)
  if (!result.ok) return
  const next = [event, ...listEvents()]
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
}

export function clearEvents() {
  if (typeof window === "undefined") return
  localStorage.removeItem(STORAGE_KEY)
}

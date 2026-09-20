import { useEffect, useRef, useState } from 'react'
import type { PositionEval } from './analysis.ts'
import { Engine } from './engine.ts'

// ponytail: profondeur fixe ; passer à `go movetime` si certaines positions sont trop lentes.
const DEPTH = 14

type Status = 'loading' | 'ready' | 'error'

/**
 * Analyse les positions dans le worker Stockfish, une par une, avec un cache par FEN.
 * Priorité : les positions de `focus` (affichée + précédente, y compris en variante), puis la partie dans l'ordre.
 * Une fois tout analysé, la boucle dort jusqu'à ce que `focus` demande une position inconnue.
 */
export function useAnalysis(fens: string[], focus: string[]) {
  const [cache, setCache] = useState<ReadonlyMap<string, PositionEval>>(() => new Map())
  const [status, setStatus] = useState<Status>('loading')
  const [error, setError] = useState('')
  const focusRef = useRef(focus)
  const wakeRef = useRef<() => void>(undefined)
  // Clé stable : `focus` est un nouveau tableau à chaque rendu.
  const focusKey = focus.join('\n')

  useEffect(() => {
    focusRef.current = focusKey.split('\n')
    wakeRef.current?.()
  }, [focusKey])

  useEffect(() => {
    const engine = new Engine()
    const done = new Map<string, PositionEval>()
    let cancelled = false

    ;(async () => {
      try {
        await engine.init()
        while (!cancelled) {
          const fen = focusRef.current.find((f) => !done.has(f)) ?? fens.find((f) => !done.has(f))
          if (fen === undefined) {
            await new Promise<void>((resolve) => (wakeRef.current = resolve))
            continue
          }
          done.set(fen, await engine.analyze(fen, DEPTH))
          if (cancelled) break
          setCache(new Map(done))
          setStatus('ready')
        }
      } catch (e) {
        if (cancelled) return
        setError((e as Error).message)
        setStatus('error')
      }
    })()

    // terminate() rejette la recherche en cours ; `cancelled` empêche d'afficher cette erreur.
    return () => {
      cancelled = true
      wakeRef.current?.()
      engine.terminate()
    }
  }, [fens])

  return { cache, status, error }
}

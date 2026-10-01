import { useState, type FormEvent } from 'react'
import AnalysisView from './AnalysisView.tsx'
import Entete from './Entete.tsx'
import Pied from './Pied.tsx'
import { SAMPLE_PGN, parseGame, type Game } from './analysis.ts'

// Boutons en pastille, comme sur le reste de la famille (mono, majuscules espacées).
const pastille = 'rounded-full px-5 py-3 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors'

export default function App() {
  const [pgn, setPgn] = useState('')
  const [error, setError] = useState('')
  const [game, setGame] = useState<Game | null>(null)

  if (game) {
    return (
      <>
        <Entete />
        <AnalysisView game={game} onBack={() => setGame(null)} />
        <Pied />
      </>
    )
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    try {
      setGame(parseGame(pgn))
      setError('')
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <>
      <Entete />
      <main className="mx-auto flex min-h-[calc(100dvh-3.5rem)] max-w-2xl flex-col justify-center gap-6 p-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold uppercase tracking-tight">Analyse de partie</h1>
          <p className="mt-2 text-encre-douce">Collez le PGN d'une partie : Stockfish l'analyse directement dans votre navigateur.</p>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label htmlFor="pgn" className="sr-only">PGN de la partie</label>
          <textarea
            id="pgn"
            value={pgn}
            onChange={(e) => setPgn(e.target.value)}
            maxLength={200_000}
            rows={14}
            spellCheck={false}
            placeholder={'[Event "…"]\n\n1. e4 e5 2. Nf3 Nc6 …'}
            aria-invalid={!!error}
            aria-describedby={error ? 'pgn-error' : undefined}
            className="w-full resize-y rounded-sm border border-filet-fort bg-papier-2 p-4 font-mono text-sm outline-none focus:border-accent"
          />
          {error && <p id="pgn-error" className="text-sm text-red-400">{error}</p>}
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={!pgn.trim()}
              className={`${pastille} bg-accent text-papier hover:bg-accent-fort disabled:opacity-40`}
            >
              Analyser la partie
            </button>
            <button
              type="button"
              onClick={() => setPgn(SAMPLE_PGN)}
              className={`${pastille} border border-filet-fort hover:bg-encre hover:text-papier`}
            >
              Charger un exemple
            </button>
          </div>
        </form>
      </main>
      <Pied />
    </>
  )
}

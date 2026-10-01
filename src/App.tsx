import { useState, type FormEvent } from 'react'
import AnalysisView from './AnalysisView.tsx'
import Pied from './Pied.tsx'
import { SAMPLE_PGN, parseGame, type Game } from './analysis.ts'

export default function App() {
  const [pgn, setPgn] = useState('')
  const [error, setError] = useState('')
  const [game, setGame] = useState<Game | null>(null)

  if (game) {
    return (
      <>
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
      <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-6 p-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analyse de partie</h1>
          <p className="mt-1 text-zinc-400">Collez le PGN d'une partie : Stockfish l'analyse directement dans votre navigateur.</p>
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
            className="w-full resize-y rounded-xl border border-zinc-800 bg-zinc-900 p-4 font-mono text-sm outline-none focus:border-emerald-500"
          />
          {error && <p id="pgn-error" className="text-sm text-red-400">{error}</p>}
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={!pgn.trim()}
              className="rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-zinc-950 hover:bg-emerald-400 disabled:opacity-40"
            >
              Analyser la partie
            </button>
            <button type="button" onClick={() => setPgn(SAMPLE_PGN)} className="rounded-xl bg-zinc-800 px-5 py-3 hover:bg-zinc-700">
              Charger un exemple
            </button>
          </div>
        </form>
      </main>
      <Pied />
    </>
  )
}

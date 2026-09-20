import type { Move } from 'chess.js'
import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import { Chessboard } from 'react-chessboard'
import { formatScore, labelFor, moveAccuracy, tryMove, uciToSan, whitePercent, type Game, type Label, type PositionEval } from './analysis.ts'
import { useAnalysis } from './useAnalysis.ts'

const LABELS: Record<Label, { sym: string; cls: string }> = {
  Brillant: { sym: '!!', cls: 'bg-cyan-400 text-zinc-950' },
  Bon: { sym: '✓', cls: 'bg-emerald-500 text-zinc-950' },
  Imprécision: { sym: '?!', cls: 'bg-yellow-400 text-zinc-950' },
  Erreur: { sym: '?', cls: 'bg-orange-500 text-zinc-950' },
  Gaffe: { sym: '??', cls: 'bg-red-500 text-white' },
}
const LABEL_ORDER = Object.keys(LABELS) as Label[]

function Badge({ label }: { label: Label }) {
  return (
    <span title={label} className={`inline-grid h-5 min-w-5 place-items-center rounded px-1 text-[11px] font-bold ${LABELS[label].cls}`}>
      <span aria-hidden="true">{LABELS[label].sym}</span>
      <span className="sr-only">{label}</span>
    </span>
  )
}

function EvalBar({ score, flipped }: { score: number | undefined; flipped: boolean }) {
  const pct = score === undefined ? 50 : whitePercent(score)
  const text = score === undefined ? '…' : formatScore(score)
  const whiteAhead = (score ?? 0) >= 0
  return (
    <div
      role="meter"
      aria-label="Évaluation"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      aria-valuetext={text}
      className={`relative flex w-6 shrink-0 overflow-hidden rounded bg-zinc-800 sm:w-8 ${flipped ? 'flex-col' : 'flex-col-reverse'}`}
    >
      <div className="bg-zinc-100 transition-[height] duration-500 ease-out" style={{ height: `${pct}%` }} />
      <span
        className={`absolute inset-x-0 text-center text-[10px] font-semibold sm:text-xs ${
          whiteAhead !== flipped ? 'bottom-1' : 'top-1'
        } ${whiteAhead ? 'text-zinc-900' : 'text-zinc-100'}`}
      >
        {text}
      </span>
    </div>
  )
}

function Summary({ game, evals, labels }: { game: Game; evals: (PositionEval | undefined)[]; labels: (Label | null)[] }) {
  const sides = (['w', 'b'] as const).map((color) => {
    const idx = game.moves.flatMap((m, i) => (m.color === color && labels[i] ? [i] : []))
    const acc = idx.length
      ? idx.reduce((sum, i) => sum + moveAccuracy(evals[i]!.score, evals[i + 1]!.score, color === 'w'), 0) / idx.length
      : null
    return {
      color,
      name: (color === 'w' ? game.headers.White : game.headers.Black) ?? (color === 'w' ? 'Blancs' : 'Noirs'),
      acc,
      counts: LABEL_ORDER.map((l) => [l, idx.filter((i) => labels[i] === l).length] as const),
    }
  })
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">Résumé par joueur</caption>
      <thead>
        <tr className="text-xs text-zinc-500">
          <th scope="col" className="pb-1 text-left font-normal">Joueur</th>
          <th scope="col" className="pb-1 font-normal">Précision</th>
          {LABEL_ORDER.map((l) => (
            <th key={l} scope="col" className="pb-1">
              <Badge label={l} />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sides.map((s) => (
          <tr key={s.color}>
            <th scope="row" className="max-w-32 truncate py-0.5 text-left font-medium">
              <span aria-hidden="true" className={`mr-1.5 inline-block h-2.5 w-2.5 rounded-full ${s.color === 'w' ? 'bg-zinc-100' : 'bg-zinc-600'}`} />
              {s.name}
            </th>
            <td className="text-center tabular-nums">{s.acc === null ? '…' : `${s.acc.toFixed(1)} %`}</td>
            {s.counts.map(([l, n]) => (
              <td key={l} className={`text-center tabular-nums ${n ? '' : 'text-zinc-600'}`}>
                {n}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

const moveNo = (m: Move) => `${m.before.split(' ')[5]}${m.color === 'w' ? '.' : '...'}`

export default function AnalysisView({ game, onBack }: { game: Game; onBack: () => void }) {
  const [ply, setPly] = useState(0)
  // Variante jouée à la main depuis la position `ply` de la partie ; vide = on suit la partie.
  const [line, setLine] = useState<Move[]>([])
  const [flipped, setFlipped] = useState(false)
  const last = game.fens.length - 1

  const shownMove = line.at(-1) ?? (ply > 0 ? game.moves[ply - 1] : null)
  const shownFen = shownMove?.after ?? game.fens[0]
  const prevFen = shownMove?.before
  const { cache, status, error } = useAnalysis(game.fens, prevFen ? [shownFen, prevFen] : [shownFen])

  const evals = useMemo(() => game.fens.map((f) => cache.get(f)), [game, cache])
  const labels = useMemo(() => game.moves.map((m, i) => labelFor(m, evals[i], evals[i + 1])), [game, evals])

  const clamp = (p: number) => Math.max(0, Math.min(last, p))
  const go = (p: number) => {
    setLine([])
    setPly(clamp(p))
  }
  // Mises à jour fonctionnelles : plusieurs touches peuvent arriver avant le rendu suivant.
  const back = () => (line.length ? setLine((l) => l.slice(0, -1)) : setPly((p) => clamp(p - 1)))
  const forward = () => {
    if (!line.length) setPly((p) => clamp(p + 1))
  }

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    const actions: Record<string, () => void> = { ArrowLeft: back, ArrowRight: forward, Home: () => go(0), End: () => go(last) }
    const action = actions[e.key]
    if (!action) return
    e.preventDefault()
    action()
  })
  useEffect(() => {
    const handler = (e: KeyboardEvent) => onKey(e)
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const onDrop = ({ sourceSquare, targetSquare }: { sourceSquare: string; targetSquare: string | null }) => {
    const m = targetSquare ? tryMove(shownFen, sourceSquare, targetSquare) : null
    if (!m) return false
    // Rejouer le coup de la partie revient simplement à avancer.
    if (!line.length && m.lan === game.moves[ply]?.lan) go(ply + 1)
    else setLine([...line, m])
    return true
  }

  const listRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLButtonElement>(null)
  // Pas de scrollIntoView : il fait aussi défiler la page (sur mobile, la liste est sous l'échiquier).
  // On ne fait défiler que la liste ; sur mobile elle n'a pas de hauteur max, donc rien ne bouge.
  useEffect(() => {
    const list = listRef.current
    const el = activeRef.current
    if (!list || !el) return
    if (el.offsetTop < list.scrollTop) list.scrollTop = el.offsetTop
    else if (el.offsetTop + el.offsetHeight > list.scrollTop + list.clientHeight)
      list.scrollTop = el.offsetTop + el.offsetHeight - list.clientHeight
  }, [ply])

  if (status === 'loading') {
    return (
      <main className="grid min-h-dvh place-items-center p-4">
        <div className="flex flex-col items-center gap-4 text-zinc-400" role="status">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-zinc-700 border-t-emerald-400" />
          <p>Initialisation de Stockfish et analyse de la position initiale…</p>
        </div>
      </main>
    )
  }

  if (status === 'error') {
    return (
      <main className="grid min-h-dvh place-items-center p-4">
        <div className="max-w-md space-y-4 text-center">
          <p className="text-red-400">{error}</p>
          <button onClick={onBack} className="rounded-lg bg-zinc-800 px-4 py-2 hover:bg-zinc-700">
            Retour
          </button>
        </div>
      </main>
    )
  }

  const current = cache.get(shownFen)
  const prev = prevFen ? cache.get(prevFen) : undefined
  const label = line.length ? labelFor(shownMove!, prev, current) : ply > 0 ? labels[ply - 1] : null
  // Pendant que la position affichée se calcule, la barre garde la dernière éval connue.
  const barScore = current?.score ?? prev?.score ?? evals.slice(0, ply + 1).findLast(Boolean)?.score
  const analyzed = evals.filter(Boolean).length

  const highlight = shownMove
    ? { [shownMove.from]: { background: 'rgba(250, 204, 21, .35)' }, [shownMove.to]: { background: 'rgba(250, 204, 21, .45)' } }
    : {}
  const arrows = current?.best
    ? [{ startSquare: current.best.slice(0, 2), endSquare: current.best.slice(2, 4), color: 'rgba(16, 185, 129, .8)' }]
    : []

  // Lignes de l'historique : la partie peut commencer par un coup noir (PGN avec [FEN]).
  const offset = game.moves[0].color === 'b' ? 1 : 0
  const cells: (number | null)[] = [...Array(offset).fill(null), ...game.moves.map((_, i) => i)]
  const rows = Array.from({ length: Math.ceil(cells.length / 2) }, (_, r) => cells.slice(r * 2, r * 2 + 2))
  const h = game.headers

  const navBtn = 'rounded-lg bg-zinc-800 py-2 text-lg hover:bg-zinc-700 disabled:opacity-40'

  return (
    <main className="mx-auto max-w-6xl p-4">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold">
            {h.White ?? 'Blancs'} {h.WhiteElo && <span className="text-zinc-500">({h.WhiteElo})</span>} –{' '}
            {h.Black ?? 'Noirs'} {h.BlackElo && <span className="text-zinc-500">({h.BlackElo})</span>}
          </h1>
          <p className="text-sm text-zinc-500">
            {[h.Event, h.Date, h.Result].filter((x) => x && x !== '?' && !x.startsWith('????')).join(' · ')}
          </p>
        </div>
        <button onClick={onBack} className="rounded-lg bg-zinc-800 px-3 py-2 text-sm hover:bg-zinc-700">
          Nouvelle partie
        </button>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,560px)_1fr]">
        {/* Zone de jeu */}
        <section className="flex gap-2">
          <EvalBar score={barScore} flipped={flipped} />
          <div className="aspect-square min-w-0 flex-1">
            <Chessboard
              options={{
                id: 'analysis',
                position: shownFen,
                boardOrientation: flipped ? 'black' : 'white',
                onPieceDrop: onDrop,
                arrows,
                squareStyles: highlight,
                animationDurationInMs: 150,
              }}
            />
          </div>
        </section>

        {/* Analyse et contrôles */}
        <section className="flex min-h-0 flex-col gap-4 lg:max-h-[calc(100dvh-7rem)]">
          <div className="space-y-2 rounded-xl bg-zinc-900 p-4" aria-live="polite">
            {shownMove ? (
              <>
                <div className="flex items-center gap-2">
                  {label ? (
                    // Le libellé est déjà écrit juste à côté.
                    <span aria-hidden="true">
                      <Badge label={label} />
                    </span>
                  ) : null}
                  <span className="font-semibold">{label ?? 'Analyse du coup en cours…'}</span>
                </div>
                <p className="text-sm">
                  Coup joué : <b>{moveNo(shownMove)} {shownMove.san}</b>
                  <span className="mx-2 text-zinc-600">|</span>
                  Meilleur coup possible : <b>{prev?.best ? uciToSan(prevFen!, prev.best) : '…'}</b>
                </p>
              </>
            ) : (
              <p className="font-semibold">Position initiale</p>
            )}
            <p className="text-sm text-zinc-400">
              Évaluation : <b className="text-zinc-100">{current ? formatScore(current.score) : '…'}</b>
              {current?.best && (
                <>
                  <span className="mx-2 text-zinc-600">·</span>
                  Suggestion ici : <b className="text-emerald-400">{uciToSan(shownFen, current.best)}</b>
                </>
              )}
            </p>
          </div>

          {line.length > 0 && (
            <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-3 text-sm">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="font-semibold text-sky-300">Variante</span>
                <button onClick={() => setLine([])} className="rounded px-2 py-0.5 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100">
                  Revenir à la partie ✕
                </button>
              </div>
              <p className="flex flex-wrap gap-x-1">
                {line.map((m, i) => (
                  // La variante ne fait que s'allonger ou se tronquer : l'index est une identité stable.
                  <button
                    key={i}
                    onClick={() => setLine(line.slice(0, i + 1))}
                    aria-current={i === line.length - 1 ? 'step' : undefined}
                    className={`rounded px-1 ${i === line.length - 1 ? 'bg-sky-500/20 text-sky-200' : 'hover:bg-zinc-800'}`}
                  >
                    {m.color === 'w' || i === 0 ? `${moveNo(m)} ` : ''}
                    {m.san}
                  </button>
                ))}
              </p>
            </div>
          )}

          <div className="grid grid-cols-5 gap-2">
            <button className={navBtn} onClick={() => go(0)} disabled={ply === 0 && !line.length} aria-label="Début">⏮</button>
            <button className={navBtn} onClick={back} disabled={ply === 0 && !line.length} aria-label="Coup précédent">◀</button>
            <button className={navBtn} onClick={forward} disabled={ply === last || line.length > 0} aria-label="Coup suivant">▶</button>
            <button className={navBtn} onClick={() => go(last)} disabled={ply === last && !line.length} aria-label="Fin">⏭</button>
            <button className={navBtn} onClick={() => setFlipped((f) => !f)} aria-label="Retourner l'échiquier">⇅</button>
          </div>

          {/* relative : sert de référence aux offsetTop des coups */}
          <div ref={listRef} className="relative min-h-48 flex-1 overflow-y-auto rounded-xl bg-zinc-900 p-2">
            <ol className="grid grid-cols-[2.5rem_1fr_1fr] gap-x-1 text-sm">
              {rows.map((row, r) => (
                <li key={r} className="contents">
                  <span className="py-1 pr-1 text-right text-zinc-500">{moveNo(game.moves[(row[0] ?? row[1])!]).replace(/\.+$/, '.')}</span>
                  {row.map((i, c) =>
                    i === null ? (
                      <span key={c} className="px-2 py-1 text-zinc-600">…</span>
                    ) : (
                      <button
                        key={c}
                        ref={ply === i + 1 ? activeRef : undefined}
                        onClick={() => go(i + 1)}
                        aria-current={ply === i + 1 && !line.length ? 'step' : undefined}
                        className={`flex items-center justify-between gap-1 rounded px-2 py-1 text-left ${
                          ply === i + 1 ? (line.length ? 'ring-1 ring-sky-500/50' : 'bg-emerald-500/20 text-emerald-200') : 'hover:bg-zinc-800'
                        }`}
                      >
                        <span>{game.moves[i].san}</span>
                        {labels[i] ? <Badge label={labels[i]} /> : <span className="text-xs text-zinc-600">·</span>}
                      </button>
                    ),
                  )}
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-xl bg-zinc-900 p-3">
            <Summary game={game} evals={evals} labels={labels} />
          </div>

          <p className="text-xs text-zinc-500">
            {analyzed < game.fens.length
              ? `Analyse Stockfish : ${analyzed}/${game.fens.length} positions (profondeur 14)`
              : `Analyse terminée · ← → pour naviguer · glissez une pièce pour explorer une variante`}
          </p>
        </section>
      </div>
    </main>
  )
}

import type { Move } from 'chess.js'
import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import { Chessboard } from 'react-chessboard'
import { formatScore, labelFor, moveAccuracy, tryMove, uciToSan, whitePercent, type Game, type Label, type PositionEval } from './analysis.ts'
import { useAnalysis } from './useAnalysis.ts'

// Les symboles d'annotation des livres d'échecs, écrits à l'encre : bleu pour les bons coups, rouge pour les fautes.
const LABELS: Record<Label, { sym: string; cls: string }> = {
  Brillant: { sym: '!!', cls: 'text-accent' },
  Bon: { sym: '!', cls: 'text-accent' },
  Imprécision: { sym: '?!', cls: 'text-[#9a5b00]' },
  Erreur: { sym: '?', cls: 'text-rouge' },
  Gaffe: { sym: '??', cls: 'text-rouge' },
}
const LABEL_ORDER = Object.keys(LABELS) as Label[]

function Badge({ label }: { label: Label }) {
  return (
    <span title={label} className={`inline-grid h-5 min-w-5 place-items-center px-0.5 font-sans text-[15px] font-black ${LABELS[label].cls}`}>
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
      className={`relative flex w-6 shrink-0 overflow-hidden border-2 border-encre bg-encre sm:w-8 ${flipped ? 'flex-col' : 'flex-col-reverse'}`}
    >
      <div className="bg-papier-2 transition-[height] duration-500 ease-out" style={{ height: `${pct}%` }} />
      <span
        className={`absolute inset-x-0 text-center text-[11px] font-semibold sm:text-xs ${
          whiteAhead !== flipped ? 'bottom-1' : 'top-1'
        } ${whiteAhead ? 'text-encre' : 'text-white'}`}
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
        <tr className="text-xs text-encre-douce">
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
              <span aria-hidden="true" className={`mr-1.5 inline-block h-2.5 w-2.5 rounded-full ${s.color === 'w' ? 'bg-encre' : 'bg-encre-faible'}`} />
              {s.name}
            </th>
            <td className="text-center tabular-nums">{s.acc === null ? '…' : `${s.acc.toFixed(1)} %`}</td>
            {s.counts.map(([l, n]) => (
              <td key={l} className={`text-center tabular-nums ${n ? '' : 'text-encre-douce'}`}>
                {n}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}


// Icônes de navigation dessinées (trait de 2 px), à la place des caractères Unicode.
function Icone({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}
const ICO = {
  debut: 'M6 5v14M18 6l-7 6 7 6',
  prec: 'M15 6l-6 6 6 6',
  suiv: 'M9 6l6 6-6 6',
  fin: 'M18 5v14M6 6l7 6-7 6',
  retourner: 'M7 4v16M4 7l3-3 3 3M17 20V4M14 17l3 3 3-3',
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
      <main className="grid min-h-[calc(100dvh-3.5rem)] place-items-center p-4">
        <div className="flex flex-col items-center gap-4 text-encre-douce" role="status">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-filet-fort border-t-accent" />
          <p>Initialisation de Stockfish et analyse de la position initiale…</p>
        </div>
      </main>
    )
  }

  if (status === 'error') {
    return (
      <main className="grid min-h-[calc(100dvh-3.5rem)] place-items-center p-4">
        <div className="max-w-md space-y-4 text-center">
          <p className="text-rouge">{error}</p>
          <button onClick={onBack} className="rounded-md border-2 border-encre bg-papier-2 px-5 py-3 text-[0.9375rem] font-semibold hover:bg-encre hover:text-white">
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
    ? { [shownMove.from]: { background: 'rgba(43, 58, 143, .18)' }, [shownMove.to]: { background: 'rgba(43, 58, 143, .3)' } }
    : {}
  const arrows = current?.best
    ? [{ startSquare: current.best.slice(0, 2), endSquare: current.best.slice(2, 4), color: 'rgba(43, 58, 143, .85)' }]
    : []

  // Lignes de l'historique : la partie peut commencer par un coup noir (PGN avec [FEN]).
  const offset = game.moves[0].color === 'b' ? 1 : 0
  const cells: (number | null)[] = [...Array(offset).fill(null), ...game.moves.map((_, i) => i)]
  const rows = Array.from({ length: Math.ceil(cells.length / 2) }, (_, r) => cells.slice(r * 2, r * 2 + 2))
  const h = game.headers

  const navBtn =
    'grid place-items-center rounded-md border-2 border-encre bg-papier-2 py-2 transition-colors hover:bg-encre hover:text-white active:scale-[0.97] disabled:opacity-40 disabled:hover:bg-papier-2 disabled:hover:text-encre'

  return (
    <main className="mx-auto max-w-6xl p-4">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-extrabold tracking-tight">
            {h.White ?? 'Blancs'} {h.WhiteElo && <span className="text-encre-douce">({h.WhiteElo})</span>} –{' '}
            {h.Black ?? 'Noirs'} {h.BlackElo && <span className="text-encre-douce">({h.BlackElo})</span>}
          </h1>
          <p className="text-sm text-encre-douce">
            {[h.Event, h.Date, h.Result].filter((x) => x && x !== '?' && !x.startsWith('????')).join(', ')}
          </p>
        </div>
        <button onClick={onBack} className="rounded-md border-2 border-encre bg-papier-2 px-4 py-2.5 text-[0.9375rem] font-semibold transition-colors hover:bg-encre hover:text-white">
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
                lightSquareStyle: { backgroundColor: '#f4f6f8' },
                darkSquareStyle: { backgroundColor: '#9aa6b8' },
                boardStyle: { borderRadius: '2px' },
              }}
            />
          </div>
        </section>

        {/* Analyse et contrôles */}
        <section className="flex min-h-0 flex-col gap-4 lg:max-h-[calc(100dvh-10.5rem)]">
          <div className="space-y-2 rounded-md border-2 border-encre bg-papier-2 p-4" aria-live="polite">
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
                  <span className="mx-2 text-encre-faible">|</span>
                  Meilleur coup possible : <b>{prev?.best ? uciToSan(prevFen!, prev.best) : '…'}</b>
                </p>
              </>
            ) : (
              <p className="font-semibold">Position initiale</p>
            )}
            <p className="text-sm text-encre-douce">
              Évaluation : <b className="text-encre">{current ? formatScore(current.score) : '…'}</b>
              {current?.best && (
                <>
                  <span className="mx-2 text-encre-faible">|</span>
                  Suggestion ici : <b className="text-accent">{uciToSan(shownFen, current.best)}</b>
                </>
              )}
            </p>
          </div>

          {line.length > 0 && (
            <div className="rounded-md border-2 border-sky-700/40 bg-sky-50 p-3 text-sm">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="font-semibold text-sky-800">Variante</span>
                <button onClick={() => setLine([])} className="rounded px-2 py-1 text-xs text-encre-douce hover:bg-papier-3 hover:text-encre">
                  Revenir à la partie
                </button>
              </div>
              <p className="flex flex-wrap gap-x-1">
                {line.map((m, i) => (
                  // La variante ne fait que s'allonger ou se tronquer : l'index est une identité stable.
                  <button
                    key={i}
                    onClick={() => setLine(line.slice(0, i + 1))}
                    aria-current={i === line.length - 1 ? 'step' : undefined}
                    className={`rounded px-1 py-0.5 ${i === line.length - 1 ? 'bg-sky-100 text-sky-900' : 'hover:bg-papier-3'}`}
                  >
                    {m.color === 'w' || i === 0 ? `${moveNo(m)} ` : ''}
                    {m.san}
                  </button>
                ))}
              </p>
            </div>
          )}

          <div className="grid grid-cols-5 gap-2">
            <button className={navBtn} onClick={() => go(0)} disabled={ply === 0 && !line.length} aria-label="Début"><Icone d={ICO.debut} /></button>
            <button className={navBtn} onClick={back} disabled={ply === 0 && !line.length} aria-label="Coup précédent"><Icone d={ICO.prec} /></button>
            <button className={navBtn} onClick={forward} disabled={ply === last || line.length > 0} aria-label="Coup suivant"><Icone d={ICO.suiv} /></button>
            <button className={navBtn} onClick={() => go(last)} disabled={ply === last && !line.length} aria-label="Fin"><Icone d={ICO.fin} /></button>
            <button className={navBtn} onClick={() => setFlipped((f) => !f)} aria-label="Retourner l'échiquier"><Icone d={ICO.retourner} /></button>
          </div>

          {/* relative : sert de référence aux offsetTop des coups */}
          <div ref={listRef} className="relative min-h-48 flex-1 overflow-y-auto rounded-md border-2 border-encre bg-papier-2 px-3 pb-2">
            {/* La feuille de notation : en-tête Blancs / Noirs, lignes réglées, coups au stylo bleu. */}
            <div aria-hidden="true" className="sticky top-0 grid grid-cols-[2.5rem_1fr_1fr] gap-x-1 border-b-2 border-encre bg-papier-2 pb-1.5 pt-2.5 text-xs font-semibold text-encre-douce">
              <span />
              <span className="px-2">Blancs</span>
              <span className="px-2">Noirs</span>
            </div>
            <ol className="grid grid-cols-[2.5rem_1fr_1fr] gap-x-1 text-sm">
              {rows.map((row, r) => (
                <li key={r} className="contents">
                  <span className="border-b border-ligne py-1.5 pr-1 text-right text-encre-douce">{moveNo(game.moves[(row[0] ?? row[1])!]).replace(/\.+$/, '.')}</span>
                  {row.map((i, c) =>
                    i === null ? (
                      <span key={c} className="border-b border-ligne px-2 py-1 text-encre-faible">…</span>
                    ) : (
                      <button
                        key={c}
                        ref={ply === i + 1 ? activeRef : undefined}
                        onClick={() => go(i + 1)}
                        aria-current={ply === i + 1 && !line.length ? 'step' : undefined}
                        className={`flex items-center justify-between gap-1 border-b border-ligne px-2 py-0.5 text-left font-plume text-[1.6rem] leading-tight ${
                          labels[i] === 'Gaffe' || labels[i] === 'Erreur' ? 'text-rouge' : 'text-accent'
                        } ${ply === i + 1 ? (line.length ? 'bg-sky-100' : 'bg-[#e3e8ff]') : 'hover:bg-papier-3'}`}
                      >
                        <span>{game.moves[i].san}</span>
                        {labels[i] && labels[i] !== 'Bon' ? <Badge label={labels[i]} /> : null}
                      </button>
                    ),
                  )}
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-md border-2 border-encre bg-papier-2 p-3">
            <Summary game={game} evals={evals} labels={labels} />
          </div>

          <p className="text-xs text-encre-douce">
            {analyzed < game.fens.length
              ? `Analyse Stockfish : ${analyzed}/${game.fens.length} positions (profondeur 14)`
              : `Analyse terminée. Flèches du clavier pour naviguer, glissez une pièce pour explorer une variante.`}
          </p>
        </section>
      </div>
    </main>
  )
}

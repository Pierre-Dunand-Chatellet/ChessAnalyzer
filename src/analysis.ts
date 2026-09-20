import { Chess, type Move, type PieceSymbol } from 'chess.js'

/** Score en centipions, du point de vue des Blancs. Un mat en n est encodé ±(MATE - n). */
export const MATE = 100_000

export type Label = 'Brillant' | 'Bon' | 'Imprécision' | 'Erreur' | 'Gaffe'

export interface PositionEval {
  score: number
  best: string | null // coup UCI (ex. "e2e4"), null si la partie est terminée
}

export interface Game {
  headers: Record<string, string>
  moves: Move[]
  fens: string[] // fens[0] = position initiale, fens[i] = position après le coup i
}

// ~3 min d'analyse à profondeur 14 ; au-delà la partie est presque sûrement un collage erroné.
export const MAX_PLIES = 600

export function parseGame(pgn: string): Game {
  const chess = new Chess()
  try {
    chess.loadPgn(pgn)
  } catch (e) {
    throw new Error(`PGN invalide : ${(e as Error).message}`)
  }
  const moves = chess.history({ verbose: true })
  if (moves.length === 0) throw new Error('La partie ne contient aucun coup.')
  if (moves.length > MAX_PLIES) throw new Error(`Partie trop longue (${moves.length} demi-coups, maximum ${MAX_PLIES}).`)
  return { headers: chess.getHeaders(), moves, fens: [moves[0].before, ...moves.map((m) => m.after)] }
}

/** Extrait le score d'une ligne UCI "info … score cp|mate N …" (point de vue du trait) et le ramène aux Blancs. */
export function parseScore(line: string, whiteToMove: boolean): number | null {
  const m = / score (cp|mate) (-?\d+)/.exec(line)
  if (!m || / (lower|upper)bound/.test(line)) return null
  const n = Number(m[2])
  // mate 0 = le camp au trait est mat
  const stm = m[1] === 'cp' ? n : n > 0 ? MATE - n : -MATE - n
  return whiteToMove ? stm : -stm
}

const isMate = (v: number) => Math.abs(v) > MATE - 1000

export function formatScore(v: number): string {
  if (isMate(v)) {
    const d = MATE - Math.abs(v)
    return d === 0 ? '#' : `${v < 0 ? '-' : ''}M${d}`
  }
  return `${v > 0 ? '+' : ''}${(v / 100).toFixed(1)}`
}

/** Part de la barre revenant aux Blancs (0-100), courbe logistique type lichess. */
export function whitePercent(v: number): number {
  if (isMate(v)) return v > 0 ? 100 : 0
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * v)) - 1)
}

const clamp = (v: number) => Math.max(-1000, Math.min(1000, v))

/**
 * Perte = éval avant le coup (meilleure ligne) − éval après le coup joué, côté du joueur.
 * Clamp à ±10 pions : passer de +15 à +9 ou de M3 à M5 ne doit pas compter comme une gaffe.
 */
export function classify(before: number, after: number, whiteMoved: boolean, isBest: boolean, sacrifice: boolean): Label {
  const sign = whiteMoved ? 1 : -1
  if (isBest) return sacrifice && sign * after > -100 ? 'Brillant' : 'Bon'
  const loss = sign * (clamp(before) - clamp(after))
  if (loss < 50) return 'Bon'
  if (loss < 100) return 'Imprécision'
  if (loss < 300) return 'Erreur'
  return 'Gaffe'
}

/** Classe un coup à partir des évals avant/après ; null tant que l'une des deux manque. */
export function labelFor(m: Move, before?: PositionEval, after?: PositionEval): Label | null {
  if (!before || !after) return null
  const isBest = before.best === m.lan
  // isSacrifice construit un échiquier : on ne l'appelle que quand ça peut changer le résultat.
  return classify(before.score, after.score, m.color === 'w', isBest, isBest && isSacrifice(m))
}

/** Précision d'un coup (0-100) d'après la chute de probabilité de gain, formule lichess. */
export function moveAccuracy(before: number, after: number, whiteMoved: boolean): number {
  const wp = (v: number) => (whiteMoved ? whitePercent(v) : 100 - whitePercent(v))
  const drop = Math.max(0, wp(before) - wp(after))
  return Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * drop) - 3.1669))
}

// ponytail: promotion toujours en dame ; ajouter un choix de pièce si le besoin apparaît.
export function tryMove(fen: string, from: string, to: string): Move | null {
  try {
    return new Chess(fen).move({ from, to, promotion: 'q' })
  } catch {
    return null
  }
}

const VALUE: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 }

// ponytail: échange statique à un coup (pièce prise par le plus petit attaquant, une seule reprise),
// pas un vrai SEE ; suffisant pour repérer les sacrifices évidents.
export function isSacrifice(m: Move): boolean {
  const piece = m.promotion ?? m.piece
  if (piece === 'p' || piece === 'k') return false
  const board = new Chess(m.after)
  const attackers = board.attackers(m.to, m.color === 'w' ? 'b' : 'w')
  if (attackers.length === 0) return false
  const defended = board.attackers(m.to, m.color).length > 0
  const cheapest = Math.min(...attackers.map((sq) => VALUE[board.get(sq)!.type]))
  const lost = defended ? VALUE[piece] - cheapest : VALUE[piece]
  return lost - (m.captured ? VALUE[m.captured] : 0) >= 1
}

export function uciToSan(fen: string, uci: string): string {
  try {
    return new Chess(fen).move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san
  } catch {
    return uci
  }
}

export const SAMPLE_PGN = `[Event "Paris Opera"]
[Site "Paris FRA"]
[Date "1858.??.??"]
[White "Paul Morphy"]
[Black "Duke Karl / Count Isouard"]
[Result "1-0"]

1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7
8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7
14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0`

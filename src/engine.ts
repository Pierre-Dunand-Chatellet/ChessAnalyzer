import { parseScore, type PositionEval } from './analysis.ts'

// Copié depuis node_modules par scripts/copy-engine.mjs ; le .wasm est cherché à côté du .js.
const ENGINE_URL = `${import.meta.env.BASE_URL}stockfish/stockfish-19-lite-single.js`
const INIT_TIMEOUT_MS = 15_000
// Large exprès : une recherche en profondeur fixe peut être lente sur une petite machine.
const SEARCH_TIMEOUT_MS = 60_000

interface Waiter {
  onLine: (line: string) => void
  fail: (e: Error) => void
}

/**
 * Stockfish.js est lui-même un script de Web Worker : le calcul tourne hors du thread UI,
 * on lui parle en UCI par postMessage. Une seule recherche à la fois.
 */
export class Engine {
  private worker = new Worker(ENGINE_URL)
  private waiters = new Set<Waiter>()
  private busy = false

  constructor() {
    this.worker.onmessage = (e: MessageEvent) => {
      if (typeof e.data === 'string') for (const w of [...this.waiters]) w.onLine(e.data)
    }
    this.worker.onerror = (e) => this.failAll(`Stockfish a planté${e.message ? ` : ${e.message}` : '.'}`)
    this.worker.onmessageerror = () => this.failAll('Message illisible reçu de Stockfish.')
  }

  private failAll(message: string) {
    const err = new Error(message)
    for (const w of [...this.waiters]) w.fail(err)
  }

  /** Attend la première ligne pour laquelle `handle` renvoie autre chose que undefined, ou échoue après `ms`. */
  private wait<T>(handle: (line: string) => T | undefined, ms: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => w.fail(new Error('Stockfish ne répond pas.')), ms)
      const w: Waiter = {
        onLine: (line) => {
          const r = handle(line)
          if (r === undefined) return
          clearTimeout(timer)
          this.waiters.delete(w)
          resolve(r)
        },
        fail: (e) => {
          clearTimeout(timer)
          this.waiters.delete(w)
          reject(e)
        },
      }
      this.waiters.add(w)
    })
  }

  private send(cmd: string) {
    this.worker.postMessage(cmd)
  }

  async init() {
    const uciok = this.wait((l) => (l === 'uciok' ? true : undefined), INIT_TIMEOUT_MS)
    this.send('uci')
    await uciok
    // parseScore lit toutes les lignes "info … score" : il faut une seule variante principale.
    this.send('setoption name MultiPV value 1')
    const readyok = this.wait((l) => (l === 'readyok' ? true : undefined), INIT_TIMEOUT_MS)
    this.send('isready')
    await readyok
  }

  analyze(fen: string, depth: number): Promise<PositionEval> {
    // Deux recherches simultanées se partageraient les mêmes lignes "info"/"bestmove".
    if (this.busy) return Promise.reject(new Error('Une analyse est déjà en cours.'))
    this.busy = true
    const whiteToMove = fen.split(' ')[1] === 'w'
    let score = 0
    const result = this.wait<PositionEval>((line) => {
      const s = parseScore(line, whiteToMove)
      if (s !== null) score = s
      if (!line.startsWith('bestmove')) return undefined
      const best = line.split(' ')[1]
      return { score, best: best && best !== '(none)' ? best : null }
    }, SEARCH_TIMEOUT_MS)
    this.send(`position fen ${fen}`)
    this.send(`go depth ${depth}`)
    return result.finally(() => {
      this.busy = false
    })
  }

  terminate() {
    this.worker.terminate()
    this.failAll('Stockfish arrêté.')
  }
}

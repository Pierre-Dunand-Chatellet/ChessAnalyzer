// Copie le moteur Stockfish (worker + wasm + licence GPL) dans public/ pour qu'il soit servi tel quel.
import { copyFileSync, mkdirSync } from 'node:fs'

const src = 'node_modules/stockfish'
const dest = 'public/stockfish'
mkdirSync(dest, { recursive: true })
for (const f of ['stockfish-19-lite-single.js', 'stockfish-19-lite-single.wasm']) copyFileSync(`${src}/bin/${f}`, `${dest}/${f}`)
copyFileSync(`${src}/Copying.txt`, `${dest}/COPYING.txt`)

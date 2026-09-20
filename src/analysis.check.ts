// Vérification rapide de la logique pure : `npm run check`
import assert from 'node:assert/strict'
import {
  MATE,
  MAX_PLIES,
  SAMPLE_PGN,
  classify,
  formatScore,
  isSacrifice,
  labelFor,
  moveAccuracy,
  parseGame,
  parseScore,
  tryMove,
  uciToSan,
  whitePercent,
} from './analysis.ts'

// Scores UCI (point de vue du trait) -> point de vue des Blancs
assert.equal(parseScore('info depth 10 score cp 35 nodes 1 pv e2e4', true), 35)
assert.equal(parseScore('info depth 10 score cp 35 nodes 1 pv e2e4', false), -35)
assert.equal(parseScore('info depth 9 score mate 3 pv a1a8', false), -(MATE - 3))
assert.equal(parseScore('info depth 0 score mate 0', true), -MATE)
assert.equal(parseScore('info depth 5 score cp 10 lowerbound', true), null)
assert.equal(parseScore('info string NNUE enabled', true), null)

assert.equal(formatScore(134), '+1.3')
assert.equal(formatScore(-(MATE - 3)), '-M3')
assert.equal(formatScore(MATE), '#')
assert.equal(whitePercent(0), 50)
assert.equal(whitePercent(MATE - 2), 100)

// Classification (perte côté joueur)
assert.equal(classify(30, 20, true, false, false), 'Bon')
assert.equal(classify(30, -40, true, false, false), 'Imprécision')
assert.equal(classify(30, -150, true, false, false), 'Erreur')
assert.equal(classify(30, -400, true, false, false), 'Gaffe')
assert.equal(classify(-30, 300, false, false, false), 'Gaffe')
assert.equal(classify(MATE - 3, MATE - 5, true, false, false), 'Bon')
assert.equal(classify(50, 60, true, true, true), 'Brillant')
assert.equal(classify(50, -500, true, true, true), 'Bon')

// PGN
const g = parseGame(SAMPLE_PGN)
assert.equal(g.moves.length, 33)
assert.equal(g.fens.length, 34)
assert.equal(g.headers.White, 'Paul Morphy')
assert.equal(uciToSan(g.fens[0], 'g1f3'), 'Nf3')
assert.equal(isSacrifice(g.moves[0]), false) // 1. e4
assert.equal(isSacrifice(g.moves[18]), true) // 10. Nxb5
assert.equal(isSacrifice(g.moves[30]), true) // 16. Qb8+
assert.throws(() => parseGame('1. e4 e5 2. Ke3'), /PGN invalide/)
assert.throws(() => parseGame('[Event "x"]\n\n*'), /aucun coup/)
const shuffle = Array.from({ length: MAX_PLIES / 2 + 1 }, (_, i) => `${i + 1}. ${i % 2 ? 'Ng1 Ng8' : 'Nf3 Nf6'}`).join(' ')
assert.throws(() => parseGame(shuffle), /trop longue/)

// Variantes (glisser-déposer)
assert.equal(tryMove(g.fens[0], 'e2', 'e4')?.san, 'e4')
assert.equal(tryMove(g.fens[0], 'e2', 'e5'), null)
assert.equal(tryMove('8/P7/8/8/8/8/8/k6K w - - 0 1', 'a7', 'a8')?.san, 'a8=Q+')

// labelFor : le coup de la partie égal au meilleur coup moteur -> Bon (ou Brillant si sacrifice)
assert.equal(labelFor(g.moves[0], undefined, { score: 30, best: null }), null)
assert.equal(labelFor(g.moves[0], { score: 30, best: 'e2e4' }, { score: 25, best: 'e7e5' }), 'Bon')
assert.equal(labelFor(g.moves[18], { score: 200, best: 'c3b5' }, { score: 250, best: 'c6b5' }), 'Brillant')
assert.equal(labelFor(g.moves[1], { score: 30, best: 'c7c5' }, { score: 400, best: 'g1f3' }), 'Gaffe')

// Précision : coup parfait ~100, grosse gaffe basse, symétrique pour les Noirs
assert.ok(moveAccuracy(0, 0, true) > 99)
assert.ok(moveAccuracy(0, -500, true) < 30)
assert.ok(Math.abs(moveAccuracy(0, -500, true) - moveAccuracy(0, 500, false)) < 1e-9)
assert.ok(moveAccuracy(0, 300, true) > 99) // gagner de l'éval ne coûte rien

console.log('analysis.check : OK')

# Analyse de partie d'échecs

Application web (SPA) qui analyse une partie d'échecs à partir de son PGN, entièrement dans le navigateur :
pas de serveur, pas de compte, pas de base de données.

- Collez un PGN : Stockfish 19 (WebAssembly, dans un Web Worker) évalue chaque position à profondeur 14.
- Barre d'évaluation, flèche du meilleur coup, historique avec classification des coups
  (Brillant, Bon, Imprécision, Erreur, Gaffe) et comparaison « coup joué / meilleur coup possible ».
- Glissez une pièce pour explorer une variante : elle est analysée et classée comme la partie.
- Résumé par joueur : précision (formule lichess) et nombre de coups par catégorie.
- Navigation : boutons, ← → Début Fin, clic dans l'historique.

## Stack

React 19 + TypeScript + Vite, Tailwind CSS 4, chess.js, react-chessboard, stockfish (lite single-thread, 1,7 Mo).

## Commandes

```bash
npm install      # copie aussi le moteur dans public/stockfish/ (scripts/copy-engine.mjs)
npm run dev      # serveur de développement
npm run check    # vérification de la logique pure (src/analysis.check.ts)
npm run lint     # oxlint (règles React, hooks, accessibilité)
npm run build    # typecheck + build dans dist/
```

## Organisation

| Fichier | Rôle |
|---|---|
| `src/analysis.ts` | Logique pure : PGN, scores UCI, classification, précision, sacrifices |
| `src/engine.ts` | Pont vers le worker Stockfish (UCI, timeouts, une recherche à la fois) |
| `src/useAnalysis.ts` | File d'analyse : position affichée d'abord, cache par FEN |
| `src/AnalysisView.tsx` | Écrans de chargement, d'erreur et d'analyse |
| `src/App.tsx` | Écran d'accueil (saisie du PGN) |
| `src/Entete.tsx`, `src/Pied.tsx` | Barre du haut (monogramme → portfolio) et pied de page (retour, mentions légales, licence de Stockfish) |
| `src/index.css` | Palette « nuit » du portfolio (tokens Tailwind `@theme`) et polices Syne, Geist, JetBrains Mono embarquées dans `src/fonts/` |

## Déploiement

`base: './'` dans `vite.config.ts` : le contenu de `dist/` fonctionne dans n'importe quel sous-dossier.
En ligne dans `/echecs/` (copie de déploiement : `E:\02_Dev\1#Serveur\echecs`).
`public/.htaccess` déclare le type MIME `application/wasm`.

## Licence du moteur

Stockfish est sous licence GPLv3 : le texte est livré avec le moteur (`public/stockfish/COPYING.txt`),
sources sur https://github.com/nmrugg/stockfish.js.

// Pied de page : retour au portfolio, mentions légales, et ce que la licence de Stockfish (GPL v3) exige
// de montrer à qui reçoit le moteur dans son navigateur : la licence et l'accès au code source.
const lien = 'inline-block py-1 underline underline-offset-4 hover:text-zinc-100'

export default function Pied() {
  return (
    <footer className="mx-auto flex max-w-6xl flex-wrap gap-x-6 gap-y-1 px-4 pb-8 pt-4 text-sm text-zinc-400">
      <a href="https://dunandchatellet.fr/" className={lien}>
        ← dunandchatellet.fr
      </a>
      <a href="https://dunandchatellet.fr/mentions-legales.html" className={lien}>
        Mentions légales
      </a>
      <span className="py-1">
        Moteur{' '}
        <a href="https://github.com/nmrugg/stockfish.js" className="underline underline-offset-4 hover:text-zinc-100">
          Stockfish
        </a>
        , sous{' '}
        <a href={`${import.meta.env.BASE_URL}stockfish/COPYING.txt`} className="underline underline-offset-4 hover:text-zinc-100">
          licence GPL v3
        </a>
      </span>
    </footer>
  )
}

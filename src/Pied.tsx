// Pied de page : rappel du portfolio, mentions légales, et ce que la licence de Stockfish (GPL v3) exige
// de montrer à qui reçoit le moteur dans son navigateur : la licence et l'accès au code source.
const lien = 'inline-block py-2 underline underline-offset-4 hover:text-encre'

export default function Pied() {
  return (
    <footer className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-0 px-4 pb-8 pt-4 text-sm text-encre-douce">
      <a href="https://dunandchatellet.fr/" className="inline-flex items-center gap-2 py-2 font-semibold text-encre underline underline-offset-4">
        <img src={`${import.meta.env.BASE_URL}marque-p.svg`} width={18} height={18} alt="" />
        Un projet de Pierre Dunand-Chatellet
      </a>
      <a href="https://dunandchatellet.fr/mentions-legales.html" className={lien}>
        Mentions légales
      </a>
      <span className="py-2">
        Moteur{' '}
        <a href="https://github.com/nmrugg/stockfish.js" className="underline underline-offset-4 hover:text-encre">
          Stockfish
        </a>
        , sous{' '}
        <a href={`${import.meta.env.BASE_URL}stockfish/COPYING.txt`} className="underline underline-offset-4 hover:text-encre">
          licence GPL v3
        </a>
      </span>
    </footer>
  )
}

// Barre du haut commune aux deux écrans : le monogramme ramène au portfolio, comme sur le Simulateur.
export default function Entete() {
  return (
    <header className="flex h-14 items-center gap-3.5 border-b-2 border-encre px-4 sm:px-6">
      <a
        href="https://dunandchatellet.fr/"
        aria-label="Pierre D—C., retour au portfolio"
        className="relative block leading-none after:absolute after:-inset-2"
      >
        <img src={`${import.meta.env.BASE_URL}marque.svg`} width={30} height={30} alt="" className="rounded-[7px]" />
      </a>
      <span className="font-display text-[13px] font-bold uppercase tracking-[0.14em]">Analyse d’échecs</span>
    </header>
  )
}

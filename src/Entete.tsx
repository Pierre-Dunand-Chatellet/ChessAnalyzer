// Barre du haut commune aux deux écrans : l'icône de l'analyseur et son nom. Le retour au portfolio est dans le pied de page.
export default function Entete() {
  return (
    <header className="flex h-14 items-center gap-3.5 border-b-2 border-encre px-4 sm:px-6">
      <img src={`${import.meta.env.BASE_URL}marque.svg`} width={30} height={30} alt="" className="rounded-[7px]" />
      <span className="font-display text-[13px] font-bold uppercase tracking-[0.14em]">Analyse d’échecs</span>
    </header>
  )
}

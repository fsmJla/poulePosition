// Liste gardée en mémoire d'un Durable Object (US-038). Le plan gratuit de Cloudflare compte chaque ligne PARCOURUE par
// une requête (5 M lignes lues par jour) : relire tout un tableau à chaque demande coûte autant de lignes que le tableau
// en a, et le tableau grossit. La liste n'est donc lue qu'une fois, puis servie depuis la mémoire jusqu'à la prochaine
// écriture. Un Durable Object traite ses requêtes l'une après l'autre : aucune écriture ne s'intercale entre une lecture
// et l'invalidation qui suit.

/** Ce que la base a rendu, et le nombre de lignes qu'elle a dû parcourir pour cela (`rowsRead`). */
export interface Lecture<T> {
  valeurs: T[];
  lignesLues: number;
}

export class ListeEnMemoire<T> {
  private valeurs: readonly T[] | null = null;

  /**
   * @param lire lecture complète de la base (appelée au premier accès, puis après chaque invalidation)
   * @param surRemplissage appelée à chaque lecture de la base avec le nombre de lignes parcourues (CA-4)
   */
  constructor(
    private readonly lire: () => Lecture<T>,
    private readonly surRemplissage?: (lignesLues: number) => void,
  ) {}

  /** La liste, lue dans la base seulement si elle n'est pas déjà en mémoire. */
  obtenir(): readonly T[] {
    if (this.valeurs === null) {
      const { valeurs, lignesLues } = this.lire();
      this.valeurs = valeurs;
      this.surRemplissage?.(lignesLues);
    }
    return this.valeurs;
  }

  /** Oublie la liste : la prochaine lecture relira la base (après une écriture qui change le tableau). */
  invalider(): void {
    this.valeurs = null;
  }

  /**
   * Met à jour la liste gardée à la suite d'une écriture, sans relire la base. Sans effet si elle n'est pas en mémoire :
   * la prochaine lecture partira de la base, qui contient déjà l'écriture.
   */
  modifier(transformer: (valeurs: readonly T[]) => readonly T[]): void {
    if (this.valeurs !== null) this.valeurs = transformer(this.valeurs);
  }
}

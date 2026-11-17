// Le lieu sur l'accueil public (US-079 CA-6, CA-9, CA-10) : la ville tirée de l'adresse, l'adresse écrite une seule
// fois (sauf un lieu différent) et le lien vers OpenStreetMap. Logique pure, sans réseau : le lien n'est qu'une adresse.

/** Coordonnées d'un lieu trouvé par la recherche d'adresse (US-070). */
export interface CoordonneesLieu {
  latitude: number;
  longitude: number;
}

const normaliser = (lieu: string) => lieu.trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * CA-6 : la ville d'une adresse trouvée par la recherche (« … 33600 Pessac » → « Pessac ») : le texte qui suit le code
 * postal à cinq chiffres. Null pour un lieu libre sans code postal, ou sans lieu.
 */
export function villeDeLieu(lieu: string | null | undefined): string | null {
  const trouve = lieu?.match(/\b\d{5}\s+(.+)$/);
  const ville = trouve?.[1]?.trim();
  return ville ? ville : null;
}

/**
 * CA-5 et CA-9 : le lieu à écrire pour un élément : le sien s'il diffère de celui de son parent (manifestation ou
 * compétition), sinon rien. La casse et les espaces ne comptent pas.
 */
export function lieuAEcrire(lieu: string | null | undefined, lieuParent: string | null | undefined): string | null {
  if (!lieu?.trim()) return null;
  return lieuParent && normaliser(lieu) === normaliser(lieuParent) ? null : lieu.trim();
}

/** Cas limite (compétition sans manifestation) : le lieu que partagent toutes les épreuves, sinon null. */
export function lieuCommun(lieux: readonly (string | null | undefined)[]): string | null {
  const [premier, ...autres] = lieux;
  if (!premier?.trim()) return null;
  return autres.every((lieu) => lieu?.trim() && normaliser(lieu) === normaliser(premier)) ? premier.trim() : null;
}

/**
 * CA-10 : le lien OpenStreetMap d'un lieu : centré sur ses coordonnées s'il en a, sinon une recherche de son adresse.
 */
export function lienOpenStreetMap(lieu: string, coordonnees?: CoordonneesLieu | null): string {
  if (coordonnees) {
    const { latitude, longitude } = coordonnees;
    return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`;
  }
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(lieu.trim())}`;
}

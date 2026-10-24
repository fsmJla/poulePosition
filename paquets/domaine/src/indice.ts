// Indice d'un tireur : touches données moins touches reçues (glossaire). Sert à départager au classement.

export interface Touches {
  touchesDonnees: number;
  touchesRecues: number;
}

/** @throws {RangeError} si un nombre de touches n'est pas un entier positif ou nul */
export function calculerIndice({ touchesDonnees, touchesRecues }: Touches): number {
  for (const touches of [touchesDonnees, touchesRecues]) {
    if (!Number.isInteger(touches) || touches < 0) throw new RangeError(`Nombre de touches invalide : ${touches}`);
  }
  return touchesDonnees - touchesRecues;
}

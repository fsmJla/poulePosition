// US-160 : ce que le pilote ajoute à la vue en direct, hors du journal : le nom de la compétition et l'affiche (celle de
// l'épreuve, sinon de sa compétition, sinon de sa manifestation, CA-4 de US-073). Lu dans les copies gardées sur ce PC,
// sans réseau : la vue se publie souvent.
import type { ComplementDirect, Epreuve } from '@poule-position/domaine';
import type { Competition, FichierJoint } from '@poule-position/protocole';
import { fichiersEffectifs } from './fichiers';

export async function complementDirect(
  epreuve: Pick<Epreuve, 'id' | 'rattachement'>,
  sources: {
    competitions: () => Promise<{ competitions: readonly Competition[] } | null>;
    fichiers: () => Promise<readonly FichierJoint[]>;
  },
): Promise<ComplementDirect> {
  const [copie, fichiers] = await Promise.all([sources.competitions(), sources.fichiers()]);
  const competition = copie?.competitions.find(({ id }) => id === epreuve.rattachement.competitionId) ?? null;
  const { affiche } = fichiersEffectifs(fichiers, [
    { proprietaire: 'epreuve', id: epreuve.id },
    { proprietaire: 'competition', id: competition?.id },
    { proprietaire: 'manifestation', id: competition?.manifestationId },
  ]);
  return { competition: competition?.nom ?? null, affiche: affiche?.nom ?? null };
}

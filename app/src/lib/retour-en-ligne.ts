// US-130 : résumé de la resynchronisation au retour du réseau. Quand le PC pilote perd la connexion (pastille « Hors
// ligne », US-094), on note pour chaque épreuve pilotée le dernier seq confirmé par le serveur. Au retour, on attend que
// tout soit confirmé, en comptant les saisies des smartphones reçues entre-temps (la boîte du serveur, ADR-0005), puis
// on annonce le résumé, qui s'efface seul.
import type { Accuse } from '@poule-position/protocole';

/** Ce que le suivi lit des épreuves de cet appareil. */
export interface SourceRetour {
  /** Épreuves pilotées ici, avec leur dernier seq confirmé par le serveur. */
  confirmes(): Promise<Map<string, number>>;
  /** Nombre total de modifications pas encore confirmées, toutes épreuves pilotées confondues. */
  enAttente(): Promise<number>;
}

export interface ResumeRetour {
  envoyees: number;
  recuperees: number;
  ecartees: number;
}

/** Ce que la zone de statut affiche : rien, l'envoi en cours, ou le résumé. */
export type EtatRetour = { etape: 'aucun' } | { etape: 'envoi' } | ({ etape: 'resume' } & ResumeRetour);

export interface OptionsRetour {
  source: SourceRetour;
  /** Intervalle entre deux lectures du nombre en attente. */
  intervalle?: number;
  /** Délai minimal après le retour, le temps que la boîte du serveur soit livrée. */
  delaiBoite?: number;
  /** Au-delà, on renonce au résumé (session expirée, envoi bloqué) : le message propre à ce cas suffit. */
  delaiMax?: number;
  /** Durée d'affichage du résumé (CA-1 : 8 s). */
  dureeResume?: number;
  minuteur?: {
    attendre: (ms: number) => Promise<void>;
    maintenant: () => number;
  };
}

const MINUTEUR = {
  attendre: (ms: number) => new Promise<void>((resoudre) => setTimeout(resoudre, ms)),
  maintenant: () => Date.now(),
};

/** CA-2 : une saisie récupérée mais écartée, le match ayant déjà un score (le papier fait foi). */
const estEcartee = (accuse: Accuse) => accuse.decision === 'refuse' && accuse.motif === 'MATCH_DEJA_SAISI';

export function creerSuiviRetour({
  source,
  intervalle = 500,
  delaiBoite = 2_000,
  delaiMax = 60_000,
  dureeResume = 8_000,
  minuteur = MINUTEUR,
}: OptionsRetour) {
  let etat: EtatRetour = { etape: 'aucun' };
  const ecouteurs = new Set<(etat: EtatRetour) => void>();
  /** Seq confirmés au moment de la coupure ; null hors coupure. */
  let avantCoupure: Map<string, number> | null = null;
  /** Numéro du retour en cours : un nouveau changement d'état annule le précédent. */
  let tour = 0;
  let recuperees = 0;
  let ecartees = 0;
  let collecte = false;

  const changer = (nouvel: EtatRetour) => {
    etat = nouvel;
    ecouteurs.forEach((ecouteur) => ecouteur(etat));
  };

  async function coupure() {
    tour++;
    collecte = false;
    changer({ etape: 'aucun' });
    // Une seconde coupure pendant un retour garde les seq d'avant la première : rien n'avait été confirmé depuis.
    if (!avantCoupure) avantCoupure = await source.confirmes().catch(() => new Map());
  }

  async function retour() {
    const monTour = ++tour;
    const avant = avantCoupure;
    if (!avant) return;
    recuperees = 0;
    ecartees = 0;
    collecte = true;
    const debut = minuteur.maintenant();
    changer({ etape: 'envoi' });
    for (;;) {
      await minuteur.attendre(intervalle);
      if (monTour !== tour) return;
      const ecoule = minuteur.maintenant() - debut;
      const restant = await source.enAttente().catch(() => 1);
      if (monTour !== tour) return;
      if (restant === 0 && ecoule >= delaiBoite) break;
      if (ecoule >= delaiMax) {
        collecte = false;
        avantCoupure = null;
        changer({ etape: 'aucun' });
        return;
      }
    }
    collecte = false;
    avantCoupure = null;
    const apres = await source.confirmes().catch(() => new Map<string, number>());
    if (monTour !== tour) return;
    // Une épreuve qui n'est plus pilotée ici (prise de main) : son message propre remplace le résumé (US-029).
    if ([...avant.keys()].some((epreuveId) => !apres.has(epreuveId))) {
      changer({ etape: 'aucun' });
      return;
    }
    let envoyees = 0;
    for (const [epreuveId, confirme] of apres) envoyees += Math.max(0, confirme - (avant.get(epreuveId) ?? 0));
    changer({ etape: 'resume', envoyees, recuperees, ecartees });
    await minuteur.attendre(dureeResume);
    if (monTour === tour) changer({ etape: 'aucun' });
  }

  return {
    /** Branché sur la pastille hors ligne du pilote (US-094). */
    surHorsLigne(horsLigne: boolean): Promise<void> {
      return horsLigne ? coupure() : retour();
    },
    /** Branché sur chaque saisie de smartphone décidée par ce PC. */
    saisieTraitee(accuse: Accuse) {
      if (!collecte) return;
      if (accuse.decision === 'accepte') recuperees++;
      else if (estEcartee(accuse)) ecartees++;
    },
    surEtat(ecouteur: (etat: EtatRetour) => void): () => void {
      ecouteurs.add(ecouteur);
      return () => ecouteurs.delete(ecouteur);
    },
    etat: () => etat,
  };
}

export type SuiviRetour = ReturnType<typeof creerSuiviRetour>;

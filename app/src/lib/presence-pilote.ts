// Présence du pilote (US-094, ADR-0028) : ce PC garde une WebSocket ouverte pour chaque épreuve qu'il pilote et qui
// se tire aujourd'hui ; le serveur sait ainsi s'il est connecté. Hors ligne, rien ne s'arrête : la compétition continue
// sur ce PC et la socket se rouvre d'elle-même au retour du réseau. Quand un autre PC prend la main, le serveur ferme la
// socket (`4004`) et la perte de main est traitée aussitôt.
import type { SaisieScore, VueSaisie } from '@poule-position/domaine';
import { FERMETURES, messageAccuse, messageVue, type Accuse } from '@poule-position/protocole';
import { demarrerConnexion, urlConnexion, type Adresse, type EtatConnexion, type SocketMinimale } from './connexion';
import type { PerteDeMain } from './synchronisation';

/** Ce que la présence demande à la synchronisation (permet une fausse synchronisation dans les tests). */
export interface SynchronisationPresence {
  epreuvesAPresence(): Promise<string[]>;
  demanderTicket(
    epreuveId: string,
  ): Promise<{ ok: true; ticket: string } | { ok: false; erreur: string } | { ok: false; perte: PerteDeMain }>;
  perteSignalee(epreuveId: string): Promise<PerteDeMain | null>;
}

export interface OptionsPresence {
  /** Adresse WebSocket du serveur (`VITE_URL_SERVEUR`) ; absente si le serveur n'est pas configuré. */
  urlServeur: string | undefined;
  synchronisation: SynchronisationPresence;
  creerSocket?: (url: string) => SocketMinimale;
  /** Intervalle entre deux revues de la liste des épreuves (locale, sans réseau). */
  intervalle?: number;
  /** US-095 : vue de saisie actuelle d'une épreuve, calculée à partir du journal local ; null si elle est inconnue. */
  vueDe?: (epreuveId: string) => Promise<VueSaisie | null>;
  /** US-099 : la table traite une saisie reçue d'un smartphone et renvoie son accusé. */
  surSaisie?: (epreuveId: string, saisie: SaisieScore) => Promise<Accuse>;
}

/** Revue de la liste des épreuves à présence : locale, sans requête. */
export const INTERVALLE_REVUE = 10_000;

/** Erreurs après lesquelles il ne sert à rien de redemander un ticket. */
const SANS_RETOUR = ['EPREUVE_SUPPRIMEE', 'ACCES_REFUSE'];

export function creerPresencePilote({
  urlServeur,
  synchronisation,
  creerSocket,
  intervalle = INTERVALLE_REVUE,
  vueDe = async () => null,
  surSaisie,
}: OptionsPresence) {
  const connexions = new Map<
    string,
    { arreter: () => void; relancer: () => void; envoyer: (texte: string) => boolean; etat: EtatConnexion }
  >();
  /** US-095 : dernière vue envoyée par épreuve ; une vue identique n'est pas renvoyée (une écriture de moins au serveur). */
  const publiees = new Map<string, string>();
  /** US-100 CA-1 : smartphones connectés, par épreuve (dit par le serveur). */
  const appareils = new Map<string, number>();
  const ecouteursAppareils = new Set<(epreuveId: string, connectes: number) => void>();
  const ecouteurs = new Set<(horsLigne: boolean) => void>();
  let horsLigne = false;

  const signaler = () => {
    const maintenant = [...connexions.values()].some(({ etat }) => etat === 'injoignable');
    if (maintenant === horsLigne) return;
    horsLigne = maintenant;
    ecouteurs.forEach((ecouteur) => ecouteur(horsLigne));
  };

  const arreter = (epreuveId: string) => {
    connexions.get(epreuveId)?.arreter();
    connexions.delete(epreuveId);
    publiees.delete(epreuveId);
    signaler();
  };

  /** US-095 CA-1 : publie la vue de saisie de l'épreuve sur sa WebSocket, si elle a changé depuis le dernier envoi. */
  async function publier(epreuveId: string): Promise<void> {
    const connexion = connexions.get(epreuveId);
    if (!connexion) return;
    const vue = await vueDe(epreuveId);
    if (!vue) return;
    const texte = messageVue(vue);
    if (publiees.get(epreuveId) === texte) return;
    if (connexion.envoyer(texte)) publiees.set(epreuveId, texte);
  }

  function ouvrir(epreuveId: string) {
    const base = urlConnexion(urlServeur, epreuveId);
    const adresse = async (): Promise<Adresse> => {
      const reponse = await synchronisation.demanderTicket(epreuveId);
      if (reponse.ok) return { url: `${base}?ticket=${encodeURIComponent(reponse.ticket)}` };
      if ('perte' in reponse || SANS_RETOUR.includes(reponse.erreur)) {
        // Plus le pilote (la perte est déjà traitée) ou épreuve supprimée : la socket n'a plus lieu d'être.
        queueMicrotask(() => arreter(epreuveId));
        return { arreter: true };
      }
      return { attendre: true };
    };
    const connexion = {
      arreter: () => {},
      relancer: () => {},
      envoyer: (() => false) as (texte: string) => boolean,
      etat: 'connexion' as EtatConnexion,
    };
    connexions.set(epreuveId, connexion);
    const {
      arreter: fermer,
      relancer,
      envoyer,
    } = demarrerConnexion({
      adresse: base ? adresse : null,
      creerSocket,
      surEtat: (etat) => {
        connexion.etat = etat;
        signaler();
      },
      // US-099 CA-5 à CA-7 : une saisie d'un téléphone, décidée par ce PC ; l'accusé repart au téléphone.
      surMessage: (message) => {
        if (message.type === 'appareils') {
          appareils.set(epreuveId, message.connectes);
          ecouteursAppareils.forEach((ecouteur) => ecouteur(epreuveId, message.connectes));
          return;
        }
        if (message.type !== 'saisie' || !surSaisie) return;
        void surSaisie(epreuveId, message.saisie).then((accuse) =>
          connexion.envoyer(messageAccuse(accuse, message.saisie.appareilId)),
        );
      },
      // US-095 CA-3 : à chaque (re)connexion, la vue complète est republiée.
      surConnecte: () => {
        publiees.delete(epreuveId);
        void publier(epreuveId);
      },
      surFin: (code) => {
        arreter(epreuveId);
        // Main prise (4004), ou plus le pilote à l'ouverture (4003) : le serveur désigne un autre appareil.
        if (code === FERMETURES.MAIN_PRISE || code === FERMETURES.EXCLUE) void synchronisation.perteSignalee(epreuveId);
      },
    });
    connexion.arreter = fermer;
    connexion.relancer = relancer;
    connexion.envoyer = envoyer;
  }

  /** Ouvre les sockets des épreuves devenues concernées, ferme celles qui ne le sont plus. */
  async function actualiser(): Promise<void> {
    const voulues = new Set(await synchronisation.epreuvesAPresence());
    for (const epreuveId of [...connexions.keys()]) if (!voulues.has(epreuveId)) arreter(epreuveId);
    for (const epreuveId of voulues) if (!connexions.has(epreuveId)) ouvrir(epreuveId);
  }

  return {
    actualiser,

    publier,

    /** US-100 CA-1 : nombre de smartphones connectés à l'épreuve, ou null s'il n'est pas connu (hors ligne). */
    appareils: (epreuveId: string): number | null =>
      connexions.get(epreuveId)?.etat === 'connecte' ? (appareils.get(epreuveId) ?? 0) : null,

    surAppareils(ecouteur: (epreuveId: string, connectes: number) => void): () => void {
      ecouteursAppareils.add(ecouteur);
      return () => ecouteursAppareils.delete(ecouteur);
    },

    /** CA-3 : vrai quand une épreuve pilotée ici n'a plus sa connexion au serveur (« la compétition continue »). */
    horsLigne: () => horsLigne,

    surEtat(ecouteur: (horsLigne: boolean) => void): () => void {
      ecouteurs.add(ecouteur);
      return () => ecouteurs.delete(ecouteur);
    },

    /**
     * Démarre la présence et la tient à jour ; renvoie de quoi tout arrêter. Quand le navigateur annonce une coupure
     * (`offline`), les sockets sont abandonnées sans attendre deux pongs manqués ; au retour (`online`), elles se
     * rouvrent aussitôt.
     */
    surveiller(cible: EventTarget = window): () => void {
      const relancerTout = () => connexions.forEach(({ relancer }) => relancer());
      cible.addEventListener('offline', relancerTout);
      cible.addEventListener('online', relancerTout);
      void actualiser();
      const minuteur = setInterval(() => void actualiser(), intervalle);
      return () => {
        clearInterval(minuteur);
        cible.removeEventListener('offline', relancerTout);
        cible.removeEventListener('online', relancerTout);
        for (const epreuveId of [...connexions.keys()]) arreter(epreuveId);
      };
    },
  };
}

export type PresencePilote = ReturnType<typeof creerPresencePilote>;

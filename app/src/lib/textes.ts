// Catalogue des textes de l'interface (français seul pour l'instant, ADR-0002). Aucun texte en dur dans les composants.
import {
  LONGUEUR_MIN_MOT_DE_PASSE,
  type Arme,
  type CouleurAvatar,
  type ErreurEpreuve,
  type ErreurCompetition,
  type ErreurManifestation,
  type ErreurNouveauMotDePasse,
  type Decompte,
  type RaisonRefus,
  type ErreurSaisieCompte,
  type Role,
  type Sexe,
  type Statut,
  type TypeEpreuve,
  type DocumentImprime,
  type RaisonIndisponible,
  type ErreurPistes,
} from '@poule-position/domaine';
import type { ErreurCompetitionSeule, ErreurCreation, ErreurModification } from './epreuves';
import type { EtatConnexion } from './connexion';
import type { IdEtapeEpreuve } from './etapes-epreuve';
import type { ErreurCompetitions } from './competitions';
import type { ErreurManifestations } from './manifestations';
import type { ErreurLot } from './suppression';
import type {
  ErreurChangementMotDePasse,
  ErreurComptes,
  ErreurConnexion,
  ErreurDemandeLien,
  ErreurNouveauMotDePasseParLien,
  ErreurProfil,
  MotifFinSession,
} from './session';

/** US-043 : « 1 manifestation, 3 compétitions, 12 épreuves » ; un type absent de la sélection n'est pas cité. */
function decompteTexte({ manifestations, competitions, epreuves }: Decompte): string {
  const parties = [
    manifestations > 0 ? `${manifestations} ${manifestations > 1 ? 'manifestations' : 'manifestation'}` : null,
    competitions > 0 ? `${competitions} ${competitions > 1 ? 'compétitions' : 'compétition'}` : null,
    epreuves > 0 ? `${epreuves} ${epreuves > 1 ? 'épreuves' : 'épreuve'}` : null,
  ];
  return parties.filter((partie) => partie !== null).join(', ');
}

/** Nom d'un tour du tableau (US-109) : « Tableau de 32 », « Quarts de finale », « Demi-finales », « Finale ». */
function nomDuTour(taille: number): string {
  if (taille === 2) return 'Finale';
  if (taille === 4) return 'Demi-finales';
  if (taille === 8) return 'Quarts de finale';
  return `Tableau de ${taille}`;
}

export const textes = {
  /** Nom affiché de l'application (US-014) ; le nom technique reste poulePosition. */
  nomApplication: 'Poule Position',
  sousTitre: 'Gestion de compétitions d’escrime',
  /** US-071 : plan du lieu (tuiles OpenStreetMap). */
  /** US-097 : saisie par smartphone (arbitres et tireurs, accès par QR code ; planches 12 à 18). */
  saisie: {
    marque: 'Poule Position',
    tableConnectee: 'Table connectée',
    tableDeconnectee: 'Table déconnectée',
    epreuve: (nom: string, arme: string) => `${nom} · ${arme}`,
    contexte: (competition: string | null, date: string | null) =>
      [
        competition,
        date
          ? new Intl.DateTimeFormat('fr-FR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              timeZone: 'UTC',
            }).format(new Date(`${date}T00:00:00Z`))
          : null,
      ]
        .filter(Boolean)
        .join(' · '),
    chargement: 'Connexion à la table…',
    refus: {
      lien: 'Ce lien n’est plus valable : scannez le QR code affiché dans la salle.',
      exclu: 'Votre accès a été retiré par la table de marque.',
      terminee: 'Cette épreuve est terminée.',
      trop: 'Trop d’essais, réessayez plus tard.',
    },
    pasDeConnexion: 'Pas de connexion : réessayez dès que le réseau revient.',
    poulesNonLancees: 'Les poules ne sont pas encore lancées : revenez dans un instant.',
    arbitre: {
      titre: 'Accès arbitre',
      nom: 'Votre nom',
      piste: 'Votre piste',
      nomPiste: (piste: number) => `Piste ${piste}`,
      poules: (poules: number[]) =>
        poules.length > 1 ? `Poules ${poules.slice(0, -1).join(', ')} et ${poules.at(-1)}` : `Poule ${poules[0]}`,
      changerPlusTard: 'Vous pourrez changer de piste à tout moment, par exemple pour arbitrer un match du tableau.',
      signature: (nom: string) =>
        `Vos saisies seront signées « arbitre ${nom || '…'} ». La table de marque les enregistre et vous confirme chaque score.`,
      commencer: 'Commencer',
      titrePiste: (piste: number, poules: number[]) =>
        `Piste ${piste} · ${poules.length > 1 ? `Poules ${poules.join(', ')}` : `Poule ${poules[0] ?? '—'}`}`,
      quiSaisit: (nom: string) => `arbitre ${nom}`,
      changerDePiste: 'Changer de piste',
      avancement: (nom: string, regles: number, total: number) =>
        `arbitre ${nom} · ${regles} match${regles > 1 ? 's' : ''} sur ${total}`,
      maintenant: (numero: number) => `À saisir maintenant · match ${numero}`,
      contre: 'contre',
      saisirScore: 'Saisir le score',
      saisieDesactivee: 'La saisie par smartphone est désactivée pour les arbitres.',
      tousSaisis: 'Tous les matchs de la piste sont saisis.',
      ensuite: 'Ensuite',
      termines: 'Terminés',
      deLaPoule: (poule: number) => `poule ${poule}`,
      forfait: 'forfait',
      voirTous: (nombre: number) => `Voir les ${nombre} matchs terminés`,
      corriger: (numero: number) => `Corriger le match ${numero}`,
      suspendue: 'Saisie suspendue',
      tablePartie:
        'La table de marque n’est plus connectée. Notez les scores sur la feuille de poule et rapportez-la à la table.',
      telephoneSansReseau:
        'Pas de connexion sur ce téléphone. Notez les scores sur la feuille de poule et rapportez-la à la table.',
      dernierEchange: (heure: string) => `Dernier échange à ${heure} · la saisie reprendra d’elle-même.`,
      reprise: 'La saisie reprendra d’elle-même.',
      aucunTermine: 'Aucun match terminé pour l’instant.',
    },
    /** US-099 : saisie d'un match de poule (planche 14). */
    match: {
      titre: (numero: number, poule: number) => `Match ${numero} · Poule ${poule}`,
      titreCorrection: (numero: number) => `Corriger le match ${numero}`,
      envoyerCorrection: 'Envoyer la correction',
      sousTitre: (piste: number, epreuve: string, touches: number) =>
        `Piste ${piste} · ${epreuve} · en ${touches} touches`,
      retourAuxMatchs: 'Retour aux matchs de la piste',
      gauche: 'à gauche',
      droite: 'à droite',
      victoire: (nom: string, a: number, b: number) => `Victoire de ${nom}, ${a} à ${b}.`,
      victoireAuTemps: (nom: string, a: number, b: number) => `Victoire au temps de ${nom}, ${a} à ${b}.`,
      unSeulVainqueur: 'Un seul vainqueur',
      pasDEgalite: 'Pas d’égalité',
      retour: 'Retour',
      envoyer: 'Envoyer à la table',
      enAttente: 'Envoyé · en attente de la table…',
      enregistre: (heure: string) => `Enregistré par la table à ${heure}`,
      matchSuivant: (paire: string) => `Match suivant : ${paire}`,
      retourMatchs: 'Retour aux matchs',
      suspendue: 'Saisie suspendue : la table n’est pas connectée. Notez le score sur la feuille de poule.',
      feuille: (poule: number, numero: number) => `Feuille de la poule ${poule} · match ${numero} encadré`,
      motifs: {
        EPREUVE_FERMEE: 'Cette épreuve est terminée : voyez la table.',
        DROIT_RETIRE: 'La saisie par smartphone n’est plus permise : voyez la table.',
        POULES_NON_LANCEES: 'Les poules ne sont pas lancées : voyez la table.',
        MATCH_INCONNU: 'Ce match n’existe pas dans la poule : voyez la table.',
        TIREUR_RETIRE: 'Un tireur de ce match est retiré : voyez la table.',
        MATCH_DEJA_SAISI: 'Ce match a déjà un score : voyez la table.',
        SCORE_INVALIDE: 'Ce score n’est pas valable : voyez la table.',
        CORRECTION_INTERDITE: 'Seul un arbitre corrige un score.',
        CORRECTION_DESACTIVEE: 'La correction par smartphone est désactivée.',
        SCORE_CHANGE: 'Le score a changé entre-temps : voyez la table.',
        HORS_POULE: 'Ce match n’est pas dans votre poule.',
        APPAREIL_EXCLU: 'Votre accès a été retiré par la table de marque.',
        TABLEAU_NON_CREE: 'Le tableau n’est pas encore créé : voyez la table.',
        MATCH_SUIVANT_REGLE: 'Le match suivant est déjà tiré : voyez la table.',
        HORS_MATCH: 'Ce match n’est pas le vôtre.',
      },
    },
    /** US-106 : les matchs du tableau sur le smartphone (planche 15). */
    tableau: {
      titreListe: 'Tableau',
      titre: (numero: number, tour: string) => `Match ${numero} · ${tour}`,
      titreCorrection: (numero: number, tour: string) => `Corriger le match ${numero} · ${tour}`,
      troisieme: 'Match pour la 3e place',
      sousTitre: (piste: number | null, epreuve: string, touches: number) =>
        `${piste ? `Piste ${piste} · ` : ''}${epreuve} · en ${touches} touches`,
      tete: (rang: number | null, cote: string) => (rang ? `tête de série ${rang} · ${cote}` : cote),
      priorite: 'Vainqueur par priorité',
      victoire: (nom: string, haut: number, bas: number) => `Victoire de ${nom}, ${haut} à ${bas}.`,
      victoireAuTemps: (nom: string, haut: number, bas: number) => `Victoire de ${nom}, ${haut} à ${bas} (au temps).`,
      victoirePriorite: (nom: string, score: number) => `Victoire de ${nom} par priorité, ${score} partout.`,
      dansLeTableau: 'Dans le tableau',
      enSaisie: 'en saisie',
      saisir: 'Saisir le score',
      corriger: (paire: string) => `Corriger ${paire}`,
      aucun: 'Aucun match du tableau pour l’instant.',
      ligne: (piste: number | null, etat: string) => (piste ? `Piste ${piste} · ${etat}` : etat),
    },
    /** US-100 : saisies reçues des smartphones, sur le PC (planche 10). */
    recues: {
      titre: 'Saisies reçues des smartphones',
      appareils: (n: number) => (n > 1 ? `${n} appareils connectés` : `${n} appareil connecté`),
      horsLigne: 'Hors ligne : aucun appareil',
      gerer: 'Gérer les accès',
      explication:
        'Ce PC applique les droits réglés dans les Paramètres : une saisie permise est acceptée d’office et s’inscrit dans la feuille.',
      aucune: 'Aucune saisie reçue pour l’instant.',
      poule: (poule: number) => `Poule ${poule}`,
      match: (poule: number, numero: number) => `Poule ${poule} · match ${numero}`,
      correction: (avant: string, apres: string) => `correction de ${avant} en ${apres}`,
      surCePc: 'saisi sur ce PC',
      acceptee: 'Acceptée',
      enregistree: 'Enregistrée',
      refusee: (motif: string) => `Refusée : ${motif}`,
      toutes: (n: number) => `Voir toutes les saisies (${n})`,
      ecartees: (n: number) => (n > 1 ? `${n} saisies smartphone écartées` : `1 saisie smartphone écartée`),
      voirEcartees: 'Voir',
      fermer: 'Fermer',
      ecarteeLigne: (match: string, propose: string, retenu: string, par: string) =>
        `${match} : proposé ${propose}, retenu ${retenu} (${par})`,
      motifs: {
        EPREUVE_FERMEE: 'épreuve terminée',
        DROIT_RETIRE: 'saisie non permise (Paramètres)',
        POULES_NON_LANCEES: 'poules non lancées',
        MATCH_INCONNU: 'match inconnu',
        TIREUR_RETIRE: 'tireur retiré',
        MATCH_DEJA_SAISI: 'match déjà saisi',
        SCORE_INVALIDE: 'score non valable',
        CORRECTION_INTERDITE: 'seul un arbitre corrige un score',
        CORRECTION_DESACTIVEE: 'correction désactivée (Paramètres)',
        SCORE_CHANGE: 'le score avait changé entre-temps',
        HORS_POULE: 'match hors de la poule du tireur',
        APPAREIL_EXCLU: 'appareil exclu',
        TABLEAU_NON_CREE: 'tableau pas encore créé',
        MATCH_SUIVANT_REGLE: 'match suivant déjà tiré',
        HORS_MATCH: 'match d’un autre tireur',
      },
    },
    tireur: {
      quiEtesVous: 'Qui êtes-vous ?',
      explication: (dames: boolean) =>
        `Choisissez votre nom parmi les ${dames ? 'tireuses' : 'tireurs'} de l’épreuve. Vos saisies seront signées à votre nom.`,
      recherche: 'Votre nom',
      trouves: (dames: boolean) => (dames ? 'Tireuses trouvées' : 'Tireurs trouvés'),
      detail: (club: string, poule: number) => `${club ? `${club} · ` : ''}poule ${poule}`,
      absent: 'Votre nom n’apparaît pas ? Adressez-vous à la table de marque.',
      pasTireur: 'Vous ne tirez pas ?',
      spectateur: 'Suivre l’épreuve en spectateur',
      choisir: (nom: string) => `Je suis ${nom}`,
      cePasMoi: 'Ce n’est pas moi',
      aVous: (numero: number) => `C’est à vous · match ${numero}`,
      prochain: (numero: number) => `Votre prochain match · match ${numero}`,
      contre: 'contre',
      dansEnviron: (n: number) => `Dans environ ${n} match${n > 1 ? 's' : ''}.`,
      ensuite: (numero: number, nom: string, n: number) =>
        `Ensuite : match ${numero} contre ${nom}, dans environ ${n} match${n > 1 ? 's' : ''}.`,
      parLArbitre: 'La saisie est faite par l’arbitre.',
      pouleTerminee: 'Votre poule est terminée.',
      retire: (dames: boolean, motif: string) => `Vous êtes ${dames ? 'retirée' : 'retiré'} de la poule (${motif}).`,
      motifs: { abandon: 'abandon', forfait: 'forfait', exclusion: 'exclusion' },
      classement: 'Ma poule · classement provisoire',
      tireuse: 'Tireuse',
      tireurColonne: 'Tireur',
      mesTermines: 'Mes matchs terminés',
      autres: 'Autres matchs de ma poule · à tirer',
      autresExplication: (dames: boolean) =>
        `Sans arbitre équipé, ${dames ? 'une tireuse' : 'un tireur'} de la poule peut saisir ces matchs. Chaque saisie est signée à votre nom.`,
      saisir: 'Saisir',
      saisirMatch: (numero: number, paire: string) => `Saisir le score du match ${numero}, ${paire}`,
      resume: (poule: number, piste: number, club: string) =>
        `Poule ${poule} · piste ${piste}${club ? ` · ${club}` : ''}`,
    },
  },
  planLieu: {
    libelle: (lieu: string) => `Plan du lieu : ${lieu}`,
    ouvrir: 'Ouvrir dans une application de cartes',
    attribution: '© OpenStreetMap contributors',
    indisponible: 'Plan indisponible',
    horsLigne: 'Plan disponible en ligne',
  },
  /** US-137 et US-138 : suivi en direct d'une épreuve sur le smartphone d'un spectateur (planches 38 et 39). */
  spectateur: {
    titre: 'Suivi en direct',
    connexion: 'Connexion au direct…',
    attente: 'Le direct commence dès que la table publie l’épreuve.',
    avantPoules: 'Le direct commence avec les poules.',
    enDirect: 'En direct',
    onglets: 'Suivi de l’épreuve',
    aVenir: 'À venir',
    libelles: {
      appel: 'Appel',
      poules: 'Poules',
      classement: 'Classement',
      tableau: 'Tableau',
      tireurs: 'Mes tireurs',
    },
    tireur: 'Tireur',
    suivreColonne: 'Suivre',
    suivre: (nom: string) => `Suivre ${nom}`,
    nePlusSuivre: (nom: string) => `Ne plus suivre ${nom}`,
    pisteAvancement: (piste: number, regles: number, total: number) => `Piste ${piste} · ${regles}/${total} matchs`,
    chercher: 'Suivre un tireur : nom ou club',
    aucunSuivi: 'Touchez l’étoile d’un tireur pour le suivre ici.',
    surCeTelephone: 'Vos tireurs suivis sont gardés sur ce téléphone, sans compte.',
    enPisteContre: (piste: number, adversaire: string) => `En piste ${piste} contre ${adversaire}`,
    prochainPoule: (adversaire: string, avant: number) =>
      `Prochain match contre ${adversaire} · après ${avant} match${avant > 1 ? 's' : ''}`,
    prochainTableau: (adversaire: string, piste: number | null) =>
      piste === null
        ? `Prochain match contre ${adversaire}`
        : `Prochain match contre ${adversaire} · à tirer, piste ${piste}`,
    place: (place: number) => (place === 1 ? 'Vainqueur' : `${place}e place`),
    retraits: { abandon: 'Abandon', forfait: 'Forfait', exclusion: 'Exclu' },
    poule: 'Poule',
    victoires: 'Victoires',
    rang: 'Rang provisoire',
    pouleEtPiste: (poule: number, piste: number) => `${poule} · piste ${piste}`,
    surMatchs: (victoires: number, matchs: number) => `${victoires} sur ${matchs}`,
    rangSur: (rang: number, sur: number) => `${rang}e / ${sur}`,
  },
  /** US-134 : l'écran géant lui-même (planches 31 à 35). */
  ecranGeant: {
    connexion: 'Connexion au serveur…',
    lienInvalide: 'Ce lien d’écran n’est plus valable : demandez le nouveau à l’organisateur.',
    pleinEcran: 'Plein écran',
    appel: 'Appel des matchs',
    poules: (numeros: number[]) =>
      numeros.length > 1
        ? `Poules ${numeros.slice(0, -1).join(', ')} et ${numeros.at(-1)}`
        : `Poule ${numeros[0] ?? ''}`,
    classement: 'Classement après les poules',
    classementFinal: 'Classement final',
    tour: (taille: number) =>
      taille <= 2
        ? 'Finale'
        : taille === 4
          ? 'Demi-finales'
          : taille === 8
            ? 'Quarts de finale'
            : `Tableau de ${taille}`,
    terminee: 'Épreuve terminée',
    attente: 'En attente',
    attenteDetail: 'Les épreuves de cet écran n’ont pas encore commencé.',
    piste: (numero: number) => `Piste ${numero}`,
    poule: (numero: number) => `Poule ${numero}`,
    etats: { enPiste: 'En piste', aTirer: 'À tirer', libre: 'Libre' },
    contextePoule: (poule: number, match: number, total: number) => `Poule ${poule} · match ${match} sur ${total}`,
    pouleTerminee: (poule: number) => `Poule ${poule} terminée`,
    aucunMatch: 'Aucun match appelé',
    contre: 'contre',
    puis: (a: string, b: string) => `Puis : ${a} – ${b}`,
    avancement: (piste: number, regles: number, total: number) => `Piste ${piste} · ${regles} matchs sur ${total}`,
    enPiste: (a: string, b: string) => `En piste : ${a} – ${b}`,
    enPisteN: (piste: number) => `En piste ${piste}`,
    aTirerN: (piste: number) => `À tirer · piste ${piste}`,
    tireur: 'Tireur',
    indice: 'Ind.',
    rang: 'Rang',
    podium: 'Podium',
    /** US-158 CA-6 : match départagé sans score, et mention de la fin anticipée. */
    nonTire: 'Non tiré',
    finAnticipee: 'Épreuve terminée avant la fin du tableau',
    /** US-142 : avancement d'une poule. */
    matchsRegles: (regles: number, total: number) => `${regles} / ${total} matchs`,
    /** US-143 : tableau en arbre. */
    tableau: 'Tableau',
    moitie: (moitie: 'haute' | 'basse') => `Tableau · moitié ${moitie}`,
    petiteFinale: 'Petite finale',
    exempt: 'exempt',
    /** US-141 : bandeau des derniers scores. */
    bandeau: 'Derniers scores',
    scorePoule: (a: string, ta: number, tb: number, b: string, poule: number) =>
      `${a} ${ta} – ${tb} ${b} · Poule ${poule}`,
    scoreTableau: (tour: string, a: string, ta: number, tb: number, b: string) => `${tour} : ${a} ${ta} – ${tb} ${b}`,
    misAJour: (heure: string) => `Mis à jour à ${heure}`,
    derniereMiseAJour: (heure: string) => `Dernière mise à jour : ${heure}`,
  },
  /** US-133 à US-136 : écrans géants d'une manifestation (planches 36 et 37). */
  ecrans: {
    titre: 'Écrans',
    intro:
      'Chaque écran affiche les épreuves cochées et les fait défiler seul. Ouvrez son lien sur la TV de la salle, ou sur ce PC branché en HDMI pour qu’il continue sans internet.',
    ajouter: 'Ajouter un écran',
    aucun: 'Aucun écran pour l’instant.',
    connecte: 'Connecté',
    jamaisOuvert: 'Jamais ouvert',
    ouvertLe: (instant: number) => {
      const date = new Date(instant);
      return `Ouvert le ${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')} à ${date.getHours()} h ${String(date.getMinutes()).padStart(2, '0')}`;
    },
    reglagesResume: (duree: number, masquees: number) =>
      `${duree} s par page · ${masquees === 0 ? 'toutes les vues' : `${masquees} vue${masquees > 1 ? 's' : ''} masquée${masquees > 1 ? 's' : ''}`}`,
    aucuneEpreuve: 'Aucune épreuve cochée',
    lienLibelle: 'Lien de l’écran (à ouvrir sur la TV, ne pas diffuser)',
    qr: (nom: string) => `QR code du lien de ${nom}`,
    copier: 'Copier le lien',
    copie: 'Lien copié',
    ouvrir: 'Ouvrir l’écran',
    ouvrirSurCePc: 'Ouvrir sur ce PC',
    fenetreBloquee: 'Autorisez l’ouverture de fenêtres pour ce site, puis réessayez.',
    modifier: 'Modifier',
    regenerer: 'Régénérer le lien…',
    regenererDetail: 'l’ancien lien ne marchera plus',
    supprimer: 'Supprimer…',
    afficher: 'Afficher sur l’écran',
    /** US-135 : vue imposée à un écran. */
    commande: {
      etiquette: (nom: string) => `Afficher sur ${nom}`,
      epreuve: 'Épreuve',
      page: 'Page',
      poule: 'Numéro de poule (vide : toutes)',
      toutes: 'toutes',
      pendant: 'Pendant',
      uneMinute: '1 min',
      cinqMinutes: '5 min',
      jusquaReprise: 'Jusqu’à reprise du défilement',
      afficher: 'Afficher',
      annuler: 'Annuler',
      imposee: (vue: string, epreuve: string, poule: number | null) =>
        `Vue imposée : ${vue.toLowerCase()}${poule ? ` ${poule}` : ''} · ${epreuve}`,
      encore: (minutes: number) => `encore ${minutes} min`,
      reprendre: 'Reprendre le défilement',
    },
    autres: (nom: string) => `Autres actions pour ${nom}`,
    confirmerRegeneration: (nom: string) => `Régénérer le lien de ${nom} ?`,
    detailRegeneration:
      'L’ancien lien et son QR code ne marcheront plus : l’écran qui l’utilise sera déconnecté. Il faudra ouvrir le nouveau lien sur la TV.',
    actionRegeneration: 'Régénérer',
    confirmerSuppression: (nom: string) => `Supprimer ${nom} ?`,
    detailSuppression: 'L’écran ouvert affichera « Cet écran n’existe plus ». Les épreuves ne sont pas touchées.',
    actionSuppression: 'Supprimer',
    horsLigne: 'Nécessite une connexion internet',
    copieDu: (date: number) => {
      const jour = new Date(date);
      return `Hors ligne : écrans du ${String(jour.getDate()).padStart(2, '0')}/${String(jour.getMonth() + 1).padStart(2, '0')} à ${jour.getHours()} h ${String(jour.getMinutes()).padStart(2, '0')}`;
    },
    fenetre: {
      titreNouveau: 'Nouvel écran',
      nom: 'Nom de l’écran',
      nomDefaut: 'Écran de la salle',
      epreuves: 'Épreuves affichées',
      epreuvesAide: 'Publiées ou non : l’écran les affiche par son lien.',
      aucuneEpreuve: 'Aucune épreuve dans cette manifestation.',
      nonPubliee: 'non publiée',
      duree: 'Durée d’une page',
      secondes: 'secondes',
      vues: 'Vues à afficher',
      style: 'Style',
      styles: { sombre: 'Sombre', clair: 'Clair' },
      bandeau: 'Bandeau des derniers scores',
      bandeauMinutes: 'Scores des dernières',
      minutes: 'minutes',
      enregistrer: 'Enregistrer',
      annuler: 'Annuler',
      enCours: 'Enregistrement…',
    },
    vues: {
      appel: 'Appel des matchs',
      poules: 'Poules',
      classement: 'Classement',
      tableau: 'Tableau',
      podium: 'Podium',
    },
    statuts: { preparation: 'en préparation', enCours: 'en cours', terminee: 'terminée', archivee: 'archivée' },
    erreurs: {
      HORS_LIGNE: 'Nécessite une connexion internet',
      SERVEUR_INJOIGNABLE: 'Serveur injoignable : réessayez dans un instant',
      SESSION_INVALIDE: 'Reconnectez-vous pour continuer',
      NOM_EN_DOUBLE: 'Un autre écran porte déjà ce nom',
      ECRAN_INCONNU: 'Cet écran n’existe plus',
      ECRAN_DECONNECTE: 'Cet écran n’est pas connecté',
      PROPRIETAIRE_INCONNU: 'Manifestation inconnue du serveur',
      ERREUR_INATTENDUE: 'Erreur inattendue du serveur : réessayez',
      NOM_VIDE: 'Donnez un nom à l’écran',
      DUREE: 'La durée d’une page va de 5 à 120 secondes',
      MINUTES: 'Le bandeau montre les scores de 1 à 120 dernières minutes',
    },
  },
  /** US-131 : sauvegarde automatique des épreuves pilotées dans un dossier (clé USB). */
  sauvegardeAuto: {
    entree: 'Sauvegarde automatique…',
    indisponible: 'Disponible sur Chrome et Edge : exportez l’épreuve à la main (menu ⋯)',
    titre: 'Sauvegarde automatique',
    explication:
      'Choisissez un dossier, par exemple sur une clé USB : ce PC y écrit la sauvegarde de chaque épreuve qu’il pilote, après chaque modification, même sans internet. En cas de panne, le fichier se reprend sur un autre PC par « Importer une épreuve ».',
    inactive: 'Aucun dossier choisi : la sauvegarde automatique est arrêtée.',
    active: (dossier: string) => `Sauvegarde automatique active dans « ${dossier} »`,
    derniere: (instant: number) => {
      const date = new Date(instant);
      return `Dernière sauvegarde à ${date.getHours()} h ${String(date.getMinutes()).padStart(2, '0')}`;
    },
    pause: (dossier: string) => `Sauvegarde en pause : autorisez de nouveau l’écriture dans « ${dossier} ».`,
    erreur: 'Sauvegarde automatique impossible : rebranchez la clé ou choisissez un autre dossier.',
    choisir: 'Choisir un dossier',
    reprendre: 'Reprendre la sauvegarde',
    arreter: 'Arrêter',
    fermer: 'Fermer',
    bandeauPause: 'Sauvegarde automatique en pause',
    bandeauErreur: 'Sauvegarde automatique impossible : rebranchez la clé ou choisissez un autre dossier',
  },
  /** US-069 : champ d'heure à deux listes (heures, minutes par quart d'heure). */
  heure: {
    aucune: 'Aucune heure',
    heures: (libelle: string) => `${libelle} — heures`,
    minutes: (libelle: string) => `${libelle} — minutes`,
  },
  /** US-052 : sélecteur de thème (« Auto » suit le réglage du système). */
  theme: {
    libelle: 'Thème',
    choix: { clair: 'Clair', sombre: 'Sombre', auto: 'Auto' },
    /** US-067 : nom accessible et infobulle des trois icônes de l'entête. */
    nomBouton: { clair: 'Thème clair', sombre: 'Thème sombre', auto: 'Thème automatique' },
  },
  /** US-054 : entête commun des pages connectées, fil d'Ariane et menu « ⋯ » (maquette « IHM de l'organisateur »). */
  entete: {
    marque: 'Poule Position',
    creer: 'Créer',
    comptes: 'Comptes',
    aide: 'Comment ça s’organise',
    theme: 'Thème',
    horsLigne: 'Nécessite une connexion internet',
    filAriane: 'Fil d’Ariane',
    accueil: 'Accueil',
    autresActions: (nom: string) => `Autres actions pour ${nom}`,
  },
  /** US-035 : import d'une épreuve depuis un fichier `.poule.json`, et reprise au retour en ligne. */
  importation: {
    action: 'Importer une épreuve…',
    actionDetail: 'Reprendre une épreuve depuis un fichier .poule.json, même sans internet',
    menuListe: 'Actions de la liste',
    titre: 'Importer une épreuve',
    lecture: 'Lecture du fichier…',
    resume: {
      nom: 'Épreuve',
      date: 'Date',
      evenements: 'Événements',
      exporteLe: 'Exporté le',
      fichiers: 'Fichiers joints',
      /** Pour « Exporté le » : jour et heure locaux. */
      dateExport: (ms: number) => new Date(ms).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' }),
      dateEpreuve: (jour: string) =>
        new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${jour}T00:00:00Z`)),
    },
    /** Ce que l'import fera, selon que l'appareil connaît ou non l'épreuve. */
    plans: {
      nouvelle: 'Cette épreuve sera créée sur cet appareil, qui en deviendra le pilote.',
      prolonge: (ajouts: number) =>
        ajouts > 1
          ? `Cet appareil a déjà une copie plus courte : ${ajouts} événements seront ajoutés, et il en deviendra le pilote.`
          : 'Cet appareil a déjà une copie plus courte : 1 événement sera ajouté, et il en deviendra le pilote.',
      aJour: 'Cet appareil a déjà tout ce que contient ce fichier : rien ne sera modifié.',
      divergent:
        'Le fichier et la copie de cet appareil ne racontent pas la même épreuve : ils diffèrent à un même numéro d’événement. Rien n’a été modifié. Vous pouvez l’importer comme une nouvelle épreuve, à côté de l’autre.',
    },
    rappelEnLigne:
      'Au retour en ligne, il faudra prendre la main sur cette épreuve avant d’envoyer quoi que ce soit au serveur.',
    boutons: {
      importer: 'Importer',
      commeNouvelle: 'Importer comme nouvelle épreuve',
      annuler: 'Annuler',
      fermer: 'Fermer',
      enCours: 'Import en cours…',
    },
    erreurs: {
      ILLISIBLE: 'Ce fichier est illisible : ce n’est pas une sauvegarde poulePosition.',
      AUTRE_FORMAT: 'Ce fichier n’est pas une sauvegarde d’épreuve poulePosition.',
      VERSION_FUTURE: 'Ce fichier vient d’une version plus récente de poulePosition : mettez l’application à jour.',
      JOURNAL_INVALIDE: 'Le journal de ce fichier est incomplet ou abîmé : il ne peut pas être importé.',
      TROP_GROS: 'Ce fichier dépasse 50 Mo : il est refusé.',
      LECTURE_IMPOSSIBLE: 'Ce fichier n’a pas pu être lu. Réessayez.',
      AUTRE_CLUB: 'Ce fichier vient d’un autre club : il ne peut pas être importé ici.',
      DIVERGENT: 'Le journal du fichier diverge de celui de cet appareil : rien n’a été modifié.',
      ECRITURE_IMPOSSIBLE: 'L’import n’a pas pu être enregistré sur cet appareil. Réessayez.',
    },
    fait: {
      nouvelle: (nom: string) => `Épreuve « ${nom} » importée.`,
      prolonge: (nom: string, ajoutes: number) =>
        `Épreuve « ${nom} » mise à jour : ${ajoutes} événement${ajoutes > 1 ? 's' : ''} ajouté${ajoutes > 1 ? 's' : ''}.`,
      aJour: (nom: string) => `Rien à importer : l’épreuve « ${nom} » est déjà à jour sur cet appareil.`,
    },
    /** Carte « Pilote » de l'épreuve importée, avant et après la reprise (CA-5 et CA-6). */
    reprise: {
      titre: 'Épreuve reprise d’un fichier',
      aReprendre:
        'Cette épreuve vient d’un fichier. Rien n’est envoyé au serveur tant que ce PC n’a pas pris la main : une autre version a pu continuer entre-temps.',
      bouton: 'Prendre la main et envoyer',
      enCours: 'Reprise en cours…',
      horsLigne: 'Nécessite une connexion internet',
      reussie: 'Main prise : les modifications de cet appareil sont envoyées.',
      divergence: (ecartes: number) =>
        ecartes > 1
          ? `L’épreuve a continué sur un autre PC : ${ecartes} modifications faites ici n’ont pas été reprises. Elles sont gardées à part : exportez-les pour les consulter.`
          : 'L’épreuve a continué sur un autre PC : 1 modification faite ici n’a pas été reprise. Elle est gardée à part : exportez-la pour la consulter.',
      mainDejaPrise: (libelle: string) => `La main vient d’être prise par ${libelle}. Réessayez.`,
      erreurs: {
        HORS_LIGNE: 'Nécessite une connexion internet',
        SESSION_INVALIDE: 'Reconnectez-vous pour prendre la main',
        EPREUVE_INCONNUE: 'Épreuve inconnue du serveur',
        ERREUR_INATTENDUE: 'Reprise impossible pour le moment',
        ACCES_REFUSE: 'Reprise impossible pour le moment',
        EPREUVE_EN_COURS: 'Reprise impossible pour le moment',
        EPREUVE_SUPPRIMEE: 'Cette épreuve a été supprimée',
      },
    },
  },
  /** US-033 : archiver et désarchiver une épreuve ou une manifestation. */
  archivage: {
    archiver: 'Archiver',
    desarchiver: 'Désarchiver',
    annuler: 'Annuler',
    enCours: 'En cours…',
    detailArchiverEpreuve:
      'L’épreuve passe en lecture seule, disparaît de la liste (« Afficher les archives » la montre) et de la page publique.',
    detailArchiverManifestation:
      'La manifestation, ses compétitions et toutes ses épreuves passent en lecture seule et disparaissent de la liste.',
    detailDesarchiverEpreuve: 'L’épreuve retrouve le statut qu’elle avait avant son archivage, non publiée.',
    detailDesarchiverManifestation:
      'La manifestation, ses compétitions et ses épreuves redeviennent modifiables, les épreuves non publiées.',
    titreArchiverEpreuve: (nom: string) => `Archiver l’épreuve « ${nom} » ?`,
    titreDesarchiverEpreuve: (nom: string) => `Désarchiver l’épreuve « ${nom} » ?`,
    titreArchiverManifestation: (nom: string) => `Archiver la manifestation « ${nom} » ?`,
    titreDesarchiverManifestation: (nom: string) => `Désarchiver la manifestation « ${nom} » ?`,
    // Motifs d'indisponibilité, écrits sous l'action grisée du menu « ⋯ ».
    epreuveEnCours: 'Une épreuve en cours ne peut pas être archivée',
    pasPilote: 'Seul le PC pilote de l’épreuve peut l’archiver ou la désarchiver',
    horsLigne: 'Nécessite internet',
    erreurs: {
      epreuveEnCours: (noms: readonly string[]) =>
        noms.length > 1
          ? 'Des épreuves en cours ne peuvent pas être archivées :'
          : 'Une épreuve en cours ne peut pas être archivée :',
      piloteesAilleurs: (noms: readonly string[]) =>
        `Prenez la main sur ${noms.join(', ')} ou archivez-les depuis leur PC`,
      PILOTEE_AILLEURS: 'Une épreuve de la manifestation est pilotée par un autre PC',
      INTROUVABLE: 'Épreuve introuvable sur cet appareil',
      PAS_PILOTE: 'Seul le PC pilote de l’épreuve peut l’archiver ou la désarchiver',
      EPREUVE_EN_COURS: 'Une épreuve en cours ne peut pas être archivée',
      EPREUVE_ARCHIVEE: 'Cette épreuve est déjà archivée',
      EPREUVE_NON_ARCHIVEE: 'Cette épreuve n’est pas archivée',
      JOURNAL_INCOHERENT: 'Le journal de cette épreuve est incohérent : rien n’a été écrit',
      ECRITURE_IMPOSSIBLE: 'Écriture impossible sur cet appareil',
      HORS_LIGNE: 'Archiver une manifestation nécessite internet : réessayez une fois la connexion revenue',
      SESSION_INVALIDE: 'Votre session a expiré : reconnectez-vous',
      MANIFESTATION_INCONNUE: 'Manifestation introuvable : elle a peut-être été supprimée',
      MANIFESTATION_NON_VIDE: 'Manifestation non vide',
      ACCES_REFUSE: 'Accès refusé',
      ERREUR_INATTENDUE: 'Une erreur est survenue : réessayez',
    },
    desarchiveePar: (noms: readonly string[]) =>
      `Ces épreuves restent archivées : leur PC pilote doit les désarchiver. ${noms.join(', ')}`,
  },
  /** US-062 : recherche de l'entête. */
  recherche: {
    placeholder: 'Rechercher une épreuve, une compétition…',
    ouvrir: 'Rechercher',
    fermer: 'Fermer la recherche',
    resultats: 'Résultats de la recherche',
    chargement: 'Chargement de la liste…',
    aucunResultat: (saisie: string) => `Aucun résultat pour « ${saisie} »`,
    archivee: 'Archivée',
    groupes: { manifestation: 'Manifestations', competition: 'Compétitions', epreuve: 'Épreuves' },
  },
  etats: {
    'non-configure': 'Serveur non configuré',
    connexion: 'Connexion au serveur…',
    connecte: 'Serveur connecté',
    injoignable: 'Serveur injoignable',
  } satisfies Record<EtatConnexion, string>,
  accueil: {
    seConnecter: 'Se connecter',
    espaceOrganisateur: "Accueil de l'organisateur",
  },
  connexion: {
    titre: 'Se connecter',
    email: 'E-mail',
    motDePasse: 'Mot de passe',
    valider: 'Se connecter',
    enCours: 'Connexion…',
    retour: "Retour à l'accueil",
    afficherMotDePasse: 'Afficher le mot de passe',
    masquerMotDePasse: 'Masquer le mot de passe',
    presentation: 'Présentation de Poule Position',
    oubli: 'Mot de passe oublié ?',
    horsLigne: 'Hors ligne : connexion possible uniquement sur un appareil déjà utilisé',
    erreurs: {
      IDENTIFIANTS_INVALIDES: 'E-mail ou mot de passe incorrect',
      COMPTE_DESACTIVE: 'Ce compte est désactivé : contactez un administrateur',
      PREMIERE_CONNEXION_HORS_LIGNE: 'Première connexion impossible hors ligne sur cet appareil',
      TROP_D_ESSAIS: 'Trop d’essais : réessayez dans 15 minutes',
      SERVEUR_NON_CONFIGURE: 'Serveur non configuré : connexion impossible',
      ERREUR_INATTENDUE: 'Erreur inattendue du serveur : réessayez',
    } satisfies Record<ErreurConnexion, string>,
    /** US-005 : pourquoi l'application a fermé la session. */
    motifs: {
      COMPTE_MODIFIE: 'Votre compte a été modifié : reconnectez-vous',
      RECONNEXION_REQUISE: 'De retour en ligne : reconnectez-vous pour continuer',
    } satisfies Record<MotifFinSession, string>,
  },
  organisateur: {
    bonjour: (nom: string) => `Bonjour, ${nom}`,
    seDeconnecter: 'Se déconnecter',
    oublier: {
      bouton: 'Se déconnecter et oublier cet appareil',
      avertissement:
        'Votre session et votre mot de passe enregistré sur cet appareil seront effacés : vous ne pourrez plus vous y reconnecter hors ligne. Les épreuves enregistrées sur cet appareil sont conservées.',
      confirmer: 'Oublier cet appareil',
      annuler: 'Annuler',
    },
    connexionLocale: 'Hors ligne : connexion locale',
    changerMotDePasse: 'Changer mon mot de passe',
    /** US-017 : menu de compte, ouvert depuis l'avatar de l'entête. */
    menu: {
      ouvrir: (nom: string) => `Menu du compte de ${nom}`,
      editerProfil: 'Éditer le profil',
    },
    actions: 'Actions',
  },
  /** US-026 : liste du club sur l'accueil de l'organisateur. */
  listeClub: {
    titre: 'Manifestations et compétitions',
    nouvelleManifestation: 'Nouvelle manifestation',
    nouvelleCompetition: 'Nouvelle compétition',
    nouvelleCompetitionDans: (manifestation: string) => `Nouvelle compétition dans ${manifestation}`,
    horsLigne: 'Nécessite une connexion internet',
    /** Hors ligne, sans aucune copie du club gardée sur l'appareil. */
    horsLigneSansCopie: 'Hors ligne : seules les épreuves de cet appareil sont listées',
    chargement: 'Chargement de la liste…',
    /** US-063 CA-1, US-079 CA-1 : filtres de la liste. */
    filtres: 'Filtrer la liste',
    filtre: {
      avenir: 'À venir',
      enCours: 'En cours',
      terminees: 'Terminées',
      archivees: 'Archivées',
      toutes: 'Toutes',
    },
    /** CA-6 : un filtre sans épreuve ne montre pas la liste du club vide. */
    filtreVide: {
      avenir: 'Aucune épreuve à venir',
      enCours: 'Aucune épreuve en cours',
      terminees: 'Aucune épreuve terminée',
      archivees: 'Aucune épreuve archivée',
      toutes: 'Aucune épreuve',
    },
    vide: 'Le club n’a encore ni manifestation, ni compétition, ni épreuve : créez une première manifestation ou une première compétition.',
    /** US-045 CA-7 : épreuves dont la compétition a été supprimée entre-temps, en tête de la liste. */
    aRattacher: 'Épreuves à rattacher',
    /** US-045 CA-4 : une compétition seule (challenge) est créée avec sa première épreuve. */
    nouvelleCompetitionSeule: 'Nouvelle compétition seule',
    aucuneEpreuve: 'Aucune épreuve',
    lectureSeule: 'Lecture seule',
    /** US-055 : refonte de l'accueil (carte de manifestation, lignes de compétition et d'épreuve, légende). */
    aujourdhui: 'Aujourd’hui',
    plan: 'Plan',
    plusEpreuves: '+ Épreuves',
    decompte: (competitions: number, epreuves: number) => {
      const c =
        competitions === 0
          ? 'Aucune compétition'
          : competitions === 1
            ? '1 compétition'
            : `${competitions} compétitions`;
      const e = epreuves === 0 ? 'aucune épreuve' : epreuves === 1 ? '1 épreuve' : `${epreuves} épreuves`;
      return `${c}, ${e}`;
    },
    nombreEpreuves: (nombre: number) =>
      nombre === 0 ? 'aucune épreuve' : nombre === 1 ? '1 épreuve' : `${nombre} épreuves`,
    /** Jour court d'une épreuve : « mer. 11 nov. ». */
    jourCourt: (date: string) =>
      new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }),
    competitionsDe: (nom: string) => `Compétitions de ${nom}`,
    epreuvesDe: (nom: string) => `Épreuves de ${nom}`,
    modifierManifestation: 'Modifier',
    ajouterCompetition: 'Ajouter une compétition',
    legende: 'Légende des icônes',
    aucuneCompetition: 'Aucune compétition',
    jour: (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`,
    ouvrir: (nom: string) => `Ouvrir l’épreuve ${nom}`,
    /** US-060 : épreuves à rattacher (leur compétition a disparu), alerte, liste et rattachement par lot. */
    rattachement: {
      alerte: (nombre: number) => (nombre > 1 ? `${nombre} épreuves à rattacher.` : '1 épreuve à rattacher.'),
      alerteSuite: 'Leur compétition a été supprimée.',
      alerteTitre: 'Épreuves à rattacher',
      lesRattacher: 'Les rattacher',
      titre: (nombre: number) => (nombre > 1 ? `${nombre} épreuves à rattacher` : '1 épreuve à rattacher'),
      explication: 'Leur compétition a été supprimée. Choisissez une compétition pour chacune, ou supprimez-les.',
      choisir: 'Choisir une compétition',
      choisirPour: (nom: string) => `Choisir une compétition pour ${nom}`,
      lot: 'Rattacher à une compétition',
      creerCompetition: 'Créer une compétition seule',
      depuisLePilote: 'À faire depuis le PC pilote',
      jour: (date: string) =>
        new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`)),
      rattachees: (nombre: number) => (nombre > 1 ? `${nombre} épreuves rattachées` : `${nombre} épreuve rattachée`),
      nonRattachees: (nombre: number) =>
        nombre > 1 ? `${nombre} épreuves n’ont pas été rattachées` : `${nombre} épreuve n’a pas été rattachée`,
      modifier: 'Modifier l’épreuve',
      fermer: 'Fermer',
      raisons: {
        INTROUVABLE: 'Inconnue de cet appareil : à faire depuis le PC pilote',
        PAS_PILOTE: 'Pilotée par un autre PC : à faire depuis le PC pilote',
        EPREUVE_ARCHIVEE: 'Épreuve archivée',
        ARME_DIFFERENTE_COMPETITION: 'Arme différente de celle de la compétition',
        DATE_HORS_MANIFESTATION: 'Date hors de la manifestation : modifiez l’épreuve',
        DATE_OBLIGATOIRE: 'Date manquante : la manifestation exige une date',
        RATTACHEMENT_INVALIDE: 'Compétition inconnue de cet appareil',
        ECRITURE_IMPOSSIBLE: 'Écriture impossible sur cet appareil',
      },
    },
    /** US-040 : suppression de plusieurs épreuves, réservée aux administrateurs. */
    suppression: {
      cocher: (nom: string) => `Sélectionner l’épreuve ${nom}`,
      enCours: 'Une épreuve en cours ne peut pas être supprimée',
      selection: (nombre: number) =>
        nombre > 1 ? `${nombre} épreuves sélectionnées` : `${nombre} épreuve sélectionnée`,
      /** US-059 : mode sélection de l'accueil, barre d'actions de la planche 4. */
      selectionner: 'Sélectionner',
      barre: 'Mode sélection',
      quitter: 'Quitter le mode sélection',
      toutSelectionner: 'Tout sélectionner',
      toutDeselectionner: 'Tout désélectionner',
      bouton: 'Supprimer…',
      aide: 'Cocher une manifestation ou une compétition sélectionne aussi tout son contenu. La suppression demande toujours une confirmation qui détaille ce qui sera supprimé.',
      /** Cas limite : la sélection ne prend que ce que la liste affiche. */
      archivesNonSelectionnees: 'Les archives masquées ne sont pas sélectionnées',
      horsLigne: 'Connexion requise pour supprimer',
      titre: (nombre: number) =>
        nombre > 1 ? `Supprimer définitivement ces ${nombre} épreuves ?` : 'Supprimer définitivement cette épreuve ?',
      avertissement:
        'La suppression est définitive : les journaux, les saisies et les fichiers joints sont effacés du serveur et de tous les PC du club. Pour garder une trace, archivez plutôt que de supprimer.',
      saisie: (mot: string) => `Saisissez ${mot} pour confirmer`,
      valider: 'Supprimer définitivement',
      progression: (faites: number, total: number) => `Suppression… ${faites} / ${total}`,
      annuler: 'Annuler',
      compteRendu: (supprimees: number) =>
        supprimees > 1 ? `${supprimees} épreuves supprimées` : `${supprimees} épreuve supprimée`,
      restantes: (restantes: number) =>
        restantes > 1 ? `${restantes} épreuves n’ont pas été supprimées` : `${restantes} épreuve n’a pas été supprimée`,
      interrompue: 'La suppression s’est arrêtée : relancez-la quand la connexion ou la session est rétablie',
      nonTraitee: 'pas traitée',
      fermer: 'Fermer',
      /** US-043 : sélection mêlée de manifestations, de compétitions et d’épreuves. */
      cocherManifestation: (nom: string) => `Sélectionner la manifestation ${nom}`,
      cocherCompetition: (nom: string) => `Sélectionner la compétition ${nom}`,
      contientEnCours: 'Contient une épreuve en cours',
      avecParent: (parent: string) => `Supprimée avec ${parent}`,
      decompte: decompteTexte,
      selectionMixte: decompteTexte,
      titreMixte: (decompte: Decompte) => `Supprimer définitivement ${decompteTexte(decompte)} ?`,
      archiveesMasquees: (nombre: number) =>
        nombre > 1 ? `dont ${nombre} archivées masquées` : `dont ${nombre} archivée masquée`,
      compteRenduMixte: (decompte: Decompte) => `Supprimé : ${decompteTexte(decompte)}`,
      restantesMixte: (restantes: number) =>
        restantes > 1 ? `${restantes} éléments n’ont pas été supprimés` : `${restantes} élément n’a pas été supprimé`,
      types: { manifestation: 'manifestation', competition: 'compétition', epreuve: 'épreuve' },
      erreurs: {
        HORS_LIGNE: 'Connexion requise pour supprimer',
        SESSION_INVALIDE: 'Reconnectez-vous pour supprimer',
        ACCES_REFUSE: 'Seul un administrateur peut supprimer',
        EPREUVE_EN_COURS: 'Contient une épreuve en cours',
        EPREUVE_INCONNUE: 'Épreuve inconnue du serveur',
        EPREUVE_SUPPRIMEE: 'Déjà supprimée',
        MANIFESTATION_INCONNUE: 'Manifestation inconnue du serveur',
        MANIFESTATION_NON_VIDE: 'Manifestation non vide',
        COMPETITION_INCONNUE: 'Compétition inconnue du serveur',
        COMPETITION_NON_VIDE: 'Compétition non vide',
        ERREUR_INATTENDUE: 'Suppression impossible pour le moment',
      } satisfies Record<ErreurLot, string>,
    },
  },
  motDePasse: {
    titre: 'Changer mon mot de passe',
    temporaire: 'Votre mot de passe est temporaire : choisissez-en un nouveau pour accéder à l’application.',
    actuel: 'Mot de passe actuel',
    nouveau: 'Nouveau mot de passe',
    confirmation: 'Confirmation du nouveau mot de passe',
    aide: `${LONGUEUR_MIN_MOT_DE_PASSE} caractères au moins`,
    valider: 'Changer le mot de passe',
    enCours: 'Changement…',
    modifie: 'Mot de passe modifié',
    continuer: "Accueil de l'organisateur",
    retour: 'Retour à mon profil',
    horsLigne: 'Nécessite une connexion internet',
    champs: {
      MOT_DE_PASSE_TROP_COURT: `Le mot de passe doit faire au moins ${LONGUEUR_MIN_MOT_DE_PASSE} caractères`,
      IDENTIQUE_A_L_ACTUEL: 'Le nouveau mot de passe doit être différent de l’actuel',
      CONFIRMATION_DIFFERENTE: 'Les deux mots de passe sont différents',
      ACTUEL_VIDE: 'Saisissez votre mot de passe actuel',
    } satisfies Record<ErreurNouveauMotDePasse | 'CONFIRMATION_DIFFERENTE' | 'ACTUEL_VIDE', string>,
    erreurs: {
      MOT_DE_PASSE_INCORRECT: 'Mot de passe actuel incorrect',
      TROP_D_ESSAIS: 'Trop d’essais : réessayez dans 15 minutes',
      MOT_DE_PASSE_ACTUEL_REQUIS: 'Saisissez votre mot de passe actuel',
      SESSION_INVALIDE: 'Session expirée : reconnectez-vous',
      HORS_LIGNE: 'Réseau perdu : le mot de passe n’a pas changé, réessayez',
      SERVEUR_NON_CONFIGURE: 'Serveur non configuré : changement impossible',
      ERREUR_INATTENDUE: 'Erreur inattendue du serveur : réessayez',
    } satisfies Record<ErreurChangementMotDePasse, string>,
  },
  /** US-019 : demande d'un lien de réinitialisation par e-mail. */
  oubli: {
    titre: 'Mot de passe oublié',
    explication:
      'Saisissez l’e-mail de votre compte : nous vous enverrons un lien pour choisir un nouveau mot de passe.',
    email: 'E-mail',
    valider: 'Recevoir un lien',
    enCours: 'Envoi…',
    envoye: 'Si un compte existe pour cet e-mail, un lien vient d’y être envoyé',
    administrateur: 'Vous pouvez aussi demander à un administrateur du club de réinitialiser votre mot de passe',
    retour: 'Retour à la connexion',
    horsLigne: 'Nécessite une connexion internet',
    erreurs: {
      TROP_D_ESSAIS: 'Trop d’essais : réessayez dans 15 minutes',
      HORS_LIGNE: 'Nécessite une connexion internet',
      SERVEUR_NON_CONFIGURE: 'Serveur non configuré : demande impossible',
      ERREUR_INATTENDUE: 'Erreur inattendue du serveur : réessayez',
    } satisfies Record<ErreurDemandeLien, string>,
  },
  /** US-019 : page du lien reçu par e-mail, pour choisir un nouveau mot de passe. */
  reinitialisation: {
    titre: 'Choisir un nouveau mot de passe',
    nouveau: 'Nouveau mot de passe',
    confirmation: 'Confirmation du nouveau mot de passe',
    aide: `${LONGUEUR_MIN_MOT_DE_PASSE} caractères au moins`,
    valider: 'Enregistrer le mot de passe',
    enCours: 'Enregistrement…',
    horsLigne: 'Nécessite une connexion internet',
    nouvelleDemande: 'Faire une nouvelle demande',
    champs: {
      MOT_DE_PASSE_TROP_COURT: `Le mot de passe doit faire au moins ${LONGUEUR_MIN_MOT_DE_PASSE} caractères`,
      CONFIRMATION_DIFFERENTE: 'Les deux mots de passe sont différents',
    },
    erreurs: {
      LIEN_INVALIDE: 'Ce lien n’est plus valable : faites une nouvelle demande',
      TROP_D_ESSAIS: 'Trop d’essais : réessayez dans 15 minutes',
      HORS_LIGNE: 'Nécessite une connexion internet',
      SERVEUR_NON_CONFIGURE: 'Serveur non configuré : enregistrement impossible',
      ERREUR_INATTENDUE: 'Erreur inattendue du serveur : réessayez',
    } satisfies Record<ErreurNouveauMotDePasseParLien, string>,
  },
  /** US-016 : page « Mon profil ». */
  profil: {
    titre: 'Mon profil',
    nom: 'Nom',
    email: 'E-mail',
    role: 'Rôle',
    avatar: 'Couleur de l’avatar',
    avatarDe: (nom: string) => `Avatar de ${nom}`,
    couleur: (couleur: CouleurAvatar) => `Couleur ${textes.profil.couleurs[couleur]}`,
    couleurs: {
      sarcelle: 'sarcelle',
      ardoise: 'ardoise',
      foret: 'forêt',
      ocre: 'ocre',
      brique: 'brique',
      prune: 'prune',
      ciel: 'ciel',
      terre: 'terre',
    } satisfies Record<CouleurAvatar, string>,
    enregistrer: 'Enregistrer',
    enCours: 'Enregistrement…',
    enregistre: 'Profil enregistré',
    horsLigne: 'Nécessite une connexion internet',
    changerMotDePasse: 'Changer mon mot de passe',
    retour: "Retour à l'accueil de l'organisateur",
    champs: {
      NOM_VIDE: 'Le nom est obligatoire',
      NOM_TROP_LONG: 'Le nom fait au plus 100 caractères',
    } satisfies Partial<Record<ErreurSaisieCompte, string>>,
    erreurs: {
      SESSION_INVALIDE: 'Session expirée : reconnectez-vous',
      HORS_LIGNE: 'Réseau perdu : rien n’a changé, réessayez',
      SERVEUR_NON_CONFIGURE: 'Serveur non configuré : enregistrement impossible',
      ERREUR_INATTENDUE: 'Erreur inattendue du serveur : réessayez',
    } satisfies Record<ErreurProfil, string>,
  },
  comptes: {
    titre: 'Comptes',
    entree: 'Comptes',
    horsLigne: 'Nécessite une connexion internet',
    chargement: 'Chargement des comptes…',
    colonnes: {
      nom: 'Nom',
      email: 'E-mail',
      role: 'Rôle',
      etat: 'État',
      derniereConnexion: 'Dernière connexion',
      actions: 'Actions',
    },
    actif: 'Actif',
    desactive: 'Désactivé',
    temporaire: 'mot de passe temporaire',
    jamais: 'Jamais',
    creation: {
      titre: 'Nouveau compte',
      email: 'E-mail',
      nom: 'Nom',
      role: 'Rôle',
      valider: 'Créer le compte',
      enCours: 'Création…',
    },
    motDePasseTemporaire: {
      titre: 'Compte créé',
      titreReinitialisation: 'Mot de passe réinitialisé',
      explication: (nom: string) =>
        `Transmettez ce mot de passe temporaire à ${nom} : il ne sera plus affiché. Il devra le changer à sa première connexion.`,
      copier: 'Copier',
      copie: 'Copié',
      fermer: 'J’ai transmis le mot de passe',
    },
    modifier: (nom: string) => `Modifier ${nom}`,
    reinitialiser: (nom: string) => `Réinitialiser le mot de passe de ${nom}`,
    confirmerReinitialisation: 'Confirmer la réinitialisation',
    desactiver: (nom: string) => `Désactiver ${nom}`,
    reactiver: (nom: string) => `Réactiver ${nom}`,
    confirmerDesactivation: 'Confirmer la désactivation',
    supprimer: (nom: string) => `Supprimer ${nom}`,
    suppression: {
      consigne: (email: string) => `Pour supprimer définitivement ce compte, saisissez son e-mail : ${email}`,
      champ: 'E-mail du compte à supprimer',
      confirmer: 'Supprimer définitivement',
    },
    enregistrer: 'Enregistrer',
    annuler: 'Annuler',
    champs: {
      EMAIL_INVALIDE: 'E-mail invalide',
      NOM_VIDE: 'Le nom est obligatoire',
      NOM_TROP_LONG: 'Le nom fait au plus 100 caractères',
    } satisfies Partial<Record<ErreurSaisieCompte, string>>,
    erreurs: {
      ACCES_REFUSE: 'Réservé aux administrateurs',
      EMAIL_DEJA_UTILISE: 'Un compte utilise déjà cet e-mail',
      DERNIER_ADMINISTRATEUR: 'Il doit rester au moins un administrateur actif',
      COMPTE_INCONNU: 'Ce compte n’existe plus : rechargez la page',
      SESSION_INVALIDE: 'Session expirée : reconnectez-vous',
      HORS_LIGNE: 'Nécessite une connexion internet',
      SERVEUR_NON_CONFIGURE: 'Serveur non configuré',
      ERREUR_INATTENDUE: 'Erreur inattendue du serveur : réessayez',
    } satisfies Record<ErreurComptes, string>,
  },
  /** US-025 : création et page d'une épreuve. */
  epreuves: {
    nouvelle: 'Nouvelle épreuve',
    titreNouvelle: 'Nouvelle épreuve',
    nom: 'Nom',
    exempleNom: 'Championnats NA sabre M13',
    arme: 'Arme',
    choisirArme: 'Choisir une arme',
    type: 'Type',
    categorie: 'Catégorie',
    aucuneCategorie: 'Aucune',
    categorieLibre: 'Autre (saisie libre)',
    categorieLibreChamp: 'Catégorie libre',
    sexe: 'Sexe',
    aucunSexe: 'Non précisé',
    date: 'Date',
    horaires: 'Horaires',
    appel: 'Appel',
    scratch: 'Scratch',
    debutPoules: 'Début des poules',
    lieu: 'Lieu',
    commentaire: 'Commentaire',
    facultatif: 'facultatif',
    creer: 'Créer l’épreuve',
    /** US-027 : modification d'une épreuve. */
    modifier: 'Modifier',
    titreModification: 'Modifier l’épreuve',
    enregistrer: 'Enregistrer',
    enregistrement: 'Enregistrement…',
    enCours: 'Création…',
    /** US-051 CA-6 : avertissement d'une copie dont le nom est déjà pris, et sa validation malgré tout. */
    nomDejaPris: 'Une épreuve porte déjà ce nom dans cette compétition.',
    creerQuandMeme: 'Créer quand même',
    annuler: 'Annuler',
    armes: {
      sabre: 'Sabre',
      epee: 'Épée',
      fleuret: 'Fleuret',
      sabreLaser: 'Sabre laser',
    } satisfies Record<Arme, string>,
    types: {
      individuelle: 'Individuelle',
      equipes2: 'Équipes de 2',
      equipes3: 'Équipes de 3',
    } satisfies Record<TypeEpreuve, string>,
    sexes: {
      hommes: 'Hommes',
      dames: 'Dames',
      mixte: 'Mixte',
    } satisfies Record<Sexe, string>,
    statuts: {
      preparation: 'En préparation',
      enCours: 'En cours',
      terminee: 'Terminée',
      archivee: 'Archivée',
    } satisfies Record<Statut, string>,
    publiee: 'Publiée',
    nonPubliee: 'Non publiée',
    pilote: 'Ce PC est le pilote',
    lectureSeule: 'Lecture seule : cette épreuve est pilotée par un autre PC',
    autreOnglet: 'Cette épreuve est ouverte dans un autre onglet : lecture seule ici',
    /** US-048 : grille des épreuves, pour créer d'un coup les épreuves d'une compétition. */
    grille: {
      ajouter: 'Ajouter des épreuves',
      ajouterA: (competition: string) => `Ajouter des épreuves à ${competition}`,
      titre: 'Ajouter des épreuves',
      chargement: 'Chargement de la compétition…',
      introuvable:
        'Cette compétition est introuvable sur cet appareil : ouvrez la liste du club en ligne, puis réessayez.',
      ariane: 'Compétition',
      sansArme: 'toutes armes',
      armeDuLot: 'Arme du lot',
      armeDuLotAide:
        'Cette compétition n’a pas d’arme : l’arme choisie vaut pour tout le lot. Refaites un lot pour une autre arme.',
      choisirArme: 'Choisir une arme',
      grille: 'Catégories et sexes',
      case: (categorie: string, sexe: string) => `${categorie} ${sexe}`,
      dejaCreee: 'déjà créée',
      categorieLibre: 'Catégorie libre',
      categorieLibreExemple: 'Open, Vétérans 50+',
      ajouterCategorie: 'Ajouter la catégorie',
      categoriesLibres: {
        CATEGORIE_VIDE: 'Saisissez le nom de la catégorie',
        CATEGORIE_TROP_LONGUE: 'La catégorie fait au plus 30 caractères',
        CATEGORIE_EXISTANTE: 'Cette catégorie est déjà dans la grille',
      } as Record<string, string>,
      reglages: 'Réglages communs',
      reglagesAide:
        'Ils s’appliquent à toutes les épreuves du lot, et restent modifiables ensuite épreuve par épreuve.',
      appelDuJour: (jour: string) => `Appel du ${jour}`,
      touchesPoules: 'Touches en poules',
      touchesTableau: 'Touches au tableau',
      matchTroisieme: 'Match pour la 3e place',
      lieuRepris: (lieu: string) => `Lieu : ${lieu}`,
      seraCreees: (nombre: number) =>
        nombre > 1 ? `${nombre} épreuves seront créées` : `${nombre} épreuve sera créée`,
      aucuneCochee: 'Aucune case cochée : cochez les catégories et les sexes des épreuves à créer.',
      /** US-078 CA-1 : en-tête des colonnes de jours, et nom de chaque bouton radio de jour d'une ligne. */
      jours: 'Jours',
      /** En-tête d'une colonne de jour : « sam. 21 ». */
      enteteJour: (date: string) =>
        new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }),
      jourDesEpreuves: (categorie: string, jour: string) => `Jour des épreuves ${categorie} : ${jour}`,
      /** US-080 CA-2 : infobulle d'un bouton de jour inaccessible. */
      jourInactif: 'Cochez une case de la ligne pour choisir son jour',
      /** US-078 CA-3 : la liste des épreuves n'existe plus ; une erreur s'affiche sous le récapitulatif. */
      erreurEpreuve: (epreuve: string, erreur: string) => `${epreuve} : ${erreur}`,
      sansJour: 'Sans jour',
      repartition: (jour: string, nombre: number) => `${jour} : ${nombre}`,
      creer: (nombre: number) => (nombre > 1 ? `Créer les ${nombre} épreuves` : 'Créer l’épreuve'),
      creation: 'Création…',
      annuler: 'Annuler',
      /** Compte rendu d'un lot interrompu : les cases manquantes restent cochées pour relancer. */
      partiel: (creees: number, manquantes: number) =>
        `${creees} épreuve${creees > 1 ? 's' : ''} créée${creees > 1 ? 's' : ''}, ${manquantes} manquante${manquantes > 1 ? 's' : ''} : les cases restent cochées, relancez la création.`,
      sansFormule: (nombre: number) =>
        nombre > 1
          ? `${nombre} épreuves gardent la formule par défaut : changez-la dans chacune d’elles.`
          : '1 épreuve garde la formule par défaut : changez-la dans l’épreuve.',
      clubInconnu: 'Compte sans club : aucune épreuve n’a été créée',
    },
    /** US-029 : prise de main depuis un autre PC. */
    prise: {
      bouton: 'Prendre la main',
      horsLigne: 'Nécessite une connexion internet',
      chargement: 'Recherche du pilote…',
      confirmer: 'Prendre la main sur cette épreuve ?',
      piloteConnecte: (libelle: string) => `Le PC de ${libelle} est connecté et pilote cette épreuve`,
      piloteHorsLigne: (libelle: string) => `Cette épreuve est pilotée par le PC de ${libelle}`,
      valider: 'Prendre la main',
      annuler: 'Annuler',
      mainDejaPrise: (libelle: string) => `La main vient d’être prise par ${libelle}`,
      perte: (libelle: string) => `${libelle} a pris la main depuis un autre PC`,
      ecartes: (nombre: number) =>
        nombre > 1
          ? `${nombre} modifications faites hors ligne n’ont pas été reprises`
          : `${nombre} modification faite hors ligne n’a pas été reprise`,
      exporter: 'Exporter en JSON',
      compris: 'Compris',
      erreurs: {
        HORS_LIGNE: 'Nécessite une connexion internet',
        SESSION_INVALIDE: 'Reconnectez-vous pour prendre la main',
        EPREUVE_INCONNUE: 'Épreuve inconnue du serveur',
        ERREUR_INATTENDUE: 'Prise de main impossible pour le moment',
        ACCES_REFUSE: 'Prise de main impossible pour le moment',
        EPREUVE_EN_COURS: 'Prise de main impossible pour le moment',
        EPREUVE_SUPPRIMEE: 'Cette épreuve a été supprimée',
      },
    },
    /** US-039 : suppression définitive d'une épreuve, réservée aux administrateurs. */
    suppression: {
      bouton: 'Supprimer définitivement…',
      horsLigne: 'Connexion requise pour supprimer',
      enCours: 'Une épreuve en cours ne peut pas être supprimée',
      titre: 'Supprimer définitivement cette épreuve ?',
      avertissement:
        'La suppression est définitive : le journal, les saisies et les fichiers joints sont effacés du serveur et de tous les PC du club. Pour garder une trace, archivez l’épreuve plutôt que de la supprimer.',
      saisie: (nom: string) => `Saisissez « ${nom} » pour confirmer`,
      valider: 'Supprimer définitivement',
      suppression: 'Suppression…',
      annuler: 'Annuler',
      /** Annonce faite une seule fois sur un PC dont la copie vient d'être effacée. */
      annonce: (nom: string, abandonnees: number) =>
        `L’épreuve ${nom || 'sans nom'} a été supprimée par un administrateur${
          abandonnees > 0 ? '. Des saisies non envoyées ont été abandonnées' : ''
        }`,
      fermer: 'Fermer',
      erreurs: {
        HORS_LIGNE: 'Connexion requise pour supprimer',
        SESSION_INVALIDE: 'Reconnectez-vous pour supprimer',
        ACCES_REFUSE: 'Seul un administrateur peut supprimer une épreuve',
        EPREUVE_EN_COURS: 'Une épreuve en cours ne peut pas être supprimée',
        EPREUVE_INCONNUE: 'Épreuve inconnue du serveur',
        EPREUVE_SUPPRIMEE: 'Cette épreuve est déjà supprimée',
        ERREUR_INATTENDUE: 'Suppression impossible pour le moment',
      },
    },
    pasEncoreEnvoyee: 'Pas encore envoyée',
    /** US-094 CA-3 : la WebSocket d'une épreuve pilotée ici est perdue ; rien ne s'arrête sur ce PC. */
    horsLignePilote: 'Hors ligne : la compétition continue sur ce PC',
    /** US-130 : retour du réseau, envoi en cours puis résumé. */
    retourEnvoi: 'De retour en ligne : envoi en cours…',
    retourResume: (envoyees: number, recuperees: number, ecartees: number) => {
      const parties = [
        envoyees > 0 && `${envoyees} modification${envoyees > 1 ? 's' : ''} envoyée${envoyees > 1 ? 's' : ''}`,
        recuperees > 0 &&
          `${recuperees} saisie${recuperees > 1 ? 's' : ''} smartphone récupérée${recuperees > 1 ? 's' : ''}`,
        ecartees > 0 && `${ecartees} écartée${ecartees > 1 ? 's' : ''}`,
      ].filter((partie): partie is string => Boolean(partie));
      return parties.length > 0 ? `De retour en ligne : ${parties.join(', ')}` : 'De retour en ligne';
    },
    enAttente: (nombre: number) =>
      nombre > 1 ? `${nombre} modifications en attente d’envoi` : `${nombre} modification en attente d’envoi`,
    /** US-022 : date de la copie d'une épreuve pilotée par un autre PC (« Copie du 28/10 à 14 h 05 »). */
    copieDu: (date: number) => {
      const jour = new Date(date);
      const deux = (nombre: number) => String(nombre).padStart(2, '0');
      return `Copie du ${deux(jour.getDate())}/${deux(jour.getMonth() + 1)} à ${jour.getHours()} h ${deux(jour.getMinutes())}`;
    },
    dateLongue: (date: string) =>
      new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`)),
    dateHorsManifestation: (debut: string, fin: string) => {
      const jour = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`;
      return `La date doit être comprise entre le ${jour(debut)} et le ${jour(fin)}`;
    },
    /** US-045 CA-1 : toute épreuve est dans une compétition, choisie dans la liste du club. */
    competition: 'Compétition',
    choisirCompetition: 'Choisissez la compétition',
    nouvelleCompetitionSeule: 'Nouvelle compétition seule (en ligne)',
    nouvelleCompetitionSeuleHorsLigne: 'Nouvelle compétition seule (nécessite une connexion internet)',
    /** CA-4 : une compétition seule et sa première épreuve portent le même nom. */
    nomCompetitionSeule: 'Nom de la compétition et de son épreuve',
    seule: 'seule',
    choisirDate: 'Choisir un jour',
    /** US-024 CA-4 : « Cette compétition est au sabre ». */
    competitionAu: (arme: Arme) =>
      `Cette compétition est ${{ sabre: 'au sabre', epee: 'à l’épée', fleuret: 'au fleuret', sabreLaser: 'au sabre laser' }[arme]}`,
    formuleTitre: 'Formule',
    formule: (touchesPoules: number, touchesTableau: number, matchTroisieme = false) =>
      `Poules en ${touchesPoules} touches, sans élimination · Tableau en ${touchesTableau} touches` +
      (matchTroisieme ? ' · Match pour la 3e place' : ''),
    modifierFormule: 'Formule',
    relais: (touches: number) => `Rencontres en relais à ${touches} touches`,
    /** US-028 CA-4 : avant de changer la formule d'une épreuve en cours. */
    formuleConfirmation: (matchs: number) =>
      matchs === 1
        ? '1 match déjà joué ne change pas : la nouvelle formule s’applique aux matchs restants'
        : `${matchs} matchs déjà joués ne changent pas : la nouvelle formule s’applique aux matchs restants`,
    /** US-032 : page « Paramètres » d'une épreuve. */
    lienParametres: 'Paramètres',
    /** US-105 (planche 21) : appareils connectés. */
    appareils: {
      titre: 'Appareils connectés',
      resume: (enLigne: number, exclus: number) =>
        `${enLigne} en ligne${exclus > 0 ? ` · ${exclus} exclu${exclus > 1 ? 's' : ''}` : ''}`,
      aide: '« Exclure » coupe un seul appareil. Pour couper tout un rôle, régénérez son QR code.',
      horsLigne: 'Hors ligne : les appareils ne peuvent pas se connecter.',
      pasPilote: 'Seul le PC pilote voit les appareils connectés.',
      aucun: 'Aucun appareil n’est encore entré par QR code.',
      colonnes: {
        appareil: 'Appareil',
        qui: 'Qui',
        ou: 'Poule',
        etat: 'État',
        saisies: 'Saisies',
        actions: 'Actions',
      },
      arbitre: 'arbitre',
      tireur: 'tireur',
      tireuse: 'tireuse',
      poule: (n: number) => `Poule ${n}`,
      connecte: 'Connecté',
      connectee: 'Connectée',
      exclu: 'Exclu',
      exclue: 'Exclue',
      vuA: (heure: string) => `Vu à ${heure}`,
      jamaisVu: 'Déconnecté',
      saisies: (n: number, refusees: number) =>
        refusees > 0 ? `${n} (${refusees} refusée${refusees > 1 ? 's' : ''})` : `${n}`,
      exclure: 'Exclure cet appareil…',
      readmettre: 'Réadmettre',
      confirmerTitre: (qui: string) => `Exclure ${qui} ?`,
      confirmerDetail:
        'Sa connexion est coupée et il ne peut plus revenir avec cet appareil. Depuis un autre navigateur, il pourrait rescanner le QR code : pour couper tout un rôle, régénérez son QR code.',
      annuler: 'Annuler',
      exclureConfirmer: 'Exclure',
    },
    parametresPage: {
      titre: 'Paramètres de l’épreuve',
      mention:
        'Ces réglages sont enregistrés. Ils seront appliqués quand la saisie par smartphone et l’affichage public seront disponibles.',
      arbitres: 'Arbitres',
      tireurs: 'Tireurs',
      affichage: 'Affichage public',
      droits: 'Droits des smartphones',
      reglages: {
        arbitreSaisitScores: 'Saisir les scores de poule et de tableau',
        arbitreDeplace: 'Déplacer une poule ou un match de piste',
        tireurSaisitPoule: 'Saisir les scores des matchs de sa poule',
        tireurSaisitTableau: 'Saisir le score de ses matchs de tableau',
        correctionScore: 'Correction d’un score déjà saisi',
        prenomInitiale: 'Afficher les noms au public sous la forme « Prénom N. »',
      },
      corrections: { arbitre: 'Arbitre seulement', personne: 'Personne' },
      enregistrer: 'Enregistrer les paramètres',
      enregistre: 'Paramètres enregistrés',
      archivee: 'Cette épreuve est archivée : ses paramètres sont en lecture seule',
      retour: 'Retour à l’épreuve',
      erreurs: {
        PARAMETRE_INVALIDE: 'Un réglage a une valeur invalide',
        CORRECTION_SCORE_INVALIDE: 'Choisissez qui peut corriger un score',
      },
    },
    /** US-096 : accès par QR code (planche 21), section de la page « Paramètres », et page d'impression. */
    accesQr: {
      titre: 'Accès par QR code',
      explication:
        'Un QR code par rôle, valable pour toute l’épreuve, sans compte. Affichez-les dans la salle ou imprimez-les : les arbitres choisissent leur piste, les tireurs leur nom.',
      imprimer: 'Imprimer les QR codes',
      copier: 'Copier le lien',
      copie: 'Lien copié',
      regenerer: 'Régénérer…',
      roles: { arbitre: 'Arbitres', tireur: 'Tireurs' },
      droits: {
        arbitre: 'Saisissent les scores de poule et de tableau de leur piste ; corrigent un score.',
        tireur: 'Saisissent les matchs de leur poule et leurs matchs de tableau.',
      },
      qrDe: (role: string, epreuve: string) => `QR code des ${role.toLowerCase()} de ${epreuve}`,
      lienDe: (role: string) => `Lien des ${role.toLowerCase()}`,
      tireursSansSaisie: 'Les tireurs ne peuvent pas saisir (Paramètres)',
      horsLigne: 'Nécessite une connexion',
      sansJeton: 'Les QR codes se créent en ligne : reconnectez ce PC pour les obtenir.',
      sansJetonLecture: 'Le pilote n’a pas encore créé les QR codes de cette épreuve.',
      termine: 'Cette épreuve est terminée : ses QR codes ne donnent plus accès.',
      confirmation: {
        titre: (role: string) => `Régénérer le QR code des ${role.toLowerCase()} ?`,
        texte:
          'L’ancien QR code cessera aussitôt de donner accès : les appareils entrés avec lui devront scanner le nouveau.',
        confirmer: 'Régénérer',
        annuler: 'Annuler',
      },
      erreurs: {
        HORS_LIGNE: 'Nécessite une connexion',
        PAS_PILOTE: 'Seul le PC pilote peut régénérer un QR code',
        SESSION_INVALIDE: 'Votre session a expiré : reconnectez-vous',
        ERREUR_INATTENDUE: 'Le QR code n’a pas pu être régénéré, réessayez',
      },
      impression: {
        titre: 'QR codes de l’épreuve',
        modeEmploi: {
          arbitre: 'Arbitres : scannez pour saisir les scores de votre piste.',
          tireur: 'Tireurs : scannez pour suivre vos matchs et saisir vos scores.',
        },
        imprimer: 'Imprimer',
        retour: 'Retour aux paramètres',
        aucun: 'Aucun QR code à imprimer : ouvrez d’abord les paramètres de l’épreuve en ligne.',
      },
    },
    /** US-028 : page « Formule » d'une épreuve. */
    formulePage: {
      titre: 'Formule de l’épreuve',
      touchesPoules: 'Touches en poules',
      touchesTableau: 'Touches au tableau',
      matchTroisieme: 'Match pour la 3e place',
      /** US-149 : déroulé d'une épreuve par équipes. */
      deroule: 'Déroulé',
      deroules: { tableauDirect: 'Tableau direct', poulesTableau: 'Poules puis tableau' },
      derouleAide: 'En tableau direct, les équipes sont placées au tableau d’après leur rang.',
      touchesRencontresPoule: 'Touches des rencontres de poule',
      relaisFixe: (touches: number) => `Rencontres en relais à ${touches} touches (fixées par le type de l’épreuve)`,
      autresFormules: 'D’autres formules seront proposées plus tard.',
      enregistrer: 'Enregistrer la formule',
      confirmer: 'Confirmer le changement',
      historique: 'Historique de la formule',
      historiqueVide: 'Aucun changement de formule',
      retour: 'Retour à l’épreuve',
      le: (date: number) => {
        const jour = new Date(date);
        const deux = (nombre: number) => String(nombre).padStart(2, '0');
        return `${deux(jour.getDate())}/${deux(jour.getMonth() + 1)} à ${jour.getHours()} h ${deux(jour.getMinutes())}`;
      },
      changement: {
        touchesPoules: (touches: number) => `Poules en ${touches} touches`,
        touchesTableau: (touches: number) => `Tableau en ${touches} touches`,
        matchTroisieme: (actif: boolean) =>
          actif ? 'Match pour la 3e place activé' : 'Match pour la 3e place désactivé',
        deroule: (deroule: 'tableauDirect' | 'poulesTableau') =>
          deroule === 'tableauDirect' ? 'Tableau direct' : 'Poules puis tableau',
      },
      erreurs: {
        TOUCHES_POULES_INVALIDES: 'Les poules se jouent en 3 à 10 touches',
        TOUCHES_TABLEAU_INVALIDES: 'Le tableau se joue en 10 ou 15 touches',
        MATCH_TROISIEME_INVALIDE: 'Choisissez si le match pour la 3e place est joué',
        FORMULE_FIGEE: 'Cette épreuve est terminée : sa formule n’est plus modifiable',
        /** US-114 CA-5 : le match pour la 3e place ne se retire plus une fois tiré. */
        TROISIEME_PLACE_REGLEE: 'Le match pour la 3e place est déjà tiré',
        DEROULE_INVALIDE: 'Choisissez tableau direct, ou poules puis tableau',
      },
    },
    chargement: 'Chargement de l’épreuve…',
    introuvable: 'Épreuve introuvable sur cet appareil',
    retour: "Retour à l'accueil de l'organisateur",
    champs: {
      NOM_VIDE: 'Le nom est obligatoire',
      NOM_TROP_LONG: 'Le nom fait au plus 100 caractères',
      ARME_INVALIDE: 'Choisissez une arme',
      ARME_DIFFERENTE_COMPETITION: 'Cette compétition est d’une autre arme',
      TYPE_INVALIDE: 'Choisissez un type',
      CATEGORIE_TROP_LONGUE: 'La catégorie fait au plus 30 caractères',
      SEXE_INVALIDE: 'Choisissez un sexe',
      DATE_INVALIDE: 'Date invalide',
      DATE_OBLIGATOIRE: 'La date est obligatoire dans une manifestation',
      DATE_HORS_MANIFESTATION: 'La date doit être comprise dans la manifestation',
      HORAIRE_INVALIDE: 'Heure invalide',
      SCRATCH_AVANT_APPEL: 'Le scratch doit être après l’appel',
      POULES_AVANT_SCRATCH: 'Le début des poules doit être après le scratch',
      POULES_AVANT_APPEL: 'Le début des poules doit être après l’appel',
      LIEU_TROP_LONG: 'Le lieu fait au plus 200 caractères',
      COMMENTAIRE_TROP_LONG: 'Le commentaire fait au plus 2 000 caractères',
      RATTACHEMENT_OBLIGATOIRE: 'Choisissez la compétition de cette épreuve',
      RATTACHEMENT_INVALIDE: 'Cette compétition est inconnue de cet appareil : choisissez-en une autre',
    } satisfies Record<ErreurEpreuve, string>,
    erreurs: {
      ECRITURE_IMPOSSIBLE:
        'Enregistrement impossible sur cet appareil (espace plein ou navigation privée) : rien n’a été enregistré',
      CLUB_INCONNU: 'Reconnectez-vous une fois en ligne pour créer une épreuve sur cet appareil',
      INTROUVABLE: 'Épreuve introuvable sur cet appareil',
      PAS_PILOTE: 'Cette épreuve est pilotée par un autre PC : modification impossible ici',
      EPREUVE_ARCHIVEE: 'Cette épreuve est archivée : elle n’est plus modifiable',
      CHAMP_FIGE: 'Ce champ ne peut plus être modifié',
      JOURNAL_INCOHERENT: 'Le journal de cette épreuve est incohérent : modification impossible',
      HORS_LIGNE: 'Réseau perdu : la compétition n’a pas été créée, réessayez',
      SESSION_INVALIDE: 'Session expirée : reconnectez-vous',
      ERREUR_INATTENDUE: 'Création impossible pour le moment',
    } satisfies Record<ErreurCreation | ErreurModification | ErreurCompetitionSeule, string>,
  },
  /** US-024 : compétitions, sous chaque manifestation de la page « Manifestations ». */
  competitions: {
    titre: 'Compétitions',
    nouvelle: 'Nouvelle compétition',
    titreModification: (nom: string) => `Modifier la compétition « ${nom} »`,
    nom: 'Nom de la compétition',
    exempleNom: 'Championnats de Nouvelle-Aquitaine de sabre',
    arme: 'Arme',
    aucuneArme: 'Toutes armes',
    commentaire: 'Commentaire',
    facultatif: 'facultatif',
    creer: 'Créer la compétition',
    enregistrer: 'Enregistrer',
    enCours: 'Enregistrement…',
    annuler: 'Annuler',
    boutonModifier: 'Modifier',
    boutonSupprimer: 'Supprimer',
    ajouter: (manifestation: string) => `Ajouter une compétition à ${manifestation}`,
    modifier: (nom: string) => `Modifier la compétition ${nom}`,
    supprimer: (nom: string) => `Supprimer la compétition ${nom}`,
    confirmerSuppression: (nom: string) => `Supprimer définitivement la compétition « ${nom} » ?`,
    confirmer: 'Supprimer',
    /** US-041 : suppression avec son contenu, réservée aux administrateurs. */
    contenu: {
      horsLigne: 'Connexion requise pour supprimer',
      titre: (nom: string) => `Supprimer définitivement la compétition « ${nom} » ?`,
      combien: (nombre: number | null) =>
        nombre === null
          ? 'Les épreuves de la compétition sont supprimées avec elle.'
          : nombre === 0
            ? 'La compétition ne contient aucune épreuve.'
            : nombre > 1
              ? `Les ${nombre} épreuves de la compétition (archivées comprises) sont supprimées avec elle.`
              : 'L’épreuve de la compétition est supprimée avec elle.',
      avertissement:
        'La suppression est définitive : les journaux, les saisies et les fichiers joints sont effacés du serveur et de tous les PC du club.',
      saisie: (nom: string) => `Saisissez « ${nom} » pour confirmer`,
      valider: 'Supprimer définitivement',
      progression: (faites: number, total: number) => `Suppression… ${faites} / ${total}`,
      annuler: 'Annuler',
      enCours: (noms: string[]) => `Une épreuve en cours empêche la suppression : ${noms.join(', ')}`,
      interrompue: (restantes: number) =>
        restantes > 1
          ? `${restantes} épreuves restent, la compétition n’est pas supprimée : relancez la suppression`
          : `${restantes} épreuve reste, la compétition n’est pas supprimée : relancez la suppression`,
    },
    recharger: 'Recharger',
    aucune: 'Aucune compétition',
    horsLigne: 'Nécessite une connexion internet',
    modifieeEntreTemps: (nom: string) => `Modifiée entre-temps par ${nom} : rechargez`,
    champs: {
      NOM_VIDE: 'Le nom est obligatoire',
      NOM_TROP_LONG: 'Le nom fait au plus 100 caractères',
      MANIFESTATION_INVALIDE: 'Manifestation invalide',
      ARME_INVALIDE: 'Choisissez une arme de la liste',
      COMMENTAIRE_TROP_LONG: 'Le commentaire fait au plus 2 000 caractères',
    } satisfies Record<ErreurCompetition, string>,
    erreurs: {
      HORS_LIGNE: 'Réseau perdu : rien n’a changé, réessayez',
      SESSION_INVALIDE: 'Session expirée : reconnectez-vous',
      MANIFESTATION_INCONNUE: 'Cette manifestation n’existe plus : rechargez',
      COMPETITION_INCONNUE: 'Cette compétition n’existe plus : rechargez',
      COMPETITION_NON_VIDE: 'Cette compétition contient des épreuves : elle ne se supprime pas',
      ACCES_REFUSE: 'Seul un administrateur peut supprimer un élément qui contient des épreuves',
      EPREUVE_EN_COURS: 'Une épreuve en cours empêche la suppression',
      ERREUR_INATTENDUE: 'Erreur inattendue du serveur : réessayez',
    } satisfies Record<ErreurCompetitions, string>,
  },
  /** US-057 : « Supprimer… » unique d'une manifestation, d'une compétition ou d'une épreuve. */
  suppressionUnique: {
    action: 'Supprimer…',
    horsLigne: 'Connexion requise pour supprimer',
    enCours: 'Une épreuve en cours ne peut pas être supprimée',
    /** Sous-titre de l'action dans le menu « ⋯ » : la portée est visible avant le clic. */
    sousTitre: (contenu: {
      type: 'manifestation' | 'competition' | 'epreuve';
      competitions: number;
      epreuves: number;
    }) => {
      if (contenu.type === 'epreuve') return 'définitivement, après confirmation';
      const epreuves =
        contenu.epreuves === 0 ? null : contenu.epreuves === 1 ? 'son épreuve' : `ses ${contenu.epreuves} épreuves`;
      const competitions =
        contenu.competitions === 0
          ? null
          : contenu.competitions === 1
            ? 'sa compétition'
            : `ses ${contenu.competitions} compétitions`;
      const parties = [competitions, epreuves].filter((partie) => partie !== null);
      return parties.length === 0 ? 'après confirmation' : `avec ${parties.join(' et ')}, après confirmation`;
    },
    /** Confirmation simple d'un objet vide (CA-2). */
    titreVide: (nom: string) => `Supprimer « ${nom} » ?`,
    /** Confirmation d'un objet non vide (CA-3). */
    titre: (type: 'manifestation' | 'competition', nom: string) =>
      `Supprimer définitivement la ${type === 'manifestation' ? 'manifestation' : 'compétition'} « ${nom} » ?`,
    annonce: (competitions: number, epreuves: number) => {
      const c = competitions === 0 ? null : competitions === 1 ? '1 compétition' : `${competitions} compétitions`;
      const e = epreuves === 0 ? null : epreuves === 1 ? '1 épreuve' : `${epreuves} épreuves`;
      return `Seront aussi supprimées : ${[c, e].filter((partie) => partie !== null).join(' et ')}, archivées comprises.`;
    },
    avertissement:
      'La suppression est définitive : les journaux, les saisies et les fichiers joints sont effacés du serveur et de tous les PC du club.',
    saisie: (nom: string) => `Saisissez « ${nom} » pour confirmer`,
    supprimer: 'Supprimer',
    supprimerDefinitivement: 'Supprimer définitivement',
    annuler: 'Annuler',
    progression: (faites: number, total: number) => `Suppression… ${faites} / ${total}`,
  },
  /** US-023 : page « Manifestations ». */
  manifestations: {
    titre: 'Manifestations',
    entree: 'Manifestations',
    nouvelle: 'Nouvelle manifestation',
    titreModification: (nom: string) => `Modifier « ${nom} »`,
    nom: 'Nom',
    exempleNom: 'Week-end des Championnats NA',
    debut: 'Date de début',
    fin: 'Date de fin',
    lieu: 'Lieu',
    /** US-070 : suggestions d'adresses sous le champ « Lieu ». */
    adresse: {
      suggestions: 'Adresses suggérées',
      recherche: 'Recherche…',
      aucune: 'Aucune adresse trouvée',
      indisponible: 'Recherche d’adresse indisponible : saisissez le lieu à la main',
      horsLigne: 'Suggestions d’adresses disponibles en ligne',
    },
    commentaire: 'Commentaire',
    facultatif: 'facultatif',
    creer: 'Créer la manifestation',
    enregistrer: 'Enregistrer',
    enCours: 'Enregistrement…',
    annuler: 'Annuler',
    boutonModifier: 'Modifier',
    boutonSupprimer: 'Supprimer',
    modifier: (nom: string) => `Modifier ${nom}`,
    supprimer: (nom: string) => `Supprimer ${nom}`,
    confirmerSuppression: (nom: string) => `Supprimer définitivement « ${nom} » ?`,
    confirmer: 'Supprimer',
    /** US-042 : suppression avec son contenu, réservée aux administrateurs. */
    contenu: {
      horsLigne: 'Connexion requise pour supprimer',
      titre: (nom: string) => `Supprimer définitivement la manifestation « ${nom} » ?`,
      combien: (competitions: number, epreuves: number | null) => {
        const lesCompetitions =
          competitions === 0
            ? 'aucune compétition'
            : competitions > 1
              ? `ses ${competitions} compétitions`
              : 'sa compétition';
        const lesEpreuves =
          epreuves === null
            ? 'ses épreuves'
            : epreuves === 0
              ? 'aucune épreuve'
              : epreuves > 1
                ? `ses ${epreuves} épreuves (archivées comprises)`
                : 'son épreuve';
        return `Sont supprimées avec elle : ${lesCompetitions} et ${lesEpreuves}.`;
      },
      avertissement:
        'La suppression est définitive : les journaux, les saisies et les fichiers joints sont effacés du serveur et de tous les PC du club.',
      saisie: (nom: string) => `Saisissez « ${nom} » pour confirmer`,
      valider: 'Supprimer définitivement',
      progression: (faites: number, total: number) => `Suppression… ${faites} / ${total}`,
      annuler: 'Annuler',
      enCours: (noms: string[]) => `Une épreuve en cours empêche la suppression : ${noms.join(', ')}`,
      interrompue: (restantes: number) =>
        restantes > 1
          ? `${restantes} épreuves restent, la manifestation n’est pas supprimée : relancez la suppression`
          : `${restantes} épreuve reste, la manifestation n’est pas supprimée : relancez la suppression`,
    },
    recharger: 'Recharger',
    chargement: 'Chargement des manifestations…',
    vide: 'Aucune manifestation pour l’instant',
    horsLigne: 'Nécessite une connexion internet',
    periode: (debut: string, fin: string) => {
      const jour = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;
      return debut === fin ? `le ${jour(debut)}` : `du ${jour(debut)} au ${jour(fin)}`;
    },
    /** Hors ligne : date de la copie gardée sur l'appareil. */
    listeDu: (date: number) => {
      const jour = new Date(date);
      const deux = (nombre: number) => String(nombre).padStart(2, '0');
      return `Hors ligne : liste du ${deux(jour.getDate())}/${deux(jour.getMonth() + 1)} à ${jour.getHours()} h ${deux(jour.getMinutes())}`;
    },
    horsDates: (noms: readonly string[]) =>
      noms.length > 1
        ? `Ces dates n’incluent plus les épreuves rattachées : ${noms.join(', ')}`
        : `Ces dates n’incluent plus l’épreuve rattachée : ${noms.join(', ')}`,
    modifieeEntreTemps: (nom: string) => `Modifié entre-temps par ${nom} : rechargez`,
    champs: {
      NOM_VIDE: 'Le nom est obligatoire',
      NOM_TROP_LONG: 'Le nom fait au plus 100 caractères',
      DATE_OBLIGATOIRE: 'La date est obligatoire',
      DATE_INVALIDE: 'Date invalide',
      FIN_AVANT_DEBUT: 'La date de fin doit suivre la date de début',
      LIEU_TROP_LONG: 'Le lieu fait au plus 200 caractères',
      COORDONNEES_INVALIDES: 'Adresse invalide : choisissez-la de nouveau',
      COMMENTAIRE_TROP_LONG: 'Le commentaire fait au plus 2 000 caractères',
    } satisfies Record<ErreurManifestation, string>,
    erreurs: {
      HORS_LIGNE: 'Réseau perdu : rien n’a changé, réessayez',
      SESSION_INVALIDE: 'Session expirée : reconnectez-vous',
      MANIFESTATION_INCONNUE: 'Cette manifestation n’existe plus : rechargez',
      ACCES_REFUSE: 'Seul un administrateur peut supprimer un élément qui contient des épreuves',
      EPREUVE_EN_COURS: 'Une épreuve en cours empêche la suppression',
      MANIFESTATION_NON_VIDE:
        'Cette manifestation contient des épreuves ou des compétitions : elle ne se supprime pas (elle pourra être archivée)',
      ERREUR_INATTENDUE: 'Erreur inattendue du serveur : réessayez',
    } satisfies Record<ErreurManifestations, string>,
  },
  /** US-047 : assistant de création d'une manifestation, de ses compétitions et de leurs épreuves. */
  assistant: {
    titre: 'Nouvelle manifestation',
    etapes: 'Étapes',
    etape: {
      manifestation: { nom: 'Manifestation', aide: 'Nom, jours, lieu' },
      competitions: { nom: 'Compétitions', aide: 'Une par affiche et par arme' },
      epreuves: { nom: 'Épreuves', aide: 'Catégories × sexes' },
      verifier: { nom: 'Vérifier', aide: 'Le plan complet' },
    },
    titreEtape: {
      manifestation: 'La manifestation',
      competitions: 'Les compétitions du week-end',
      epreuves: 'Les épreuves de chaque compétition',
      verifier: 'Vérifier le plan',
    },
    aideEtape: {
      manifestation: 'Le nom, les jours et le lieu : les compétitions et leurs épreuves viennent ensuite.',
      competitions:
        'Une compétition regroupe les épreuves présentées sous un même nom et une même arme. Ses épreuves (catégories et sexes) se cochent à l’étape suivante.',
      epreuves:
        'Choisissez une compétition, puis cochez ses catégories et ses sexes : les épreuves se créent d’un coup.',
      verifier: 'Voici le plan de la manifestation, tel qu’on le retrouvera dans la liste.',
    },
    precedent: 'Précédent',
    suivant: (etape: string) => `Suivant : ${etape}`,
    plusTard: 'Plus tard',
    terminer: 'Terminer',
    apercu: 'Aperçu en direct',
    apercuAide:
      'L’aperçu se remplit à chaque étape. Il prend la même forme que le plan de la manifestation, qu’on retrouve ensuite.',
    apercuVide: 'La manifestation apparaît ici dès que vous saisissez son nom.',
    enSaisie: 'en cours de saisie',
    competitionSansNom: 'Nouvelle compétition',
    planVide: 'Le plan se remplira avec les compétitions de la manifestation.',
    epreuves: (nombre: number) => (nombre === 0 ? '0 épreuve' : nombre === 1 ? '1 épreuve' : `${nombre} épreuves`),
    nomCompetition: 'Nom de la compétition',
    arme: 'Arme',
    plusieursArmes: 'Plusieurs armes',
    ajouterCompetition: 'Ajouter la compétition',
    competitionAjoutee: (nom: string) => `Compétition « ${nom} » créée`,
    aucuneCompetition: 'Aucune compétition pour l’instant : ajoutez-en à l’étape précédente, ou passez cette étape.',
    competitionsCreees: 'Compétitions créées',
    choisirCompetition: 'Compétition à compléter',
    epreuvesDe: (nom: string, nombre: number) =>
      `${nom} (${nombre === 0 ? 'aucune épreuve' : nombre === 1 ? '1 épreuve' : `${nombre} épreuves`})`,
    epreuvesCreees: (nombre: number) => (nombre === 1 ? '1 épreuve créée' : `${nombre} épreuves créées`),
    bilan: (competitions: number, epreuves: number) =>
      `${competitions === 0 ? 'Aucune compétition' : competitions === 1 ? '1 compétition' : `${competitions} compétitions`}, ${epreuves === 0 ? 'aucune épreuve' : epreuves === 1 ? '1 épreuve' : `${epreuves} épreuves`}`,
    reseauPerdu: 'Réseau perdu : ce qui est déjà créé est gardé. Reprenez depuis le plan de la manifestation.',
    horsLigne: 'Nécessite une connexion internet',
    chargement: 'Chargement…',
    manifestationCree: (nom: string) => `Manifestation « ${nom} » créée`,
  },
  /** US-046 : point d'entrée « Créer » (« Que voulez-vous créer ? ») et aide « Comment ça s'organise ». */
  creer: {
    bouton: 'Créer',
    titre: 'Que voulez-vous créer ?',
    intro: 'Choisissez ce qui ressemble à votre situation : chaque choix vous guide ensuite pas à pas.',
    cartes: 'Ce qu’on peut créer',
    quand: 'Quand choisir',
    exemple: 'Exemple',
    horsLigne: 'Nécessite une connexion internet',
    lienAide: 'Voir comment s’articulent manifestations, compétitions et épreuves',
    manifestation: {
      titre: 'Une manifestation',
      etiquette: 'Le plus courant',
      quand: 'Un week-end ou une journée qui réunit plusieurs compétitions.',
      exemple: 'Les Championnats de Nouvelle-Aquitaine, samedi et dimanche, avec une compétition par arme.',
      bouton: 'Créer une manifestation',
      miniature: 'Une manifestation contient ses compétitions, qui contiennent leurs épreuves',
    },
    completer: {
      titre: 'Compléter',
      quand: 'Ajouter une compétition ou des épreuves à ce qui existe déjà.',
      exemple: 'Ajouter les M15 Dames à la compétition d’épée du week-end.',
      miniature: 'Une compétition ou des épreuves s’ajoutent dans une manifestation ou une compétition existante',
      rechercher: 'Rechercher une manifestation ou une compétition',
      placeholder: 'Un nom, ou une partie du nom',
      resultats: 'Résultats de la recherche',
      aucunResultat: 'Aucun résultat pour cette recherche',
      limite: (montres: number, total: number) => `${montres} résultats sur ${total} : précisez la recherche`,
      rienACompleter: 'Rien à compléter pour l’instant',
      choisir: (nom: string) => `Choisir ${nom}`,
      types: { manifestation: 'Manifestation', competition: 'Compétition' },
      dans: (manifestation: string) => `dans ${manifestation}`,
      actionsDe: (nom: string) => `Ajouter à ${nom}`,
      aucuneAction: 'Rien à ajouter ici sans connexion internet',
      horsLigne: 'Hors ligne : seules des épreuves s’ajoutent, à une compétition connue de cet appareil',
      chargement: 'Chargement…',
    },
    seule: {
      titre: 'Une compétition seule',
      quand: 'Un challenge ou une compétition qui n’appartient à aucune manifestation.',
      exemple: 'Le challenge de Noël du club, en une seule étape avec sa première épreuve.',
      bouton: 'Créer une compétition seule',
      miniature: 'Une compétition seule contient ses épreuves, à côté des manifestations',
    },
  },
  /** US-046 CA-3 : page d'aide qui montre les trois niveaux emboîtés sur un exemple. */
  aide: {
    titre: 'Comment ça s’organise',
    intro: 'Trois niveaux s’emboîtent : une manifestation contient des compétitions, qui contiennent des épreuves.',
    retour: 'Retour à « Que voulez-vous créer ? »',
    exemple: 'Un exemple',
    niveaux: 'Les trois niveaux',
    manifestation: {
      nom: 'La manifestation',
      texte: 'Le cadre d’un week-end ou d’une journée : un nom, des jours, un lieu. Elle réunit des compétitions.',
    },
    competition: {
      nom: 'La compétition',
      texte:
        'Une affiche pour une arme ou pour plusieurs, avec ses épreuves. Elle reprend les jours de sa manifestation.',
    },
    epreuve: {
      nom: 'L’épreuve',
      texte: 'Une catégorie et un sexe, un jour, une heure d’appel. Elle reprend l’arme de sa compétition.',
    },
    reprend: 'Ce qu’il reprend du niveau précédent',
    exempleManifestation: 'Week-end des Championnats',
    exempleJours: 'Samedi 13 et dimanche 14 mars',
    exempleSeule: 'Une compétition seule, à côté',
    exempleSeuleNom: 'Challenge de Noël',
    exempleCompetitions: [
      { nom: 'Sabre', epreuves: ['M13 · Hommes', 'M15 · Dames'] },
      { nom: 'Épée', epreuves: ['M17 · Hommes'] },
    ],
    exempleEpreuveSeule: 'Senior · Dames',
  },
  /** US-058 : page d'une épreuve par étapes (navigation latérale, entête, cartes du Résumé). */
  pageEpreuve: {
    /** US-064 : bandeau « Prochaine étape » du résumé. Chaque étape livrée par un Epic ajoute sa phrase et son bouton. */
    prochaineEtape: {
      titre: 'Prochaine étape',
      phrases: {
        creerTableau: 'Les poules sont terminées : créer le tableau',
        terminer: 'Tous les matchs du tableau sont tirés : terminer l’épreuve',
        publier: 'Publier l’épreuve pour ouvrir le suivi en direct',
        partager: 'Partager le lien public',
      },
      boutons: {
        publier: 'Publier',
        copier: 'Copier le lien',
        creerTableau: 'Créer le tableau',
        terminer: 'Terminer l’épreuve',
      },
      /** Lecture seule : l'étape est annoncée sans bouton (CA-4). */
      depuisLePilote: 'À faire depuis le PC pilote.',
      lienCopie: 'Lien copié',
      copieImpossible: 'Le lien n’a pas pu être copié : sélectionnez-le depuis la page publique de l’épreuve.',
    },
    navigation: 'Étapes de l’épreuve',
    aVenir: 'À venir',
    /** US-061 : barre d'onglets du smartphone (libellé court d'« Inscriptions », onglet « Plus »). */
    barre: { inscriptions: 'Inscrits', plus: 'Plus', retour: (niveau: string) => `Retour à ${niveau}` },
    etapes: {
      resume: 'Résumé',
      inscriptions: 'Inscriptions',
      emargement: 'Émargement',
      poules: 'Poules',
      classement: 'Classement',
      tableau: 'Tableau',
      impressions: 'Impressions',
      formule: 'Formule',
      parametres: 'Paramètres',
    } satisfies Record<IdEtapeEpreuve, string>,
    /** Titre des cartes du Résumé. */
    cartes: {
      pilote: 'Pilote',
      publication: 'Publication',
      informations: 'Informations',
      formule: 'Formule',
      documents: 'Affiche et feuille de route',
    },
    /** Libellés de la carte Informations (la planche abrège « Début des poules » en « Début »). */
    informations: { lieu: 'Lieu', appel: 'Appel', scratch: 'Scratch', debut: 'Début' },
    vide: '—',
    piloteEnvoye: 'Toutes les modifications sont envoyées au serveur.',
    piloteHorsLigne: 'Hors ligne : les modifications seront envoyées au retour du réseau.',
    modifierInformations: 'Modifier les informations',
    modifierFormule: 'Modifier la formule',
    menuEpreuve: 'Autres actions',
    dupliquer: 'Dupliquer',
    dupliquerDetail: 'Une nouvelle épreuve préremplie, dans la même compétition',
    /** US-034 : export de l'épreuve dans un fichier `.poule.json`. */
    exporter: 'Exporter',
    exporterDetail: 'Un fichier de sauvegarde, avec le journal et les fichiers joints',
    /** US-133 CA-6 : vers les écrans géants qui peuvent afficher l'épreuve. */
    ecransGeants: 'Écrans géants…',
    exportation: {
      enCours: 'Préparation du fichier…',
      choisi: (nom: string) => `Épreuve exportée dans le fichier ${nom}.`,
      telecharge: (nom: string) => `Épreuve exportée : le fichier ${nom} a été téléchargé.`,
      annule: 'Export annulé : aucun fichier n’a été enregistré.',
      echec: 'Le fichier n’a pas pu être enregistré. Réessayez.',
      journalAbsent: 'Cette épreuve n’est pas encore sur cet appareil : ouvrez-la en ligne avant de l’exporter.',
      fichiersManquants: (n: number) =>
        n === 1
          ? 'Un fichier joint n’est pas disponible sur cet appareil : il n’est pas dans la sauvegarde.'
          : `${n} fichiers joints ne sont pas disponibles sur cet appareil : ils ne sont pas dans la sauvegarde.`,
      donneesPersonnelles: 'Ce fichier contient les noms des tireurs : gardez-le pour vous (ADR-0014).',
    },
  },
  /** US-056 : page d'une manifestation (onglets Compétitions, Plan, Affiche et feuille de route). */
  pageManifestation: {
    chargement: 'Chargement de la manifestation…',
    introuvable: 'Cette manifestation n’existe plus',
    retourAccueil: 'Retour à l’accueil',
    /** Dates de la planche 2 : « 11 et 12 novembre 2026 », « le 11 novembre 2026 », « du 30 novembre au 2 décembre 2026 ». */
    dates: (debut: string, fin: string) => {
      const mois = [
        'janvier',
        'février',
        'mars',
        'avril',
        'mai',
        'juin',
        'juillet',
        'août',
        'septembre',
        'octobre',
        'novembre',
        'décembre',
      ];
      const [anneeD = '', moisD = '', jourD = ''] = debut.split('-');
      const [anneeF = '', moisF = '', jourF = ''] = fin.split('-');
      const jour = (valeur: string) => (valeur === '01' ? '1er' : String(Number(valeur)));
      const nomMois = (valeur: string) => mois[Number(valeur) - 1] ?? '';
      if (debut === fin) return `le ${jour(jourD)} ${nomMois(moisD)} ${anneeD}`;
      if (anneeD === anneeF && moisD === moisF) {
        const deuxJours = Number(jourF) === Number(jourD) + 1;
        return `${deuxJours ? `${jour(jourD)} et ${jour(jourF)}` : `du ${jour(jourD)} au ${jour(jourF)}`} ${nomMois(moisD)} ${anneeD}`;
      }
      const debutLong =
        anneeD === anneeF ? `${jour(jourD)} ${nomMois(moisD)}` : `${jour(jourD)} ${nomMois(moisD)} ${anneeD}`;
      return `du ${debutLong} au ${jour(jourF)} ${nomMois(moisF)} ${anneeF}`;
    },
    modifier: 'Modifier',
    onglets: 'Vues de la manifestation',
    competitions: 'Compétitions',
    plan: 'Plan',
    documents: 'Affiche et feuille de route',
    ecrans: 'Écrans',
    nouvelleCompetition: 'Nouvelle compétition',
    plusEpreuves: '+ Épreuves',
    necessiteInternet: 'Nécessite une connexion internet',
    ajouterDesEpreuves: 'Ajouter des épreuves',
    modifierCompetition: (nom: string) => `Modifier ${nom}`,
    epreuvesDe: (nom: string) => `Épreuves de ${nom}`,
    aucuneEpreuve: 'Aucune épreuve',
    ouvrirEpreuve: (nom: string) => `Ouvrir l’épreuve ${nom}`,
  },
  /** US-049 : plan d'une manifestation (lignes = compétitions, colonnes = jours). */
  plan: {
    lien: 'Voir le plan',
    lienPour: (manifestation: string) => `Voir le plan de ${manifestation}`,
    titre: (manifestation: string) => `Plan de ${manifestation}`,
    chargement: 'Chargement du plan…',
    introuvable: 'Cette manifestation est introuvable sur cet appareil.',
    retour: 'Toutes les manifestations',
    epreuves: (nombre: number) => (nombre === 0 ? 'Aucune épreuve' : nombre === 1 ? '1 épreuve' : `${nombre} épreuves`),
    /** Hors ligne : date de la copie gardée sur l'appareil, ou l'appareil seul si rien n'a encore été copié. */
    horsLigne: (date: number | null) => {
      if (date === null) return 'Hors ligne : plan des données de cet appareil';
      const jour = new Date(date);
      const deux = (nombre: number) => String(nombre).padStart(2, '0');
      return `Hors ligne : plan du ${deux(jour.getDate())}/${deux(jour.getMonth() + 1)} à ${jour.getHours()} h ${deux(jour.getMinutes())}`;
    },
    ajouterCompetition: 'Ajouter une compétition',
    premiereCompetition: 'Ajouter une première compétition',
    modifierManifestation: 'Modifier la manifestation',
    necessiteInternet: 'Nécessite une connexion internet',
    ajouterEpreuves: (competition: string) => `Ajouter des épreuves à ${competition}`,
    ajouterEpreuvesCourt: 'Ajouter des épreuves',
    plus: '+ Épreuve',
    /** Titre d'une tuile : la catégorie (ou le nom) et le sexe s'il y en a un. */
    titreTuile: (categorie: string, sexe: string | null) => (sexe ? `${categorie} · ${sexe}` : categorie),
    plusDans: (competition: string, jour: string) => `Ajouter une épreuve à ${competition}, ${jour}`,
    competitionSansArme: 'Toutes armes',
    colonnes: 'Plan par jour',
    jourAFixer: 'Jour à fixer',
    aucuneEpreuve: 'Aucune épreuve ce jour',
    lectureSeule: 'Lecture seule',
    nonEnvoyee: 'Pas encore envoyée',
    appel: (heure: string) => `appel ${heure}`,
    /** US-050 CA-4 : les autres horaires du panneau d'une épreuve. */
    horaire: {
      appel: (heure: string) => `appel ${heure}`,
      scratch: (heure: string) => `scratch ${heure}`,
      debutPoules: (heure: string) => `poules ${heure}`,
    },
    /** US-050 CA-3 : le compte de compétitions du bandeau d'entête. */
    competitions: (nombre: number) =>
      nombre === 0 ? 'Aucune compétition' : nombre === 1 ? '1 compétition' : `${nombre} compétitions`,
    /** US-050 : titre au-dessus du nom de l'épreuve dans le panneau. */
    epreuveSelectionnee: 'Épreuve sélectionnée',
    /** US-050 CA-6 : « Changer de jour : dimanche », pour une manifestation de deux jours. */
    changerDeJourVers: (jour: string) => `Changer de jour : ${jour}`,
    /** US-050 CA-6 : nom du jour de la semaine d'une date `AAAA-MM-JJ` (« dimanche »). */
    jourSemaine: (date: string) =>
      new Intl.DateTimeFormat('fr-FR', { weekday: 'long', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`)),
    tuile: (nom: string) => `Épreuve ${nom}`,
    panneau: (nom: string) => `Détail de l’épreuve ${nom}`,
    fermer: 'Fermer',
    ouvrir: 'Ouvrir l’épreuve',
    /** US-051 CA-1 : copie l'épreuve dans le formulaire « Nouvelle épreuve ». */
    dupliquer: 'Dupliquer',
    changerDeJour: 'Changer de jour',
    nouveauJour: 'Nouveau jour',
    jourChange: (jour: string) => `Épreuve déplacée au ${jour}`,
    jourRefuse: 'Impossible de changer le jour de cette épreuve.',
    jourFige: 'Une épreuve en cours ou terminée ne change pas de jour.',
    jourLectureSeule: 'Cette épreuve est pilotée par un autre PC : ouvrez-la pour la consulter.',
    jour: 'Jour',
    competition: 'Compétition',
    arme: 'Arme',
    lieu: 'Lieu',
    horaires: 'Horaires',
    type: 'Type',
    formule: 'Formule',
    formuleParDefaut: 'formule par défaut',
    formuleModifiee: 'formule modifiée',
    detailInconnu: 'Détails non disponibles sur cet appareil : ouvrez l’épreuve pour les voir.',
    origines: {
      competition: 'comme la compétition',
      manifestation: 'comme la manifestation',
      modifiee: 'modifiée',
      /** US-050 CA-5 : le jour d'une épreuve est l'un des jours de la manifestation. */
      jour: 'jour de la manifestation',
    },
  },
  /** US-030 : affiche et feuille de route d'une manifestation, d'une compétition ou d'une épreuve. */
  /** US-031 : publier ou dépublier une épreuve. « Publiée / Non publiée » parle de visibilité, jamais du réseau (CA-6). */
  publication: {
    titre: 'Publication',
    publier: 'Publier',
    depublier: 'Dépublier',
    enCours: 'Enregistrement…',
    aidePubliee: 'Cette épreuve est visible du public sur la page d’accueil.',
    aideNonPubliee: 'Seuls les organisateurs connectés voient cette épreuve.',
    /** Après « Publier » ou « Dépublier » tant que le serveur n'a pas reçu l'événement. */
    enAttente: 'Publication en attente d’envoi',
    lienPublic: 'Page publique de l’épreuve',
    erreurs: {
      INTROUVABLE: 'Cette épreuve est introuvable sur cet appareil',
      PAS_PILOTE: 'Seul le PC pilote peut publier cette épreuve',
      EPREUVE_ARCHIVEE: 'Une épreuve archivée ne se publie pas',
      JOURNAL_INCOHERENT: 'Le journal de cette épreuve est incohérent : la publication n’a pas été enregistrée',
      ECRITURE_IMPOSSIBLE: 'La publication n’a pas pu être enregistrée sur cet appareil',
    },
  },
  /** US-079 CA-3 à CA-5 : publier ou dépublier toutes les épreuves d'une compétition. */
  publicationLot: {
    publier: 'Publier toutes les épreuves',
    depublier: 'Dépublier toutes les épreuves',
    detailPublier: 'visibles du public sur la page d’accueil',
    detailDepublier: 'seuls les organisateurs les verront',
    lectureSeule: 'Lecture seule : un autre PC est le pilote',
    titre: 'Publication',
    compte: (publiees: number, total: number) =>
      `${publiees} épreuve${publiees > 1 ? 's' : ''} publiée${publiees > 1 ? 's' : ''} sur ${total}`,
    enCours: 'Publication…',
    faites: (nombre: number, publiee: boolean) => {
      const verbe = publiee ? 'publiée' : 'dépubliée';
      return nombre === 0
        ? `Aucune épreuve ${verbe}`
        : `${nombre} épreuve${nombre > 1 ? 's' : ''} ${verbe}${nombre > 1 ? 's' : ''}`;
    },
    autrePc: (nombre: number, publiee: boolean) =>
      `${nombre} épreuve${nombre > 1 ? 's n’ont' : ' n’a'} pas été ${publiee ? 'publiée' : 'dépubliée'}${nombre > 1 ? 's' : ''} : un autre PC est le pilote`,
    archivees: (nombre: number) =>
      `${nombre} épreuve${nombre > 1 ? 's archivées restent' : ' archivée reste'} telle${nombre > 1 ? 's' : ''} quelle${nombre > 1 ? 's' : ''}`,
    echecs: (nombre: number) =>
      `${nombre} épreuve${nombre > 1 ? 's n’ont' : ' n’a'} pas pu être enregistrée${nombre > 1 ? 's' : ''} sur cet appareil`,
  },
  /** US-082 : saisie des tireurs d'une épreuve (planche 7). */
  /** US-146 et US-147 : équipes d'une épreuve par équipes (planches 40 et 40 bis). */
  equipes: {
    /** US-148 : émargement par équipes (planche 41). */
    emargement: {
      compteur: (completes: number, total: number) =>
        `${completes} équipe${completes > 1 ? 's' : ''} complète${completes > 1 ? 's' : ''} sur ${total}`,
      complete: 'Complète',
      avecRemplacant: 'Complète · avec remplaçant',
      incomplete: (presents: number, taille: number) =>
        `Incomplète · ${presents} présent${presents > 1 ? 's' : ''} sur ${taille}`,
      filtres: { toutes: 'Toutes', incompletes: 'Incomplètes', completes: 'Complètes' },
      sansEquipe: 'Sans équipe · ne tireront pas',
      aide: (taille: number) =>
        `Une équipe est complète avec ${taille} présents, remplaçant compris. Une équipe incomplète ne tirera pas.`,
      creerTableau: 'Créer le tableau',
      confirmerIncompletes: (noms: string[]) =>
        `${noms.length === 1 ? '1 équipe incomplète ne tirera pas' : `${noms.length} équipes incomplètes ne tireront pas`} : ${noms.join(', ')}`,
      detailIncompletes:
        'Vous pourrez encore pointer leurs tireurs tant que les poules ou le tableau ne sont pas lancés.',
      continuer: 'Continuer',
      aucuneComplete: 'Aucune équipe complète : pointez les tireurs présents',
    },
    effectif: (n: number) => `${n} équipe${n > 1 ? 's' : ''}`,
    ongletTireurs: 'Tireurs',
    ongletEquipes: 'Équipes',
    onglets: 'Inscrits ou équipes',
    titreListe: 'Équipes · rangées par la somme des classements des titulaires',
    nouvelle: 'Nouvelle équipe',
    aucune: 'Aucune équipe : créez-en une à partir des tireurs inscrits.',
    sansEquipe: (noms: string[]) =>
      `${noms.length === 1 ? '1 tireur sans équipe' : `${noms.length} tireurs sans équipe`} ne tirera${noms.length === 1 ? '' : 'ont'} pas : ${noms.join(', ')}.`,
    resume: (equipes: number, sans: number) =>
      `${equipes} équipe${equipes > 1 ? 's' : ''}${sans > 0 ? ` · ${sans} tireur${sans > 1 ? 's' : ''} sans équipe` : ''}`,
    somme: (somme: number) => `Σ ${somme}`,
    tirage: 'tirage au sort',
    rangModifie: 'rang modifié',
    mixte: 'Mixte',
    nonClasse: 'non classé',
    remplacant: 'Remplaçant',
    titulaire: 'Titulaire',
    monter: (nom: string) => `Monter ${nom}`,
    descendre: (nom: string) => `Descendre ${nom}`,
    modifier: (nom: string) => `Modifier l’équipe ${nom}`,
    supprimer: 'Supprimer l’équipe…',
    revenirAuCalcul: 'Revenir au rang calculé',
    aide: 'Rang = somme des classements des titulaires (un tireur non classé compte pour le dernier classement + 1) ; à égalité, tirage au sort. Les flèches corrigent le rang à la main, jusqu’au lancement.',
    confirmerSuppression: (nom: string) => `Supprimer l’équipe « ${nom} » ?`,
    detailSuppression: 'Ses tireurs redeviennent sans équipe.',
    supprimerAction: 'Supprimer',
    figees: 'Poules lancées ou tableau créé : seul le remplaçant se change encore.',
    pasAssez: 'Pas assez de tireurs sans équipe pour une nouvelle équipe',
    fenetre: {
      titreNouvelle: 'Nouvelle équipe',
      nom: 'Nom de l’équipe',
      nomAide: 'Proposé d’après le club du premier tireur choisi.',
      tireurs: (taille: number) => `Tireurs sans équipe · ${taille} titulaires, 1 remplaçant au plus`,
      role: (nom: string) => `Rôle de ${nom}`,
      bilan: (titulaires: number, taille: number, remplacant: boolean, somme: number, club: string) =>
        `${titulaires}/${taille} titulaires${remplacant ? ' · 1 remplaçant' : ''} · Σ ${somme} · club : ${club}`,
      creer: 'Créer l’équipe',
      enregistrer: 'Enregistrer',
      annuler: 'Annuler',
      aucunLibre: 'Aucun tireur sans équipe.',
    },
    erreurs: {
      NOM_EQUIPE_VIDE: 'Donnez un nom à l’équipe',
      NOM_EQUIPE_PRIS: 'Une autre équipe porte déjà ce nom',
      TITULAIRES_INVALIDES: 'Choisissez exactement le nombre de titulaires de l’épreuve',
      TIREUR_DEJA_EN_EQUIPE: 'Un de ces tireurs est déjà dans une autre équipe',
      EQUIPES_FIGEES: 'Les équipes sont figées : poules lancées ou tableau créé',
      TIREUR_EN_EQUIPE: 'Retirez d’abord ce tireur de son équipe',
      AUTRE: 'L’équipe n’a pas pu être enregistrée',
    } as Record<string, string>,
  },
  inscriptions: {
    titre: 'Inscriptions',
    nombre: (nombre: number) => (nombre > 1 ? `${nombre} inscrits` : `${nombre} inscrit`),
    importer: 'Importer un fichier…',
    autresActions: 'Autres actions',
    ajout: 'Ajouter un tireur',
    nom: 'Nom',
    prenom: 'Prénom',
    club: 'Club',
    classement: 'Classement',
    facultatif: 'facultatif',
    exempleNom: 'MARTIN',
    exemplePrenom: 'Léa',
    ajouter: 'Ajouter',
    aideAjout: 'Entrée ajoute le tireur et replace le curseur sur « Nom ». Le club reprend le dernier saisi.',
    clubsProposes: 'Clubs déjà saisis',
    dernierSaisi: 'dernier saisi',
    ajoute: (nom: string) => `${nom} ajouté à la liste`,
    homonyme: (nom: string, club: string) =>
      `Un tireur du même nom est déjà inscrit : ${nom}${club ? ` (${club})` : ''}. Ajouter quand même ?`,
    ajouterQuandMeme: 'Ajouter quand même',
    annuler: 'Annuler',
    dejaInscrit: 'Ce tireur est déjà inscrit',
    liste: 'Liste des inscrits',
    filtrer: 'Filtrer les inscrits',
    exempleFiltre: 'Filtrer par nom ou club',
    clubs: (nombre: number) => (nombre > 1 ? `${nombre} clubs` : `${nombre} club`),
    colonnes: { classement: 'Classement', nom: 'Nom', prenom: 'Prénom', club: 'Club', actions: 'Actions' },
    sansClassement: '—',
    tri: 'Trié par classement, puis par nom. « — » : sans classement, placé au hasard lors de la constitution des poules.',
    aucun: 'Aucun tireur inscrit : saisissez-les ci-dessus ou importez un fichier.',
    aucunFiltre: 'Aucun inscrit ne correspond au filtre.',
    modifier: (nom: string) => `Modifier ${nom}`,
    autresActionsPour: (nom: string) => `Autres actions pour ${nom}`,
    retirer: 'Retirer de l’épreuve',
    confirmerRetrait: (nom: string) => `Retirer ${nom} de l’épreuve ?`,
    detailRetrait: 'Il disparaît de la liste des inscrits.',
    retirerAction: 'Retirer',
    retire: (nom: string) => `${nom} retiré de l’épreuve`,
    enregistrer: 'Enregistrer',
    lectureSeule: 'Lecture seule : un autre PC est le pilote',
    closes: 'Les inscriptions sont closes : les poules sont lancées',
    archivee: 'Épreuve archivée : lecture seule',
    erreurs: {
      TIREUR_NOM_VIDE: 'Le nom est obligatoire',
      TIREUR_PRENOM_VIDE: 'Le prénom est obligatoire',
      TIREUR_CHAMP_TROP_LONG: 'Ce champ fait au plus 60 caractères',
      CLASSEMENT_INVALIDE: 'Le classement est un nombre entier',
      INSCRIPTIONS_CLOSES: 'Les inscriptions sont closes : les poules sont lancées',
      TIREUR_EN_EQUIPE: 'Retirez d’abord ce tireur de son équipe',
      PAS_PILOTE: 'Lecture seule : un autre PC est le pilote',
      AUTRE: 'L’inscription n’a pas pu être enregistrée sur cet appareil',
    } as Record<string, string>,
  },
  /** US-084 : émargement d'une épreuve (planche 19). */
  emargement: {
    titre: 'Émargement',
    compteur: (presents: number, inscrits: number) => `${presents} présent${presents > 1 ? 's' : ''} sur ${inscrits}`,
    horaires: (appel: string | null, scratch: string | null) =>
      [appel ? `Appel ${appel}` : null, scratch ? `scratch ${scratch}` : null].filter(Boolean).join(' · '),
    surPlace: 'Inscrire sur place',
    surPlaceTitre: 'Inscrire sur place · pointé présent d’emblée',
    inscrireEtPointer: 'Inscrire et pointer',
    apresScratch: (scratch: string) =>
      `Le scratch (${scratch}) est passé : l’inscription reste possible, à vous de décider.`,
    constituer: 'Constituer les poules',
    remettreAbsents: 'Remettre tout le monde absent',
    remettreAbsentsDetail: 'après confirmation',
    confirmerRemise: 'Remettre tout le monde absent ?',
    detailRemise: (nombre: number) =>
      `${nombre} pointage${nombre > 1 ? 's seront effacés' : ' sera effacé'} ; les inscrits restent inscrits.`,
    remettre: 'Remettre absents',
    imprimer: 'Imprimer la feuille de présence',
    imprimerAVenir: 'À venir (impressions, E7)',
    liste: 'Pointer les présents',
    rechercher: 'Rechercher un tireur',
    exempleRecherche: 'Nom, prénom ou club · Entrée pointe le seul résultat',
    filtres: { toutes: 'Tous', absentes: 'Absents', presentes: 'Présents' },
    afficher: 'Afficher',
    present: (heure: string | null) => (heure ? `Présent · ${heure}` : 'Présent'),
    absent: 'Absent',
    pointer: (nom: string) => `Présent : ${nom}`,
    aide: 'Cliquez une ligne, ou Espace, pour la pointer ; recliquez pour la remettre absente. Les absents ne sont pas placés dans les poules.',
    aucunInscrit: 'Inscrivez d’abord les tireurs (étape « Inscriptions »).',
    aucunResultat: 'Aucun inscrit ne correspond.',
    pointe: (nom: string) => `${nom} pointé présent`,
    depointe: (nom: string) => `${nom} remis absent`,
  },
  // US-086 à US-089 : poules d'une épreuve (planches 8, 9 et 10).
  poules: {
    titre: 'Poules',
    constituerTitre: 'Constituer les poules',
    tour: '1er tour de poules',
    presents: (presents: number) => `${presents} tireur${presents > 1 ? 's' : ''} présent${presents > 1 ? 's' : ''}`,
    surInscrits: (inscrits: number) => ` sur ${inscrits} inscrit${inscrits > 1 ? 's' : ''} (émargement)`,
    voirEmargement: 'Voir l’émargement',
    pointezDabord: 'Pointez d’abord les présents : les poules se font avec eux.',
    auMoinsTrois: 'Il faut au moins 3 présents pour constituer une poule.',
    nombre: 'Nombre de poules',
    nombreDetail: ' · la formule prévoit des poules de 5 à 7',
    proposition: (nombre: number, grande: number, petites: number) =>
      petites === 0 ? `${nombre} poule${nombre > 1 ? 's' : ''} de ${grande}` : `${nombre} poules`,
    detailProposition: (grande: number, grandes: number, petites: number) =>
      petites === 0 ? null : `${grandes} de ${grande} et ${petites} de ${grande - 1}`,
    recommandee: 'Recommandé',
    matchsParPoule: (matchs: number) => `${matchs} matchs par poule`,
    horsBornes: 'Hors de 5 à 7 tireurs par poule',
    horsBornesTouches: (touches: number) => `Les touches vont de 0 à ${touches}`,
    autreNombre: 'Autre nombre de poules',
    nombreChoisi: 'Nombre de poules choisi',
    repartition: 'Répartition',
    automatique: 'Automatique',
    automatiqueDetail: 'Serpentin selon le classement, clubs séparés',
    manuelle: 'Manuelle',
    manuelleDetail: 'Les poules partent vides : vous placez chaque tireur',
    options: 'Options',
    separerClubs: 'Séparer les tireurs d’un même club autant que possible',
    hasard: (n: number) => `Placer au hasard les tireurs sans classement (${n} tireur${n > 1 ? 's' : ''})`,
    /** US-158 CA-8 à CA-10 : le champ « Pistes ». */
    pistes: 'Pistes',
    pistesAide:
      'Un numéro (la première piste, les suivantes s’enchaînent) ou une liste : 4, 5, 6, 10-13. Modifiable ensuite poule par poule.',
    pistesUtilisees: (pistes: readonly number[]) =>
      `Piste${pistes.length > 1 ? 's' : ''} utilisée${pistes.length > 1 ? 's' : ''} : ${pistes.join(', ')}`,
    erreursPistes: (e: ErreurPistes): string => {
      switch (e.erreur) {
        case 'VIDE':
          return 'Indiquez au moins une piste.';
        case 'INVALIDE':
          return e.texte === ''
            ? 'Une piste manque entre deux virgules.'
            : `« ${e.texte} » n’est pas un numéro de piste (de 1 à 99).`;
        case 'PLAGE_INVALIDE':
          return `Plage ${e.texte} invalide : de la plus petite à la plus grande piste, de 1 à 99.`;
        case 'EN_DOUBLE':
          return `La piste ${e.piste} est en double.`;
        case 'MANQUE':
          return `Il manque ${e.manque} piste${e.manque > 1 ? 's' : ''} pour ${e.poules} poules.`;
      }
    },
    rienDeFige: 'Rien n’est figé : vous vérifiez et ajustez les poules avant de les lancer.',
    remplacee: 'La composition actuelle sera remplacée, avec vos ajustements.',
    repartir: 'Répartir les poules',
    creerVides: 'Créer les poules vides',
    annuler: 'Annuler',
    aideTitre: 'Comment se fait la répartition automatique',
    aideTexte: 'Les tireurs sont pris dans l’ordre du classement et distribués ',
    serpentin: 'en serpentin',
    aideSuite: ' : chaque poule reçoit une tête de série, et les niveaux s’équilibrent.',
    aideTableau: 'Rang au classement placé dans chaque poule',
    sens: 'Sens',
    versLaDroite: 'vers la droite',
    versLaGauche: 'vers la gauche',
    aideClubs:
      'Si deux tireurs d’un même club tombent dans la même poule, l’application l’échange avec un tireur de rang voisin d’une autre poule. Quand c’est impossible (trop de tireurs du club), la poule est signalée.',
    poule: (numero: number) => `Poule ${numero}`,
    piste: 'Piste',
    pisteN: (piste: number) => `Piste ${piste}`,
    aVerifier: 'À vérifier',
    enCours: 'En cours',
    resume: (nombre: number, tailles: string, pistes: string, manuelle: boolean) =>
      [
        `${nombre} poule${nombre > 1 ? 's' : ''} ${tailles}`,
        pistes,
        manuelle ? 'répartition manuelle' : 'répartition automatique',
      ]
        .filter(Boolean)
        .join(' · '),
    /** US-158 CA-9 : « pistes 1 à 4 » quand elles se suivent, sinon leur liste (« pistes 4, 5, 10 »). */
    pistesDe: (pistes: readonly number[]) => {
      const triees = [...new Set(pistes)].sort((a, b) => a - b);
      const [premiere, derniere] = [triees[0], triees[triees.length - 1]];
      if (premiere === undefined || derniere === undefined) return '';
      if (premiere === derniere) return `piste ${premiere}`;
      return derniere - premiere === triees.length - 1
        ? `pistes ${premiere} à ${derniere}`
        : `pistes ${triees.join(', ')}`;
    },
    tireursPoule: (n: number) => `${n} tireur${n > 1 ? 's' : ''}`,
    moyenne: (moyenne: number) =>
      ` · moyenne des rangs ${moyenne.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`,
    clubEnDouble: (nombre: number, club: string) => `${nombre} tireurs de ${club} dans cette poule`,
    tailleHorsBornes: (n: number) => `Poule de ${n} : hors de 5 à 7 tireurs`,
    pouleVide: 'Aucun tireur : glissez-en un ici, ou « ⋯ › Déplacer vers… »',
    lectureSeule: 'Lecture seule : un autre PC est le pilote',
    archivee: 'Épreuve archivée : lecture seule',
    /** US-109 CA-5 : une fois le tableau créé, les poules sont figées. */
    tableauCree: 'Le tableau est créé : les poules sont en lecture seule',
    repartiesAnnonce: (n: number) => `${n} poule${n > 1 ? 's' : ''} constituée${n > 1 ? 's' : ''}`,
    repartirANouveau: 'Répartir à nouveau',
    // US-087 (planche 9).
    lancer: 'Lancer les poules',
    confirmerLancement: 'Lancer les poules ?',
    detailLancement:
      'La répartition sera figée et la saisie des scores s’ouvrira ; les inscriptions et l’émargement se ferment.',
    lanceesFigees: 'Les poules sont lancées : la répartition est figée.',
    imprimerFeuilles: 'Imprimer les feuilles de poule',
    imprimerAVenir: 'À venir (impressions, E7)',
    aideAjustement:
      'Glissez un tireur par sa poignée pour le changer de poule, ou ouvrez son menu « ⋯ » › Déplacer vers… (au clavier). Une fois les poules lancées, la répartition est figée et les feuilles de poule peuvent être imprimées.',
    glisser: (nom: string) => `Glisser ${nom} vers une autre poule`,
    deplacerVers: (numero: number) => `Déplacer vers la poule ${numero}`,
    deplacerAilleurs: 'Déplacer vers une autre poule',
    unePouleSeule: 'Une seule poule : aucune autre où déplacer',
    placerDans: (numero: number) => `Placer dans la poule ${numero}`,
    aPlacer: (n: number) => `À placer · ${n} tireur${n > 1 ? 's' : ''}`,
    pisteDe: (numero: number) => `Piste de la poule ${numero}`,
    pisteEnDouble: (piste: number) => `Piste ${piste} utilisée par plusieurs poules`,
    memeClub: (nom: string, autre: string, club: string) => `Déposer ${nom} ici : même club que ${autre} (${club})`,
    alertes: (n: number) => `${n} alerte${n > 1 ? 's' : ''} à vérifier`,
    raisonLancement: (code: string, aPlacer: number) =>
      code === 'TIREURS_A_PLACER'
        ? `${aPlacer} tireur${aPlacer > 1 ? 's' : ''} à placer`
        : code === 'POULE_TROP_GRANDE'
          ? 'Une poule a plus de 7 tireurs'
          : 'Chaque poule doit avoir au moins 3 tireurs',
    lanceesAnnonce: 'Poules lancées',
    // US-088 (planche 10).
    avancement: (regles: number, total: number) => `${regles} match${regles > 1 ? 's' : ''} sur ${total}`,
    classementApres: 'le classement après poules s’ouvre quand toutes les poules sont terminées',
    toutesTerminees: 'Toutes les poules sont terminées : le classement après poules s’ouvre avec le tableau (E6)',
    ongletAvancement: (regles: number, total: number, terminee: boolean) =>
      terminee ? `Terminée · ${regles}/${total}` : `${regles}/${total} matchs`,
    feuille: (numero: number, piste: number) => `Feuille de la poule ${numero} · piste ${piste}`,
    cliquezUneCase: 'Cliquez une case pour saisir ou corriger',
    tireur: 'Tireur',
    colonnes: { victoires: 'V', ratio: 'V/M', td: 'TD', tr: 'TR', indice: 'Ind', rang: 'Rg' },
    colonnesLongues: {
      victoires: 'Victoires',
      ratio: 'Victoires par match',
      td: 'Touches données',
      tr: 'Touches reçues',
      indice: 'Indice',
      rang: 'Rang',
    },
    caseMatch: (nom: string, adversaire: string, resultat: string) => `${nom} contre ${adversaire} : ${resultat}`,
    aTirer: 'à tirer',
    /** US-158 CA-4 : match resté sans score quand le tableau a été créé avant la fin des poules. */
    nonTire: 'Non tiré',
    forfait: 'forfait',
    legende:
      'V5 : victoire, avec ses touches · chiffre : touches de la défaite · case teintée : match en cours de saisie · rang provisoire jusqu’au dernier match.',
    match: (numero: number, total: number) => `Match ${numero} sur ${total}`,
    contre: (a: number, b: number) => `${a} contre ${b}`,
    touchesDe: (nom: string) => `Touches de ${nom}`,
    auTemps: 'Victoire au temps',
    valider: 'Valider le score',
    aideSaisie: (touches: number) => `Entrée valide et passe au match suivant. Le vainqueur a ${touches} touches.`,
    vainqueurATouches: (touches: number) => `Le vainqueur a ${touches} touches`,
    auTempsMoins: (touches: number) => `Au temps, le vainqueur mène sans atteindre ${touches} touches`,
    egalite: 'Pas d’égalité : un des deux tireurs gagne',
    // US-091 : saisie par boutons.
    unSeulVainqueur: 'Un seul vainqueur : choisissez « V » d’un seul côté',
    boutonsDe: (nom: string) => `Score de ${nom}`,
    boutonPour: (valeur: string, nom: string) => `${valeur} pour ${nom}`,
    cotePiste: { gauche: 'à gauche', droite: 'à droite' },
    aideBoutons:
      'Deux choix enregistrent le score et passent au match suivant. Sans « V », c’est une victoire au temps.',
    pouleFinie: 'Tous les matchs de cette poule sont saisis : cliquez une case pour corriger un score.',
    ordreDesMatchs: 'Ordre des matchs',
    enCoursDeSaisie: 'en cours',
    // US-092 : classement des poules (planche 20).
    classementTitre: 'Classement des poules',
    classementProvisoire: 'provisoire',
    classementDefinitif: 'définitif',
    classementProvisoireEntete: (regles: number, total: number) =>
      `Provisoire · ${regles} match${regles > 1 ? 's' : ''} sur ${total}`,
    classementDefinitifEntete: 'Définitif',
    /** US-158 CA-4 : poules figées par un tableau créé avant leur fin. */
    classementDefinitifNonTires: (n: number) => `Définitif · ${n} match${n > 1 ? 's' : ''} non tiré${n > 1 ? 's' : ''}`,
    classementAide: 'Se met à jour à chaque score saisi · départage : V/M, puis indice, puis touches données',
    imprimerClassement: 'Imprimer le classement',
    classementEffectif: (tireurs: number, poules: number) =>
      `${tireurs} tireur${tireurs > 1 ? 's' : ''} · ${poules} poule${poules > 1 ? 's' : ''}`,
    etatPoules: (terminees: number[], enCours: number[]) => {
      const liste = (n: number[]) =>
        n.length === 1 ? `Poule ${n[0]}` : `Poules ${n.slice(0, -1).join(', ')} et ${n.at(-1)}`;
      return [
        terminees.length ? `${liste(terminees)} terminée${terminees.length > 1 ? 's' : ''}` : null,
        enCours.length ? `${liste(enCours).toLowerCase()} en cours` : null,
      ]
        .filter(Boolean)
        .join(' · ')
        .replace(/^poule/, 'Poule');
    },
    club: 'Club',
    poulesColonne: 'Poule',
    matchsTires: 'Matchs tirés',
    etatColonne: 'État',
    exaequo: 'ex aequo',
    pouleTerminee: 'Poule terminée',
    matchsATirer: (n: number) => `${n} match${n > 1 ? 's' : ''} à tirer`,
    classementLegende:
      '« = » : ex aequo. Le rang reste provisoire tant qu’une poule n’est pas terminée ; un tireur retiré (abandon, forfait, exclusion) est placé en fin de classement. Le tableau (E6) partira de ce classement.',
    // US-089 : retrait d'un tireur des poules.
    motifs: { abandon: 'Abandon', forfait: 'Forfait', exclusion: 'Exclusion' } as Record<string, string>,
    retirerMotif: (motif: string) => `${motif}…`,
    retirerDetail: 'matchs restants perdus, classé dernier',
    confirmerRetrait: (nom: string, motif: string) => `${motif} : retirer ${nom} des poules ?`,
    detailRetrait: (touches: number) =>
      `Ses matchs déjà tirés gardent leur score ; ses matchs restants comptent perdus 0 à ${touches} et ne se saisissent plus. Il est classé dernier de sa poule.`,
    retirer: 'Retirer',
    annulerRetrait: 'Annuler le retrait',
    confirmerAnnulation: (nom: string) => `Annuler le retrait de ${nom} ?`,
    detailAnnulation: 'Ses matchs restants redeviennent à tirer et son rang est recalculé.',
    annulerLeRetrait: 'Annuler le retrait',
    retraitAnnonce: (nom: string, motif: string) => `${nom} : ${motif.toLowerCase()} enregistré`,
    retraitAnnuleAnnonce: (nom: string) => `Retrait de ${nom} annulé`,
    scoreEnregistre: (a: string, ta: number, tb: number, b: string) => `${a} ${ta}–${tb} ${b} enregistré`,
    erreurs: {
      POULES_LANCEES: 'Les poules sont lancées : la répartition est figée',
      POULES_NON_LANCEES: 'Les poules ne sont pas encore lancées',
      POULES_INCOMPLETES: 'Chaque poule doit avoir au moins 3 tireurs',
      POULE_TROP_GRANDE: 'Une poule a plus de 7 tireurs',
      TIREURS_A_PLACER: 'Des présents sont encore à placer',
      TIREUR_ABSENT: 'Un tireur n’est plus présent : répartissez à nouveau',
      SCORE_INVALIDE: 'Score invalide',
      TIREUR_RETIRE: 'Ce tireur est retiré des poules',
      EPREUVE_ARCHIVEE: 'L’épreuve est archivée',
      AUTRE: 'Les poules n’ont pas pu être enregistrées sur cet appareil',
    } as Record<string, string>,
  },
  /** US-120 à US-128 : étape « Impressions » et documents imprimés (Epic 7, planches 22 à 30). */
  impressions: {
    titre: 'Impressions',
    explication:
      'Tout s’imprime depuis ce PC, avec ou sans internet. Pour un PDF, choisissez « Enregistrer en PDF » dans la fenêtre d’impression.',
    groupes: { avant: 'Avant les poules', poules: 'Poules', tableau: 'Tableau' },
    documents: {
      presence: { nom: 'Feuille de présence', detail: 'Les inscrits, case « Présente » et signature' },
      qrCodes: { nom: 'QR codes des arbitres et des tireurs', detail: 'Une page à afficher près des pistes' },
      poulesVierges: {
        nom: 'Feuilles de poule à remplir',
        detail: 'Pour les arbitres : une page par poule, ordre des matchs, signature, QR code des arbitres',
      },
      poulesResultats: {
        nom: 'Feuilles de poule avec résultats',
        detail: 'À afficher : scores, victoires, indices et rangs',
      },
      poulesPistes: {
        nom: 'Poules par piste',
        detail: 'À afficher dans la salle : les poules, leur piste et leurs tireurs',
      },
      classementPoules: {
        nom: 'Classement des poules',
        detail: 'Le classement après les poules, provisoire ou définitif',
      },
      feuillesMatch: {
        nom: 'Feuilles de match',
        detail: 'Pour les arbitres : 2 par page, à couper ; les matchs à tirer du tour choisi',
      },
      tableau: { nom: 'Tableau', detail: 'À afficher : l’arbre, de son premier tour à la finale, scores compris' },
      classementFinal: { nom: 'Classement final', detail: 'Le podium et le classement de l’épreuve' },
      rencontresPoules: {
        nom: 'Feuilles de rencontre',
        detail: 'Pour les arbitres : une par rencontre à tirer des poules, avec l’ordre des relais',
      },
      rencontresTableau: {
        nom: 'Feuilles de rencontre',
        detail: 'Pour les arbitres : une par rencontre à tirer du tour choisi, avec l’ordre des relais',
      },
    } satisfies Record<DocumentImprime, { nom: string; detail: string }>,
    raisons: {
      AUCUN_INSCRIT: 'Aucun inscrit',
      POULES_NON_COMPOSEES: 'Après la composition des poules',
      POULES_NON_LANCEES: 'Après le lancement des poules',
      TABLEAU_NON_CREE: 'Après la création du tableau',
      AUCUN_MATCH_A_TIRER: 'Aucun match à tirer',
    } satisfies Record<RaisonIndisponible, string>,
    aVenir: 'À venir',
    imprimer: 'Imprimer',
    toutes: 'Toutes',
    poule: (n: number) => `Poule ${n}`,
    choixPoules: 'Poules à imprimer',
    choixTour: 'Tour à imprimer',
    choixFormat: 'Format du papier',
    formats: { a4: 'A4 paysage', a3: 'A3 paysage' },
    // Page d'impression et gabarit commun (US-120 CA-3).
    retour: 'Retour aux impressions',
    imprimerPage: 'Imprimer',
    introuvable: 'Ce document est introuvable.',
    indisponible: (raison: string) => `Ce document ne peut pas encore s’imprimer : ${raison.toLowerCase()}.`,
    marque: 'Poule Position',
    imprimeLe: (date: Date) =>
      `Imprimé le ${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()} à ${date.getHours()} h ${String(date.getMinutes()).padStart(2, '0')}`,
    page: (n: number, total: number) => `Page ${n} / ${total}`,
    // US-121 : feuille de présence (planche 23).
    presence: {
      titre: 'Feuille de présence',
      intro: (n: number) =>
        `${n} inscrit${n > 1 ? 's' : ''} · cochez la case à l’arrivée et faites signer. Les cases déjà cochées viennent de l’émargement sur le PC.`,
      colonnes: {
        equipe: 'Équipe',
        numero: 'N°',
        tireur: 'Tireur',
        club: 'Club',
        classement: 'Class.',
        present: 'Présent',
        signature: 'Signature',
      },
      pointe: 'pointé à l’émargement',
      pied: (presents: number, total: number) =>
        `${presents} présent${presents > 1 ? 's' : ''} sur ${total} au moment de l’impression`,
    },
    // US-128 : classement final (planche 30).
    classementFinal: {
      titre: 'Classement final',
      podium: 'Podium',
      place: (place: number) => (place === 1 ? '1re' : `${place}e`),
    },
    // US-127 : tableau à afficher (planche 29).
    tableau: {
      titre: (premier: string) => `Tableau, du ${premier.toLowerCase()} à la finale`,
      titreTour: (tour: string) => tour,
      aRemplir: '……………………………',
      legende: '(n) : rang après les poules · en gras : vainqueur',
    },
    // US-126 : feuilles de match du tableau (planche 28).
    /** US-153 (planche 43) : feuille de rencontre par équipes. */
    feuillesRencontre: {
      titre: 'Feuille de rencontre',
      membres: (noms: string[]) => noms.join(' · '),
      poule: (poule: number, numero: number) => `Poule ${poule} · rencontre ${numero}`,
      tour: (tour: string, numero: number) => `${tour} · rencontre ${numero}`,
      piste: (piste: number | null) => (piste === null ? 'Piste : ______' : `Piste ${piste}`),
      numero: 'N°',
      tireurs: (debut: number, fin: number) => `Tireur (écrire son numéro ${debut} à ${fin})`,
      remplacant: (nom: string | null) => `Remplaçant : ${nom ?? '—'}`,
      relais: 'Relais',
      tireursRelais: 'Tireurs',
      jusqua: 'Jusqu’à',
      paraphe: 'Paraphe arbitre',
      explication: (touches: number) =>
        `Chaque relais se tire jusqu’au score cumulé indiqué (ou jusqu’à la fin de son temps), ${touches} touches en tout. L’ordre des relais est l’ordre officiel : 1, 2, 3 pour une équipe, 4, 5, 6 pour l’autre. Un remplaçant prend les relais du tireur qu’il remplace.`,
      scoreFinal: 'Score final',
      vainqueur: 'Vainqueur :',
      arbitre: 'Arbitre',
      capitaine: (equipe: string) => `Capitaine ${equipe}`,
    },
    feuillesMatch: {
      titre: (tour: string) => `Feuilles de match · ${tour}`,
      piste: (piste: number | null) => `${piste ? `Piste ${piste}` : 'Piste ____'} · ___ h ___`,
      cotes: { gauche: 'À gauche', droite: 'À droite' },
      touches: 'Touches',
      vainqueur: 'Vainqueur : ………………………………………………',
      auTemps: '☐ au temps',
      priorite: '☐ à égalité, priorité à : ………………………',
      signatures: ['Arbitre', 'Tireur à gauche', 'Tireur à droite'],
      rapporter: 'Rapportez la feuille à la table de marque dès la fin du match.',
      suite: (tour: string) => `Le vainqueur passe au tour suivant : ${tour}.`,
      finale: 'Le vainqueur remporte l’épreuve.',
      couper: 'couper ici',
      pied: 'matchs à tirer',
    },
    // US-125 : classement après les poules (planche 27).
    classementPoules: {
      titre: 'Classement après les poules',
      definitif: (total: number) => `Définitif · ${total} matchs sur ${total}`,
    },
    // US-124 : poules par piste (planche 26).
    poulesPistes: {
      titre: 'Les poules',
      sousTitre: (n: number) => `${n} poule${n > 1 ? 's' : ''} · rendez-vous sur votre piste`,
    },
    // US-122 et US-123 : feuilles de poule (planches 24 et 25).
    feuillePoule: {
      titre: (numero: number, piste: number | null) => (piste ? `Poule ${numero} · Piste ${piste}` : `Poule ${numero}`),
      sousTitre: (tireurs: number, matchs: number, touches: number) =>
        `${tireurs} tireurs · ${matchs} matchs en ${touches} touches · début : ____ h ____`,
      colonnes: ['V', 'V/M', 'TD', 'TR', 'Ind', 'Rg'],
      tireur: 'Tireur',
      club: 'Club',
      ordre: (touches: number) =>
        `Ordre des matchs · notez « V » pour le vainqueur (V${touches}, ou V et ses touches au temps)`,
      ordreSimple: 'Ordre des matchs',
      arbitre: 'Arbitre',
      nom: 'Nom : ……………………………………………',
      signature: 'Signature :',
      fin: 'Fin de poule',
      heure: 'Heure : ____ h ____',
      rapporter: 'Rapportez la feuille à la table de marque.',
      qr: 'Arbitre : scannez pour saisir les scores sur votre téléphone.',
      qrNom: (poule: number) => `QR code des arbitres, poule ${poule}`,
      pagination: (n: number, total: number) => `Poule ${n} / ${total}`,
      piedVierge: 'V = victoire (V et les touches au temps) ; défaite = touches données',
      provisoire: (regles: number, total: number) =>
        `Provisoire · ${regles} match${regles > 1 ? 's' : ''} sur ${total}`,
      terminee: 'Terminée',
      enCours: 'en cours',
      legende:
        'V : victoires · V/M : victoires par match · TD : touches données · TR : touches reçues · Ind : indice (TD − TR) · Rg : rang dans la poule.',
      piedResultats: 'à afficher dans la salle',
    },
  },
  /** US-117, US-118 : afficheur et pavé de score à la demande, communs aux saisies du PC et du smartphone. */
  pave: {
    /** US-159 : intervertir les côtés de piste (un gaucher appelé en premier, FIE t.22.1). */
    inverser: 'Intervertir les tireurs',
    scoreDe: (nom: string) => 'Score de ' + nom,
    case: (nom: string, valeur: string | null, ouverte: boolean) =>
      'Score de ' + nom + ' : ' + (valeur ?? 'à choisir') + (ouverte ? '' : ', toucher pour modifier'),
    bouton: (valeur: string, nom: string) => valeur + ' pour ' + nom,
    corriger: 'Touchez un score pour le corriger.',
    priorite: 'Égalité : qui a la priorité ?',
    prioriteGroupe: 'Vainqueur par priorité',
    /** US-150 à US-152 (planches 42 et 42 bis) : score d'une rencontre en relais, dizaines puis unités. */
    dizaines: 'Dizaines',
    unites: 'Unités',
    dizainesDe: (nom: string) => 'Dizaines du score de ' + nom,
    unitesDe: (nom: string) => 'Unités du score de ' + nom,
  },
  /** US-109 à US-115 : l'étape « Tableau » (planche 11). */
  tableau: {
    titre: 'Tableau',
    etats: { aCreer: 'À créer', enCours: 'En cours', termine: 'Terminé' },
    /** CA-3 (US-109) : « Tableau de 32 · 24 qualifiés, 8 exempts · pas de match pour la 3e place ». */
    sousTitre: (taille: number, qualifies: number, troisieme: boolean) => {
      const exempts = taille - qualifies;
      const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;
      const effectif =
        exempts > 0
          ? `${pluriel(qualifies, 'qualifié')}, ${pluriel(exempts, 'exempt')}`
          : pluriel(qualifies, 'qualifié');
      return `${nomDuTour(taille)} · ${effectif} · ${troisieme ? 'match pour la 3e place' : 'pas de match pour la 3e place'}`;
    },
    nomDuTour,
    /** Libellé court d'un tour, dans les pilules (planche 11 : « Quarts », « Demies »). */
    pilule: (taille: number) =>
      taille === 8 ? 'Quarts' : taille === 4 ? 'Demies' : taille === 2 ? 'Finale' : `Tableau de ${taille}`,
    troisiemePlace: '3e place',
    /** US-110 : titre de l'arbre (« Du tableau de 16 à la finale »). */
    arbreTitre: (debut: string, fin: string) => {
      const du = debut.startsWith('Tableau') ? `Du ${debut.toLowerCase()}` : `Des ${debut.toLowerCase()}`;
      const a =
        fin === 'Finale'
          ? 'à la finale'
          : fin.startsWith('Tableau')
            ? `au ${fin.toLowerCase()}`
            : `aux ${fin.toLowerCase()}`;
      return `${du} ${a}`;
    },
    cliquezUnMatch: 'Cliquez un match pour saisir ou corriger son score',
    /** US-110 CA-3 : « Vainqueur du match 4 », « Vainqueur du quart 1 », « Perdant de la demie 2 ». */
    provenance: (taille: number, numero: number, perdant: boolean) => {
      const qui = perdant ? 'Perdant' : 'Vainqueur';
      if (taille === 8) return `${qui} du quart ${numero}`;
      if (taille === 4) return `${qui} de la demie ${numero}`;
      return `${qui} du match ${numero}`;
    },
    /** US-110 CA-3 : l'état d'un match. */
    etatMatch: (match: { etat: string; piste: number | null; enPiste: boolean }) => {
      if (match.etat === 'regle') return 'Terminé';
      if (match.etat === 'exempt') return 'Exempt';
      if (match.etat === 'attente') return 'En attente';
      // US-158 CA-6 : départagé sans score à la fin anticipée de l'épreuve.
      if (match.etat === 'nonTire') return 'Non tiré';
      if (match.piste === null) return 'À tirer · piste à attribuer';
      return match.enPiste ? `En piste ${match.piste}` : `À tirer · piste ${match.piste}`;
    },
    motifCourt: (motif: string) => ({ abandon: 'Abandon', forfait: 'Forfait', exclusion: 'Exclusion' })[motif] ?? motif,
    /** US-110 CA-1 : avancement d'un tour dans sa pilule (« terminé », « 4/8 »). */
    avancementTour: (regles: number, total: number) =>
      total > 0 && regles === total ? 'terminé' : `${regles}/${total}`,
    tours: 'Tours du tableau',
    /** US-111 : carte de saisie du match choisi. */
    titreMatch: (tour: number, numero: number) =>
      tour === 0 ? 'Match pour la 3e place' : tour === 2 ? 'Finale' : `${nomDuTour(tour)} · match ${numero}`,
    appele: (piste: number, heure: number) => {
      const date = new Date(heure);
      return `Piste ${piste} · appelé à ${date.getHours()} h ${String(date.getMinutes()).padStart(2, '0')}`;
    },
    enFile: (piste: number) => `Piste ${piste} · en attente de la piste`,
    pisteAAttribuer: 'Piste à attribuer',
    touchesDe: (nom: string) => `Touches de ${nom}`,
    valider: 'Valider le score',
    victoireAuTemps: (nom: string) => `Victoire au temps de ${nom}`,
    priorite: 'Vainqueur par priorité',
    prioriteMention: 'priorité',
    horsBornes: (touches: number) => `Entre 0 et ${touches} touches`,
    scoreEnregistre: (a: string, ta: number, tb: number, b: string) => `${a} ${ta}–${tb} ${b} enregistré`,
    enAttenteDe: (provenance: string) => `En attente : ${provenance.charAt(0).toLowerCase()}${provenance.slice(1)}`,
    corrigerDabord: (suivant: string) => `Corrigez d’abord le match suivant (${suivant})`,
    retrait: 'Abandon, forfait, exclusion…',
    carteSaisie: 'Saisie du match',
    /** US-112 : appeler un match sur une piste. */
    piste: 'Piste',
    appeler: (piste: number | null) => (piste ? `Appeler sur la piste ${piste}` : 'Appeler'),
    changerPiste: (piste: number | null) => (piste ? `Changer pour la piste ${piste}` : 'Changer de piste'),
    pisteOccupee: 'occupée',
    /** US-117 : la pastille de la piste du match. */
    pisteDuMatch: (piste: number) => `Piste ${piste} : le match y est appelé`,
    autrePiste: 'Autre…',
    retirerPiste: (piste: number) => `Retirer la piste ${piste}`,
    appelAnnonce: (match: string, piste: number) => `${match} appelé sur la piste ${piste}`,
    pisteRetireeAnnonce: (match: string) => `${match} : piste retirée`,
    menuMatch: (match: string) => match,
    /** US-113 : abandon, forfait, exclusion dans le tableau. */
    retraitTitre: (match: string) => `Abandon, forfait, exclusion · ${match}`,
    retraitQui: 'Tireur retiré',
    retraitConstat: (motif: string, nom: string) => `${motif} de ${nom}`,
    retraitMotif: 'Motif',
    retraitEffet: (nom: string, suite: string) => `${nom} ${suite}`,
    suiteDuVainqueur: (tourSuivant: number | null, troisieme: boolean) => {
      if (troisieme) return 'est 3e';
      if (tourSuivant === null) return 'remporte l’épreuve';
      if (tourSuivant === 2) return 'passe en finale';
      if (tourSuivant === 4) return 'passe en demi-finale';
      if (tourSuivant === 8) return 'passe en quart de finale';
      return `passe au tableau de ${tourSuivant}`;
    },
    retirer: 'Retirer',
    annulerRetrait: 'Annuler le retrait',
    retraitAnnonce: (nom: string, motif: string) => `${nom} : ${motif.toLowerCase()} enregistré`,
    retraitAnnuleAnnonce: (match: string) => `${match} : retrait annulé`,
    /** US-115 : classement final et fin de l'épreuve. */
    classementFinal: 'Classement final',
    provisoire: 'provisoire',
    classementProvisoire: (regles: number, total: number) =>
      `Provisoire · ${regles} match${regles > 1 ? 's' : ''} sur ${total}`,
    classementDefinitif: 'Définitif',
    effectif: (n: number) => `${n} tireur${n > 1 ? 's' : ''}`,
    colonnes: { place: 'Place', tireur: 'Tireur', club: 'Club', tour: 'Éliminé en', rang: 'Rang poules', etat: 'État' },
    tourElimination: (taille: number | null) =>
      taille === null
        ? '—'
        : taille === 1
          ? 'Vainqueur'
          : taille === 2
            ? 'Finale'
            : taille === 4
              ? 'Demies'
              : taille === 8
                ? 'Quarts'
                : `Tableau de ${taille}`,
    etatsClassement: {
      classe: '',
      elimine: 'Place à venir',
      enLice: 'En lice',
      exclusion: 'Exclusion',
      nonQualifie: 'Non qualifié',
    } as Record<string, string>,
    legendeClassement:
      '« = » : ex aequo. Les éliminés d’un même tour sont classés par leur rang après poules, une fois le tour terminé ; un tireur exclu n’est pas classé.',
    terminer: 'Terminer l’épreuve',
    confirmerFin: 'Terminer l’épreuve ?',
    detailFin: 'Les scores ne pourront plus être modifiés. Le classement final devient définitif.',
    termineeAnnonce: 'Épreuve terminée',
    imprimerClassement: 'Imprimer le classement final',
    podium: 'Podium',
    poulesEnCours: (regles: number, total: number) =>
      `Le tableau se crée quand toutes les poules sont terminées · ${regles} match${regles > 1 ? 's' : ''} sur ${total}`,
    voirPoules: 'Voir les poules',
    unSeulQualifie: 'Un seul tireur qualifié : il remporte l’épreuve.',
    premierTour: 'Premier tour',
    exempt: 'Exempt',
    contre: 'contre',
    exaequo: (rang: number, noms: string) =>
      `${rang === 1 ? '1er' : `${rang}e`} ex aequo : ${noms} · départagés par tirage au sort à la création du tableau`,
    nonQualifies: 'Non qualifiés',
    nonQualifiesDetail: 'retirés des poules',
    creer: 'Créer le tableau',
    confirmerCreation: 'Créer le tableau ?',
    detailCreation:
      'Les ex aequo sont tirés au sort et les scores des poules ne pourront plus être modifiés. Le tableau se joue ensuite match par match.',
    creeAnnonce: 'Tableau créé',
    /** US-158 CA-1 et CA-2 : créer le tableau avant la fin des poules. */
    creerAnticipe: 'Créer le tableau sans attendre la fin des poules…',
    confirmerCreationAnticipee: 'Créer le tableau sans attendre la fin des poules ?',
    detailCreationAnticipee: (nonTires: readonly { poule: number; nombre: number }[]) => {
      const total = nonTires.reduce((somme, { nombre }) => somme + nombre, 0);
      const detail = nonTires.map(({ poule, nombre }) => `poule ${poule} (${nombre})`).join(', ');
      return `${total} match${total > 1 ? 's' : ''} non tiré${total > 1 ? 's' : ''} : ${detail}. Ils ne pourront plus être saisis : le classement des poules se fait sur les matchs tirés (V/M, indice, touches données) et les ex aequo sont tirés au sort.`;
    },
    /** US-158 CA-5 : terminer l'épreuve avant la fin du tableau. */
    terminerAnticipe: 'Terminer l’épreuve sans attendre la fin du tableau…',
    confirmerFinAnticipee: 'Terminer l’épreuve sans attendre la fin du tableau ?',
    detailFinAnticipee: (nonTires: number, enPiste: number) =>
      `${nonTires} match${nonTires > 1 ? 's' : ''} non tiré${nonTires > 1 ? 's' : ''}${enPiste > 0 ? ` (dont ${enPiste} en piste)` : ''}. Chacun est attribué au mieux classé après les poules, sans score, jusqu’à la finale. Les scores ne pourront plus être modifiés.`,
    /** US-158 CA-4 et CA-6 : mentions des matchs non tirés. */
    nonTire: 'Non tiré',
    finAnticipee: 'Épreuve terminée avant la fin du tableau',
    legende:
      '(n) : rang au classement après poules. Le vainqueur passe au tour suivant dès que le score est validé ; le classement final s’affiche après la finale.',
    lectureSeule: 'Lecture seule : un autre PC est le pilote',
    poulesFigees: 'Le tableau est créé : les poules sont figées.',
    imprimer: 'Imprimer le tableau',
    imprimerAVenir: 'À venir (impressions, E7)',
    menu: 'Tableau',
    erreurs: {
      POULES_NON_TERMINEES: 'Toutes les poules ne sont pas terminées',
      TABLEAU_EXISTE: 'Le tableau est déjà créé',
      TABLEAU_ABSENT: 'Le tableau n’est pas encore créé',
      QUALIFIES_INVALIDES: 'Les qualifiés ont changé : rechargez la page',
      QUALIFIES_INSUFFISANTS: 'Il faut au moins deux qualifiés pour un tableau',
      TABLEAU_TROP_GRAND: 'Un tableau compte au plus 256 tireurs',
      MATCH_INCONNU: 'Ce match n’existe pas dans le tableau',
      MATCH_NON_PRET: 'Ce match attend encore un tireur',
      MATCH_REGLE: 'Ce match est déjà réglé',
      MATCH_SUIVANT_REGLE: 'Le match suivant est déjà réglé : corrigez-le d’abord',
      PISTE_INVALIDE: 'Piste invalide (1 à 99)',
      SCORE_INVALIDE: 'Score invalide',
      MOTIF_INVALIDE: 'Motif invalide',
      RETRAIT_ABSENT: 'Aucun retrait à annuler sur ce match',
      MATCHS_A_REGLER: 'Des matchs restent à régler',
      EPREUVE_TERMINEE: 'L’épreuve est terminée',
      EPREUVE_ARCHIVEE: 'L’épreuve est archivée',
      AUTRE: 'Le tableau n’a pas pu être enregistré sur cet appareil',
    } as Record<string, string>,
  },
  /** US-083 : import du fichier d'inscription de la Fédération (XML Engarde / BellePoule). */
  importFfe: {
    titre: 'Importer le fichier de la Fédération',
    choisir: 'Fichier d’inscription (XML Engarde / BellePoule)',
    resume: (total: number) => (total > 1 ? `${total} tireurs dans le fichier` : `${total} tireur dans le fichier`),
    nouveaux: (nombre: number) => `${nombre} nouveau${nombre > 1 ? 'x' : ''}`,
    deja: (nombre: number, aMettreAJour: number) =>
      `${nombre} déjà inscrit${nombre > 1 ? 's' : ''} (même licence)${aMettreAJour > 0 ? `, dont ${aMettreAJour} à mettre à jour` : ''}`,
    homonymes: (nombre: number) => `${nombre} homonyme${nombre > 1 ? 's' : ''} : cochez ceux à inscrire quand même`,
    homonyme: (importe: string, inscrit: string) => `${importe}, comme ${inscrit}`,
    ecartes: (nombre: number) => `${nombre} écarté${nombre > 1 ? 's' : ''}`,
    motifs: {
      NOM_MANQUANT: 'Nom ou prénom manquant',
      SEXE_DIFFERENT: 'Sexe différent de l’épreuve',
      LICENCE_EN_DOUBLE: 'Licence en double dans le fichier',
    },
    competitionDifferente: (detail: string) =>
      `Le fichier concerne une autre épreuve (${detail}) : vérifiez avant d’importer.`,
    importer: (nombre: number) => (nombre > 1 ? `Importer ${nombre} tireurs` : `Importer ${nombre} tireur`),
    annuler: 'Annuler',
    resultat: (inscrits: number, misAJour: number, ecartes: number, echecs: number) =>
      [
        `${inscrits} tireur${inscrits > 1 ? 's' : ''} inscrit${inscrits > 1 ? 's' : ''}`,
        misAJour > 0 ? `${misAJour} mis à jour` : null,
        ecartes > 0 ? `${ecartes} écarté${ecartes > 1 ? 's' : ''}` : null,
        echecs > 0 ? `${echecs} non enregistré${echecs > 1 ? 's' : ''}` : null,
      ]
        .filter(Boolean)
        .join(', '),
    erreurs: {
      TROP_GROS: 'Ce fichier dépasse 5 Mo',
      PAS_INDIVIDUEL: 'Ce fichier n’est pas un fichier d’inscription individuelle au format Engarde / BellePoule',
      AUCUN_TIREUR: 'Ce fichier ne contient aucun tireur',
    },
  },
  /** US-156 : import des équipes depuis un fichier CSV. */
  importEquipes: {
    importerFichier: 'Importer un fichier…',
    titre: 'Importer des équipes',
    choisir: 'Fichier d’équipes (CSV)',
    resume: (total: number) => (total > 1 ? `${total} équipes dans le fichier` : `${total} équipe dans le fichier`),
    importables: (nombre: number) => `${nombre} équipe${nombre > 1 ? 's' : ''} à créer`,
    tireurs: (aInscrire: number, deja: number) =>
      `${aInscrire} tireur${aInscrire > 1 ? 's' : ''} à inscrire, ${deja} déjà inscrit${deja > 1 ? 's' : ''}`,
    rapproches: (nombre: number) =>
      `${nombre} rapproché${nombre > 1 ? 's' : ''} d’un inscrit par le nom (sans licence commune) : vérifiez`,
    rapproche: (importe: string, inscrit: string) => `${importe}, comme ${inscrit}`,
    ecartees: (nombre: number) => `${nombre} écartée${nombre > 1 ? 's' : ''}`,
    motif: (motif: string, tireur?: string, equipe?: string) =>
      (
        ({
          NOM_EQUIPE_MANQUANT: 'Nom d’équipe manquant',
          NOM_EQUIPE_PRIS: 'Une autre équipe porte déjà ce nom',
          NOMBRE_TITULAIRES: 'Nombre de titulaires différent du type d’épreuve',
          NOM_TIREUR_MANQUANT: 'Nom ou prénom manquant',
          DOUBLON_DANS_EQUIPE: 'Le même tireur apparaît deux fois dans l’équipe',
          TIREUR_DEJA_EN_EQUIPE: `${tireur ?? 'Un tireur'} est déjà dans l’équipe ${equipe ?? ''}`.trim(),
        }) as Record<string, string>
      )[motif] ?? motif,
    importer: (nombre: number) => (nombre > 1 ? `Importer ${nombre} équipes` : `Importer ${nombre} équipe`),
    annuler: 'Annuler',
    resultat: (equipes: number, tireurs: number, ecartees: number, echecs: number) =>
      [
        `${equipes} équipe${equipes > 1 ? 's' : ''} créée${equipes > 1 ? 's' : ''}`,
        `${tireurs} tireur${tireurs > 1 ? 's' : ''} inscrit${tireurs > 1 ? 's' : ''}`,
        `${ecartees} écartée${ecartees > 1 ? 's' : ''}`,
        echecs > 0 ? `${echecs} non enregistrée${echecs > 1 ? 's' : ''}` : null,
      ]
        .filter(Boolean)
        .join(', '),
    erreurs: {
      TROP_GROS: 'Ce fichier dépasse 5 Mo',
      COLONNES_MANQUANTES: 'Ce fichier n’est pas un fichier d’équipes au format attendu',
      AUCUNE_EQUIPE: 'Ce fichier ne contient aucune équipe',
    },
    colonnesManquantes: (colonnes: string[]) => `Colonnes manquantes : ${colonnes.join(', ')}`,
  },
  /** US-080 CA-3 à CA-5 : reprendre en main toutes les épreuves d'une compétition. */
  repriseLot: {
    action: 'Tout reprendre en main',
    detail: 'ce PC devient le pilote de toutes ses épreuves',
    horsLigne: 'Nécessite une connexion internet',
    titre: (competition: string) => `Tout reprendre en main « ${competition} » ?`,
    resume: (nombre: number) =>
      nombre > 1
        ? `${nombre} épreuves pilotées par un autre PC passent sur ce PC.`
        : '1 épreuve pilotée par un autre PC passe sur ce PC.',
    connecte: (libelle: string, nombre: number) =>
      `Le PC de ${libelle} est connecté et pilote ${nombre > 1 ? `${nombre} de ces épreuves` : 'l’une d’elles'}.`,
    valider: 'Tout reprendre en main',
    faites: (nombre: number) =>
      nombre > 1 ? `${nombre} épreuves reprises en main` : `${nombre} épreuve reprise en main`,
    dejaPrises: (nombre: number) =>
      nombre > 1
        ? `${nombre} épreuves ont été reprises entre-temps par un autre PC`
        : '1 épreuve a été reprise entre-temps par un autre PC',
    echecs: (nombre: number) =>
      nombre > 1 ? `${nombre} épreuves n’ont pas pu être reprises` : '1 épreuve n’a pas pu être reprise',
  },
  /** US-031 : page d'accueil publique et page « direct » d'une épreuve (E9 y ajoutera le suivi en direct). */
  accueilPublic: {
    /** US-157 CA-1 : sous-titre propre à l'accueil public (la connexion garde `sousTitre`). */
    sousTitre: 'Escrime',
    /** US-157 CA-2 : nom accessible et infobulle de l'icône « Info ». */
    feuilleDeRouteDe: (nom: string) => `Feuille de route : ${nom}`,
    titre: 'Épreuves à venir',
    chargement: 'Chargement des épreuves…',
    aucune: 'Aucune épreuve à venir',
    injoignable: 'Impossible de joindre le serveur : vérifiez votre connexion internet.',
    erreur: 'Les épreuves n’ont pas pu être chargées. Réessayez dans un instant.',
    reessayer: 'Réessayer',
    competitionsSeules: 'Autres compétitions',
    affiche: (nom: string) => `Affiche : ${nom}`,
    feuilleDeRoute: 'Feuille de route',
    voir: 'Voir l’épreuve',
    jours: (debut: string, fin: string) => {
      const jour = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;
      return debut === fin ? `le ${jour(debut)}` : `du ${jour(debut)} au ${jour(fin)}`;
    },
    /** US-079 CA-6 : les dates en toutes lettres, « du samedi 21 au dimanche 22 novembre 2026 ». */
    periode: (debut: string, fin: string) => {
      const ecrire = (date: string, options: Intl.DateTimeFormatOptions) =>
        new Intl.DateTimeFormat('fr-FR', { ...options, timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
      const complet = (date: string) =>
        ecrire(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      if (debut === fin) return `le ${complet(debut)}`;
      const memeAnnee = debut.slice(0, 4) === fin.slice(0, 4);
      const memeMois = memeAnnee && debut.slice(5, 7) === fin.slice(5, 7);
      const depart = memeMois
        ? ecrire(debut, { weekday: 'long', day: 'numeric' })
        : memeAnnee
          ? ecrire(debut, { weekday: 'long', day: 'numeric', month: 'long' })
          : complet(debut);
      return `du ${depart} au ${complet(fin)}`;
    },
    /** US-079 CA-7 : jour court d'une épreuve, « sam. 21 ». */
    jourCourt: (date: string) =>
      new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', timeZone: 'UTC' }).format(
        new Date(`${date}T00:00:00Z`),
      ),
    /** US-079 CA-10 : nom accessible et infobulle du lien vers la carte. */
    voirSurCarte: (lieu: string) => `Voir ${lieu} sur OpenStreetMap`,
    /** US-079 CA-7 : la ligne d'une épreuve est le lien vers elle. */
    voirEpreuve: (nom: string) => `Voir l’épreuve ${nom}`,
    /** US-139 : épreuve en cours ou terminée sur l'accueil public. */
    enDirect: 'En direct',
    suivreEnDirect: 'Suivre en direct',
    resultats: 'Résultats',
    suivreEpreuve: (nom: string) => `Suivre en direct ${nom}`,
    resultatsEpreuve: (nom: string) => `Résultats de ${nom}`,
    direct: {
      titre: 'Épreuve',
      chargement: 'Chargement de l’épreuve…',
      nonPubliee: 'Cette épreuve n’est pas publiée',
      accueil: 'Voir toutes les épreuves',
    },
  },
  fichiers: {
    titre: 'Documents',
    affiche: 'Affiche',
    feuilleDeRoute: 'Feuille de route',
    aucuneAffiche: 'Aucune affiche',
    aucuneFeuille: 'Aucune feuille de route',
    chargement: 'Chargement des documents…',
    joindreAffiche: 'Joindre une affiche',
    joindreFeuille: 'Joindre une feuille de route',
    remplacer: 'Remplacer',
    retirer: 'Retirer',
    ouvrir: 'Ouvrir la feuille de route',
    /** US-072 : aperçu des documents et fenêtre d'aperçu. */
    apercu: {
      agrandir: (document: string) => `Agrandir l’aperçu : ${document}`,
      premierePage: (document: string) => `Première page : ${document}`,
      pages: (n: number) => (n > 1 ? `${n} pages` : '1 page'),
      chargement: 'Aperçu…',
      nouvelOnglet: 'Ouvrir dans un nouvel onglet',
      fermer: 'Fermer',
      fenetre: (document: string) => `Aperçu : ${document}`,
      horsLigne: 'Aperçu disponible en ligne',
      indisponible: 'Aperçu indisponible',
      introuvable: 'Fichier introuvable',
    },
    /** US-073 : repère « Document » sur les lignes de la liste, et sa légende. */
    repere: {
      affiche: 'Affiche jointe',
      feuilleDeRoute: 'Feuille de route jointe',
      les2: 'Affiche et feuille de route jointes',
      legende: 'Affiche ou feuille de route jointe',
      choix: 'Document à voir',
    },
    /** CA-4 : le fichier vient d'un niveau au-dessus. */
    heritee: {
      competition: 'reprise de la compétition',
      manifestation: 'reprise de la manifestation',
    },
    horsLigne: 'Nécessite une connexion internet',
    envoiEnCours: 'Envoi en cours…',
    copieDu: (date: number) => `Documents du ${new Date(date).toLocaleString('fr-FR')}`,
    /** Les fichiers acceptés, pour le sélecteur de fichier et son aide. */
    aide: {
      affiche: 'PNG, JPEG ou WebP, 5 Mo au plus',
      feuilleDeRoute: 'PDF, 5 Mo au plus',
    },
    erreurs: {
      HORS_LIGNE: 'Nécessite une connexion internet',
      INTERROMPU: 'Envoi interrompu : réessayez',
      SESSION_INVALIDE: 'Votre session a expiré : reconnectez-vous',
      ACCES_REFUSE: 'Vous n’avez pas le droit de joindre des documents',
      PROPRIETAIRE_INCONNU: 'Cet élément n’est pas encore connu du serveur : réessayez dans un instant',
      FICHIER_INCONNU: 'Ce document a déjà été retiré',
      ERREUR_INATTENDUE: 'Une erreur est survenue : réessayez',
    },
    /** CA-3 : la raison du refus, dite clairement. */
    raisons: {
      VIDE: 'Ce fichier est vide.',
      TROP_GROS: 'Ce fichier dépasse 5 Mo.',
      TYPE_REFUSE: 'Ce type de fichier n’est pas accepté : choisissez un PDF, un PNG, un JPEG ou un WebP.',
      TYPE_INCOMPATIBLE:
        'Ce type de fichier ne convient pas ici : une affiche est une image, une feuille de route est un PDF.',
      IMAGE_ANIMEE: 'Les images animées ne sont pas acceptées.',
      IMAGE_TROP_GRANDE: 'Cette image dépasse 20 millions de pixels : choisissez-en une plus petite.',
    } satisfies Record<RaisonRefus, string>,
  },
  roles: {
    administrateur: 'Administrateur',
    organisateur: 'Organisateur',
  } satisfies Record<Role, string>,
};

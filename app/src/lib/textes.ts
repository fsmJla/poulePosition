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
} from '@poule-position/domaine';
import type { ErreurCompetitionSeule, ErreurCreation, ErreurModification } from './epreuves';
import type { EtatConnexion } from './connexion';
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

export const textes = {
  /** Nom affiché de l'application (US-014) ; le nom technique reste poulePosition. */
  nomApplication: 'Poule Position',
  sousTitre: 'Gestion de compétitions d’escrime',
  /** US-052 : sélecteur de thème (« Auto » suit le réglage du système). */
  theme: {
    libelle: 'Thème',
    choix: { clair: 'Clair', sombre: 'Sombre', auto: 'Auto' },
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
    titre: 'Manifestations et épreuves du club',
    nouvelleManifestation: 'Nouvelle manifestation',
    nouvelleCompetition: 'Nouvelle compétition',
    nouvelleCompetitionDans: (manifestation: string) => `Nouvelle compétition dans ${manifestation}`,
    horsLigne: 'Nécessite une connexion internet',
    /** Hors ligne, sans aucune copie du club gardée sur l'appareil. */
    horsLigneSansCopie: 'Hors ligne : seules les épreuves de cet appareil sont listées',
    chargement: 'Chargement de la liste…',
    afficherArchives: 'Afficher les archives',
    archivesMasquees: (nombre: number) =>
      nombre > 1 ? `${nombre} épreuves archivées masquées` : `${nombre} épreuve archivée masquée`,
    vide: 'Le club n’a encore ni manifestation, ni compétition, ni épreuve : créez une première manifestation ou une première compétition.',
    /** US-045 CA-7 : épreuves dont la compétition a été supprimée entre-temps, en tête de la liste. */
    aRattacher: 'Épreuves à rattacher',
    competitionSupprimee: 'Sa compétition a été supprimée : choisissez-en une autre',
    choisirCompetition: (nom: string) => `Choisir une compétition pour l’épreuve ${nom}`,
    choisirCompetitionBouton: 'Choisir une compétition',
    /** US-045 CA-4 : une compétition seule (challenge) est créée avec sa première épreuve. */
    nouvelleCompetitionSeule: 'Nouvelle compétition seule',
    aucuneEpreuve: 'Aucune épreuve',
    lectureSeule: 'Lecture seule',
    jour: (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`,
    ouvrir: (nom: string) => `Ouvrir l’épreuve ${nom}`,
    /** US-040 : suppression de plusieurs épreuves, réservée aux administrateurs. */
    suppression: {
      cocher: (nom: string) => `Sélectionner l’épreuve ${nom}`,
      enCours: 'Une épreuve en cours ne peut pas être supprimée',
      selection: (nombre: number) =>
        nombre > 1 ? `${nombre} épreuves sélectionnées` : `${nombre} épreuve sélectionnée`,
      toutCocher: 'Tout cocher',
      toutDecocher: 'Tout décocher',
      bouton: 'Supprimer définitivement…',
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
      nomEpreuve: (cle: string) => `Nom de l’épreuve ${cle}`,
      jourEpreuve: (cle: string) => `Jour de l’épreuve ${cle}`,
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
    parametresPage: {
      titre: 'Paramètres de l’épreuve',
      mention:
        'Ces réglages sont enregistrés. Ils seront appliqués quand la saisie par smartphone et l’affichage public seront disponibles.',
      arbitres: 'Arbitres',
      tireurs: 'Tireurs',
      affichage: 'Affichage public',
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
    /** US-028 : page « Formule » d'une épreuve. */
    formulePage: {
      titre: 'Formule de l’épreuve',
      touchesPoules: 'Touches en poules',
      touchesTableau: 'Touches au tableau',
      matchTroisieme: 'Match pour la 3e place',
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
      },
      erreurs: {
        TOUCHES_POULES_INVALIDES: 'Les poules se jouent en 3 à 10 touches',
        TOUCHES_TABLEAU_INVALIDES: 'Le tableau se joue en 10 ou 15 touches',
        MATCH_TROISIEME_INVALIDE: 'Choisissez si le match pour la 3e place est joué',
        FORMULE_FIGEE: 'Cette épreuve est terminée : sa formule n’est plus modifiable',
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
      bouton: 'Supprimer avec son contenu…',
      supprimer: (nom: string) => `Supprimer avec son contenu la compétition ${nom}`,
      horsLigne: 'Connexion requise pour supprimer',
      titre: (nom: string) => `Supprimer définitivement la compétition « ${nom} » avec son contenu ?`,
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
      ACCES_REFUSE: 'Seul un administrateur peut supprimer avec son contenu',
      EPREUVE_EN_COURS: 'Une épreuve en cours empêche la suppression',
      ERREUR_INATTENDUE: 'Erreur inattendue du serveur : réessayez',
    } satisfies Record<ErreurCompetitions, string>,
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
      bouton: 'Supprimer avec son contenu…',
      supprimer: (nom: string) => `Supprimer avec son contenu la manifestation ${nom}`,
      horsLigne: 'Connexion requise pour supprimer',
      titre: (nom: string) => `Supprimer définitivement la manifestation « ${nom} » avec son contenu ?`,
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
      COMMENTAIRE_TROP_LONG: 'Le commentaire fait au plus 2 000 caractères',
    } satisfies Record<ErreurManifestation, string>,
    erreurs: {
      HORS_LIGNE: 'Réseau perdu : rien n’a changé, réessayez',
      SESSION_INVALIDE: 'Session expirée : reconnectez-vous',
      MANIFESTATION_INCONNUE: 'Cette manifestation n’existe plus : rechargez',
      ACCES_REFUSE: 'Seul un administrateur peut supprimer avec son contenu',
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
  /** US-031 : page d'accueil publique et page « direct » d'une épreuve (E9 y ajoutera le suivi en direct). */
  accueilPublic: {
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

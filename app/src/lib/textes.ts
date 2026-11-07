// Catalogue des textes de l'interface (français seul pour l'instant, ADR-0002). Aucun texte en dur dans les composants.
import {
  LONGUEUR_MIN_MOT_DE_PASSE,
  type Arme,
  type CouleurAvatar,
  type ErreurCompetition,
  type ErreurEpreuve,
  type ErreurManifestation,
  type ErreurNouveauMotDePasse,
  type Decompte,
  type ErreurSaisieCompte,
  type Role,
  type Sexe,
  type Statut,
  type TypeCompetition,
} from '@poule-position/domaine';
import type { ErreurCreation, ErreurModification } from './competitions';
import type { EtatConnexion } from './connexion';
import type { ErreurEpreuves } from './epreuves';
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

/** US-043 : « 1 manifestation, 3 épreuves, 12 compétitions » ; un type absent de la sélection n'est pas cité. */
function decompteTexte({ manifestations, epreuves, competitions }: Decompte): string {
  const parties = [
    manifestations > 0 ? `${manifestations} ${manifestations > 1 ? 'manifestations' : 'manifestation'}` : null,
    epreuves > 0 ? `${epreuves} ${epreuves > 1 ? 'épreuves' : 'épreuve'}` : null,
    competitions > 0 ? `${competitions} ${competitions > 1 ? 'compétitions' : 'compétition'}` : null,
  ];
  return parties.filter((partie) => partie !== null).join(', ');
}

export const textes = {
  /** Nom affiché de l'application (US-014) ; le nom technique reste poulePosition. */
  nomApplication: 'Poule Position',
  sousTitre: 'Gestion de compétitions d’escrime',
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
        'Votre session et votre mot de passe enregistré sur cet appareil seront effacés : vous ne pourrez plus vous y reconnecter hors ligne. Les compétitions enregistrées sur cet appareil sont conservées.',
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
    titre: 'Manifestations et compétitions du club',
    nouvelleManifestation: 'Nouvelle manifestation',
    nouvelleEpreuve: 'Nouvelle épreuve',
    nouvelleEpreuveDans: (manifestation: string) => `Nouvelle épreuve dans ${manifestation}`,
    horsLigne: 'Nécessite une connexion internet',
    /** Hors ligne, sans aucune copie du club gardée sur l'appareil. */
    horsLigneSansCopie: 'Hors ligne : seules les compétitions de cet appareil sont listées',
    chargement: 'Chargement de la liste…',
    afficherArchives: 'Afficher les archives',
    archivesMasquees: (nombre: number) =>
      nombre > 1 ? `${nombre} compétitions archivées masquées` : `${nombre} compétition archivée masquée`,
    vide: 'Le club n’a encore ni manifestation ni compétition : créez une première manifestation ou une première compétition.',
    isolees: 'Compétitions isolées',
    aucuneCompetition: 'Aucune compétition',
    lectureSeule: 'Lecture seule',
    jour: (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`,
    ouvrir: (nom: string) => `Ouvrir la compétition ${nom}`,
    /** US-040 : suppression de plusieurs compétitions, réservée aux administrateurs. */
    suppression: {
      cocher: (nom: string) => `Sélectionner la compétition ${nom}`,
      enCours: 'Une compétition en cours ne peut pas être supprimée',
      selection: (nombre: number) =>
        nombre > 1 ? `${nombre} compétitions sélectionnées` : `${nombre} compétition sélectionnée`,
      toutCocher: 'Tout cocher',
      toutDecocher: 'Tout décocher',
      bouton: 'Supprimer définitivement…',
      horsLigne: 'Connexion requise pour supprimer',
      titre: (nombre: number) =>
        nombre > 1
          ? `Supprimer définitivement ces ${nombre} compétitions ?`
          : 'Supprimer définitivement cette compétition ?',
      avertissement:
        'La suppression est définitive : les journaux, les saisies et les fichiers joints sont effacés du serveur et de tous les PC du club. Pour garder une trace, archivez plutôt que de supprimer.',
      saisie: (mot: string) => `Saisissez ${mot} pour confirmer`,
      valider: 'Supprimer définitivement',
      progression: (faites: number, total: number) => `Suppression… ${faites} / ${total}`,
      annuler: 'Annuler',
      compteRendu: (supprimees: number) =>
        supprimees > 1 ? `${supprimees} compétitions supprimées` : `${supprimees} compétition supprimée`,
      restantes: (restantes: number) =>
        restantes > 1
          ? `${restantes} compétitions n’ont pas été supprimées`
          : `${restantes} compétition n’a pas été supprimée`,
      interrompue: 'La suppression s’est arrêtée : relancez-la quand la connexion ou la session est rétablie',
      nonTraitee: 'pas traitée',
      fermer: 'Fermer',
      /** US-043 : sélection mêlée de manifestations, d'épreuves et de compétitions. */
      cocherManifestation: (nom: string) => `Sélectionner la manifestation ${nom}`,
      cocherEpreuve: (nom: string) => `Sélectionner l’épreuve ${nom}`,
      contientEnCours: 'Contient une compétition en cours',
      avecParent: (parent: string) => `Supprimée avec ${parent}`,
      decompte: decompteTexte,
      selectionMixte: decompteTexte,
      titreMixte: (decompte: Decompte) => `Supprimer définitivement ${decompteTexte(decompte)} ?`,
      archiveesMasquees: (nombre: number) =>
        nombre > 1 ? `dont ${nombre} archivées masquées` : `dont ${nombre} archivée masquée`,
      compteRenduMixte: (decompte: Decompte) => `Supprimé : ${decompteTexte(decompte)}`,
      restantesMixte: (restantes: number) =>
        restantes > 1 ? `${restantes} éléments n’ont pas été supprimés` : `${restantes} élément n’a pas été supprimé`,
      types: { manifestation: 'manifestation', epreuve: 'épreuve', competition: 'compétition' },
      erreurs: {
        HORS_LIGNE: 'Connexion requise pour supprimer',
        SESSION_INVALIDE: 'Reconnectez-vous pour supprimer',
        ACCES_REFUSE: 'Seul un administrateur peut supprimer',
        COMPETITION_EN_COURS: 'Contient une compétition en cours',
        COMPETITION_INCONNUE: 'Compétition inconnue du serveur',
        COMPETITION_SUPPRIMEE: 'Déjà supprimée',
        MANIFESTATION_INCONNUE: 'Manifestation inconnue du serveur',
        MANIFESTATION_NON_VIDE: 'Manifestation non vide',
        EPREUVE_INCONNUE: 'Épreuve inconnue du serveur',
        EPREUVE_NON_VIDE: 'Épreuve non vide',
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
  /** US-025 : création et page d'une compétition. */
  competitions: {
    nouvelle: 'Nouvelle compétition',
    titreNouvelle: 'Nouvelle compétition',
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
    creer: 'Créer la compétition',
    /** US-027 : modification d'une compétition. */
    modifier: 'Modifier',
    titreModification: 'Modifier la compétition',
    enregistrer: 'Enregistrer',
    enregistrement: 'Enregistrement…',
    enCours: 'Création…',
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
    } satisfies Record<TypeCompetition, string>,
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
    lectureSeule: 'Lecture seule : cette compétition est pilotée par un autre PC',
    autreOnglet: 'Cette compétition est ouverte dans un autre onglet : lecture seule ici',
    /** US-029 : prise de main depuis un autre PC. */
    prise: {
      bouton: 'Prendre la main',
      horsLigne: 'Nécessite une connexion internet',
      chargement: 'Recherche du pilote…',
      confirmer: 'Prendre la main sur cette compétition ?',
      piloteConnecte: (libelle: string) => `Le PC de ${libelle} est connecté et pilote cette compétition`,
      piloteHorsLigne: (libelle: string) => `Cette compétition est pilotée par le PC de ${libelle}`,
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
        COMPETITION_INCONNUE: 'Compétition inconnue du serveur',
        ERREUR_INATTENDUE: 'Prise de main impossible pour le moment',
        ACCES_REFUSE: 'Prise de main impossible pour le moment',
        COMPETITION_EN_COURS: 'Prise de main impossible pour le moment',
        COMPETITION_SUPPRIMEE: 'Cette compétition a été supprimée',
      },
    },
    /** US-039 : suppression définitive d'une compétition, réservée aux administrateurs. */
    suppression: {
      bouton: 'Supprimer définitivement…',
      horsLigne: 'Connexion requise pour supprimer',
      enCours: 'Une compétition en cours ne peut pas être supprimée',
      titre: 'Supprimer définitivement cette compétition ?',
      avertissement:
        'La suppression est définitive : le journal, les saisies et les fichiers joints sont effacés du serveur et de tous les PC du club. Pour garder une trace, archivez la compétition plutôt que de la supprimer.',
      saisie: (nom: string) => `Saisissez « ${nom} » pour confirmer`,
      valider: 'Supprimer définitivement',
      suppression: 'Suppression…',
      annuler: 'Annuler',
      /** Annonce faite une seule fois sur un PC dont la copie vient d'être effacée. */
      annonce: (nom: string, abandonnees: number) =>
        `La compétition ${nom || 'sans nom'} a été supprimée par un administrateur${
          abandonnees > 0 ? '. Des saisies non envoyées ont été abandonnées' : ''
        }`,
      fermer: 'Fermer',
      erreurs: {
        HORS_LIGNE: 'Connexion requise pour supprimer',
        SESSION_INVALIDE: 'Reconnectez-vous pour supprimer',
        ACCES_REFUSE: 'Seul un administrateur peut supprimer une compétition',
        COMPETITION_EN_COURS: 'Une compétition en cours ne peut pas être supprimée',
        COMPETITION_INCONNUE: 'Compétition inconnue du serveur',
        COMPETITION_SUPPRIMEE: 'Cette compétition est déjà supprimée',
        ERREUR_INATTENDUE: 'Suppression impossible pour le moment',
      },
    },
    pasEncoreEnvoyee: 'Pas encore envoyée',
    enAttente: (nombre: number) =>
      nombre > 1 ? `${nombre} modifications en attente d’envoi` : `${nombre} modification en attente d’envoi`,
    /** US-022 : date de la copie d'une compétition pilotée par un autre PC (« Copie du 28/10 à 14 h 05 »). */
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
    rattachement: 'Rattachement',
    manifestation: 'Manifestation',
    epreuve: 'Épreuve',
    aucuneManifestation: 'Aucune (compétition isolée)',
    aucuneEpreuve: 'Aucune épreuve',
    choisirDate: 'Choisir un jour',
    /** US-024 CA-4 : « Cette épreuve est au sabre ». */
    epreuveAu: (arme: Arme) =>
      `Cette épreuve est ${{ sabre: 'au sabre', epee: 'à l’épée', fleuret: 'au fleuret', sabreLaser: 'au sabre laser' }[arme]}`,
    formuleTitre: 'Formule',
    formule: (touchesPoules: number, touchesTableau: number, matchTroisieme = false) =>
      `Poules en ${touchesPoules} touches, sans élimination · Tableau en ${touchesTableau} touches` +
      (matchTroisieme ? ' · Match pour la 3e place' : ''),
    modifierFormule: 'Formule',
    relais: (touches: number) => `Rencontres en relais à ${touches} touches`,
    /** US-028 CA-4 : avant de changer la formule d'une compétition en cours. */
    formuleConfirmation: (matchs: number) =>
      matchs === 1
        ? '1 match déjà joué ne change pas : la nouvelle formule s’applique aux matchs restants'
        : `${matchs} matchs déjà joués ne changent pas : la nouvelle formule s’applique aux matchs restants`,
    /** US-032 : page « Paramètres » d'une compétition. */
    lienParametres: 'Paramètres',
    parametresPage: {
      titre: 'Paramètres de la compétition',
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
      archivee: 'Cette compétition est archivée : ses paramètres sont en lecture seule',
      retour: 'Retour à la compétition',
      erreurs: {
        PARAMETRE_INVALIDE: 'Un réglage a une valeur invalide',
        CORRECTION_SCORE_INVALIDE: 'Choisissez qui peut corriger un score',
      },
    },
    /** US-028 : page « Formule » d'une compétition. */
    formulePage: {
      titre: 'Formule de la compétition',
      touchesPoules: 'Touches en poules',
      touchesTableau: 'Touches au tableau',
      matchTroisieme: 'Match pour la 3e place',
      relaisFixe: (touches: number) =>
        `Rencontres en relais à ${touches} touches (fixées par le type de la compétition)`,
      autresFormules: 'D’autres formules seront proposées plus tard.',
      enregistrer: 'Enregistrer la formule',
      confirmer: 'Confirmer le changement',
      historique: 'Historique de la formule',
      historiqueVide: 'Aucun changement de formule',
      retour: 'Retour à la compétition',
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
        FORMULE_FIGEE: 'Cette compétition est terminée : sa formule n’est plus modifiable',
      },
    },
    chargement: 'Chargement de la compétition…',
    introuvable: 'Compétition introuvable sur cet appareil',
    retour: "Retour à l'accueil de l'organisateur",
    champs: {
      NOM_VIDE: 'Le nom est obligatoire',
      NOM_TROP_LONG: 'Le nom fait au plus 100 caractères',
      ARME_INVALIDE: 'Choisissez une arme',
      ARME_DIFFERENTE_EPREUVE: 'Cette épreuve est d’une autre arme',
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
      RATTACHEMENT_INVALIDE: 'Rattachement invalide',
    } satisfies Record<ErreurCompetition, string>,
    erreurs: {
      ECRITURE_IMPOSSIBLE:
        'Enregistrement impossible sur cet appareil (espace plein ou navigation privée) : rien n’a été enregistré',
      CLUB_INCONNU: 'Reconnectez-vous une fois en ligne pour créer une compétition sur cet appareil',
      INTROUVABLE: 'Compétition introuvable sur cet appareil',
      PAS_PILOTE: 'Cette compétition est pilotée par un autre PC : modification impossible ici',
      COMPETITION_ARCHIVEE: 'Cette compétition est archivée : elle n’est plus modifiable',
      CHAMP_FIGE: 'Ce champ ne peut plus être modifié',
      JOURNAL_INCOHERENT: 'Le journal de cette compétition est incohérent : modification impossible',
    } satisfies Record<ErreurCreation | ErreurModification, string>,
  },
  /** US-024 : épreuves, sous chaque manifestation de la page « Manifestations ». */
  epreuves: {
    titre: 'Épreuves',
    nouvelle: 'Nouvelle épreuve',
    titreModification: (nom: string) => `Modifier l’épreuve « ${nom} »`,
    nom: 'Nom de l’épreuve',
    exempleNom: 'Championnats de Nouvelle-Aquitaine de sabre',
    arme: 'Arme',
    aucuneArme: 'Toutes armes',
    commentaire: 'Commentaire',
    facultatif: 'facultatif',
    creer: 'Créer l’épreuve',
    enregistrer: 'Enregistrer',
    enCours: 'Enregistrement…',
    annuler: 'Annuler',
    boutonModifier: 'Modifier',
    boutonSupprimer: 'Supprimer',
    ajouter: (manifestation: string) => `Ajouter une épreuve à ${manifestation}`,
    modifier: (nom: string) => `Modifier l’épreuve ${nom}`,
    supprimer: (nom: string) => `Supprimer l’épreuve ${nom}`,
    confirmerSuppression: (nom: string) => `Supprimer définitivement l’épreuve « ${nom} » ?`,
    confirmer: 'Supprimer',
    /** US-041 : suppression avec son contenu, réservée aux administrateurs. */
    contenu: {
      bouton: 'Supprimer avec son contenu…',
      supprimer: (nom: string) => `Supprimer avec son contenu l’épreuve ${nom}`,
      horsLigne: 'Connexion requise pour supprimer',
      titre: (nom: string) => `Supprimer définitivement l’épreuve « ${nom} » avec son contenu ?`,
      combien: (nombre: number | null) =>
        nombre === null
          ? 'Les compétitions de l’épreuve sont supprimées avec elle.'
          : nombre === 0
            ? 'L’épreuve ne contient aucune compétition.'
            : nombre > 1
              ? `Les ${nombre} compétitions de l’épreuve (archivées comprises) sont supprimées avec elle.`
              : 'La compétition de l’épreuve est supprimée avec elle.',
      avertissement:
        'La suppression est définitive : les journaux, les saisies et les fichiers joints sont effacés du serveur et de tous les PC du club.',
      saisie: (nom: string) => `Saisissez « ${nom} » pour confirmer`,
      valider: 'Supprimer définitivement',
      progression: (faites: number, total: number) => `Suppression… ${faites} / ${total}`,
      annuler: 'Annuler',
      enCours: (noms: string[]) => `Une compétition en cours empêche la suppression : ${noms.join(', ')}`,
      interrompue: (restantes: number) =>
        restantes > 1
          ? `${restantes} compétitions restent, l’épreuve n’est pas supprimée : relancez la suppression`
          : `${restantes} compétition reste, l’épreuve n’est pas supprimée : relancez la suppression`,
    },
    recharger: 'Recharger',
    aucune: 'Aucune épreuve',
    horsLigne: 'Nécessite une connexion internet',
    modifieeEntreTemps: (nom: string) => `Modifiée entre-temps par ${nom} : rechargez`,
    champs: {
      NOM_VIDE: 'Le nom est obligatoire',
      NOM_TROP_LONG: 'Le nom fait au plus 100 caractères',
      MANIFESTATION_OBLIGATOIRE: 'Une épreuve appartient toujours à une manifestation',
      ARME_INVALIDE: 'Choisissez une arme de la liste',
      COMMENTAIRE_TROP_LONG: 'Le commentaire fait au plus 2 000 caractères',
    } satisfies Record<ErreurEpreuve, string>,
    erreurs: {
      HORS_LIGNE: 'Réseau perdu : rien n’a changé, réessayez',
      SESSION_INVALIDE: 'Session expirée : reconnectez-vous',
      MANIFESTATION_INCONNUE: 'Cette manifestation n’existe plus : rechargez',
      EPREUVE_INCONNUE: 'Cette épreuve n’existe plus : rechargez',
      EPREUVE_NON_VIDE: 'Cette épreuve contient des compétitions : elle ne se supprime pas',
      ACCES_REFUSE: 'Seul un administrateur peut supprimer avec son contenu',
      COMPETITION_EN_COURS: 'Une compétition en cours empêche la suppression',
      ERREUR_INATTENDUE: 'Erreur inattendue du serveur : réessayez',
    } satisfies Record<ErreurEpreuves, string>,
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
      combien: (epreuves: number, competitions: number | null) => {
        const lesEpreuves =
          epreuves === 0 ? 'aucune épreuve' : epreuves > 1 ? `ses ${epreuves} épreuves` : 'son épreuve';
        const lesCompetitions =
          competitions === null
            ? 'ses compétitions'
            : competitions === 0
              ? 'aucune compétition'
              : competitions > 1
                ? `ses ${competitions} compétitions (archivées comprises)`
                : 'sa compétition';
        return `Sont supprimées avec elle : ${lesEpreuves} et ${lesCompetitions}.`;
      },
      avertissement:
        'La suppression est définitive : les journaux, les saisies et les fichiers joints sont effacés du serveur et de tous les PC du club.',
      saisie: (nom: string) => `Saisissez « ${nom} » pour confirmer`,
      valider: 'Supprimer définitivement',
      progression: (faites: number, total: number) => `Suppression… ${faites} / ${total}`,
      annuler: 'Annuler',
      enCours: (noms: string[]) => `Une compétition en cours empêche la suppression : ${noms.join(', ')}`,
      interrompue: (restantes: number) =>
        restantes > 1
          ? `${restantes} compétitions restent, la manifestation n’est pas supprimée : relancez la suppression`
          : `${restantes} compétition reste, la manifestation n’est pas supprimée : relancez la suppression`,
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
        ? `Ces dates n’incluent plus les compétitions rattachées : ${noms.join(', ')}`
        : `Ces dates n’incluent plus la compétition rattachée : ${noms.join(', ')}`,
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
      COMPETITION_EN_COURS: 'Une compétition en cours empêche la suppression',
      MANIFESTATION_NON_VIDE:
        'Cette manifestation contient des compétitions ou des épreuves : elle ne se supprime pas (elle pourra être archivée)',
      ERREUR_INATTENDUE: 'Erreur inattendue du serveur : réessayez',
    } satisfies Record<ErreurManifestations, string>,
  },
  roles: {
    administrateur: 'Administrateur',
    organisateur: 'Organisateur',
  } satisfies Record<Role, string>,
};

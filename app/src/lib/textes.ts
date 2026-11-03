// Catalogue des textes de l'interface (français seul pour l'instant, ADR-0002). Aucun texte en dur dans les composants.
import {
  LONGUEUR_MIN_MOT_DE_PASSE,
  type Arme,
  type CouleurAvatar,
  type ErreurCompetition,
  type ErreurManifestation,
  type ErreurNouveauMotDePasse,
  type ErreurSaisieCompte,
  type Role,
  type Sexe,
  type Statut,
  type TypeCompetition,
} from '@poule-position/domaine';
import type { ErreurCreation } from './competitions';
import type { EtatConnexion } from './connexion';
import type { ErreurManifestations } from './manifestations';
import type {
  ErreurChangementMotDePasse,
  ErreurComptes,
  ErreurConnexion,
  ErreurDemandeLien,
  ErreurNouveauMotDePasseParLien,
  ErreurProfil,
  MotifFinSession,
} from './session';

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
    formuleTitre: 'Formule',
    formule: (touchesPoules: number, touchesTableau: number) =>
      `Poules en ${touchesPoules} touches, sans élimination · Tableau en ${touchesTableau} touches`,
    relais: (touches: number) => `Rencontres en relais à ${touches} touches`,
    chargement: 'Chargement de la compétition…',
    introuvable: 'Compétition introuvable sur cet appareil',
    retour: "Retour à l'accueil de l'organisateur",
    champs: {
      NOM_VIDE: 'Le nom est obligatoire',
      NOM_TROP_LONG: 'Le nom fait au plus 100 caractères',
      ARME_INVALIDE: 'Choisissez une arme',
      ARME_DIFFERENTE_EPREUVE: 'L’arme doit être celle de l’épreuve',
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
        'Enregistrement impossible sur cet appareil (espace plein ou navigation privée) : rien n’a été créé',
      CLUB_INCONNU: 'Reconnectez-vous une fois en ligne pour créer une compétition sur cet appareil',
    } satisfies Record<ErreurCreation, string>,
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
      MANIFESTATION_NON_VIDE:
        'Cette manifestation contient des compétitions : elle ne se supprime pas (elle pourra être archivée)',
      ERREUR_INATTENDUE: 'Erreur inattendue du serveur : réessayez',
    } satisfies Record<ErreurManifestations, string>,
  },
  roles: {
    administrateur: 'Administrateur',
    organisateur: 'Organisateur',
  } satisfies Record<Role, string>,
};

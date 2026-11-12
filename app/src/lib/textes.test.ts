import { describe, expect, it } from 'vitest';
import { COULEURS_AVATAR } from '@poule-position/domaine';
import { textes } from './textes';

describe('textes de la connexion', () => {
  it('US-003 CA-2 : même message pour un e-mail inconnu et un mot de passe faux', () => {
    expect(textes.connexion.erreurs.IDENTIFIANTS_INVALIDES).toBe('E-mail ou mot de passe incorrect');
  });

  it('US-003 CA-3 : COMPTE_DESACTIVE affiche le message attendu', () => {
    expect(textes.connexion.erreurs.COMPTE_DESACTIVE).toBe('Ce compte est désactivé : contactez un administrateur');
  });

  it('US-003 hors ligne : l’écran indique que seule la reconnexion sur un appareil déjà utilisé est possible', () => {
    expect(textes.connexion.horsLigne).toBe('Hors ligne : connexion possible uniquement sur un appareil déjà utilisé');
  });

  it('US-005 CA-1, CA-3, CA-4 et CA-6 : messages de l’US', () => {
    expect(textes.organisateur.connexionLocale).toBe('Hors ligne : connexion locale');
    expect(textes.connexion.erreurs.PREMIERE_CONNEXION_HORS_LIGNE).toBe(
      'Première connexion impossible hors ligne sur cet appareil',
    );
    expect(textes.connexion.erreurs.TROP_D_ESSAIS).toBe('Trop d’essais : réessayez dans 15 minutes');
    expect(textes.connexion.motifs.COMPTE_MODIFIE).toBe('Votre compte a été modifié : reconnectez-vous');
  });

  it('US-006 CA-1 et CA-3 : le bouton, et l’avertissement qui précise que les épreuves sont conservées', () => {
    expect(textes.organisateur.oublier.bouton).toBe('Se déconnecter et oublier cet appareil');
    expect(textes.organisateur.oublier.avertissement).toContain(
      'Les épreuves enregistrées sur cet appareil sont conservées.',
    );
  });

  it('US-004 CA-1 : trop d’essais, à la connexion comme au changement de mot de passe', () => {
    expect(textes.connexion.erreurs.TROP_D_ESSAIS).toBe('Trop d’essais : réessayez dans 15 minutes');
    expect(textes.motDePasse.erreurs.TROP_D_ESSAIS).toBe(textes.connexion.erreurs.TROP_D_ESSAIS);
  });

  it('US-003 CA-1 : affiche le nom et le rôle', () => {
    expect(textes.organisateur.bonjour('Julien Lameyre')).toBe('Bonjour, Julien Lameyre');
    expect(textes.roles).toEqual({ administrateur: 'Administrateur', organisateur: 'Organisateur' });
  });
});

describe('textes du changement de mot de passe (US-010)', () => {
  it('US-010 CA-1 et hors ligne : messages de l’US', () => {
    expect(textes.motDePasse.modifie).toBe('Mot de passe modifié');
    expect(textes.motDePasse.horsLigne).toBe('Nécessite une connexion internet');
  });

  it('US-010 CA-2 : un message précis par règle', () => {
    expect(textes.motDePasse.champs.MOT_DE_PASSE_TROP_COURT).toContain('10 caractères');
    expect(textes.motDePasse.champs.IDENTIQUE_A_L_ACTUEL).toContain('différent');
    expect(textes.motDePasse.champs.CONFIRMATION_DIFFERENTE).toContain('différents');
  });
});

describe('mot de passe oublié (US-009, US-019)', () => {
  it('US-009 CA-4 et US-019 CA-1 : « Mot de passe oublié ? » ; la mention de l’administrateur reste', () => {
    expect(textes.connexion.oubli).toBe('Mot de passe oublié ?');
    expect(textes.oubli.administrateur).toBe(
      'Vous pouvez aussi demander à un administrateur du club de réinitialiser votre mot de passe',
    );
  });

  it('US-019 CA-1, CA-2 et CA-3 : messages de l’US', () => {
    expect(textes.oubli.envoye).toBe('Si un compte existe pour cet e-mail, un lien vient d’y être envoyé');
    expect(textes.reinitialisation.erreurs.LIEN_INVALIDE).toBe(
      'Ce lien n’est plus valable : faites une nouvelle demande',
    );
    expect(textes.oubli.horsLigne).toBe('Nécessite une connexion internet');
    expect(textes.reinitialisation.horsLigne).toBe('Nécessite une connexion internet');
  });
});

describe('textes du profil (US-016)', () => {
  it('US-016 CA-1 et CA-6 : page « Mon profil », tuile de l’accueil et retour depuis le mot de passe', () => {
    expect(textes.profil.titre).toBe('Mon profil');
    expect(textes.motDePasse.retour).toBe('Retour à mon profil');
    expect(textes.profil.horsLigne).toBe('Nécessite une connexion internet');
    expect(textes.profil.erreurs.HORS_LIGNE).toBe('Réseau perdu : rien n’a changé, réessayez');
  });

  it('US-016 CA-3 : chaque couleur d’avatar a un nom lisible', () => {
    for (const couleur of COULEURS_AVATAR) expect(textes.profil.couleurs[couleur]).toMatch(/^[a-zéèêô]+$/);
    expect(textes.profil.couleur('prune')).toBe('Couleur prune');
  });
});

describe('textes du menu de compte (US-017)', () => {
  it('US-017 CA-2 et CA-4 : nom accessible de l’avatar et entrées du menu', () => {
    expect(textes.organisateur.menu.ouvrir('Julien Lameyre')).toBe('Menu du compte de Julien Lameyre');
    expect(textes.organisateur.menu.editerProfil).toBe('Éditer le profil');
    expect(textes.organisateur.seDeconnecter).toBe('Se déconnecter');
    expect(textes.organisateur.oublier.bouton).toBe('Se déconnecter et oublier cet appareil');
  });
});

describe('textes des épreuves (US-025)', () => {
  it('US-025 CA-4 : la date hors de la manifestation donne ses bornes', () => {
    expect(textes.epreuves.dateHorsManifestation('2027-03-14', '2027-03-15')).toBe(
      'La date doit être comprise entre le 14/03 et le 15/03',
    );
  });

  it('US-025 CA-5 : le message nomme les deux horaires en cause', () => {
    expect(textes.epreuves.champs.SCRATCH_AVANT_APPEL).toBe('Le scratch doit être après l’appel');
    expect(textes.epreuves.champs.POULES_AVANT_SCRATCH).toBe('Le début des poules doit être après le scratch');
    expect(textes.epreuves.champs.POULES_AVANT_APPEL).toBe('Le début des poules doit être après l’appel');
  });

  it('US-025 : la date et les modifications en attente se lisent en français', () => {
    expect(textes.epreuves.dateLongue('2027-03-13')).toBe('samedi 13 mars 2027');
    expect(textes.epreuves.enAttente(1)).toBe('1 modification en attente d’envoi');
    expect(textes.epreuves.enAttente(3)).toBe('3 modifications en attente d’envoi');
    expect(textes.epreuves.copieDu(new Date(2026, 9, 28, 14, 5).getTime())).toBe('Copie du 28/10 à 14 h 05');
  });
});

describe('textes des manifestations (US-023)', () => {
  it('US-023 CA-3 : la date de fin doit suivre la date de début', () => {
    expect(textes.manifestations.champs.FIN_AVANT_DEBUT).toBe('La date de fin doit suivre la date de début');
  });

  it('US-023 CA-4 : le message cite les épreuves concernées', () => {
    expect(textes.manifestations.horsDates(['Sabre M13'])).toBe(
      'Ces dates n’incluent plus l’épreuve rattachée : Sabre M13',
    );
    expect(textes.manifestations.horsDates(['Sabre M13', 'Épée M15'])).toBe(
      'Ces dates n’incluent plus les épreuves rattachées : Sabre M13, Épée M15',
    );
  });

  it('US-023 cas limites : modification concurrente, réseau perdu, hors ligne', () => {
    expect(textes.manifestations.modifieeEntreTemps('Bruno')).toBe('Modifié entre-temps par Bruno : rechargez');
    expect(textes.manifestations.erreurs.HORS_LIGNE).toBe('Réseau perdu : rien n’a changé, réessayez');
    expect(textes.manifestations.horsLigne).toBe('Nécessite une connexion internet');
    expect(textes.manifestations.periode('2027-03-14', '2027-03-15')).toBe('du 14/03/2027 au 15/03/2027');
    expect(textes.manifestations.periode('2027-03-14', '2027-03-14')).toBe('le 14/03/2027');
    expect(textes.manifestations.listeDu(new Date(2026, 10, 3, 9, 5).getTime())).toBe(
      'Hors ligne : liste du 03/11 à 9 h 05',
    );
  });
});

describe('textes des compétitions (US-024)', () => {
  it('CA-4 : « Cette compétition est au <arme> », avec la bonne préposition', () => {
    expect(textes.epreuves.competitionAu('sabre')).toBe('Cette compétition est au sabre');
    expect(textes.epreuves.competitionAu('epee')).toBe('Cette compétition est à l’épée');
    expect(textes.epreuves.competitionAu('fleuret')).toBe('Cette compétition est au fleuret');
    expect(textes.epreuves.competitionAu('sabreLaser')).toBe('Cette compétition est au sabre laser');
  });

  it('hors ligne et CA-5 : « Nécessite une connexion internet », et le refus d’une compétition non vide', () => {
    expect(textes.competitions.horsLigne).toBe('Nécessite une connexion internet');
    expect(textes.competitions.erreurs.COMPETITION_NON_VIDE).toContain('ne se supprime pas');
  });
});

describe('textes de l’accueil (US-026)', () => {
  it('CA-3 : le filtre des archives et le nombre d’épreuves masquées', () => {
    expect(textes.listeClub.filtre.avenir).toBe('À venir et en cours');
    expect(textes.listeClub.filtreVide.terminees).toBe('Aucune épreuve terminée');
  });

  it('CA-6 : le message invite à créer une première manifestation ou une première compétition', () => {
    expect(textes.listeClub.vide).toContain('première manifestation');
    expect(textes.listeClub.vide).toContain('première compétition');
  });

  it('hors ligne : les créations de manifestation et de compétition sont grisées avec le message habituel', () => {
    expect(textes.listeClub.horsLigne).toBe('Nécessite une connexion internet');
    expect(textes.listeClub.jour('2027-03-14')).toBe('14/03/2027');
  });
});

describe('vocabulaire : une compétition est composée d’épreuves (US-044)', () => {
  /** Tous les textes du catalogue, les fonctions étant appelées avec des paramètres d'exemple. */
  function tousLesTextes(valeur: unknown, vus = new Set<unknown>()): string[] {
    if (typeof valeur === 'string') return [valeur];
    if (typeof valeur === 'function') {
      try {
        return tousLesTextes((valeur as (...args: unknown[]) => unknown)('X', 'X', 2), vus);
      } catch {
        return [];
      }
    }
    if (valeur === null || typeof valeur !== 'object' || vus.has(valeur)) return [];
    vus.add(valeur);
    return Object.values(valeur).flatMap((enfant) => tousLesTextes(enfant, vus));
  }

  it('US-044 CA-2 : l’unité qui se tire s’appelle « épreuve », le regroupement « compétition »', () => {
    expect(textes.epreuves.nouvelle).toBe('Nouvelle épreuve');
    expect(textes.competitions.nouvelle).toBe('Nouvelle compétition');
    expect(textes.epreuves.pilote).toBe('Ce PC est le pilote');
    expect(textes.competitions.supprimer('X')).toBe('Supprimer la compétition X');
    expect(textes.competitions.exempleNom).toBe('Championnats de Nouvelle-Aquitaine de sabre');
  });

  it('US-044 CA-2 : le slogan garde le sens générique « compétitions d’escrime » (pas de renommage aveugle)', () => {
    expect(textes.sousTitre).toBe('Gestion de compétitions d’escrime');
  });

  it('US-044 CA-2 : le catalogue ne garde aucune élision ni aucun accord fautif (« la épreuve », « son compétition »)', () => {
    const fautes = tousLesTextes(textes).filter((texte) =>
      /\b[lL]a [éÉ]preuve|\b[lL][’'][cC]ompétition|\b[dD][’'][cC]ompétition|\b[dD]e [éÉ]preuve|\b[sSmMtT]on compétition|\b[sSmMtT]a épreuve/.test(
        texte,
      ),
    );
    expect(fautes).toEqual([]);
  });
});

describe('textes du plan (US-050)', () => {
  it('US-050 CA-3 : le compte de compétitions du bandeau, au singulier et au pluriel', () => {
    expect(textes.plan.competitions(0)).toBe('Aucune compétition');
    expect(textes.plan.competitions(1)).toBe('1 compétition');
    expect(textes.plan.competitions(3)).toBe('3 compétitions');
  });

  it('US-050 CA-4 : les horaires du panneau', () => {
    expect(textes.plan.horaire.appel('08:30')).toBe('appel 08:30');
    expect(textes.plan.horaire.scratch('09:00')).toBe('scratch 09:00');
    expect(textes.plan.horaire.debutPoules('09:30')).toBe('poules 09:30');
  });

  it('US-050 CA-5 : l’origine du jour', () => {
    expect(textes.plan.origines.jour).toBe('jour de la manifestation');
  });

  it('US-050 CA-6 : « Changer de jour : dimanche », avec le nom du jour d’une date', () => {
    expect(textes.plan.jourSemaine('2027-03-14')).toBe('dimanche');
    expect(textes.plan.jourSemaine('2027-03-15')).toBe('lundi');
    expect(textes.plan.changerDeJourVers('lundi')).toBe('Changer de jour : lundi');
  });
});

describe('vocabulaire de la publication (US-031 CA-6)', () => {
  const chaines = (valeur: unknown): string[] =>
    typeof valeur === 'string'
      ? [valeur]
      : valeur && typeof valeur === 'object'
        ? Object.values(valeur).flatMap(chaines)
        : [];

  it('CA-6 : « Publiée / Non publiée », jamais « en ligne / hors ligne », réservés à l’état du réseau', () => {
    expect(textes.epreuves.publiee).toBe('Publiée');
    expect(textes.epreuves.nonPubliee).toBe('Non publiée');
    expect(textes.publication.publier).toBe('Publier');
    expect(textes.publication.depublier).toBe('Dépublier');
    for (const texte of [...chaines(textes.publication), ...chaines(textes.accueilPublic)]) {
      expect(texte, texte).not.toMatch(/en ligne|hors ligne/i);
    }
  });

  it('CA-4 : le message d’une épreuve non publiée est celui de l’US', () => {
    expect(textes.accueilPublic.direct.nonPubliee).toBe('Cette épreuve n’est pas publiée');
  });

  it('cas limite : une page publique sans épreuve dit « Aucune épreuve à venir »', () => {
    expect(textes.accueilPublic.aucune).toBe('Aucune épreuve à venir');
  });

  it('hors ligne : le visiteur est averti que le serveur est injoignable', () => {
    expect(textes.accueilPublic.injoignable).toContain('connexion internet');
    expect(textes.publication.enAttente).toBe('Publication en attente d’envoi');
  });
});

describe('dates de la page d’une manifestation (US-056 CA-8)', () => {
  const { dates } = textes.pageManifestation;

  it('CA-8 : « 11 et 12 novembre 2026 » comme sur la planche 2', () => {
    expect(dates('2026-11-11', '2026-11-12')).toBe('11 et 12 novembre 2026');
  });

  it('un seul jour, plus de deux jours, deux mois, deux années, premier du mois', () => {
    expect(dates('2026-11-11', '2026-11-11')).toBe('le 11 novembre 2026');
    expect(dates('2026-11-11', '2026-11-13')).toBe('du 11 au 13 novembre 2026');
    expect(dates('2026-11-30', '2026-12-02')).toBe('du 30 novembre au 2 décembre 2026');
    expect(dates('2026-12-31', '2027-01-01')).toBe('du 31 décembre 2026 au 1er janvier 2027');
    expect(dates('2027-03-01', '2027-03-02')).toBe('1er et 2 mars 2027');
  });
});

# Backlog

Les US s'écrivent au fil de l'eau (`/debut-spec-US`, `/impact`, `/bug`), une par fichier, à partir du modèle
[`_modele-US.md`](_modele-US.md). La numérotation est globale et continue (`US-001`, `US-002`…) et un numéro
n'est jamais réutilisé.

Statuts : `À spécifier` → `Prête` → `En cours` → `En revue` → `Terminée` · `Bloquée` (voir `CLAUDE.md`).

> **Porte d'entrée :** aucune US fonctionnelle ne démarre tant que **US-001** n'est pas `Terminée`.

## Epics

| Epic | Fonctionnalités (exigences) | Priorité |
|---|---|---|
| E0 — Socle technique | walking skeleton, protocole, synchronisation, PWA | P1 |
| E1 — Comptes et authentification | F1 | P1 |
| E2 — Compétitions (manifestations, épreuves, compétitions) | F2, F16 | P1 / P2 |
| E3 — Inscriptions et émargement | F3, F4 | P1 |
| E4 — Poules | F5, F6, F7 | P1 |
| E5 — Saisie smartphone | F8 | P1 |
| E6 — Tableau | F9, F10 | P1 |
| E7 — Impressions | F11 | P1 |
| E8 — Hors ligne et resynchronisation | F12 | P1 |
| E9 — Affichage en direct | F13, F14 | P1 / P2 |
| E10 — Équipes | F15 | P2 |
| E11 — Journal et données personnelles | F17, purge à 1 an | P2 |
| E12 — Localisation | F18 | P3 |

## US

| Réf. | Titre | Epic | Statut | Dépend de |
|---|---|---|---|---|
| [US-001](US-001-walking-skeleton.md) | Walking skeleton : chaîne complète avec une page minimale | E0 | Terminée | — |
| [US-002](US-002-creer-premier-administrateur.md) | Créer le premier administrateur par une commande d'installation | E1 | Terminée | US-001 |
| [US-003](US-003-se-connecter-en-ligne.md) | Se connecter et se déconnecter (en ligne) | E1 | Terminée | US-002 |
| [US-004](US-004-limiter-essais-connexion.md) | Limiter les essais de connexion | E1 | Terminée | US-003 |
| [US-005](US-005-se-reconnecter-hors-ligne.md) | Se reconnecter hors ligne sur un appareil déjà utilisé | E1 | Terminée | US-003 |
| [US-006](US-006-oublier-cet-appareil.md) | Oublier cet appareil (P2) | E1 | Terminée | US-005 |
| [US-007](US-007-gerer-les-comptes.md) | Lister, créer et modifier les comptes | E1 | Terminée | US-003 |
| [US-008](US-008-desactiver-supprimer-compte.md) | Désactiver, réactiver ou supprimer un compte | E1 | Terminée | US-007 |
| [US-009](US-009-reinitialiser-mot-de-passe.md) | Réinitialiser le mot de passe d'un compte (mot de passe oublié) | E1 | Terminée | US-007 |
| [US-010](US-010-changer-son-mot-de-passe.md) | Changer son mot de passe | E1 | Terminée | US-003 |
| [US-011](US-011-identite-visuelle.md) | Appliquer l'identité visuelle (palette, polices, icônes) | E0 | Terminée | US-001 |
| [US-012](US-012-ecran-connexion-moderne.md) | Moderniser l'écran de connexion | E1 | Terminée | US-011, US-014, US-003 |
| [US-013](US-013-correction-e2e-preview-bloques.md) | Corriger les E2E de la preview bloqués à l'installation du navigateur | E0 | Terminée | US-001 |
| [US-014](US-014-banniere-poule-position.md) | Intégrer la bannière « Poule Position » et l'entête de site | E0 | Terminée | US-011 |
| [US-015](US-015-correction-secret-dans-rapport-e2e.md) | Corriger l'exposition du mot de passe E2E dans le rapport de la CI | E0 | Terminée | US-001, US-003 |
| [US-016](US-016-modifier-son-profil.md) | Modifier son profil (nom et avatar) (P2) | E1 | Terminée | US-007, US-010 |
| [US-017](US-017-menu-de-compte.md) | Menu de compte en haut à droite (P2) | E1 | Terminée | US-016, US-006 |
| [US-018](US-018-envoyer-des-emails.md) | Envoyer des e-mails depuis le serveur (SMTP OVH du club) (P2) | E1 | Terminée | US-001 |
| [US-019](US-019-reinitialiser-par-email.md) | Réinitialiser son mot de passe par e-mail (P2) | E1 | Terminée | US-018, US-009, US-004 |
| [US-020](US-020-domaine-pessac-escrime.md) | Servir l'application sur poule-position.pessac-escrime.fr (P1, technique) | E0 | Terminée | US-001, US-019 |
| [US-021](US-021-journal-local-competition.md) | Tenir le journal local d'une compétition et sa projection (technique) | E2 | Terminée | US-001 |
| [US-022](US-022-synchroniser-competitions.md) | Répliquer le journal sur le serveur et retrouver les compétitions du club sur tout PC (technique) | E2 | Terminée | US-021 |
| [US-023](US-023-gerer-manifestations.md) | Créer et modifier une manifestation | E2 | Terminée | US-003 |
| [US-024](US-024-gerer-epreuves.md) | Créer et modifier une épreuve dans une manifestation | E2 | Terminée | US-023 |
| [US-025](US-025-creer-competition.md) | Créer une compétition | E2 | Terminée | US-021, US-022, (US-024) |
| [US-026](US-026-lister-competitions.md) | Lister les manifestations, épreuves et compétitions du club | E2 | Terminée | US-022, US-023, US-025 |
| [US-027](US-027-modifier-competition.md) | Modifier une compétition | E2 | Terminée | US-025 |
| [US-028](US-028-formule-competition.md) | Choisir et faire évoluer la formule d'une compétition | E2 | Terminée | US-025 |
| [US-029](US-029-prendre-la-main.md) | Prendre la main sur une compétition depuis un autre PC | E2 | Terminée | US-022 |
| [US-030](US-030-affiche-feuille-de-route.md) | Joindre une affiche et une feuille de route | E2 | Prête | US-022, US-023, US-024, US-025 |
| [US-031](US-031-publier-competition.md) | Publier ou dépublier une compétition | E2 | Prête | US-022, US-026, (US-030) |
| [US-032](US-032-parametres-competition.md) | Régler les paramètres d'une compétition (droits des QR codes, « Prénom N. ») | E2 | Terminée | US-025 |
| [US-033](US-033-archiver-competition.md) | Archiver ou désarchiver une compétition ou une manifestation | E2 | Prête | US-026 |
| [US-034](US-034-exporter-competition-json.md) | Exporter une compétition en JSON (P2) | E2 | Prête | US-021 |
| [US-035](US-035-importer-competition-json.md) | Importer une compétition depuis un fichier JSON (P2) | E2 | Prête | US-034, US-029 |
| [US-036](US-036-correction-e2e-desactivation-hors-ligne.md) | Corriger le test E2E « désactivation hors ligne » qui échoue sur la preview | E0 | Terminée | US-008 |
| [US-037](US-037-economiser-minutes-ci.md) | Économiser les minutes de CI sur les E2E de la preview | E0 | Terminée | US-013, US-015 |
| [US-038](US-038-correction-lectures-index.md) | Corriger les lectures répétées de tout l'index du club (quota Cloudflare) | E2 | Terminée | US-022, US-023, US-024, US-029 |
| [US-039](US-039-supprimer-competition.md) | Supprimer définitivement une compétition (administrateur) | E2 | Terminée | US-022, US-026, US-029 |
| [US-040](US-040-supprimer-plusieurs-competitions.md) | Supprimer plusieurs compétitions d'un coup | E2 | Terminée | US-039, US-026 |
| [US-041](US-041-supprimer-epreuve-avec-contenu.md) | Supprimer une épreuve avec son contenu | E2 | Terminée | US-024, US-039 |
| [US-042](US-042-supprimer-manifestation-avec-contenu.md) | Supprimer une manifestation avec son contenu | E2 | En cours | US-023, US-041 |
| [US-043](US-043-supprimer-par-lot-tous-types.md) | Supprimer par lot des manifestations, des épreuves et des compétitions | E2 | Prête | US-040, US-041, US-042 |

Le découpage des fonctionnalités en US fines (**étape 4**, exigences §11) se fait Epic par Epic.

**Ordre conseillé pour E1 :** US-002 → US-003 → US-010 (le changement de mot de passe est nécessaire dès les
mots de passe temporaires) → US-007 → US-009 → US-008 → US-005 → US-004 → US-006 → US-016 → US-017 (le menu de
compte ouvre la page de profil) → US-018 (avec son ADR et un essai d'envoi réel) → US-019.

**Ordre conseillé pour E2 :** US-021 → US-022 (avec l'ADR-0016 : index des compétitions, pilote, stockage des
manifestations et épreuves) → US-025 → US-023 → US-024 → US-026 → US-027 → US-028 → US-029 → US-032 → US-030 →
US-031 → US-033 → US-034 → US-035 → US-039 → US-040 → US-041 → US-042 → US-043.

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
| E2 — Compétitions | F2, F16 | P1 / P2 |
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
| [US-006](US-006-oublier-cet-appareil.md) | Oublier cet appareil (P2) | E1 | En cours | US-005 |
| [US-007](US-007-gerer-les-comptes.md) | Lister, créer et modifier les comptes | E1 | Terminée | US-003 |
| [US-008](US-008-desactiver-supprimer-compte.md) | Désactiver, réactiver ou supprimer un compte | E1 | Terminée | US-007 |
| [US-009](US-009-reinitialiser-mot-de-passe.md) | Réinitialiser le mot de passe d'un compte (mot de passe oublié) | E1 | Terminée | US-007 |
| [US-010](US-010-changer-son-mot-de-passe.md) | Changer son mot de passe | E1 | Terminée | US-003 |
| [US-011](US-011-identite-visuelle.md) | Appliquer l'identité visuelle (palette, polices, icônes) | E0 | Terminée | US-001 |
| [US-012](US-012-ecran-connexion-moderne.md) | Moderniser l'écran de connexion | E1 | Terminée | US-011, US-014, US-003 |
| [US-013](US-013-correction-e2e-preview-bloques.md) | Corriger les E2E de la preview bloqués à l'installation du navigateur | E0 | Terminée | US-001 |
| [US-014](US-014-banniere-poule-position.md) | Intégrer la bannière « Poule Position » et l'entête de site | E0 | Terminée | US-011 |
| [US-015](US-015-correction-secret-dans-rapport-e2e.md) | Corriger l'exposition du mot de passe E2E dans le rapport de la CI | E0 | Terminée | US-001, US-003 |

Le découpage des fonctionnalités en US fines (**étape 4**, exigences §11) se fait Epic par Epic.

**Ordre conseillé pour E1 :** US-002 → US-003 → US-010 (le changement de mot de passe est nécessaire dès les
mots de passe temporaires) → US-007 → US-009 → US-008 → US-005 → US-004 → US-006.

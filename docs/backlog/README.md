# Backlog

Les US s'écrivent au fil de l'eau (`/debut-spec-US`, `/impact`, `/bug`), une par fichier, à partir du modèle
[`_modele-US.md`](_modele-US.md). La numérotation est globale et continue (`US-001`, `US-002`…) et un numéro
n'est jamais réutilisé.

Statuts : `À spécifier` → `Prête` → `En cours` → `En revue` → `Terminée` · `Bloquée` · `Abandonnée` (voir `CLAUDE.md`).

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
| [US-030](US-030-affiche-feuille-de-route.md) | Joindre une affiche et une feuille de route | E2 | Terminée | US-044, US-022, US-023, US-024, US-025 |
| [US-031](US-031-publier-competition.md) | Publier ou dépublier une épreuve | E2 | Terminée | US-044, US-022, US-026, (US-030) |
| [US-032](US-032-parametres-competition.md) | Régler les paramètres d'une compétition (droits des QR codes, « Prénom N. ») | E2 | Terminée | US-025 |
| [US-033](US-033-archiver-competition.md) | Archiver ou désarchiver une épreuve ou une manifestation | E2 | Terminée | US-044, US-026 |
| [US-034](US-034-exporter-competition-json.md) | Exporter une épreuve en JSON (P2) | E2 | Prête | US-044, US-021 |
| [US-035](US-035-importer-competition-json.md) | Importer une épreuve depuis un fichier JSON (P2) | E2 | Prête | US-044, US-034, US-029 |
| [US-036](US-036-correction-e2e-desactivation-hors-ligne.md) | Corriger le test E2E « désactivation hors ligne » qui échoue sur la preview | E0 | Terminée | US-008 |
| [US-037](US-037-economiser-minutes-ci.md) | Économiser les minutes de CI sur les E2E de la preview | E0 | Terminée | US-013, US-015 |
| [US-038](US-038-correction-lectures-index.md) | Corriger les lectures répétées de tout l'index du club (quota Cloudflare) | E2 | Terminée | US-022, US-023, US-024, US-029 |
| [US-039](US-039-supprimer-competition.md) | Supprimer définitivement une compétition (administrateur) | E2 | Terminée | US-022, US-026, US-029 |
| [US-040](US-040-supprimer-plusieurs-competitions.md) | Supprimer plusieurs compétitions d'un coup | E2 | Terminée | US-039, US-026 |
| [US-041](US-041-supprimer-epreuve-avec-contenu.md) | Supprimer une épreuve avec son contenu | E2 | Terminée | US-024, US-039 |
| [US-042](US-042-supprimer-manifestation-avec-contenu.md) | Supprimer une manifestation avec son contenu | E2 | Terminée | US-023, US-041 |
| [US-043](US-043-supprimer-par-lot-tous-types.md) | Supprimer par lot des manifestations, des épreuves et des compétitions | E2 | Terminée | US-040, US-041, US-042 |
| [US-044](US-044-inverser-vocabulaire-competition-epreuve.md) | Inverser le vocabulaire compétition / épreuve (technique) | E2 | Terminée | US-043 |
| [US-045](US-045-rattacher-epreuve-a-competition.md) | Rattacher toute épreuve à une compétition | E2 | Terminée | US-044 |
| [US-046](US-046-point-entree-creer.md) | Un seul point d'entrée « Créer », et l'aide « Comment ça s'organise » | E2 | Terminée | US-047, US-048 |
| [US-047](US-047-assistant-manifestation.md) | Créer une manifestation avec un assistant | E2 | Terminée | US-048, US-049 |
| [US-048](US-048-creer-epreuves-en-lot.md) | Créer les épreuves d'une compétition en lot (grille des épreuves) | E2 | Terminée | US-045 |
| [US-049](US-049-plan-de-la-manifestation.md) | Voir et compléter le plan de la manifestation | E2 | Terminée | US-045, US-048 |
| [US-050](US-050-aligner-plan-sur-maquette.md) | Aligner le plan de la manifestation sur la maquette | E2 | Terminée | US-049 |
| [US-051](US-051-dupliquer-epreuve.md) | Dupliquer une épreuve depuis le plan | E2 | Terminée | US-049, US-050 |
| [US-052](US-052-choisir-le-theme.md) | Choisir le thème clair, sombre ou automatique | E1 | Terminée | US-014, US-017 |
| [US-053](US-053-pastille-etat-serveur.md) | Voir l'état du serveur dans l'entête | E1 | Abandonnée | US-001, US-014, US-017 |
| [US-054](US-054-entete-fil-ariane-icones.md) | Poser le socle de la nouvelle IHM : entête, fil d'Ariane, icônes et menu « ⋯ » | E0 | Terminée | US-014, US-017, US-046, US-052 |
| [US-055](US-055-accueil-organisateur-refondu.md) | Refondre l'accueil de l'organisateur | E2 | Terminée | US-054, US-026, US-045 |
| [US-056](US-056-page-manifestation.md) | Donner sa page à chaque manifestation (onglets Compétitions, Plan, Documents) | E2 | Terminée | US-054, US-055, US-023, US-049, US-030 |
| [US-057](US-057-un-seul-supprimer.md) | Fusionner « Supprimer » et « Supprimer avec son contenu… » en une seule action | E2 | Terminée | US-054, US-039, US-041, US-042 |
| [US-058](US-058-page-epreuve-par-etapes.md) | Organiser la page d'une épreuve par étapes | E2 | Terminée | US-054, US-028, US-030, US-031, US-032 |
| [US-059](US-059-mode-selection.md) | Sélectionner plusieurs éléments dans un mode dédié (P2) | E2 | Terminée | US-055, US-057, US-043 |
| [US-060](US-060-epreuves-a-rattacher.md) | Signaler les épreuves à rattacher par une alerte et les rattacher par lot (P2) | E2 | Terminée | US-055, US-059, US-045 |
| [US-061](US-061-organisateur-sur-smartphone.md) | Adapter l'accueil et la page d'une épreuve au smartphone de l'organisateur (P2) | E2 | Terminée | US-054, US-055, US-058 |
| [US-062](US-062-rechercher.md) | Rechercher une manifestation, une compétition ou une épreuve (P2) | E2 | Terminée | US-054, US-055 |
| [US-063](US-063-filtrer-la-liste.md) | Filtrer la liste du club : à venir et en cours, terminées, archivées, toutes (P2) | E2 | Terminée | US-055, US-033 |
| [US-064](US-064-prochaine-etape.md) | Indiquer la prochaine étape d'une épreuve (P2) | E2 | Terminée | US-058, US-031 |
| [US-065](US-065-correction-e2e-us001-pastille-serveur.md) | Corriger les E2E d'US-001 devenus faux depuis la disparition de la pastille d'état du serveur (correction) | E1 | Terminée | US-001, US-031 |
| [US-066](US-066-correction-creer-flottant-club-vide.md) | Afficher le bouton « Créer » flottant même quand le club est vide (correction) | E2 | Terminée | US-061 |
| [US-067](US-067-theme-trois-icones-visibles.md) | Afficher en permanence les trois icônes de thème sur PC (P2) | E1 | Terminée | US-052, US-054 |
| [US-068](US-068-correction-alignement-plan-verifier.md) | Aligner les lignes du plan de l'étape « Vérifier » (correction) (P2) | E2 | Terminée | US-047, US-050 |
| [US-069](US-069-horaires-par-defaut-et-quarts-d-heure.md) | Proposer 9 h 00 par défaut et des minutes par quart d'heure pour les horaires (P2) | E2 | Prête | US-025, US-027, US-048 |
| [US-070](US-070-rechercher-adresse-du-lieu.md) | Choisir le lieu d'une manifestation par une recherche d'adresse (P2, ADR à écrire d'abord) | E2 | Prête | US-023, US-047 |
| [US-071](US-071-plan-du-lieu-dans-recapitulatif.md) | Afficher un plan du lieu dans le récapitulatif de la manifestation (P2) | E2 | Prête | US-070, US-047, US-056 |
| [US-072](US-072-apercu-affiche-feuille-de-route.md) | Voir un aperçu de l'affiche et de la feuille de route sur la page Documents (P2) | E2 | Prête | US-030, US-056 |
| [US-073](US-073-indiquer-documents-sur-la-ligne.md) | Indiquer sur la ligne qu'il y a une affiche ou une feuille de route, et l'ouvrir en aperçu (P2) | E2 | Prête | US-072, US-055, US-056 |
| [US-074](US-074-correction-annuler-en-bouton.md) | Afficher « Annuler » comme un bouton dans les formulaires (correction) (P2) | E2 | Terminée | US-024, US-027, US-048, US-054 |
| [US-075](US-075-etiqueter-reel-et-selection-par-impact.md) | Étiqueter les tests « réel » et choisir les E2E par impact (technique, ADR-0023) | E0 | Terminée | US-037 |
| [US-076](US-076-e2e-interface-sur-runner-local.md) | Lancer les E2E « interface » sur le runner GitHub contre le serveur local (technique) | E0 | Terminée | US-075 |
| [US-077](US-077-reduire-e2e-reel-sur-preview.md) | Limiter les E2E de la preview Cloudflare aux tests « réel » et mesurer le gain (technique) | E0 | Terminée | US-075, US-076 |

Le découpage des fonctionnalités en US fines (**étape 4**, exigences §11) se fait Epic par Epic.

**Ordre conseillé pour E1 :** US-002 → US-003 → US-010 (le changement de mot de passe est nécessaire dès les
mots de passe temporaires) → US-007 → US-009 → US-008 → US-005 → US-004 → US-006 → US-016 → US-017 (le menu de
compte ouvre la page de profil) → US-018 (avec son ADR et un essai d'envoi réel) → US-019.
Puis, indépendante de l'ordre de E2 : US-052 (thème). US-053 (pastille du serveur) est abandonnée.

**Ordre conseillé pour E2 :** US-021 → US-022 (avec l'ADR-0016 : index des compétitions, pilote, stockage des
manifestations et épreuves) → US-025 → US-023 → US-024 → US-026 → US-027 → US-028 → US-029 → US-032 → US-030 →
US-031 → US-033 → US-034 → US-035 → US-039 → US-040 → US-041 → US-042 → US-043 → US-044 (seule en cours pendant le renommage) → US-045 →
US-048 → US-049 → US-047 → US-046, puis US-050 et US-051 (alignement du plan sur la maquette, une fois les autres écrans réalisés), puis US-030 → US-031 → US-033 → US-034 → US-035 avec le nouveau vocabulaire.

**Ordre conseillé pour la refonte de l'IHM** (maquette « IHM de l'organisateur », [`docs/maquettes/`](../maquettes/README.md)) :
US-054 (socle : entête, fil d'Ariane, icônes, menu « ⋯ ») → US-055 → US-057 → US-056 → US-058 → US-064 → US-059 →
US-060 → US-061 → US-062, puis US-063 une fois US-033 livrée. US-033, US-034 et US-035 placent leurs actions dans
le menu « ⋯ » de l'épreuve (US-058 CA-6).

**Retours de recette du 2026-11-13 (« Brain Dump »), ordre conseillé :** les corrections d'abord et indépendantes
(US-066, US-074, US-068), puis US-067 et US-069 ; l'adresse et le plan en suite (**ADR de l'API Adresse et de Leaflet
d'abord**, via `/adr`) : US-070 → US-071 ; les documents : US-072 → US-073.

**Économie des E2E (2026-11-13, quota Cloudflare à ~90 %), à faire avant les US fonctionnelles suivantes :** US-075 → US-076 → US-077 (ADR-0023).

> **Maquette de référence (2026-11-11) :** toute US qui touche un écran de l'organisateur cite sa planche et respecte
> les principes et le vocabulaire d'icônes de [`docs/maquettes/README.md`](../maquettes/README.md) ; un écart se
> déclare dans les **Hypothèses** de l'US. Les US terminées touchées par la refonte sont listées dans les « Notes
> techniques » des US-054 à US-064.

> **Vocabulaire révisé le 2026-11-08 :** la compétition regroupe des épreuves, l'épreuve est ce qui se tire (voir le
> glossaire). Les US terminées gardent l'ancien vocabulaire ; les US à venir emploient le nouveau.

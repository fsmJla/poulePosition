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
| [US-034](US-034-exporter-competition-json.md) | Exporter une épreuve en JSON (P2) | E2 | Terminée | US-044, US-021 |
| [US-035](US-035-importer-competition-json.md) | Importer une épreuve depuis un fichier JSON (P2) | E2 | Terminée | US-044, US-034, US-029 |
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
| [US-069](US-069-horaires-par-defaut-et-quarts-d-heure.md) | Proposer 9 h 00 par défaut et des minutes par quart d'heure pour les horaires (P2) | E2 | Terminée | US-025, US-027, US-048 |
| [US-070](US-070-rechercher-adresse-du-lieu.md) | Choisir le lieu d'une manifestation par une recherche d'adresse (P2, ADR à écrire d'abord) | E2 | Terminée | US-023, US-047 |
| [US-071](US-071-plan-du-lieu-dans-recapitulatif.md) | Afficher un plan du lieu dans le récapitulatif de la manifestation (P2) | E2 | Terminée | US-070, US-047, US-056 |
| [US-072](US-072-apercu-affiche-feuille-de-route.md) | Voir un aperçu de l'affiche et de la feuille de route sur la page Documents (P2) | E2 | Terminée | US-030, US-056 |
| [US-073](US-073-indiquer-documents-sur-la-ligne.md) | Indiquer sur la ligne qu'il y a une affiche ou une feuille de route, et l'ouvrir en aperçu (P2) | E2 | Terminée | US-072, US-055, US-056 |
| [US-074](US-074-correction-annuler-en-bouton.md) | Afficher « Annuler » comme un bouton dans les formulaires (correction) (P2) | E2 | Terminée | US-024, US-027, US-048, US-054 |
| [US-075](US-075-etiqueter-reel-et-selection-par-impact.md) | Étiqueter les tests « réel » et choisir les E2E par impact (technique, ADR-0023) | E0 | Terminée | US-037 |
| [US-076](US-076-e2e-interface-sur-runner-local.md) | Lancer les E2E « interface » sur le runner GitHub contre le serveur local (technique) | E0 | Terminée | US-075 |
| [US-077](US-077-reduire-e2e-reel-sur-preview.md) | Limiter les E2E de la preview Cloudflare aux tests « réel » et mesurer le gain (technique) | E0 | Terminée | US-075, US-076 |
| [US-078](US-078-choisir-le-jour-des-epreuves.md) | Choisir le jour des épreuves dans la grille et en glissant sur le plan (P2) | E2 | Terminée | US-048, US-049, US-050 |
| [US-079](US-079-accueil-plus-lisible-et-publier-une-competition.md) | Séparer « À venir » et « En cours », publier toute une compétition et structurer l'accueil public (P2) | E2 | Terminée | US-031, US-055, US-056, US-063, US-070 |
| [US-080](US-080-grille-et-reprise-en-main.md) | Retoucher la grille des jours et reprendre en main toutes les épreuves d'une compétition (P2) | E2 | Terminée | US-029, US-078, US-079 |
| [US-081](US-081-tireurs-dans-le-journal.md) | Tenir la liste des tireurs d'une épreuve dans son journal (technique) | E3 | Terminée | US-021, US-022 |
| [US-082](US-082-saisir-les-tireurs.md) | Saisir les tireurs d'une épreuve | E3 | Terminée | US-081, US-058 |
| [US-083](US-083-importer-fichier-ffe.md) | Importer les tireurs depuis le fichier d'inscription de la Fédération (format Engarde / BellePoule) | E3 | Terminée | US-081, US-082 |
| [US-084](US-084-emarger-les-tireurs.md) | Émarger les tireurs le jour de l'épreuve | E3 | Terminée | US-081, US-082 |
| [US-085](US-085-poules-dans-le-journal.md) | Tenir les poules d'une épreuve dans son journal (technique) | E4 | Terminée | US-081 |
| [US-086](US-086-constituer-les-poules.md) | Constituer les poules (automatique ou manuelle) | E4 | Terminée | US-085, US-084 |
| [US-087](US-087-ajuster-et-lancer-les-poules.md) | Vérifier, ajuster à la main et lancer les poules | E4 | Terminée | US-086 |
| [US-088](US-088-saisir-les-scores-des-poules.md) | Saisir les scores des poules sur le PC | E4 | Terminée | US-087 |
| [US-089](US-089-abandon-forfait-exclusion-en-poule.md) | Retirer un tireur des poules (abandon, forfait, exclusion) | E4 | Terminée | US-088 |
| [US-090](US-090-bandeau-envoi-sans-decalage.md) | Ne plus décaler l'écran quand une saisie part au serveur | E4 | Terminée | US-088 |
| [US-091](US-091-saisie-par-boutons-sur-pc.md) | Saisir un score de poule par boutons sur le PC | E4 | Terminée | US-088 |
| [US-092](US-092-classement-des-poules.md) | Suivre le classement des poules en temps réel | E4 | Terminée | US-088, US-089 |
| [US-093](US-093-correction-menu-coupe-dans-les-cadres.md) | Corriger le menu « ⋯ » coupé par le cadre de la feuille de poule | E4 | Terminée | US-089 |
| [US-094](US-094-websocket-du-pilote.md) | Ouvrir la WebSocket du pilote et retirer les battements de présence (technique, ADR à écrire d'abord) | E5 | Terminée | US-022, US-029 |
| [US-095](US-095-vue-de-saisie-diffusee.md) | Publier la vue de saisie de l'épreuve pour les smartphones (technique) | E5 | Terminée | US-094, US-088, US-092 |
| [US-096](US-096-qr-codes-arbitres-tireurs.md) | Afficher, imprimer et régénérer les QR codes des arbitres et des tireurs | E5 | Terminée | US-094, US-032 |
| [US-097](US-097-acces-arbitre.md) | Ouvrir l'accès arbitre par le QR code (nom et piste) | E5 | Terminée | US-095, US-096 |
| [US-098](US-098-matchs-de-la-piste.md) | Voir les matchs de sa piste et changer de piste (arbitre) | E5 | Terminée | US-097 |
| [US-099](US-099-saisir-score-poule-smartphone.md) | Saisir le score d'un match de poule sur le smartphone et l'envoyer à la table | E5 | Terminée | US-098, US-091 |
| [US-100](US-100-saisies-recues-sur-le-pc.md) | Voir sur le PC les saisies reçues des smartphones | E5 | Terminée | US-099 |
| [US-101](US-101-corriger-score-smartphone.md) | Corriger depuis le smartphone un score déjà enregistré (arbitre) | E5 | Terminée | US-099 |
| [US-102](US-102-saisie-suspendue.md) | Suspendre la saisie quand la table est déconnectée et récupérer les saisies en route | E5 | Terminée | US-099 |
| [US-103](US-103-acces-tireur.md) | Ouvrir l'accès tireur par le QR code (« Qui êtes-vous ? ») | E5 | Terminée | US-095, US-096 |
| [US-104](US-104-mes-matchs-tireur.md) | Voir « Mes matchs » et saisir les scores de sa poule (tireur) | E5 | Terminée | US-103, US-099 |
| [US-105](US-105-appareils-connectes.md) | Voir les appareils connectés et en exclure un | E5 | Terminée | US-096, US-097, US-103 |
| [US-106](US-106-saisir-score-tableau-smartphone.md) | Saisir le score d'un match du tableau sur le smartphone | E5 | Terminée | US-099, US-104, US-108, US-111, US-112 |
| [US-107](US-107-ecran-poules-compact.md) | Alléger l'entête et réagencer l'écran des poules | E4 | Terminée | US-088, US-100 |
| [US-108](US-108-tableau-dans-le-journal.md) | Tenir le tableau d'une épreuve dans son journal (technique) | E6 | Terminée | US-085, US-089, US-092, US-028 |
| [US-109](US-109-creer-le-tableau.md) | Créer le tableau à partir du classement des poules | E6 | Terminée | US-108, US-092, US-058, US-064 |
| [US-110](US-110-voir-le-tableau.md) | Voir le tableau : tours et arbre | E6 | Terminée | US-109 |
| [US-111](US-111-saisir-score-tableau-pc.md) | Saisir et corriger le score d'un match du tableau sur le PC | E6 | Terminée | US-110 |
| [US-112](US-112-appeler-match-sur-piste.md) | Appeler un match du tableau sur une piste | E6 | Terminée | US-111 |
| [US-113](US-113-abandon-forfait-exclusion-tableau.md) | Retirer un tireur du tableau (abandon, forfait, exclusion) | E6 | Terminée | US-111 |
| [US-114](US-114-match-troisieme-place.md) | Tirer le match pour la 3e place | E6 | Terminée | US-111, US-112, US-028 |
| [US-115](US-115-classement-final-terminer.md) | Afficher le classement final et terminer l'épreuve | E6 | Terminée | US-111, US-113, US-114, US-064 |
| [US-116](US-116-separer-clubs-tableau.md) | Séparer les tireurs d'un même club au premier tour du tableau (P2) | E6 | À spécifier | US-109 |
| [US-117](US-117-saisie-tableau-par-boutons.md) | Saisir le score du tableau sur un afficheur et un pavé, et appeler d'un clic sur le PC | E6 | Terminée | US-111, US-112, US-091 |
| [US-118](US-118-saisies-harmonisees.md) | Saisir tous les scores sur l'afficheur et le pavé à la demande (poules PC, smartphone) | E4, E5 | Terminée | US-117, US-091, US-099, US-101, US-106 |
| [US-119](US-119-saisies-recues-tableau.md) | Voir les saisies reçues des smartphones sur l'écran du tableau | E6 | Terminée | US-100, US-106, US-111 |
| [US-120](US-120-etape-impressions.md) | Ouvrir l'étape « Impressions » et le gabarit commun des documents imprimés | E7 | Terminée | US-058, US-096 |
| [US-121](US-121-imprimer-feuille-presence.md) | Imprimer la feuille de présence | E7 | Terminée | US-120, US-084 |
| [US-122](US-122-imprimer-feuilles-poule-vierges.md) | Imprimer les feuilles de poule à remplir | E7 | Terminée | US-120, US-087, US-096 |
| [US-123](US-123-imprimer-feuilles-poule-resultats.md) | Imprimer les feuilles de poule avec résultats | E7 | Terminée | US-120, US-088 |
| [US-124](US-124-imprimer-poules-par-piste.md) | Imprimer les poules par piste, à afficher | E7 | Terminée | US-120, US-087 |
| [US-125](US-125-imprimer-classement-poules.md) | Imprimer le classement après les poules | E7 | Terminée | US-120, US-092 |
| [US-126](US-126-imprimer-feuilles-match-tableau.md) | Imprimer les feuilles de match du tableau | E7 | Terminée | US-120, US-110, US-112 |
| [US-127](US-127-imprimer-tableau.md) | Imprimer le tableau à afficher | E7 | Terminée | US-120, US-110 |
| [US-128](US-128-imprimer-classement-final.md) | Imprimer le classement final | E7 | Terminée | US-120, US-115 |
| [US-129](US-129-reprendre-apres-plantage.md) | Reprendre l'épreuve après un plantage, sur l'écran quitté | E8 | Terminée | US-021, US-005, US-058, US-094 |
| [US-130](US-130-resume-retour-en-ligne.md) | Résumer la resynchronisation au retour du réseau | E8 | Terminée | US-094, US-102, US-022 |
| [US-131](US-131-sauvegarde-automatique-dossier.md) | Sauvegarder automatiquement les épreuves pilotées dans un dossier (clé USB) | E8 | Terminée | US-034, US-035, US-017 |
| [US-132](US-132-publier-vue-en-direct.md) | Publier la vue en direct d'une épreuve et la lire par lien public ou lien d'écran (technique, ADR à écrire d'abord) | E9 | Terminée | US-094, US-095, US-031, US-032, US-112 |
| [US-133](US-133-gerer-les-ecrans.md) | Gérer les écrans géants d'une manifestation (onglet « Écrans ») | E9 | Terminée | US-132, US-056 |
| [US-134](US-134-afficher-ecran-geant.md) | Afficher l'écran géant avec un défilement automatique | E9 | Terminée | US-132, US-133 |
| [US-135](US-135-forcer-une-vue-ecran.md) | Forcer une vue sur un écran géant depuis le PC | E9 | Terminée | US-134 |
| [US-136](US-136-ecran-geant-fenetre-locale.md) | Ouvrir l'écran géant dans une fenêtre locale du PC pilote, qui marche sans internet | E9 | Terminée | US-134 |
| [US-137](US-137-suivre-epreuve-en-direct.md) | Suivre une épreuve en direct sur son smartphone (spectateur) (P2) | E9 | Terminée | US-132, US-031 |
| [US-138](US-138-suivre-un-tireur.md) | Suivre un ou plusieurs tireurs (spectateur) (P2) | E9 | Terminée | US-137 |
| [US-139](US-139-suivre-en-direct-depuis-accueil.md) | Proposer « Suivre en direct » sur l'accueil public (P2) | E9 | Terminée | US-137, US-079 |
| [US-140](US-140-theme-ecran.md) | Choisir le thème clair ou sombre d'un écran géant | E9 | Terminée | US-133, US-134 |
| [US-141](US-141-bandeau-derniers-scores.md) | Faire défiler les derniers scores dans un bandeau en bas de l'écran géant | E9 | Terminée | US-134 |
| [US-142](US-142-quatre-poules-par-page.md) | Afficher quatre poules par page sur l'écran géant, avec leur classement | E9 | Terminée | US-134 |
| [US-143](US-143-tableau-en-arbre.md) | Afficher le tableau en arbre symétrique sur l'écran géant | E9 | Terminée | US-134 |
| [US-144](US-144-style-ecran-personnalise.md) | Donner à un écran géant un style personnalisé (couleurs et logo d'un sponsor) (P3) | E9 | À spécifier | US-140 |
| [US-145](US-145-equipes-dans-le-journal.md) | Tenir les équipes dans le journal et faire tirer poules et tableau par des participants (technique) | E10 | Terminée | US-081, US-085, US-108 |
| [US-146](US-146-constituer-les-equipes.md) | Constituer les équipes à partir des tireurs inscrits | E10 | Terminée | US-145, US-082 |
| [US-147](US-147-ranger-les-equipes.md) | Ranger les équipes par la somme des classements de leurs titulaires | E10 | Terminée | US-146 |
| [US-148](US-148-emarger-les-equipes.md) | Émarger une épreuve par équipes | E10 | Terminée | US-146, US-084 |
| [US-149](US-149-formule-par-equipes.md) | Choisir la formule d'une épreuve par équipes : tableau direct, ou poules puis tableau | E10 | Terminée | US-028, US-145 |
| [US-150](US-150-poules-d-equipes.md) | Constituer, lancer et saisir les poules d'équipes | E10 | Terminée | US-147, US-148, US-149, US-086, US-087, US-088 |
| [US-151](US-151-tableau-des-equipes.md) | Créer et dérouler le tableau des équipes jusqu'au classement final | E10 | Terminée | US-147, US-148, US-149, US-109, US-111, US-115 |
| [US-152](US-152-saisir-rencontre-smartphone.md) | Saisir le score final d'une rencontre par équipes sur le smartphone de l'arbitre | E10 | Terminée | US-150, US-151, US-099, US-106 |
| [US-153](US-153-imprimer-feuille-rencontre.md) | Imprimer la feuille de rencontre par équipes (ordre des relais) | E10 | Terminée | US-120, US-150, US-151 |
| [US-154](US-154-imprimer-documents-equipes.md) | Adapter aux équipes les documents imprimés existants | E10 | Terminée | US-148, US-150, US-151, US-121 à US-128 |
| [US-155](US-155-direct-equipes.md) | Afficher les épreuves par équipes sur l'écran géant et pour les spectateurs | E10 | Terminée | US-150, US-151, US-132 à US-143 |
| [US-156](US-156-importer-equipes-csv.md) | Importer les équipes depuis un fichier CSV | E10 | Terminée | US-146, US-083 |
| [US-157](US-157-alleger-entete-accueil-public.md) | Alléger l'entête de l'accueil public : « Escrime », icône « Info » pour la feuille de route, pastille « Se connecter » (P3) | E2 | Terminée | US-079, US-052 |
| [US-158](US-158-assouplir-deroule-epreuve.md) | Assouplir le déroulé : tableau et fin d'épreuve anticipés, 3e place à trois tireurs (correction), liste des pistes des poules (P2) | E6 | Terminée | US-086, US-109, US-114, US-115 |
| [US-159](US-159-cotes-piste-reglementaires.md) | Placer les tireurs du bon côté de la piste (FIE t.22) et pouvoir les intervertir (correction, P2) | E5 | Terminée | US-091, US-099, US-106, US-117, US-118 |

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

**Ordre conseillé pour E3 (inscriptions et émargement, maquette « Déroulé de l'épreuve ») :** US-081 → US-082 → US-083 → US-084
(planche 19 « Émargement »).

**Ordre conseillé pour E4 (poules, planches 8 à 10) :** US-085 → US-086 → US-087 → US-088 → US-089, puis les retours
de l'utilisateur : US-090 → US-091 → US-092 (planche 20).

**Ordre conseillé pour E5 (saisie smartphone, planches 10, 12 à 18, 18 bis et 21) :** US-094 (ADR de
l'authentification de la socket d'abord) → US-095 → US-096 → US-097 → US-098 →
US-099 → US-100 → US-102 → US-101 → US-103 → US-104 → US-105 ; US-106 après les US du tableau (E6).

**Ordre conseillé pour E6 (tableau, planches 11, 15 et 20) :** US-108 → US-109 → US-110 → US-111 → US-112 → US-113 →
US-114 → US-115, puis US-106 (saisie du tableau sur smartphone, E5). US-116 (séparation des clubs, P2) attend ses règles.
Puis US-117 (carte du tableau sur un afficheur et un pavé) → US-118 (même saisie pour les poules et les smartphones).

**Ordre conseillé pour E7 (impressions, planches 22 à 30) :** US-120 (étape et gabarit) → US-121 → US-122 → US-123 → US-124 → US-125 → US-126 → US-127 → US-128.

**Ordre conseillé pour E8 (hors ligne et resynchronisation) :** US-129 (reprise après plantage) → US-130 (résumé au
retour du réseau) → US-131 (sauvegarde automatique dans un dossier). Le reste de F12 est déjà livré : connexion hors
ligne (US-005), journal local et envoi différé (US-021, US-022), pastille hors ligne et reconnexion (US-094), saisie
suspendue et saisies récupérées ou écartées (US-102), impressions hors ligne (E7). La fenêtre locale de l'écran géant
(ADR-0010) relève de E9.

**Ordre conseillé pour E9 (affichage en direct) :** US-132 (ADR des lecteurs de la vue en direct d'abord, via `/adr`), puis US-133 (planches 31 à 39 validées le 2026-11-21, `docs/maquettes/direct/`) → US-134 → US-136 (fenêtre locale, hors ligne) → US-135. Puis, en P2 : US-137 → US-138 → US-139. Retours de recette du 2026-11-22 : US-142 → US-143 → US-141 → US-140 ; US-144 (P3) attend sa spécification.

**Ordre conseillé pour E10 (équipes) :** US-145 (ADR « Équipes et participants dans le journal » d'abord, via `/adr`), puis
les planches 40 à 43 à dessiner et faire valider, puis US-146 → US-147 → US-148 → US-149 → US-151 (tableau direct, le
cas par défaut) → US-150 (poules d'équipes) → US-152 → US-153 → US-154 → US-155.
Puis, indépendante, US-156 (import des équipes depuis un CSV).

**Retours ergonomiques du 2026-11-28 :** US-157 (entête de l'accueil public) et US-158 (déroulé :
tableau et fin d'épreuve anticipés, 3e place à trois tireurs, liste des pistes), indépendantes l'une de l'autre.
Puis US-159 (côtés de piste réglementaires et inversion des tireurs).

**Retours ergonomiques du 2026-11-17, indépendants l'un de l'autre :** US-078 (jour des épreuves : grille et
glisser-déposer sur le plan) et US-079 (filtres « À venir » / « En cours » de l'accueil de l'organisateur,
publication par compétition, accueil public structuré avec la ville et le lieu sur OpenStreetMap).

> **Maquette de référence (2026-11-11) :** toute US qui touche un écran de l'organisateur cite sa planche et respecte
> les principes et le vocabulaire d'icônes de [`docs/maquettes/README.md`](../maquettes/README.md) ; un écart se
> déclare dans les **Hypothèses** de l'US. Les US terminées touchées par la refonte sont listées dans les « Notes
> techniques » des US-054 à US-064.

> **Vocabulaire révisé le 2026-11-08 :** la compétition regroupe des épreuves, l'épreuve est ce qui se tire (voir le
> glossaire). Les US terminées gardent l'ancien vocabulaire ; les US à venir emploient le nouveau.

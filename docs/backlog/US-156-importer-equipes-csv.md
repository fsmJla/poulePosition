# US-156 — Importer les équipes depuis un fichier CSV

- **Epic :** E10 — Équipes
- **Fonctionnalité :** F3, F15, F16 (exigences §3)
- **Priorité :** P2
- **Type :** fonctionnelle
- **Statut :** Terminée
- **Dépend de :** US-146, US-083
- **Branche / PR :** `us/US-156-importer-equipes-csv`

## Récit

**En tant qu'**organisateur, **je veux** importer d'un seul fichier CSV la liste des équipes et de leurs tireurs,
**afin de** ne pas saisir à la main des dizaines d'équipes (50 équipes de 2 = 100 tireurs et 50 formulaires).

Maquette : planche 40 « Inscriptions : équipes » (`docs/maquettes/equipes/40-inscriptions-equipes.png`). Le bouton
« Importer un fichier… » de l'onglet « Équipes » (même place que celui de l'onglet « Tireurs », planche 7) est un écart
mineur à la planche, déclaré dans les Hypothèses ; l'aperçu reprend la fenêtre de confirmation d'US-083.

## Format pris en charge

Un fichier CSV, séparateur « ; », première ligne d'en-têtes, UTF-8 (avec ou sans BOM) ou ISO-8859-1 (export Excel).
Une ligne par équipe :

| Colonne | Obligatoire | Contenu |
|---|---|---|
| `Équipe` | oui | Nom de l'équipe (« Pessac 1 ») |
| `Nom 1`, `Prénom 1`, `Licence 1`, `Club 1`, `Classement 1` | nom et prénom oui ; le reste facultatif | Premier titulaire |
| `Nom 2` … `Classement 2` | nom et prénom oui | Deuxième titulaire |
| `Nom 3` … `Classement 3` | oui en équipes de 3, sinon absent ou vide | Troisième titulaire |
| `Nom R` … `Classement R` | non | Remplaçant |

Les colonnes inconnues sont ignorées : le club d'une équipe se déduit de ses tireurs (« Mixte » s'ils diffèrent,
US-146). Exemple : `docs/reference/import-equipes/equipes-epee.csv` (50 équipes de 2, 100 tireurs).

## Critères d'acceptation

**CA-1 — Choisir le fichier**
- **Étant donné** une épreuve par équipes, avant le lancement des poules ou du tableau
- **Quand** l'organisateur clique « Importer un fichier… » dans l'onglet « Équipes » et choisit un fichier `.csv`
- **Alors** le fichier est lu sur l'appareil, sans réseau ni envoi à un tiers, quel que soit son encodage (UTF-8 ou
  ISO-8859-1) ; une épreuve individuelle n'a pas ce bouton.

**CA-2 — Aperçu avant import**
- **Étant donné** un fichier lisible
- **Quand** l'aperçu s'ouvre
- **Alors** il donne le nombre d'équipes du fichier réparties en « importables » et « écartées » (avec le motif de
  chacune, CA-4), le nombre de tireurs « à inscrire » et « déjà inscrits » (même licence, ou à défaut mêmes nom et
  prénom), et la liste des homonymes douteux (US-081 CA-6) ; « Importer N équipes » et « Annuler ».

**CA-3 — Importer**
- **Étant donné** l'aperçu validé
- **Quand** l'import se fait
- **Alors** les tireurs inconnus sont inscrits (`TireurInscrit`), puis chaque équipe importable est créée
  (`EquipeCreee`) avec ses titulaires et son remplaçant ; un tireur déjà inscrit est réutilisé tel quel. Un message dit
  le résultat (« 50 équipes créées, 100 tireurs inscrits, 0 écartée ») et les équipes apparaissent dans l'onglet
  « Équipes », rangées comme à la saisie manuelle (US-147).

**CA-4 — Équipes écartées**
- **Étant donné** un fichier dont certaines lignes sont en défaut
- **Quand** l'aperçu se calcule
- **Alors** l'équipe est écartée, le reste est importé, avec l'un des motifs : « Nom d'équipe manquant » ; « Une autre
  équipe porte déjà ce nom » (dans l'épreuve ou plus haut dans le fichier) ; « Nombre de titulaires différent du type
  d'épreuve » (2 en équipes de 2, 3 en équipes de 3) ; « Nom ou prénom manquant » ; « Le même tireur apparaît deux fois
  dans l'équipe » ; « <Nom Prénom> est déjà dans l'équipe <X> » (équipe existante, ou ligne plus haut du fichier).

**CA-5 — Fichiers refusés**
- **Étant donné** un fichier qui n'est pas un CSV d'équipes (colonnes `Équipe`, `Nom 1`, `Prénom 1`, `Nom 2`,
  `Prénom 2` absentes, autre format, XML) ou de plus de 5 Mo
- **Quand** l'organisateur le choisit
- **Alors** rien n'est importé et un message le dit (« Ce fichier n'est pas un fichier d'équipes au format attendu »,
  avec les colonnes manquantes).

**CA-6 — Épreuve verrouillée**
- **Étant donné** des poules lancées ou un tableau créé, ou une épreuve en lecture seule (US-082 CA-8)
- **Quand** l'organisateur ouvre l'onglet « Équipes »
- **Alors** le bouton « Importer un fichier… » est absent.

## Comportement hors ligne

Tout se fait sur l'appareil : la lecture du fichier et l'écriture des événements dans le journal local marchent sans
réseau ; l'envoi au serveur suit au retour du réseau (US-022). Testé par un E2E réseau coupé avec un fichier d'exemple.

## Cas limites et erreurs

- Fichier sans aucune ligne d'équipe : « Ce fichier ne contient aucune équipe ».
- Lignes vides, espaces autour des valeurs, guillemets CSV, retours Windows : tolérés.
- `Classement` vide, nul ou non numérique : le tireur est inscrit sans classement.
- Sexe, date de naissance et autres colonnes : ignorés (ADR-0014).
- Tireur déjà inscrit dont le club ou le classement diffère du fichier : son inscription n'est pas modifiée (l'import
  ne touche que les équipes et les tireurs inconnus).
- Zéro équipe importable : « Importer » désactivé, les motifs restent visibles.
- Un fichier de 100 équipes ou plus est importé en un seul lot, sans bloquer l'interface.

## Hypothèses

- Format CSV choisi par l'utilisateur le 2026-11-26. Le XML Engarde par équipes (`BaseCompetitionParEquipes`) reste
  refusé (US-083) et pourra faire l'objet d'une US séparée, sur un vrai fichier de la Fédération.
- Les tireurs inconnus sont inscrits à la volée par l'import (choix de l'utilisateur) ; un tireur est reconnu par sa
  licence, à défaut par ses nom et prénom (sans casse ni accents).
- Une équipe en conflit est écartée, jamais écrasée (choix de l'utilisateur) ; l'import n'est possible qu'avant le
  lancement (choix de l'utilisateur).
- Écart à la planche 40 : ajout du bouton « Importer un fichier… » (icône d'import du vocabulaire, nom visible) ;
  l'aperçu reprend la fenêtre d'US-083, sans planche dédiée. À valider à la recette.
- Prises à l'implémentation (validées avec le plan) :
  - le journal n'a pas d'écriture par lot : l'import écrit événement par événement, comme celui des tireurs (US-083).
    Pour chaque équipe, ses tireurs inconnus sont inscrits, puis l'équipe est créée ; une écriture refusée est comptée
    (« non enregistrée ») sans arrêter l'import, et une équipe dont un tireur n'a pas pu être inscrit n'est pas créée ;
  - rapprochement des homonymes : même licence = même tireur ; même nom et prénom avec une licence absente d'un côté =
    réutilisé et listé « rapproché par le nom » dans l'aperçu ; même nom et prénom mais deux licences différentes =
    autre tireur, inscrit ;
  - le bouton « Importer un fichier… » est dans l'en-tête de la liste d'équipes, à côté de « Nouvelle équipe » ; le
    bouton d'import XML des tireurs (US-083) n'est plus affiché sur l'onglet « Équipes » ;
  - un tireur déjà pris par une équipe plus haut dans le fichier est traité comme un tireur déjà en équipe
    (« <Nom Prénom> est déjà dans l'équipe <X> »).

## Questions bloquantes

Aucune.

## Notes techniques

- Analyse du CSV et rapprochement des tireurs purs, dans `paquets/domaine` (sans DOM) ; l'application lit le fichier
  (`FileReader`, décodage `TextDecoder`) et passe le texte au domaine.
- Événements existants (`TireurInscrit`, `EquipeCreee`, US-081 et US-145) : pas de nouveau type, pas de changement
  du serveur. Pas de nouvelle dépendance.
- Impacts : US-146 (onglet « Équipes », `Terminée`) et US-083 (`Terminée`, son message de refus des fichiers par
  équipes peut renvoyer vers ce bouton).

## Suivi

| Date | Événement |
|---|---|
| 2026-11-26 | Créée |
| 2026-11-26 | Implémentée sur `us/US-156-importer-equipes-csv` : tests unitaires (domaine, lecture du fichier) et E2E `import-equipes` verts en local ; en revue |

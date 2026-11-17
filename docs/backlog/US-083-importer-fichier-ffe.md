# US-083 — Importer les tireurs depuis le fichier d'inscription de la Fédération (format Engarde / BellePoule)

- **Epic :** E3 — Inscriptions et émargement
- **Fonctionnalité :** F3 (exigences §3), F16 (import)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** En revue
- **Dépend de :** US-081, US-082
- **Branche / PR :** `us/US-083-importer-fichier-ffe` / —

## Récit

**En tant qu'**organisateur, **je veux** importer la liste des inscrits que la Fédération fournit au format d'Engarde et
de BellePoule, **afin de** ne pas ressaisir des dizaines de tireurs déjà inscrits en ligne.

Maquette : planche 7 (bouton « Importer un fichier… »). L'aperçu avant import n'a pas de planche : il suit le modèle
de la fenêtre de confirmation de l'import d'une épreuve (US-035) ; écart déclaré dans les Hypothèses.

## Format pris en charge

Le fichier XML de compétition individuelle échangé par la FFE, Engarde et BellePoule, d'après la grammaire XML de la FIE
(version 3.3) et la documentation d'Engarde (sources ci-dessous) :

```xml
<?xml version="1.0" encoding="ISO-8859-1"?>
<BaseCompetitionIndividuelle Arme="S" Sexe="F" Categorie="M13" ...>
  <Tireurs>
    <Tireur ID="1" Nom="DUBOIS" Prenom="Chloé" Sexe="F" Licence="123456" Club="PESSAC SPUC"
            Ligue="NOUVELLE AQUITAINE" Nation="FRA" Classement="12" DateNaissance="01.02.2014" />
  </Tireurs>
</BaseCompetitionIndividuelle>
```

Seuls `Nom`, `Prenom`, `Club`, `Licence` et `Classement` sont repris ; `Sexe` sert au contrôle (CA-4) ; les autres
attributs, dont `DateNaissance`, sont ignorés (ADR-0014).

Sources (consultées le 2026-11-17) : documentation d'Engarde, « Champs pris en compte dans les fichiers XML »,
https://www.engarde-escrime.com/field-taken-into-account-in-the-xml-fil?lang=fr ; sommaire de la documentation,
https://www.engarde-escrime.com/documentation?lang=fr. La liste exacte des attributs de `Tireur` n'y est pas détaillée :
elle est à confirmer sur un vrai fichier de la Fédération (voir Hypothèses).

## Critères d'acceptation

**CA-1 — Choisir le fichier**
- **Étant donné** l'écran des inscriptions d'une épreuve pilotée par ce PC
- **Quand** l'organisateur clique « Importer un fichier… » et choisit un fichier `.xml`
- **Alors** le fichier est lu sur l'appareil, sans réseau ni envoi à un tiers, quel que soit son encodage déclaré
  (ISO-8859-1 ou UTF-8).

**CA-2 — Aperçu avant import**
- **Étant donné** un fichier lisible
- **Quand** l'aperçu s'ouvre
- **Alors** il donne le nombre de tireurs du fichier, répartis en « nouveaux », « déjà inscrits (même licence) » et
  « homonymes » (US-081 CA-6), la liste de ces derniers, et les tireurs écartés avec leur motif (CA-4) ; « Importer N
  tireurs » et « Annuler ».

**CA-3 — Importer**
- **Étant donné** l'aperçu validé
- **Quand** l'import se fait
- **Alors** chaque nouveau tireur est inscrit (`TireurInscrit`) ; un tireur de même licence est mis à jour (club,
  classement) par `TireurModifie` s'ils ont changé, sans doublon ; un homonyme sans licence commune est inscrit
  seulement si l'organisateur l'a coché dans l'aperçu. Un message dit le résultat (« 42 tireurs inscrits, 3 mis à jour,
  2 écartés »).

**CA-4 — Contrôles**
- **Étant donné** une épreuve « Dames » ou « Hommes »
- **Quand** un `Tireur` du fichier a un `Sexe` différent
- **Alors** il est écarté avec le motif « Sexe différent de l'épreuve » ; une épreuve mixte n'écarte personne. Un
  `Tireur` sans nom ou sans prénom est écarté (« Nom ou prénom manquant »).

**CA-5 — Fichiers refusés**
- **Étant donné** un fichier qui n'est pas un XML de compétition individuelle (XML mal formé, fichier par équipes
  `BaseCompetitionParEquipes`, autre format) ou de plus de 5 Mo
- **Quand** l'organisateur le choisit
- **Alors** rien n'est importé et un message le dit (« Ce fichier n'est pas un fichier d'inscription individuelle au
  format Engarde / BellePoule »).

## Comportement hors ligne

Tout se fait sur l'appareil : la lecture du fichier et l'écriture des événements dans le journal local marchent sans
réseau ; l'envoi au serveur suit au retour du réseau (US-022). Testé par un E2E réseau coupé avec un fichier d'exemple.

## Cas limites et erreurs

- Fichier sans aucun tireur : « Ce fichier ne contient aucun tireur ».
- Attributs inconnus ou en plus : ignorés.
- `Classement` vide, nul ou non numérique : le tireur est inscrit sans classement.
- Deux `Tireur` de même licence dans le fichier : le premier est repris, le second écarté (« Licence en double dans le
  fichier »).
- Épreuve en lecture seule (US-082 CA-8) : le bouton est absent.
- Attributs du fichier différents de l'épreuve (arme, catégorie) : simple avertissement dans l'aperçu, l'import reste
  possible.

## Hypothèses

- Le fichier de la Fédération est le XML `BaseCompetitionIndividuelle` (choix de l'utilisateur le 2026-11-17 : partir
  de la grammaire XML FIE/FFE et ajuster à la recette). Les noms d'attributs `Nom`, `Prenom`, `Sexe`, `Licence`,
  `Club`, `Classement` sont à confirmer sur un vrai fichier, à déposer anonymisé dans `docs/reference/import-ffe/` ; ce
  fichier servira de jeu d'essai aux tests.
- Le format texte « FFF » d'Engarde et les CSV libres ne sont pas pris en charge par cette US.
- L'aperçu reprend la fenêtre de confirmation d'US-035 (pas de planche dédiée).
- Prises à l'implémentation :
  - le XML est lu par un petit lecteur d'attributs (balises `BaseCompetitionIndividuelle` et `Tireur`, entités XML,
    commentaires) plutôt que par l'analyseur du navigateur : il se teste hors navigateur et tolère un fichier
    légèrement mal formé ;
  - `Sexe` « F » ou « D » vaut Dames, « M » ou « H » vaut Hommes ; un sexe absent ou inconnu n'écarte pas le tireur ;
  - le fichier d'essai des tests est `tests/e2e/donnees/inscription-ffe.xml` (anonymisé, ISO-8859-1), en attendant
    un vrai fichier de la Fédération dans `docs/reference/import-ffe/`.

## Questions bloquantes

Aucune.

## Notes techniques

- Lecture du XML dans le navigateur (`DOMParser`), décodage selon l'encodage déclaré (`TextDecoder`) ; analyse et
  classement des tireurs purs, dans `paquets/domaine` (sans DOM : l'application lui passe les attributs lus).
- Pas de nouvelle dépendance, pas de service externe, pas de changement du serveur.

## Suivi

| Date | Événement |
|---|---|
| 2026-11-17 | Créée |
| 2026-11-17 | Implémentée ; passe à En revue |

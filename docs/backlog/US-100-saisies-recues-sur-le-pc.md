# US-100 — Voir sur le PC les saisies reçues des smartphones

- **Epic :** E5 — Saisie smartphone
- **Fonctionnalité :** F7, F8 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** En revue
- **Dépend de :** US-099
- **Branche / PR :** `us/US-100-saisies-recues-sur-le-pc`

## Récit

**En tant qu'**organisateur, **je veux** voir sous la feuille de poule les saisies reçues des smartphones, acceptées
ou refusées avec leur motif, **afin de** savoir qui a saisi quoi et de régler un refus avec l'arbitre.

Maquette : carte « Saisies reçues des smartphones » de la planche 10 (`docs/maquettes/deroule/10-poules-saisie.png`,
source `deroule/SaisiePoules.dc.html`), laissée à E5 par US-088 ; icônes Smartphone, Coche, Triangle d'alerte.

## Critères d'acceptation

**CA-1 — La carte**
- **Étant donné** l'étape Poules d'une épreuve lancée, sur le PC
- **Quand** la page s'affiche
- **Alors** sous la feuille, la carte « Saisies reçues des smartphones » (icône Smartphone) montre le nombre
  d'appareils connectés (« 7 appareils connectés »), le lien « Gérer les accès » (US-096) et la phrase « Ce PC applique
  les droits réglés dans les Paramètres : une saisie permise est acceptée d'office et s'inscrit dans la feuille. »

**CA-2 — Une ligne par saisie**
- **Étant donné** des saisies traitées
- **Quand** la carte s'affiche
- **Alors** chaque ligne donne l'heure, « Poule 2 · match 9 : ROUX 3 – 5 MOREAU », l'auteur (« arbitre Dupont (t4) »)
  et le résultat : « Acceptée » (Coche) ou « Refusée : <motif> » (Triangle d'alerte, `--etat-erreur`), la plus
  récente en haut ; les scores saisis sur ce PC figurent aussi, « saisi sur ce PC », « Enregistrée ».

**CA-3 — Correction**
- **Étant donné** une correction reçue (US-101)
- **Quand** elle s'affiche
- **Alors** la ligne dit « correction de 5–4 en 4–5 ».

**CA-4 — En direct**
- **Étant donné** la carte affichée
- **Quand** une saisie arrive
- **Alors** sa ligne apparaît en tête sans recharger ni décaler la saisie en cours (US-090).

**CA-5 — Longueur**
- **Étant donné** plus de 10 saisies
- **Quand** la carte s'affiche
- **Alors** les 10 dernières sont visibles et « Voir toutes les saisies (N) » déplie la liste.

**CA-6 — Conforme à la planche 10**
- **Étant donné** la capture de la planche 10
- **Quand** un test E2E affiche l'étape Poules à 1360 px avec des saisies reçues
- **Alors** la carte suit la planche ; la recette liste les écarts.

## Comportement hors ligne

La liste se lit depuis le journal local : elle reste visible hors ligne. Le nombre d'appareils connectés devient
« Hors ligne : aucun appareil ». Testé par un E2E réseau coupé.

## Cas limites et erreurs

- Aucune saisie : « Aucune saisie reçue pour l'instant. »
- PC non pilote : la carte est visible en lecture (depuis la copie du journal), sans nombre d'appareils.
- Sur smartphone de l'organisateur (390 px) : la carte passe sous la feuille, une ligne sur deux lignes de texte.

## Hypothèses

- Les refus sont inscrits au journal (événement `SaisieRefusee` avec l'auteur et le motif) pour être retrouvés après
  un rechargement ou sur un autre PC ; c'est aussi la trace demandée par l'ADR-0005.

- Implémentation (2026-11-19) : la liste est calculée dans le domaine (`lignesSaisies`) à partir du journal :
  `ScorePouleSaisi` (avec `saisie` : « Acceptée » ; sans : « saisi sur ce PC », « Enregistrée ») et `SaisieRefusee`
  (« Refusée : motif »). Une correction se reconnaît à un score précédent du même match.
- Implémentation : le nombre d'appareils connectés vient du serveur (message `appareils`, à chaque entrée ou sortie d'un
  smartphone) ; il n'est pas affiché sur un PC qui n'est pas le pilote, et vaut « Hors ligne : aucun appareil » sans
  connexion au serveur. « Gérer les accès » ouvre la page « Paramètres » (planche 21).
- Implémentation : une même saisie refusée, renvoyée, reçoit le même refus sans nouvelle trace.

## Questions bloquantes

Aucune.

## Notes techniques

- US réalisée touchée : US-088 (la carte s'ajoute à la page de saisie des poules ; ses E2E de structure à revoir).

## Suivi

| Date | Événement |
|---|---|
| 2026-11-19 | Créée |
| 2026-11-19 | En cours sur `us/US-100-saisies-recues-sur-le-pc` (série, recette groupée) |
| 2026-11-19 | Implémentée ; en revue. Contrôles locaux verts (lint, typage, 1 782 tests, E2E `saisies-recues`, `saisie-match`, `poules-saisie`) |

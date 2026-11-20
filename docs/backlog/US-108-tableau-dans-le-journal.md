# US-108 — Tenir le tableau d'une épreuve dans son journal (technique)

- **Epic :** E6 — Tableau
- **Fonctionnalité :** F9, F10 (exigences §3)
- **Priorité :** P1
- **Type :** technique
- **Statut :** Terminée
- **Dépend de :** US-085, US-089, US-092, US-028
- **Branche / PR :** `us/US-108-tableau-dans-le-journal`

## Récit

**En tant que** développeur, **je veux** que la création du tableau, l'appel des matchs sur les pistes, les scores,
les retraits et la fin de l'épreuve soient des événements du journal de l'épreuve, avec leurs règles et leurs calculs
(taille du tableau, placement, exempts, avancement, classement final) dans le domaine, **afin que** les écrans du
tableau (US-109 à US-115) et la saisie sur smartphone (US-106) écrivent tous la même chose, hors ligne compris.

Maquette : sans objet (aucun écran).

## Critères d'acceptation

**CA-1 — Qualifiés et classement figé**
- **Étant donné** des poules lancées dont tous les matchs sont réglés (classement « définitif », US-092)
- **Quand** le domaine calcule les qualifiés
- **Alors** tous les tireurs des poules sont qualifiés, sauf les tireurs retirés des poules (US-089), dans l'ordre du
  classement après poules (V/M, indice, TD). Une égalité parfaite est départagée par **tirage au sort**, et
  l'ordre tiré est porté par l'événement de création (CA-2) : le tableau ne dépend jamais d'un nouveau tirage.

**CA-2 — Créer le tableau**
- **Étant donné** des qualifiés (au moins 2)
- **Quand** l'application écrit `TableauCree` avec l'ordre des qualifiés (identifiants, rang de 1 à N après tirage
  au sort des ex aequo)
- **Alors** la projection donne un tableau de taille T, la plus petite puissance de 2 ≥ N (de 2 à 256), avec les
  qualifiés placés selon l'ordre de la FIE (CA-3) ; les T − N meilleurs classés sont **exempts** au premier tour et
  passent d'office au tour suivant. Le journal refuse la création si un match de poule reste à tirer
  (`POULES_NON_TERMINEES`), si un tableau existe déjà (`TABLEAU_EXISTE`) ou si l'ordre ne correspond pas aux
  qualifiés (`QUALIFIES_INVALIDES`).

**CA-3 — Placement de la FIE**
- **Étant donné** un tableau de taille T
- **Quand** le domaine place les rangs
- **Alors** chaque match du premier tour oppose les rangs r et T + 1 − r, et les matchs sont ordonnés de sorte que
  les rangs 1 et 2 ne se rencontrent qu'en finale, 1 à 4 qu'en demi-finale, etc. Exemple pour le tableau de 16 (celui de la
  planche 11) : 1-16, 8-9, 5-12, 4-13, 3-14, 6-11, 7-10, 2-15. Un rang au-delà de N est un exempt.

**CA-4 — Figer les poules**
- **Étant donné** un tableau créé
- **Quand** l'application écrit un score de poule, un retrait des poules ou son annulation
- **Alors** le journal le refuse (`TABLEAU_CREE`).

**CA-5 — Appeler un match sur une piste**
- **Étant donné** un match dont les deux tireurs sont connus et qui n'est pas réglé
- **Quand** l'application écrit `MatchTableauAppele` avec le match, la piste et l'heure
- **Alors** le match prend cette piste et son heure d'appel ; un nouvel appel du même match remplace le précédent
  (changement de piste), et `piste: null` retire la piste. Le journal refuse un match en attente d'un tireur ou déjà
  réglé.

**CA-6 — Saisir un score du tableau**
- **Étant donné** un match dont les deux tireurs sont connus
- **Quand** l'application écrit `ScoreTableauSaisi` avec le match, les touches de chacun et, en cas d'égalité, le
  vainqueur (`parPriorite`)
- **Alors** le match est réglé et son vainqueur prend sa place au tour suivant. Le journal refuse des touches
  négatives ou au-delà des touches du tableau (formule en vigueur, US-028), un vainqueur à égalité sans
  `parPriorite`, un `parPriorite` sans égalité, et un match en attente d'un tireur.

**CA-7 — Corriger un score**
- **Étant donné** un match réglé
- **Quand** l'application écrit un nouveau `ScoreTableauSaisi` pour ce match
- **Alors** il remplace l'ancien si le match suivant du vainqueur n'est pas encore réglé ; si le vainqueur change,
  le nouveau vainqueur le remplace au tour suivant (et la piste appelée du match suivant est conservée). Si le match
  suivant est déjà réglé, le journal refuse (`MATCH_SUIVANT_REGLE`).

**CA-8 — Retirer un tireur du tableau**
- **Étant donné** un match non réglé dont les deux tireurs sont connus
- **Quand** l'application écrit `TireurRetireDuTableau` avec le tireur, le match et le motif (`abandon`, `forfait`,
  `exclusion`)
- **Alors** le match est réglé en faveur de l'adversaire, qui passe au tour suivant ; les touches déjà portées ne sont
  pas enregistrées. `RetraitDuTableauAnnule` annule le retrait aux mêmes conditions qu'une correction (CA-7).

**CA-9 — Match pour la 3e place**
- **Étant donné** une formule avec match pour la 3e place (US-028), y compris activée après la finale
- **Quand** les deux demi-finales sont réglées
- **Alors** la projection donne un match « 3e place » entre leurs perdants, qui s'appelle et se saisit comme les
  autres ; désactivé alors que le match est réglé, le journal refuse (`TROISIEME_PLACE_REGLEE`).

**CA-10 — Classement final**
- **Étant donné** un tableau
- **Quand** le domaine calcule le classement final
- **Alors** le vainqueur de la finale est 1er, le finaliste 2e ; avec match pour la 3e place, son vainqueur est 3e et
  son perdant 4e, sinon les deux perdants des demies sont 3es ex aequo ; les autres tireurs éliminés au même tour
  prennent les places suivantes **dans l'ordre de leur rang après poules** (places distinctes). Un tireur exclu (US-113)
  n'est pas classé ; les tireurs retirés des poules sont en fin de classement, sans place. Tant qu'un match reste à
  régler, le classement est « provisoire ».

**CA-11 — Terminer l'épreuve**
- **Étant donné** un tableau dont tous les matchs sont réglés (3e place comprise si elle est prévue)
- **Quand** l'application écrit `EpreuveTerminee`
- **Alors** l'épreuve passe « Terminée » et le journal refuse ensuite toute écriture du tableau
  (`EPREUVE_TERMINEE`). Avant, il refuse (`MATCHS_A_REGLER`).

## Comportement hors ligne

Les événements s'écrivent dans le journal local du PC pilote sans réseau et partent au serveur au retour du réseau
(US-022). Tous les calculs (placement, avancement, classement final) sont purs et locaux. Testé par les tests
unitaires du journal et par les E2E hors ligne d'US-109 et d'US-111.

## Cas limites et erreurs

- 2 qualifiés : tableau de 2, une finale seule. Un seul qualifié : pas de tableau (`QUALIFIES_INSUFFISANTS`), il est
  1er au classement final.
- N puissance de 2 : aucun exempt.
- Plus de 256 qualifiés : refusé (`TABLEAU_TROP_GRAND`).
- Un exempt n'a pas de match à saisir, ni à appeler.
- Deux retraits dans un même match : impossible, le premier règle le match.
- Changement des touches du tableau en cours (US-028 CA-4) : les scores déjà saisis restent valables, le contrôle
  porte sur la valeur en vigueur au moment de la saisie.

## Hypothèses

- Règles d'après le règlement technique de la FIE (placement du tableau, tirage au sort des ex aequo, classement des
  éliminés d'un même tour selon le classement après poules) et la documentation d'Engarde
  (https://www.engarde-escrime.com/documentation?lang=fr), **à vérifier sur le texte officiel à l'implémentation**.
  Choix confirmés par l'utilisateur le 2026-11-20 : tirage au sort des ex aequo, classement des éliminés par le rang après poules,
  saisie d'une égalité avec un vainqueur désigné par la priorité.
- Le tirage au sort se fait dans l'application au moment de créer le tableau (US-109) et l'ordre tiré est stocké dans
  l'événement : rejouer le journal donne toujours le même tableau.
- Un abandon ou un forfait dans le tableau classe le tireur avec les éliminés de ce tour ; l'exclusion le retire du
  classement final (règle de la FIE, à vérifier).
- Pas de séparation des clubs au premier tour en P1 (US-116, P2).
- Les identifiants de match sont stables : tour (taille du tableau) + numéro dans le tour (1 en haut).

## Questions bloquantes

Aucune.

## Notes techniques

- Protocole : `TableauCree`, `MatchTableauAppele`, `ScoreTableauSaisi`, `TireurRetireDuTableau`,
  `RetraitDuTableauAnnule`, `EpreuveTerminee` dans `paquets/protocole/src/journal.ts`, documentés dans
  `docs/protocole.md` (nouveau paragraphe après celui des poules).
- Domaine : `paquets/domaine/src/tableau.ts` : `tailleTableau(n)`, `placementFIE(taille)`, `qualifies(…)`,
  projection `tableau` (tours, matchs, état de chaque match), `classementFinal(…)`. Couverture ≥ 90 % (règle 5).
- Le tirage au sort reçoit son aléa en paramètre (fonction pure, testable) ; l'app le fournit.
- La règle `prochaineEtape` (US-064) recevra ses cas du tableau par US-109 et US-115.
- Export / import JSON (US-034, US-035) : les nouveaux événements doivent passer l'aller-retour ; à vérifier par un test.

## Suivi

| Date | Événement |
|---|---|
| 2026-11-20 | Créée (spécification de l'Epic 6) ; hypothèses et écarts validés par l'utilisateur, passe à Prête |
| 2026-11-20 | Implémentée : `paquets/domaine/src/tableau.ts`, journal, protocole et `docs/protocole.md` ; passe En revue |
| 2026-11-20 | Recette OK sur https://poule-position-git-us-us-106-saisir-sco-528a26-fsmjlas-projects.vercel.app (recette groupée d'US-108 à US-115 et US-106, PC 1360 px, téléphone 390 × 844, hors ligne, thème sombre) ; mergée dans `dev` ; passe à Terminée |

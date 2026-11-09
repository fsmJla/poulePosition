# US-043 — Supprimer par lot des manifestations, des épreuves et des compétitions

- **Epic :** E2 — Compétitions
- **Fonctionnalité :** F2 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** Terminée
- **Dépend de :** US-040, US-041, US-042
- **Branche / PR :** `us/US-043-supprimer-par-lot-tous-types`

## Récit

**En tant qu'**administrateur, **je veux** cocher dans la liste de l'accueil des manifestations, des épreuves et des
compétitions, et tout supprimer en une seule confirmation, **afin de** vider rapidement le club de ses données de test
sans rien oublier.

## Critères d'acceptation

**CA-1 — Cases sur tous les éléments**
- **Étant donné** un administrateur sur la liste de l'accueil (US-026), en ligne
- **Quand** il l'affiche
- **Alors** chaque manifestation, chaque épreuve et chaque compétition porte une case, et la barre de sélection d'US-040
  est conservée. Une manifestation, une épreuve ou une compétition « En cours » (ou qui en contient une) ne se coche pas,
  avec la raison en infobulle (« Contient une compétition en cours »).

**CA-2 — Cocher un parent couvre son contenu**
- **Étant donné** une manifestation ou une épreuve cochée
- **Quand** l'administrateur la coche
- **Alors** ses épreuves et ses compétitions apparaissent cochées et verrouillées (« supprimées avec <parent> »), et le
  compteur par type est juste : « 1 manifestation, 3 épreuves, 12 compétitions ». Décocher le parent les libère.

**CA-3 — Tout cocher et compétitions masquées**
- **Étant donné** la liste affichée avec ses filtres (archives)
- **Quand** l'administrateur choisit « Tout cocher »
- **Alors** tous les éléments visibles et supprimables sont cochés, jamais ceux qu'un filtre masque. Si une manifestation
  ou une épreuve cochée contient des compétitions archivées masquées, la confirmation le dit (« dont 3 archivées
  masquées »), car elles sont supprimées avec leur parent.

**CA-4 — Confirmation unique**
- **Étant donné** une sélection
- **Quand** l'administrateur confirme
- **Alors** la fenêtre indique le décompte par type et liste les noms des éléments cochés directement (pas leur contenu),
  puis demande de saisir « SUPPRIMER ». Une fois confirmé, la suppression s'enchaîne avec une progression globale.

**CA-5 — Ordre et dédoublonnage**
- **Étant donné** une sélection qui mêle parents et éléments de ces parents
- **Quand** la suppression s'exécute
- **Alors** un élément dont le parent est coché n'est pas supprimé deux fois. L'ordre est : les manifestations avec leur
  contenu (US-042), puis les épreuves restantes avec leur contenu (US-041), puis les compétitions restantes (US-039).

**CA-6 — Compte rendu et reprise**
- **Étant donné** une suppression en série dont certains éléments échouent (compétition devenue « En cours », réseau
  coupé, session perdue)
- **Quand** la série se termine
- **Alors** un compte rendu indique ce qui est supprimé et ce qui reste, avec le motif ; ce qui reste demeure coché pour
  relancer. Une erreur de session ou de réseau arrête la série ; un autre refus laisse l'élément restant et continue.

**CA-7 — Réservé aux administrateurs**
- **Étant donné** un organisateur qui n'est pas administrateur
- **Quand** il ouvre la liste
- **Alors** aucune case ni barre de suppression n'est affichée.

## Comportement hors ligne

Suspendu hors ligne, comme US-040 : cases et bouton grisés, avec « Connexion requise pour supprimer ». Si le réseau est
coupé en cours de série, elle s'arrête proprement et le compte rendu indique ce qui reste (CA-6).

## Cas limites et erreurs

- Une manifestation cochée dont une compétition devient « En cours » entre-temps reste, avec son motif, et la série
  continue avec les autres éléments.
- La liste se relit une seule fois, à la fin de la série (US-038), pas entre deux suppressions.
- Un élément déjà supprimé par un autre administrateur compte comme supprimé (idempotence, US-041 CA-7, US-042 CA-7).
- Série longue : une page affiche la progression globale ; les 801 manifestations vides d'une preview sont des
  suppressions très rapides, sans contenu.

## Hypothèses

- La sélection mêlée se fait dans la liste d'accueil, tous types ensemble (décision du 2026-11-07).
- Cocher un parent coche implicitement son contenu, y compris les compétitions archivées masquées, annoncées à la
  confirmation.
- Une manifestation, une épreuve ou une compétition qui contient une compétition « En cours » ne se coche pas, plutôt
  que d'échouer au serveur : l'écran ne propose pas l'impossible (même règle que US-040 CA-1).
- Réservé aux administrateurs.

## Questions bloquantes

- Aucune.

## Notes techniques

- Étend l'écran d'US-040 (barre, confirmation, compte rendu) sans nouvelle route : la série appelle les routes de
  US-039, US-041 et US-042.
- Les décisions pures (sélection, dédoublonnage, décompte par type, ordre) vont dans `paquets/domaine`, avec leurs tests.
- US-040 reste valable : son périmètre (compétitions seules) est inclus dans celui-ci.

## Décisions prises pendant l'implémentation

- Les règles pures sont dans `paquets/domaine/src/selection-suppression.ts` (`analyserSelection`, `planSuppression`,
  `toutCocherListe`, `elementsEnCours`) ; `elementsEnCours` est calculé une fois pour toute la liste, car l'écran le
  consulte à chaque case (plus de 800 manifestations sur la preview).
- Un parent est non cochable s'il contient une compétition « En cours », archivées masquées comprises (la liste complète
  est connue de l'écran) ; le serveur reste la dernière barrière (US-041 et US-042 CA-3).
- Une sélection de compétitions seules garde les textes d'US-040 (« 2 compétitions sélectionnées », même confirmation) ;
  dès qu'une manifestation ou une épreuve est cochée, compteur et confirmation sont par type.
- Un parent coché verrouille son contenu, coché ou non : ses cases apparaissent cochées et grisées (« Supprimée avec X »).
- `supprimerSerieMixte` remplace `supprimerEnSerie` (US-040), retirée avec `toutCocher`, `selectionnables` et
  `competitionsVisibles`, devenues inutiles ; leurs garanties (déjà supprimé, arrêt sur session ou réseau, compte rendu)
  sont reprises par les tests d'US-043. Une manifestation ou une épreuve absente du serveur compte comme supprimée.
- CA-1 « En cours » n'est testé qu'en unitaire : l'E2E ne sait pas créer une compétition en cours. Les E2E de suppression
  réelle ne tournent qu'en local (le compte de la preview est un organisateur) ; seul CA-7 y tourne.
- À noter, hors périmètre : la liste de l'accueil replie les manifestations à chaque relecture des données (changement
  de réseau, fin d'une suppression), comportement antérieur à cette US.

## Suivi

| Date | Événement |
|---|---|
| 2026-11-07 | Créée |
| 2026-11-07 | En cours : plan validé, implémentation |
| 2026-11-07 | En revue : PR vers `dev`, contrôles locaux verts (lint, typage, 1010 tests avec couverture, build, audit sans vulnérabilité haute) ; E2E locaux : 283 passent, 11 ignorés (preview uniquement) |
| 2026-11-07 | Recette OK sur https://poule-position-git-us-us-043-supprimer-b05c39-fsmjlas-projects.vercel.app (administrateur, PC) : CA-1, CA-2, CA-4, CA-5 et CA-6 vérifiés à la main avec suppression réelle ; CA-7 par l'E2E de la preview ; « Tout cocher », « épreuve seule », CA-1 « En cours » et hors ligne couverts par les tests automatisés. Un écart d'affichage (case de manifestation centrée au-dessus du nom) a été corrigé et revérifié. Terminée. |
| 2026-11-08 | Impactée par US-044 (vocabulaire inversé) et US-045 (toute épreuve dans une compétition, compétition dans une manifestation ou seule) |

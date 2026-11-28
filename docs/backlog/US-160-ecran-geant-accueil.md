# US-160 — Présenter l'épreuve sur l'écran géant avant son lancement (mode Accueil)

- **Epic :** E9 — Affichage en direct
- **Fonctionnalité :** F13 (exigences §3)
- **Priorité :** P2
- **Type :** fonctionnelle
- **Statut :** En revue
- **Dépend de :** US-132, US-134, US-030, US-084
- **Branche / PR :** `us/US-160-ecran-geant-accueil`

## Récit

**En tant qu'** organisateur, **je veux** que l'écran géant présente l'épreuve avant le lancement des poules, comme une
bande annonce (affiche, nom, horaires, inscrits et émargés, compte à rebours), **afin d'**accueillir le public et les
tireurs et de leur donner la prochaine étape.

Maquette : planche 35 bis (`docs/maquettes/direct/35bis-ecran-accueil.png`, source animée
`direct/EcranAccueil.html`), validée par l'utilisateur le 2026-11-28 ; thème sombre et bandeau des planches 31 à 35.

## Critères d'acceptation

**CA-1 — Premier mode affiché**
- **Étant donné** un écran géant qui suit une épreuve dont les poules ne sont pas lancées
- **Quand** l'écran s'affiche
- **Alors** il montre le mode Accueil (pastille « Bientôt ») au lieu de « Les épreuves de cet écran n'ont pas encore
  commencé ».

**CA-2 — Plans en boucle**
- **Étant donné** le mode Accueil
- **Quand** le temps passe
- **Alors** des plans de 8 s se suivent en boucle, avec des repères d'avancement : l'affiche (zoom lent sur son flou),
  le nom lettre par lettre avec la compétition et le type (« Sabre · M13 · Dames · Individuel »), les horaires (Appel,
  Scratch, Début, la prochaine étape mise en avant, les passées estompées), puis les inscrits et les émargés, qui
  défilent jusqu'à leur nombre dans un anneau.

**CA-3 — Données de l'épreuve**
- **Étant donné** une épreuve avec inscrits, émargés, horaires et affiche
- **Quand** le pilote publie la vue en direct
- **Alors** elle porte les horaires, le type, le nombre d'inscrits et d'émargés (par équipes : équipes inscrites et
  équipes complètes), le nom de la compétition et l'affiche : celle de l'épreuve, sinon de sa compétition, sinon de sa
  manifestation ;
- **Et** aucun nom d'émargé n'est publié.

**CA-4 — Compte à rebours**
- **Étant donné** des horaires
- **Quand** l'écran s'affiche
- **Alors** le bas de l'écran montre, fixe, le temps restant avant la prochaine étape (« Appel dans 42:12 », puis le
  scratch, puis le début des poules) et la frise des étapes ;
- **Et** passé l'heure du début sans poules lancées, « Début imminent » clignote doucement.

**CA-5 — Fin du mode**
- **Étant donné** le mode Accueil
- **Quand** les poules sont lancées
- **Alors** l'écran passe seul à l'appel des matchs et aux poules.

**CA-6 — Conforme à la planche 35 bis.**

## Comportement hors ligne

L'écran local (ouvert sur le PC pilote, US-136) reçoit la vue par le canal local : le mode Accueil, ses horaires, ses
nombres et son compte à rebours fonctionnent sans réseau. L'affiche se lit sur le serveur : sans réseau, son plan est
sauté. Testé : unitaires (calcul de la vue et du compte à rebours sans réseau) ; E2E de l'écran.

## Cas limites et erreurs

- Sans affiche, ou affiche illisible : son plan est sauté.
- Horaire absent : il n'apparaît ni dans les horaires ni dans la frise ; sans aucun horaire, « Bientôt » remplace le
  compte à rebours.
- Épreuve sans date : les horaires sont ceux du jour ; épreuve dans plusieurs jours : « 3 j 04:00:00 ».
- Vue publiée par un pilote d'avant cette US (sans `accueil`) : l'écran attend comme avant.
- Nom long : il passe à la ligne entre les mots (jamais au milieu d’N mot), dans une taille adaptée à sa longueur.
- `prefers-reduced-motion` : plans sans animation.
- Les chiffres défilent une seule fois par passage du plan : une vue republiée (nouvelle émargée) affiche le nouveau nombre sans relancer l’animation.
- Plusieurs épreuves en mode Accueil sur un même écran : la séquence complète d’une épreuve (tous ses plans), puis celle de la suivante ; chaque épreuve repart à son premier plan.

## Hypothèses

- **Type** (validé) : arme, catégorie, sexe et formule (« Individuel », « Par équipes de 2 / 3 »).
- **Après l'heure du début** (validé) : « Début imminent » jusqu'au lancement.
- **Périmètre** (validé) : l'épreuve suivie par l'écran, affiche héritée épreuve → compétition → manifestation.
- **Affiche** lue dans la copie des fichiers gardée sur le PC pilote (rafraîchie dès qu'une page de l'organisateur
  liste les fichiers) : une affiche jointe ailleurs apparaît après ce rafraîchissement.
- **Non masquable** dans les réglages de l'écran (« vues à afficher ») ni imposable : c'est le seul contenu avant le
  lancement.
- **Bandeau** : la pastille dit « Bientôt » ; le compte à rebours dit « Début imminent ».
- **Classement de l’écran géant** (retour de recette du 2026-11-28, planche 33) : présentation inchangée, mais 24 lignes par page (deux colonnes de 12, au lieu de 12) et un vrai tableau : bordures visibles, entête sur fond, une ligne sur deux en teinte d’accent.

## Questions bloquantes

- Aucune.

## Notes techniques

- Domaine : `AccueilDirect`, `ComplementDirect`, `accueilDirect` ; `vueDirect(epreuve, evenements, complement)`.
- Protocole : champ facultatif `accueil` de la vue en direct (`docs/protocole.md`).
- App : `complement-direct.ts` (compétition, affiche héritée), `fichiers.copieLocale()`, page `accueil` de
  `ecran-geant.ts` (`plansAccueil`, `prochaineEtape`, `formaterReste`), composant `EcranAccueil.svelte`.

## Suivi

| Date | Événement |
|---|---|
| 2026-11-28 | Demandée par l'utilisateur ; maquette animée validée ; implémentée et passée en revue. |

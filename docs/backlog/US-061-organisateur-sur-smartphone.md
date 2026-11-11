# US-061 — Adapter l'accueil et la page d'une épreuve au smartphone de l'organisateur

- **Epic :** E2 — Compétitions
- **Fonctionnalité :** F2 (exigences §3)
- **Priorité :** P2
- **Type :** fonctionnelle
- **Statut :** Prête
- **Dépend de :** US-054, US-055, US-058
- **Branche / PR :** — (renseignés par `/debut-impl-US` et `/fin-impl-US`)

## Récit

**En tant qu'**organisateur, **je veux** consulter le club et une épreuve confortablement sur mon téléphone, **afin
de** suivre la journée loin du PC pilote.

Maquette : planches 5 « Smartphone : accueil » et 6 « Smartphone : épreuve »
(`docs/maquettes/ihm/MobileAccueil.dc.html`, `MobileEpreuve.dc.html`), principe 13.

Périmètre : l'organisateur sur téléphone. La saisie de l'arbitre et du tireur (E5) est traitée plus tard, avec sa
propre maquette.

## Critères d'acceptation

**CA-1 — Accueil sur une colonne**
- **Étant donné** un écran de 390 px de large
- **Quand** l'accueil s'affiche
- **Alors** la liste tient sur une colonne, sans défilement horizontal : carte de manifestation, lignes de
  compétition, lignes d'épreuve (nom court, statut en texte, icône de publication, chevron).

**CA-2 — Bouton « Créer » flottant**
- **Étant donné** l'accueil sur un écran étroit
- **Quand** il s'affiche
- **Alors** un bouton « Créer » (icône plus et libellé) reste en bas à droite au-dessus du contenu, mène à `/creer`,
  et ne masque jamais la dernière ligne (marge de fin de liste).

**CA-3 — Entête de l'épreuve sur écran étroit**
- **Étant donné** la page d'une épreuve sur un écran étroit
- **Quand** elle s'affiche
- **Alors** l'entête montre une flèche de retour (vers le niveau supérieur du fil d'Ariane), le nom court de l'épreuve,
  sa compétition et son arme, et le menu « ⋯ » ; le fil d'Ariane complet n'est pas affiché.

**CA-4 — Barre d'onglets en bas**
- **Étant donné** la page d'une épreuve sur un écran étroit
- **Quand** elle s'affiche
- **Alors** les étapes sont une barre fixe en bas : Résumé, Inscrits, Poules, Tableau et « Plus » (Émargement,
  Impressions, Formule, Paramètres). L'onglet ouvert est mis en évidence ; une étape à venir est grisée (US-058 CA-2).

**CA-5 — Cartes empilées**
- **Étant donné** l'étape « Résumé » sur un écran étroit
- **Quand** elle s'affiche
- **Alors** les cartes d'US-058 sont empilées sur une colonne, et l'état du pilote (« Ce PC est le pilote » ou
  « Lecture seule : un autre PC est le pilote ») figure en tête.

**CA-6 — Cibles tactiles**
- **Étant donné** un écran tactile
- **Quand** on utilise ces deux écrans
- **Alors** toute cible fait au moins 44 × 44 px et les zones sûres de l'appareil (encoche, barre de geste) sont
  respectées.

**CA-7 — Conforme aux planches 5 et 6**
- **Étant donné** les captures de référence `docs/maquettes/ihm/5-smartphone-accueil.png` et
  `6-smartphone-epreuve.png`, et les données des planches
- **Quand** un test E2E affiche l'accueil puis la page d'une épreuve au format 390 × 844
- **Alors** les deux écrans ont la structure, l'ordre, les alignements et les couleurs des captures (table « De la
  maquette à la charte ») ; le test joint ses captures au rapport, et la recette les compare aux références et liste
  les écarts. Les filtres, l'alerte, la loupe et le bandeau « Prochaine étape » des planches viennent avec leurs US
  (US-063, US-060, US-062, US-064).

## Comportement hors ligne

Identique à US-055 et à US-058 : ces écrans s'affichent depuis la copie de l'appareil. Un téléphone est le plus
souvent en lecture seule (un autre PC est le pilote) ; les actions indisponibles sont grisées avec leur motif. Testé
par un E2E réseau coupé au format 390 px.

## Cas limites et erreurs

- Rotation en paysage ou tablette : au-delà du point de bascule, la disposition large s'applique.
- Clavier virtuel ouvert : la barre d'onglets ne recouvre pas le champ en cours de saisie.
- Nom d'épreuve long : tronqué sur une ligne dans l'entête, complet dans le titre de la page.

## Hypothèses

- Point de bascule étroit / large : celui du plan de la manifestation (48 rem, US-050), à confirmer à l'implémentation.
- La page d'une manifestation (US-056) et le mode sélection (US-059) s'adaptent à l'écran étroit dans leurs propres
  US ; cette US ne couvre que les planches 5 et 6.

## Questions bloquantes

- Aucune.

## Notes techniques

- Interface seulement. Tests E2E au format 390 × 844.
- US terminées touchées : aucune au-delà de celles d'US-055 et d'US-058.

## Suivi

| Date | Événement |
|---|---|
| 2026-11-11 | Créée d'après la maquette « IHM de l'organisateur » ; périmètre organisateur confirmé le 2026-11-11 |
| 2026-11-11 | Ajout du critère « Conforme à la planche » (capture de référence, comparaison en recette) |

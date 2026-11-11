# US-057 — Fusionner « Supprimer » et « Supprimer avec son contenu… » en une seule action

- **Epic :** E2 — Compétitions
- **Fonctionnalité :** F2 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** Prête
- **Dépend de :** US-054, US-039, US-041, US-042
- **Branche / PR :** — (renseignés par `/debut-impl-US` et `/fin-impl-US`)

## Récit

**En tant qu'**administrateur, **je veux** une seule action « Supprimer… » par manifestation, compétition ou épreuve,
dont la confirmation me dit ce qui va disparaître, **afin de** ne plus avoir à choisir entre deux boutons presque
identiques.

Maquette : planche 2, menu « ⋯ » ouvert (`docs/maquettes/ihm/Manifestation.dc.html`), principe 6.
Décision de l'utilisateur du 2026-11-11.

## Critères d'acceptation

**CA-1 — Une seule action**
- **Étant donné** un administrateur en ligne
- **Quand** il ouvre le menu « ⋯ » d'une manifestation, d'une compétition ou d'une épreuve
- **Alors** il y trouve une seule action « Supprimer… », la dernière, en rouge ; « Supprimer avec son contenu… »
  n'existe plus nulle part.

**CA-2 — Objet vide**
- **Étant donné** une manifestation sans compétition, ou une compétition sans épreuve
- **Quand** l'administrateur choisit « Supprimer… »
- **Alors** une confirmation simple « Supprimer <nom> ? » suffit.

**CA-3 — Objet non vide : la confirmation détaille le contenu**
- **Étant donné** une manifestation ou une compétition qui contient des compétitions ou des épreuves
- **Quand** l'administrateur choisit « Supprimer… »
- **Alors** la confirmation annonce le contenu supprimé (« 3 compétitions et 9 épreuves, archivées comprises »), la
  liste des épreuves, et garde le niveau de confirmation explicite d'US-041 CA-4 et d'US-042 CA-4.

**CA-4 — Mêmes règles de suppression**
- **Étant donné** une suppression confirmée
- **Quand** elle s'exécute
- **Alors** les règles d'US-039, US-041 et US-042 s'appliquent sans changement : blocage par une épreuve en cours,
  étapes, reprise après interruption, idempotence, copies locales.

**CA-5 — Indisponible, avec le motif**
- **Étant donné** un organisateur non administrateur, ou un PC hors ligne, ou un contenu dont une épreuve est en cours
- **Quand** le menu « ⋯ » s'ouvre
- **Alors** « Supprimer… » est absent pour le non-administrateur ; pour les autres cas il est grisé, avec son motif
  (« Connexion requise pour supprimer », « Une épreuve en cours ne peut pas être supprimée »).

**CA-6 — Conforme à la planche 2 (menu ouvert)**
- **Étant donné** la capture de référence `docs/maquettes/ihm/2-manifestation.png`
- **Quand** un test E2E ouvre le menu « ⋯ » d'une compétition non vide
- **Alors** « Supprimer… » y figure comme sur la capture : dernière action, sous un séparateur, avec la corbeille, en
  `--etat-erreur`, et son sous-titre qui annonce le contenu ; le test joint sa capture au rapport, et la recette la
  compare à la référence. La fenêtre de confirmation n'a pas de planche : elle reprend les styles de confirmation
  existants.

## Comportement hors ligne

Suspendu hors ligne, comme US-039, US-041 et US-042 : « Supprimer… » est grisé avec « Connexion requise pour
supprimer ». Testé par un E2E réseau coupé.

## Cas limites et erreurs

- Le contenu change entre l'ouverture de la confirmation et sa validation (une épreuve ajoutée depuis un autre PC) :
  la suppression traite le contenu réel et le compte rendu l'indique, comme US-042.
- Sous-titre de l'action dans le menu : il annonce le contenu (« avec ses 7 épreuves, après confirmation ») pour que
  la portée soit visible avant le clic.

## Hypothèses

- Le terme du glossaire « Suppression avec contenu » est conservé pour désigner le mécanisme ; seul le libellé de
  l'interface disparaît.
- La suppression par lot (US-043) garde sa confirmation unique ; sa présentation est revue par US-059.

## Questions bloquantes

- Aucune.

## Notes techniques

- Changement d'interface seulement : aucun impact sur le protocole, le serveur ni le journal.
- US terminées touchées : US-039, US-041 (CA-4), US-042 (CA-4), US-023 et US-024 (suppression d'un objet vide). Leurs
  E2E sont adaptés au nouveau parcours.

## Suivi

| Date | Événement |
|---|---|
| 2026-11-11 | Créée d'après la maquette « IHM de l'organisateur » ; fusion validée par l'utilisateur le 2026-11-11 |
| 2026-11-11 | Ajout du critère « Conforme à la planche » (capture de référence, comparaison en recette) |

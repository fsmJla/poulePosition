# US-072 — Voir un aperçu de l'affiche et de la feuille de route sur la page Documents

- **Epic :** E2 — Compétitions
- **Fonctionnalité :** F2 (exigences §3)
- **Priorité :** P2
- **Type :** fonctionnelle
- **Statut :** Prête
- **Dépend de :** US-030, US-056
- **Branche / PR :** — (renseignés par `/debut-impl-US` et `/fin-impl-US`)

## Récit

**En tant qu'**organisateur, **je veux** voir un aperçu de la feuille de route (comme celui de l'affiche) sur l'écran
« Affiche et feuille de route », **afin de** vérifier que c'est le bon fichier sans l'ouvrir dans un autre onglet.
Aujourd'hui l'affiche a une vignette, mais la feuille de route n'a qu'un lien « Ouvrir la feuille de route ».

Maquette : onglet « Affiche et feuille de route » de la page d'une manifestation (planche 2, US-056) et mêmes blocs
sur les pages d'une compétition et d'une épreuve. Pas de planche pour l'aperçu (Hypothèses).

## Critères d'acceptation

**CA-1 — Aperçu de la feuille de route**
- **Étant donné** une feuille de route (PDF) jointe
- **Quand** la page Documents s'affiche
- **Alors** elle montre un aperçu de sa première page (vignette de même gabarit que celle de l'affiche), avec le nom du
  fichier, sa taille et son nombre de pages, au-dessus des boutons « Remplacer » et « Retirer ».

**CA-2 — Ouvrir l'aperçu en grand**
- **Étant donné** la vignette de l'affiche ou de la feuille de route
- **Quand** l'organisateur clique dessus (ou au clavier, Entrée)
- **Alors** une fenêtre modale de taille moyenne s'ouvre avec l'affiche en image, ou la feuille de route en PDF
  parcourable, un bouton « Ouvrir dans un nouvel onglet » et un bouton « Fermer » (Échap ferme aussi) ; le focus y est
  piégé puis rendu au bouton d'origine.

**CA-3 — Boutons de la charte**
- **Étant donné** les blocs Affiche et Feuille de route
- **Quand** ils s'affichent
- **Alors** « Remplacer » est un bouton neutre, « Retirer » un bouton neutre de la charte (et non le bouton gris par
  défaut du navigateur vu à la recette), et le lien « Ouvrir la feuille de route » n'a plus le bleu et le soulignement
  du navigateur : il reprend `--accent`.

**CA-4 — Sans fichier**
- **Étant donné** une manifestation sans feuille de route
- **Quand** la page s'affiche
- **Alors** le bloc montre « Aucune feuille de route » et le bouton « Ajouter » (US-030 CA-2), sans aperçu vide.

**CA-5 — Fichier illisible**
- **Étant donné** un PDF que le navigateur ne sait pas afficher (ou une vignette qui échoue)
- **Quand** l'aperçu devrait s'afficher
- **Alors** une icône « Document » avec le nom du fichier remplace la vignette, et le bouton « Ouvrir dans un nouvel onglet » reste disponible.

**CA-6 — Écran étroit**
- **Étant donné** 390 px
- **Quand** la page ou la fenêtre d'aperçu s'affiche
- **Alors** l'aperçu tient dans la largeur ; la fenêtre occupe l'écran avec un bouton « Fermer » d'au moins 44 × 44 px.

## Comportement hors ligne

Les fichiers viennent du serveur (ADR-0022) : hors ligne, un fichier déjà vu dans l'appareil s'affiche depuis le cache
du navigateur ; sinon l'aperçu est remplacé par « Aperçu disponible en ligne » avec le nom du fichier. Joindre ou
remplacer un fichier reste suspendu hors ligne, comme US-030. L'épreuve continue sans ces documents.

## Cas limites et erreurs

- PDF de plusieurs pages : la vignette montre la première ; la fenêtre permet de les parcourir.
- Fichier supprimé sur le serveur entre-temps : « Fichier introuvable » à la place de l'aperçu.
- Même composant d'aperçu pour l'affiche et la feuille de route, réutilisé par US-073.

## Hypothèses

- « Ici mettre un aperçu de la feuille de route » = sur la page Documents, comme pour l'affiche (vignette), et au clic
  une fenêtre modale moyenne (validée en dialogue le 2026-11-13).
- Les boutons « Retirer » et le lien « Ouvrir la feuille de route » aux styles par défaut sont visibles sur la capture
  de recette mais n'étaient pas cités par l'utilisateur ; ils sont corrigés ici (CA-3). À valider.
- Rendu du PDF : lecteur intégré du navigateur dans la fenêtre (`<iframe>`/`<object>`), vignette de la première page produite
  côté navigateur ; aucune bibliothèque payante. Si une bibliothèque de rendu PDF est nécessaire, elle passe par l'ADR
  de l'US (règle 1 : libre et gratuite) et n'est chargée qu'à la demande.
- La fenêtre modale suit les confirmations existantes (`ConfirmationArchivage`) pour le piège du focus.

## Questions bloquantes

Aucune.

## Notes techniques

- Composant « Aperçu de document » partagé (vignette + fenêtre) ; l'affiche reprend la sienne, réduite côté navigateur (US-030).
- Les fichiers sont servis par l'URL d'US-030 / ADR-0022 ; ne pas ajouter de nouveau point d'accès serveur sauf si
  l'affichage en ligne (en-tête `Content-Disposition`) l'exige — à vérifier à l'implémentation.
- Impacte US-030 (CA-2 : « un lien l'ouvre ou le télécharge ») et US-056.

## Suivi

| Date | Événement |
|---|---|
| 2026-11-13 | Créée depuis le retour de recette « Brain Dump » (documents) ; format d'aperçu validé en dialogue |

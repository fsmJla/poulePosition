# US-058 — Organiser la page d'une épreuve par étapes

- **Epic :** E2 — Compétitions
- **Fonctionnalité :** F2 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** Prête
- **Dépend de :** US-054, US-028, US-030, US-031, US-032
- **Branche / PR :** — (renseignés par `/debut-impl-US` et `/fin-impl-US`)

## Récit

**En tant qu'**organisateur, **je veux** que la page d'une épreuve présente ses étapes dans l'ordre du déroulement et
un résumé en cartes, **afin de** savoir où j'en suis et de passer d'une étape à l'autre en un clic.

Maquette : planche 3 « Page d'une épreuve » (`docs/maquettes/ihm/Epreuve.dc.html`), principes 4, 7 et 11, et
« Navigation de l'épreuve » dans `docs/maquettes/README.md`.

## Critères d'acceptation

**CA-1 — Navigation par étapes**
- **Étant donné** la page d'une épreuve, sur un écran large
- **Quand** elle s'affiche
- **Alors** une navigation latérale (« Étapes de l'épreuve ») liste, avec icône et libellé : Résumé, Inscriptions,
  Émargement, Poules, Tableau, Impressions, puis, sous un séparateur, Formule et Paramètres. L'étape ouverte est mise
  en évidence et porte `aria-current="page"`.

**CA-2 — Étapes à venir grisées**
- **Étant donné** une étape qui n'est pas encore livrée (Inscriptions, Émargement, Poules, Tableau, Impressions à la
  date de cette US)
- **Quand** la navigation s'affiche
- **Alors** l'étape est visible, grisée, avec la mention « À venir » ; elle n'est pas un lien, est annoncée comme
  indisponible (`aria-disabled`) et ne reçoit pas d'action. Activer une étape à sa livraison se fait en un seul
  endroit (la liste des étapes).

**CA-3 — Entête de l'épreuve**
- **Étant donné** la page d'une épreuve
- **Quand** elle s'affiche
- **Alors** elle montre le fil d'Ariane complet, le nom court de l'épreuve en titre, la pastille de son statut, puis
  la compétition (avec son carré de couleur), l'arme et la date ; à droite, « Modifier » et un menu « ⋯ ».

**CA-4 — Résumé en cartes**
- **Étant donné** l'étape « Résumé »
- **Quand** elle s'affiche
- **Alors** elle présente des cartes : **Pilote** (« Ce PC est le pilote » et l'état d'envoi, ou « Lecture seule » et
  « Prendre la main », US-029), **Publication** (état, action « Publier » ou « Dépublier », lien public, US-031),
  **Informations** (lieu, appel, scratch, début ; crayon vers la modification), **Formule** (résumé ; crayon vers la
  formule, US-028), **Affiche et feuille de route** (documents joints ou « Joindre », US-030).

**CA-5 — Formule et Paramètres dans la navigation**
- **Étant donné** les pages Formule (US-028) et Paramètres (US-032)
- **Quand** on les ouvre
- **Alors** elles s'affichent dans la même page à étapes, la navigation restant visible ; leurs adresses actuelles
  sont conservées.

**CA-6 — Menu « ⋯ » de l'épreuve**
- **Étant donné** le menu « ⋯ » de l'épreuve
- **Quand** on l'ouvre
- **Alors** il propose les actions existantes à cette date (Dupliquer, US-051 ; Supprimer…, US-057) et accueillera
  Archiver (US-033), Exporter (US-034) à leur livraison.

**CA-7 — Lecture seule**
- **Étant donné** une épreuve dont un autre PC est le pilote
- **Quand** la page s'affiche
- **Alors** les actions de modification sont absentes ou grisées avec « Lecture seule : un autre PC est le pilote »,
  comme aujourd'hui.

## Comportement hors ligne

Comme aujourd'hui : une épreuve pilotée par ce PC s'ouvre et se modifie hors ligne (journal local) ; la carte Pilote
indique que les modifications seront envoyées au retour du réseau ; « Publier », « Prendre la main » et « Joindre »
suivent les règles hors ligne d'US-031, US-029 et US-030. La navigation par étapes s'affiche hors ligne. Les E2E réseau
coupé existants de la page d'épreuve sont adaptés.

## Cas limites et erreurs

- Épreuve inconnue de l'appareil ou supprimée : message et lien vers l'accueil, comme aujourd'hui.
- Épreuve terminée ou archivée : cartes en lecture seule, sans action « Publier ».
- Écran étroit : la navigation latérale devient la barre d'onglets d'US-061 ; tant qu'US-061 n'est pas livrée, elle
  passe au-dessus du contenu en liste défilante.

## Hypothèses

- La liste des étapes (ordre, icône, état « livrée ou non ») est une donnée unique de l'application, que chaque Epic
  met à jour en livrant son étape.
- Le bandeau « Prochaine étape » de la planche 3 est livré par US-064.
- Le compteur à côté d'une étape (nombre d'inscrits…) viendra avec l'Epic de l'étape.

## Questions bloquantes

- Aucune.

## Notes techniques

- `Epreuve.svelte` est restructurée en gabarit à étapes ; les pages Formule et Paramètres s'y insèrent.
- Pas d'impact sur le protocole, le serveur ni le journal.
- US terminées touchées : US-025, US-027, US-028, US-029, US-030, US-031, US-032, US-051.

## Suivi

| Date | Événement |
|---|---|
| 2026-11-11 | Créée d'après la maquette « IHM de l'organisateur » ; étapes à venir grisées (décision du 2026-11-11) |

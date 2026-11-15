# US-070 — Choisir le lieu d'une manifestation par une recherche d'adresse

- **Epic :** E2 — Compétitions
- **Fonctionnalité :** F2 (exigences §3)
- **Priorité :** P2
- **Type :** fonctionnelle
- **Statut :** Terminée
- **Dépend de :** US-023, US-047
- **Branche / PR :** `us/US-070-rechercher-adresse-du-lieu`

## Récit

**En tant qu'**organisateur, **je veux** taper quelques lettres du lieu et choisir une vraie adresse dans une liste de
suggestions, **afin d'**éviter les fautes de saisie et d'obtenir une adresse exacte (et ses coordonnées) pour afficher
un plan (US-071).

Maquette : les champs « Lieu » du formulaire de manifestation (US-023) et de l'étape « Manifestation » de l'assistant
(US-047) ; pas de planche pour la liste de suggestions (Hypothèses). Vocabulaire d'icônes : « Repère de carte » (Lieu).

## Critères d'acceptation

**CA-1 — Suggestions en tapant**
- **Étant donné** le champ « Lieu » d'une manifestation, en ligne
- **Quand** l'organisateur tape au moins 3 caractères (« salle bellegrave pessac »)
- **Alors** après une courte pause de frappe, une liste d'au plus 5 adresses s'affiche sous le champ (libellé complet : numéro,
  rue, code postal, commune) ; une indication « Recherche… » est visible pendant la requête.

**CA-2 — Choisir une adresse**
- **Étant donné** la liste de suggestions
- **Quand** l'organisateur en choisit une (clic, ou flèches puis Entrée)
- **Alors** le champ prend son libellé, et l'adresse est mémorisée avec ses coordonnées (latitude, longitude) dans la manifestation.

**CA-3 — Garder un nom libre**
- **Étant donné** un lieu qui n'est pas une adresse (« Gymnase du club »)
- **Quand** l'organisateur ne choisit aucune suggestion
- **Alors** le texte saisi est enregistré tel quel, sans coordonnées, sans bloquer l'enregistrement ; il peut combiner un
  nom et l'adresse choisie (« Salle Bellegrave — 12 rue … »), et le nom reste visible dans la liste (US-055).

**CA-4 — Modifier le lieu**
- **Étant donné** une manifestation dont le lieu a des coordonnées
- **Quand** l'organisateur modifie le texte à la main
- **Alors** les coordonnées sont retirées (le lieu ne correspond plus à l'adresse choisie) jusqu'à un nouveau choix ; le texte de 200 caractères au plus reste la règle d'US-023.

**CA-5 — Aucun résultat, erreur du service**
- **Étant donné** une recherche sans résultat, ou un service qui échoue ou dépasse 5 s
- **Quand** la liste devrait s'afficher
- **Alors** un message discret l'indique (« Aucune adresse trouvée » / « Recherche d'adresse indisponible : saisissez le lieu à la main ») ;
  la saisie libre continue de fonctionner (CA-3).

**CA-6 — Accessible**
- **Étant donné** le champ de recherche
- **Quand** il est utilisé au clavier ou au lecteur d'écran
- **Alors** c'est un champ à liste de suggestions (`combobox`) : les résultats sont annoncés, naviguables aux flèches, fermés par Échap.

## Comportement hors ligne

La recherche d'adresse n'existe qu'en ligne : hors ligne, le champ « Lieu » reste un champ texte libre (CA-3), avec la
mention « Suggestions d'adresses disponibles en ligne ». La saisie, l'enregistrement local et la synchronisation ne sont
jamais bloqués. Un lieu saisi hors ligne n'a pas de coordonnées ; il pourra en recevoir à une modification ultérieure en ligne.

## Cas limites et erreurs

- Frappe rapide : seule la dernière requête compte (les réponses périmées sont ignorées) ; au plus une requête par pause de frappe, pour respecter le quota du service.
- Quota du service dépassé (HTTP 429) : même message que l'erreur (CA-5), sans nouvelle requête pendant quelques secondes.
- Adresse hors de France : non proposée par le service retenu ; saisie libre (Hypothèses).
- Lieu des compétitions et des épreuves (US-024, US-045) : ils reprennent le lieu de la manifestation (texte) ; seule la
  manifestation a le sélecteur (Hypothèses).

## Hypothèses

- **Fournisseur retenu (dialogue du 2026-11-13) :** l'**API Adresse** de data.gouv.fr (Base Adresse Nationale), gratuite,
  sans clé ni compte, appelée directement depuis le navigateur. Google Maps est exclu (ADR-0013, règle « gratuit uniquement »).
- **Limite assumée :** France uniquement. Un lieu à l'étranger se saisit à la main (CA-3).
- **ADR nécessaire avant l'implémentation (`/adr`)** : nouveau service externe (règle 1) ; elle documente URL, quota
  (à relever au moment de l'ADR), conditions d'usage, comportement hors ligne et mise à jour de la politique
  `connect-src` (CSP) de l'application. Elle complète l'ADR-0013 (qui ne couvre que les tuiles).
- Données personnelles (ADR-0014) : seul le texte de la recherche part vers le service, sans `clubId` ni identité ; le
  lieu d'une manifestation est une donnée publique, pas personnelle.
- La liste de suggestions n'a pas de planche : elle suit le style des menus déroulants existants (recherche de l'entête,
  US-062 : liste sous le champ, `combobox`). À valider à la recette.
- Seule la manifestation reçoit le sélecteur d'adresse, car c'est le « lieu » du retour de recette. À valider : faut-il l'étendre aux compétitions et épreuves ?

- **Écart au fournisseur validé (2026-11-15) :** l'« API Adresse » de `api-adresse.data.gouv.fr` a été transférée à l'IGN. L'implémentation utilise son successeur officiel, le géocodage de la Géoplateforme (`data.geopf.fr/geocodage`), même service, mêmes données, gratuit et sans clé : [ADR-0025](../adr/0025-recherche-adresse-geoplateforme.md), **proposée, à valider**.
- Le lieu reste un texte ; les coordonnées sont un champ facultatif `coordonnees` (rétrocompatible), plutôt qu'une valeur structurée qui aurait cassé la lecture de l'existant.
- Les suggestions s'affichent sous le champ, dans le flux de la page (elles ne masquent pas « Suivant »). Le champ est dans l'assistant (étape 1) et le formulaire de modification de la manifestation.
- Les E2E du niveau « interface » interceptent le service ; la garde de Chromium refuse `data.geopf.fr`.

## Questions bloquantes

Aucune.

## Notes techniques

- Le lieu devient une valeur structurée : `{ texte: string, coordonnees?: { lat, lon } }` ; un lieu historique en texte
  simple reste valide (lecture rétrocompatible). Évolution du schéma des événements de manifestation dans
  `paquets/protocole` et de la projection ; **le serveur ne décide rien** (règle 3). Les coordonnées sont validées
  (bornes, nombres finis) dans le domaine.
- Un module pur de requête / d'interprétation de la réponse dans `app/src/lib/` (testé en unitaire avec des réponses
  simulées) ; aucun appel réseau réel en test (E2E sur réponse interceptée).
- Une ADR à rédiger d'abord (voir Hypothèses) ; l'ADR-0013 sera mentionnée comme complétée, pas modifiée.
- Impacte US-023, US-047 (champ lieu), US-055 (affichage du lieu dans la liste : texte seul).

## Suivi

| Date | Événement |
|---|---|
| 2026-11-13 | Créée depuis le retour de recette « Brain Dump » ; fournisseur validé en dialogue |
| 2026-11-15 | ADR-0025 rédigée (successeur de l'API Adresse). Implémentée : `ChampLieu`, `lib/adresse.ts`, champ `coordonnees` (domaine, protocole), tests unitaires et `adresse-lieu.spec.ts`. En revue |
| 2026-11-15 | Recette OK en local (capture : suggestions sous le champ, 1 000 px), CI verte sur la PR #109. ADR-0025 reste à valider. Terminée |

# US-129 — Reprendre l'épreuve après un plantage, sur l'écran quitté

- **Epic :** E8 — Hors ligne et resynchronisation
- **Fonctionnalité :** F12 (exigences §1, « Application robuste », et §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** Prête
- **Dépend de :** US-021, US-005, US-058, US-094
- **Branche / PR :** — (renseignés par `/debut-impl-US` et `/fin-impl-US`)

## Récit

**En tant qu'**organisateur, **je veux** qu'après un plantage, une fermeture du navigateur ou un redémarrage du PC,
même sans internet, l'application rouvre l'épreuve à l'étape où j'en étais, sans rien perdre de ce que j'avais validé,
**afin de** continuer la compétition aussitôt (exigences §1 : « en cas de plantage ou de perte de connexion, il faut
impérativement pouvoir continuer la compétition »).

Maquette : sans objet. L'US n'ajoute aucun écran : elle rouvre un écran existant (page de l'épreuve et ses étapes,
planches 3 et 8 à 11, 19 et 20). Le message du CA-4 reprend la zone de statut sous l'entête (principe des messages).

## Critères d'acceptation

**CA-1 — Rien de validé n'est perdu**
- **Étant donné** le PC pilote d'une épreuve, **hors ligne**, qui vient de valider un score de poule
- **Quand** l'onglet est fermé brutalement (ou le navigateur tué) aussitôt après la validation, puis rouvert sans réseau
- **Alors** le score est présent, le classement le prend en compte et il est compté dans « n modifications en attente
  d'envoi ».

**CA-2 — Réouverture sur l'écran quitté**
- **Étant donné** l'organisateur sur une étape d'une épreuve qu'il pilote (inscriptions, émargement, poules, tableau,
  impressions…) avec une session valide sur ce PC
- **Quand** il ferme l'application puis la rouvre à son adresse d'accueil, en ligne ou hors ligne
- **Alors** elle s'ouvre directement sur cette épreuve et cette étape, avec le fil d'Ariane complet.

**CA-3 — Réouverture après une nouvelle connexion**
- **Étant donné** une réouverture où la session n'est plus ouverte (déconnexion, session expirée) sur un appareil connu
- **Quand** l'organisateur se reconnecte, en ligne ou hors ligne (US-005)
- **Alors** il arrive sur l'épreuve et l'étape quittées, et non sur l'accueil.

**CA-4 — L'écran quitté n'est plus disponible**
- **Étant donné** que l'épreuve quittée a été supprimée, n'est plus sur cet appareil, ou que ce PC n'en est plus le
  pilote (prise de main par un autre PC entre-temps)
- **Quand** l'application est rouverte
- **Alors** elle ouvre l'accueil (épreuve absente) ou l'épreuve en lecture seule avec son message actuel (US-029),
  sans erreur.

**CA-5 — Envoi au retour du réseau**
- **Étant donné** des modifications faites hors ligne avant le plantage
- **Quand** l'application est rouverte puis le réseau revient
- **Alors** elles partent au serveur comme sans plantage (US-022, US-094) et le compteur revient à zéro.

**CA-6 — Seulement le PC pilote**
- **Étant donné** un appareil qui n'est pilote d'aucune épreuve ouverte (accueil, page de manifestation, smartphone
  d'arbitre ou de tireur)
- **Quand** l'application est rouverte à son adresse d'accueil
- **Alors** le comportement est inchangé : accueil pour l'organisateur ; les smartphones rouvrent leur lien QR comme
  aujourd'hui.

## Comportement hors ligne

C'est le cas principal : l'application se relance depuis le cache de la PWA, la session locale (US-005) ou celle
déjà ouverte est reprise, l'épreuve se relit depuis le journal local (IndexedDB) et l'écran quitté s'affiche. La
pastille « Hors ligne : la compétition continue sur ce PC » s'affiche comme d'habitude. Testé en E2E avec
`context.setOffline(true)` puis rechargement et réouverture d'une page.

## Cas limites et erreurs

- Plantage pendant la frappe d'un score non validé (afficheur et pavé ouverts) : la frappe en cours est perdue,
  le score n'a jamais été inscrit au journal ; le match reste à saisir.
- Plusieurs onglets ouverts sur des épreuves différentes : l'écran retenu est le **dernier** consulté.
- Adresse précise ouverte directement (lien, favori) : elle prime sur l'écran mémorisé.
- Fenêtre d'impression ouverte au moment du plantage : on rouvre l'étape « Impressions », pas l'aperçu.
- Épreuve terminée : on rouvre son classement final, comme n'importe quelle étape.
- Stockage local effacé par l'utilisateur : rien n'est mémorisé, l'accueil s'ouvre.

## Hypothèses

- L'écran mémorisé est **par appareil** (stockage local du navigateur), pas par compte : sur un PC partagé, le
  compte suivant ne rouvre une épreuve que s'il peut y accéder (même club).
- La réouverture ne vaut que pour l'**épreuve pilotée** : l'accueil, les pages de manifestation et de compétition
  ne sont pas mémorisés (l'accueil s'ouvre déjà par défaut).
- Seul ce qui est **validé** (inscrit au journal) survit à un plantage ; aucun brouillon n'est sauvegardé.

## Questions bloquantes

- Aucune.

## Notes techniques

- Mémoriser la route courante (`#/epreuve/<id>/<etape>`) quand une page d'épreuve pilotée s'affiche ; la lire au
  démarrage d'`App.svelte` quand l'adresse est celle de l'accueil, après la restauration de la session.
- CA-1 vérifie que l'événement est écrit dans IndexedDB **avant** que l'écran le montre comme enregistré (US-021) ;
  si ce n'est pas le cas aujourd'hui, c'est la correction à faire.
- Impacts : US-001 (démarrage de l'application), US-005 (redirection après la connexion hors ligne), US-029 (lecture
  seule après une prise de main).

## Suivi

| Date | Événement |
|---|---|
| 2026-11-21 | Créée (spécification de l'Epic 8) |

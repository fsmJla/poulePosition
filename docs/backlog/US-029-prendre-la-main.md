# US-029 — Prendre la main sur une compétition depuis un autre PC

- **Epic :** E2 — Compétitions
- **Fonctionnalité :** F2, F12 (exigences §3)
- **Priorité :** P1
- **Type :** fonctionnelle
- **Statut :** Terminée
- **Dépend de :** US-022
- **Branche / PR :** `us/US-029-prendre-la-main`

## Récit

**En tant qu'**organisateur sur un PC qui n'est pas le pilote d'une compétition, **je veux** en prendre la main,
**afin de** la modifier moi-même ou de la reprendre si le PC pilote tombe en panne le jour J.

## Critères d'acceptation

**CA-1 — Prendre la main**
- **Étant donné** une compétition ouverte en lecture seule sur un PC en ligne
- **Quand** l'organisateur choisit « Prendre la main » et confirme
- **Alors** le serveur désigne ce PC comme pilote, qui récupère le journal complet du serveur et devient
  modifiable ; l'événement `PiloteChange` est inscrit au journal (ancien et nouveau PC, auteur).

**CA-2 — L'ancien pilote passe en lecture seule**
- **Étant donné** l'ancien PC pilote en ligne
- **Quand** la main est prise
- **Alors** il passe aussitôt en lecture seule avec « <nom> a pris la main depuis un autre PC ».

**CA-3 — Événements non envoyés de l'ancien pilote**
- **Étant donné** un ancien pilote qui avait des événements pas encore envoyés (il était hors ligne)
- **Quand** il revient en ligne après la prise de main
- **Alors** ses événements sont refusés par le serveur (`PAS_PILOTE`), il en est averti
  (« n modifications faites hors ligne n'ont pas été reprises ») et peut les exporter en JSON pour les consulter.

**CA-4 — Avertissement si le pilote est connecté**
- **Étant donné** un pilote actuellement connecté au serveur
- **Quand** un autre PC demande à prendre la main
- **Alors** la confirmation l'indique (« Le PC de <nom> est connecté et pilote cette compétition ») avant de
  continuer.

**CA-5 — Plusieurs compétitions par PC**
- **Étant donné** un PC qui pilote déjà une compétition
- **Quand** il prend la main sur une deuxième
- **Alors** il pilote les deux.

## Comportement hors ligne

Prendre la main exige le réseau (bouton grisé avec « Nécessite une connexion internet ») : c'est le serveur qui
attribue le pilotage. Un PC pilote qui perd le réseau garde la main et continue seul. Si son pilotage a été repris
entre-temps, CA-3 s'applique.

## Cas limites et erreurs

- Deux PC demandent la main en même temps : le serveur n'en retient qu'un, l'autre reçoit « La main vient d'être
  prise par <nom> ».
- Reprise sans réseau sur un PC de secours : par import du fichier de sauvegarde (US-035).

## Hypothèses

- Tout organisateur du club peut prendre la main, sans accord de l'ancien pilote (cas de la panne).
- Le PC est identifié par un identifiant d'appareil gardé dans IndexedDB, associé au compte connecté.

- Présence du pilote par battements HTTP toutes les 30 s (60 s sans signe = déconnecté), en attendant la WebSocket du
  pilote (E5) : l'ancien pilote passe en lecture seule 30 s au plus après la prise de main, pas instantanément
  (décision de l'utilisateur, 2026-11-03 ; ADR-0017).
- Le nom du pilote affiché est celui du compte suivi du début de l'identifiant de l'appareil : « Julien Lameyre
  (appareil 7f3a) », ce qui distingue deux PC d'un même compte (décision de l'utilisateur, 2026-11-03).
- Une compétition terminée ou archivée peut changer de pilote : prendre la main ne modifie pas son contenu.
- L'export JSON des modifications écartées contient les événements au format du journal ; sa réimportation relève
  d'US-035.
- Les battements ne concernent que les compétitions en préparation ou en cours.

## Questions bloquantes

- Aucune.

## Notes techniques

- ADR-0001 (bail du pilote, reprise explicite), ADR-0005. Détails dans l'ADR-0016 (voir US-022).

## Suivi

| Date | Événement |
|---|---|
| 2026-10-28 | Créée |
| 2026-11-03 | Plan validé ; en cours sur `us/US-029-prendre-la-main` |
| 2026-11-03 | Implémentée (`PiloteChange`, prise de main, présence, modifications écartées, ADR-0017) ; en revue (PR #50) |
| 2026-11-04 | Recette OK sur https://poule-position-git-us-us-029-prendre-la-main-fsmjlas-projects.vercel.app (deux PC simulés : CA-1 prise de main, CA-2 bascule de l'ancien pilote en 14 s, CA-3 modification hors ligne écartée et exportée, CA-4 avertissement « pilote connecté », CA-5 deux compétitions pilotées, bouton grisé hors ligne) ; déployée en preview et vérifiée ; mergée dans `dev` |
| 2026-11-08 | Impactée par US-044 (vocabulaire inversé : la compétition regroupe, l'épreuve se tire) |

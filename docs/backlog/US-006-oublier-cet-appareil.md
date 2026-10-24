# US-006 — Oublier cet appareil

- **Epic :** E1 — Comptes et authentification
- **Fonctionnalité :** F1 (exigences §3)
- **Priorité :** P2
- **Type :** fonctionnelle
- **Statut :** Prête
- **Dépend de :** US-005
- **Branche / PR :** —

## Récit

**En tant qu'**organisateur qui s'est connecté sur un PC qui n'est pas le sien, **je veux** effacer toute trace de
mon compte sur cet appareil **afin que** personne ne puisse s'y reconnecter à ma place.

## Critères d'acceptation

**CA-1 — Effacement de son compte**
- **Étant donné** un compte connecté sur l'appareil
- **Quand** je choisis « Se déconnecter et oublier cet appareil » et que je confirme
- **Alors** ma session et mon vérificateur local sont effacés, et une reconnexion hors ligne avec mon compte est
  ensuite refusée sur cet appareil (US-005, CA-3).

**CA-2 — Les autres comptes ne sont pas touchés**
- **Étant donné** deux comptes connus de l'appareil
- **Quand** l'un d'eux utilise « oublier cet appareil »
- **Alors** l'autre peut toujours se reconnecter hors ligne.

**CA-3 — Données de compétition conservées**
- **Étant donné** des compétitions stockées sur l'appareil
- **Quand** j'oublie l'appareil
- **Alors** les compétitions locales ne sont pas effacées. L'avertissement de confirmation le précise.

## Comportement hors ligne

Fonctionne hors ligne : l'effacement est purement local.

## Cas limites et erreurs

- Annulation de la confirmation : rien n'est effacé.

## Hypothèses

- L'effacement des compétitions locales relève d'une autre fonction (purge, E11).

## Questions bloquantes

- Aucune.

## Notes techniques

ADR-0006 (mesure de réduction du risque « appareil volé »).

## Suivi

| Date | Événement |
|---|---|
| 2026-10-25 | Créée (spécification E1) |

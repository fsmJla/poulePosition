# ADR-0013 — Intégrations externes : e-mail et carte

- **Statut :** Acceptée (2026-10-24) ; partie « E-mail » remplacée par [ADR-0015](0015-envoi-emails-smtp-ovh.md) le 2026-10-27, partie « Carte » en vigueur
- **Date :** 2026-10-24

## Contexte

Les exigences §5 mentionnent les e-mails « si un plan gratuit est possible » et une carte de localisation
(F18, P3). Aucun de ces besoins n'est P1 : le mot de passe oublié est couvert par l'administrateur
(ADR-0006).

## Décision

### E-mail : différé, Resend pressenti

- **Aucun e-mail en P1.** Quand le besoin arrivera (mot de passe oublié, convocations), le fournisseur
  pressenti est **Resend**, appelé depuis le Worker par API HTTP, avec la clé en secret Wrangler.
- **Nom de domaine** : un domaine d'envoi vérifié (SPF/DKIM) sera nécessaire pour écrire à n'importe quel
  destinataire. Le club dispose de `pessac-escrime.fr`, à confirmer. Point à vérifier au moment de
  l'intégration : sans domaine vérifié, Resend ne permet d'envoyer qu'à sa propre adresse. C'est son
  comportement connu, non confirmé par la page consultée.

| Fournisseur | Plan gratuit (vérifié le 2026-10-24) | Remarque |
|---|---|---|
| **Resend** | 100 e-mails / jour, 3 000 / mois, 3 domaines vérifiés, 10 requêtes / s ; au-delà, l'envoi est suspendu sans facturation | API simple, adaptée au Worker |
| Brevo | 300 e-mails / jour (sources tierces), mention Brevo dans les e-mails | Alternative si Resend ne convient pas |

Sources : <https://resend.com/docs/knowledge-base/resend-sending-limits>, revues Brevo 2026, par exemple
<https://dreamlit.ai/blog/brevo-review>.

### Carte : Leaflet + tuiles OpenStreetMap (P3)

- La carte est affichée sur la page publique d'une compétition, avec **Leaflet** et les tuiles
  `tile.openstreetmap.org`, et un lien « Itinéraire » vers l'application de cartographie du téléphone.
- **Politique d'usage des tuiles OSM** (<https://operations.osmfoundation.org/policies/tiles/>) : il faut
  une attribution visible « © OpenStreetMap contributors », le Referer envoyé et le cache respecté. Le
  préchargement « hors ligne » de zones est **interdit**. Il n'y a aucune garantie de service, l'accès
  peut être coupé sans préavis.
- Hors ligne, la carte n'est pas disponible, mais l'adresse reste affichée en texte. C'est conforme à « les
  fonctionnalités nécessitant une connexion sont inaccessibles ».

## Alternatives écartées

| Alternative | Pourquoi écartée |
|---|---|
| Google Maps API | Elle exige un compte de facturation avec carte bancaire. |
| Mapbox / MapTiler gratuits | Ils exigent une clé et un compte, avec des quotas. OSM suffit pour une carte par compétition. Ce serait le plan B si l'accès OSM était refusé. |
| Envoi d'e-mails par SMTP Gmail | Fragile, avec des conditions d'usage floues pour une application. |

## Conséquences

- ➕ Il n'y a aucune dépendance externe en P1.
- ➖ Le jour où les e-mails seront intégrés, il faudra gérer DNS, domaine et réputation d'envoi.

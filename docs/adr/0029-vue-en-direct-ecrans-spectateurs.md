# ADR-0029 — Vue en direct : publication par le pilote, lecture par les spectateurs et les écrans géants

- **Statut :** Acceptée (2026-11-21)
- **Date :** 2026-11-21
- **Complète :** ADR-0005 (vues publiées par le pilote), ADR-0007 (lien public des spectateurs), ADR-0010 (écran
  géant) et ADR-0028 (WebSocket du pilote par ticket).

## Contexte

L'Epic 9 affiche l'épreuve en direct sur des écrans géants (F13, P1) et sur les smartphones des spectateurs (F14, P2),
moins de 2 s après chaque score (exigences §6). Les décisions de l'utilisateur, prises le 2026-11-21 :

- un écran géant est réglé sur la page d'une **manifestation**. On y coche les épreuves à afficher (de plusieurs
  compétitions), la durée d'une page et les vues masquées ;
- un écran s'ouvre par un **lien secret propre à l'écran**, régénérable, qui affiche les épreuves cochées **qu'elles
  soient publiées ou non**. Les spectateurs, eux, ne voient que les épreuves publiées (ADR-0007) ;
- l'organisateur peut **imposer une vue** à un écran depuis son PC ;
- la **fenêtre locale** de l'écran, ouverte sur le PC pilote, doit marcher sans internet (ADR-0010) ;
- le réglage « Prénom N. » (US-032) s'applique à tout affichage public.

Aujourd'hui, le pilote ne publie que la **vue de saisie** (US-095), réservée aux smartphones porteurs d'un QR. Elle
contient des droits et des identifiants d'appareil. Le serveur ne calcule rien (ADR-0001).

## Décision

### 1. La vue en direct est calculée par le pilote

- `paquets/domaine` calcule une `VueDirect` à partir du journal : l'étape, les poules (piste, tireurs, scores), le
  classement provisoire ou définitif, le tableau, les matchs appelés par piste avec leur heure (US-112) et le podium.
  Les noms y sont déjà mis en forme selon « Prénom N. ». Elle ne contient ni émargement, ni licence, ni classement
  fédéral, ni droit, ni identifiant d'appareil. Elle porte aussi le statut de publication de l'épreuve.
- Le pilote la publie sur **sa WebSocket existante** (ADR-0028), avec un message `vueDirect`, à chaque écriture qui la
  change. Une vue identique n'est pas renvoyée.
- Le DO `Epreuve` garde **la dernière vue** (une ligne SQLite remplacée) et son heure de publication. Il la diffuse
  telle quelle à ses lecteurs. Taille visée : moins de 256 Ko, la limite de messages fixée par l'ADR-0004. Une épreuve de
  200 tireurs fait quelques dizaines de Ko.

### 2. Deux sortes de lecteurs, sur une même WebSocket de lecture du DO `Epreuve`

| Lecteur | Ouverture | Condition |
|---|---|---|
| **Spectateur** | `…/epreuves/<id>/direct`, sans authentification | L'épreuve est publiée, d'après la dernière vue. À la dépublication, le DO ferme les sockets des spectateurs avec le code `4005` (« épreuve non publiée »). |
| **Écran** | `…/epreuves/<id>/direct?ticket=<ticket>` | Un ticket d'écran valide (§3) qui contient cette épreuve, publiée ou non. |

- À l'ouverture, le lecteur reçoit aussitôt la dernière vue, puis chaque nouvelle. Le DO diffuse aussi `pilote-absent`
  et `pilote-present` (ADR-0005) : le lecteur garde la dernière vue avec son heure (« Dernière mise à jour : 14 h 32 »).
- Les sockets sont en **hibernation**, et les `ping` reçoivent une réponse automatique.
- Garde-fou : **300 lecteurs** au plus par épreuve (ADR-0004). Au-delà, la connexion est refusée avec
  `TROP_DE_CONNEXIONS`.

### 3. Les écrans sont gardés dans le DO `Club`, avec un lien secret et un ticket court

- Le DO `Club` garde les écrans : identifiant, manifestation, nom, épreuves cochées, durée d'une page, vues masquées,
  vue imposée et son échéance, jeton. Ce sont des **réglages d'affichage**, pas une donnée d'escrime : ils ne vont pas
  dans le journal d'une épreuve et ne passent pas par le pilote. Tout organisateur du club les gère en HTTP avec sa
  session (US-133).
- Le **jeton** d'un écran est tiré par le serveur (128 bits) et gardé en clair dans le DO `Club`, lisible seulement avec
  une session du club, pour réafficher le lien. Le lien est `…/ecran/<ecranId>#<jeton>` : le jeton est dans le
  fragment, jamais envoyé dans une adresse au serveur (comme les QR, US-097). « Régénérer » remplace le jeton et ferme
  les sockets de l'écran.
- L'écran échange son jeton contre un **ticket de 60 s** (`POST /ecrans/<id>/ticket`, jeton dans le corps), signé avec
  `SECRET_SESSION` comme celui du pilote (ADR-0028). Le ticket porte le club, l'écran et la liste de ses épreuves. Un
  jeton faux compte pour le limiteur par IP.
- L'écran ouvre **une socket de contrôle** sur le DO `Club` (`…/ecrans/<id>/connexion?ticket=…`). Elle lui apporte ses
  réglages, leurs changements et les vues imposées (US-135), et elle dit à l'organisateur si l'écran est « connecté ».
  Il ouvre aussi **une socket de lecture par épreuve cochée** (§2).
- Les PC du club gardent **une copie des écrans** de leurs manifestations. Elle sert à les lister hors ligne et à
  ouvrir la fenêtre locale sans réseau.

### 4. La fenêtre locale passe par `BroadcastChannel`

La fenêtre locale (US-136) reçoit la `VueDirect` des épreuves pilotées par ce PC par `BroadcastChannel`, sans réseau,
comme le prévoit l'ADR-0010. Une vue imposée depuis ce PC lui parvient de la même façon. Les épreuves pilotées ailleurs
lui viennent du serveur quand le PC est en ligne.

## Limites du plan gratuit (Cloudflare Workers Free, vérifiées le 2026-11-21)

Sources : https://developers.cloudflare.com/durable-objects/platform/pricing/ et
https://developers.cloudflare.com/durable-objects/platform/limits/ (pages mises à jour le 2026-11-13).

| Limite | Valeur | Effet ici |
|---|---|---|
| Requêtes DO et Workers | 100 000 / jour, remise à zéro à 00:00 UTC ; ouvrir une WebSocket compte 1 requête | 150 spectateurs et 3 écrans, avec quelques reconnexions chacun : moins de 1 000 requêtes |
| Messages WebSocket | entrants comptés **20 pour 1** ; **sortants gratuits** ; pings protocolaires gratuits | La diffusion d'une vue à 300 lecteurs ne coûte rien. Le pilote publie environ 1 500 vues par jour, soit 75 requêtes. |
| Durée DO | 13 000 Go·s / jour ; rien pendant l'hibernation ; réponses automatiques aux pings non comptées | Les lecteurs n'envoient rien : le DO dort entre deux publications |
| SQLite | 100 000 lignes écrites et 5 M lignes lues par jour ; 5 Go par compte | Une ligne écrite par vue publiée (environ 1 500 par jour) ; les écrans écrivent seulement à leurs changements de réglage |
| Débit d'un objet | limite souple de 1 000 requêtes par seconde | Très au-dessus des besoins |
| Taille d'un message | 32 Mio en réception | Vues de quelques dizaines de Ko |
| Connexions par objet | **non précisé** par la documentation | Garde-fou à 300 lecteurs (§2). Le test de charge, lancé manuellement avec l'utilisateur, le confirmera. |
| Stockage par objet (gratuit) | **à vérifier** : la page des limites dit 10 Go dans son tableau et 1 Go dans sa FAQ | Sans effet : une vue fait quelques dizaines de Ko |

Aucun service nouveau, aucun moyen de paiement. La consommation se suit avec `/quotas`.

## Alternatives écartées

| Alternative | Pourquoi écartée |
|---|---|
| Lecteurs en HTTP par interrogation régulière (toutes les 5 s) | 150 lecteurs sur dix heures feraient environ 1 million de requêtes par jour, dix fois le quota, et le délai de 2 s ne serait pas tenu. |
| Server-Sent Events | Pas d'hibernation : le DO resterait actif, donc facturé en durée, tant qu'un lecteur est connecté. |
| Une seule socket d'écran sur le DO `Club`, qui relaie les vues des épreuves | Chaque vue relayée d'un DO à l'autre coûterait une requête ; le DO `Club` deviendrait un goulet. |
| Réutiliser la vue de saisie pour le public | Elle porte des droits et des identifiants d'appareil, et ne suit pas « Prénom N. ». |
| Jeton d'écran dans l'adresse de la socket | Un jeton valable toute la manifestation finirait dans les journaux. Le ticket de 60 s suit l'ADR-0028. |
| Écrans dans le journal de chaque épreuve | Un écran mêle plusieurs épreuves, pilotées par des PC différents, et se règle depuis n'importe quel PC : ce n'est pas une donnée d'une épreuve. |
| Le pilote calcule les vues par écran | Le pilote d'une épreuve ne connaît pas les autres épreuves de l'écran ; l'écran assemble lui-même ses pages. |

## Conséquences

- ➕ Score saisi au PC → vue publiée → diffusion : un seul aller-retour, sans calcul au serveur, compatible avec les 2 s.
- ➕ Le coût ne dépend presque pas du nombre de lecteurs, puisque les messages sortants sont gratuits et que le DO
  hiberne.
- ➕ Les épreuves non publiées peuvent passer sur l'écran de la salle sans être visibles du public.
- ➖ Un écran de N épreuves ouvre N + 1 sockets. C'est acceptable : quelques écrans par salle.
- ➖ Le lien d'un écran donne accès à des épreuves non publiées tant qu'il n'est pas régénéré. C'est le choix retenu :
  l'organisateur le garde pour la TV de la salle.
- ➖ Le code de fermeture `4005` s'ajoute à la liste du protocole (`docs/protocole.md`).

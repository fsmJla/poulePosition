# ADR-0006 — Authentification (comptes, hors ligne, mot de passe oublié)

- **Statut :** Acceptée (2026-10-24)
- **Date :** 2026-10-24

## Contexte

Il y a une dizaine de comptes (administrateurs, organisateurs) et un système « robuste ». Il faut pouvoir
s'authentifier sans internet. Décision du 2026-10-24 : la connexion hors ligne est autorisée **sur un
appareil déjà identifié en ligne auparavant**, y compris après une déconnexion, grâce à un mot de passe
vérifiable localement. Le mot de passe oublié est souhaité « si possible et gratuit ». Les arbitres,
tireurs et spectateurs n'ont pas de compte (ADR-0007).

## Décision

### Comptes et connexion en ligne

- Les comptes sont stockés dans le DO `Club` : identifiant, nom, rôle (`administrateur` / `organisateur`),
  sel, vérificateur, date de modification, état actif.
- **Hachage côté client, vérification légère côté serveur** : le Worker gratuit est limité à 10 ms de CPU
  par requête, ce qui interdit un hachage lent côté serveur.
  1. Le client récupère le sel du compte.
  2. Il calcule `K = PBKDF2-SHA256(mot de passe, sel, 600 000 itérations)` avec WebCrypto (~0,3 s sur un PC).
  3. Le serveur compare `HMAC-SHA256(K, poivre)` au vérificateur stocké. Le poivre est un secret Wrangler,
     ce qui coûte quelques microsecondes.
  4. Le serveur renvoie une **session** : un jeton signé HMAC (format JWT) valable 30 jours, renouvelé à
     chaque passage en ligne, avec le rôle et l'identifiant de club.
- Après 5 échecs, le compte est bloqué de façon progressive (limiteur par compte et par IP).

### Connexion hors ligne

- À chaque connexion en ligne réussie, l'appareil enregistre dans IndexedDB le sel et un **vérificateur
  local** `HMAC-SHA256(K, "local")`. Ce vérificateur est distinct du vérificateur serveur, donc une fuite
  de l'un ne compromet pas l'autre.
- Hors ligne, l'utilisateur saisit son mot de passe et l'appareil recalcule `K` puis compare. En cas de
  succès, il ouvre une session locale qui permet d'agir sur les compétitions dont l'appareil est pilote.
- Hors ligne, une première connexion sur un appareil inconnu est impossible. C'est la limite acceptée.
- Au retour en ligne, la session est revalidée auprès du serveur. Un compte désactivé ou un mot de passe
  changé entre-temps invalide la session locale.

### Mot de passe oublié

- **P1 : réinitialisation par un administrateur**, qui génère un mot de passe temporaire à changer à la
  première connexion. Avec 10 comptes, c'est suffisant et sans dépendance.
- **Plus tard** : un lien par e-mail, si un fournisseur gratuit est retenu (ADR-0013).

## Alternatives écartées

| Alternative | Pourquoi écartée |
|---|---|
| Fournisseur d'identité (Clerk, Auth0, Supabase Auth, Firebase Auth) | Aucun ne permet une reconnexion hors ligne après déconnexion. Il ajoute un service, des quotas et des conditions. C'est surdimensionné pour 10 comptes. |
| Cloudflare Access (gratuit jusqu'à 50 utilisateurs) | Il protège des URL, pas une PWA hors ligne. Il n'y a pas de rôles applicatifs. |
| Hachage lent côté serveur (PBKDF2 / Argon2 dans le Worker) | Il dépasse les 10 ms de CPU du plan gratuit. |
| Passkeys (WebAuthn) | Ils sont modernes et robustes, mais la vérification hors ligne et la récupération sur un PC partagé de club sont plus complexes. On pourra les ajouter plus tard comme second moyen. |
| Session persistante seule, sans mot de passe local | Ce n'est pas le choix retenu : une déconnexion hors ligne bloquerait l'organisateur. |

## Conséquences

- ➕ Aucun service tiers et aucun coût. La connexion fonctionne hors ligne sur les appareils connus.
- ➕ Le serveur ne voit jamais le mot de passe en clair et ne stocke qu'un vérificateur poivré.
- ➖ Un appareil volé contient un vérificateur local attaquable hors ligne. Les 600 000 itérations PBKDF2
  freinent cette attaque. La fonction « Oublier cet appareil » et un mot de passe de 10 caractères minimum
  la limitent davantage.
- ➖ Une révocation ne prend effet sur un appareil hors ligne qu'à son retour en ligne.
- ➖ C'est du code de sécurité maison. Il sera concentré dans un module court, testé et relu, à partir de
  primitives WebCrypto standard uniquement.

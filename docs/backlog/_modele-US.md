# US-XXX — Titre court à l'infinitif

- **Epic :** EX — …
- **Fonctionnalité :** FX (exigences §3)
- **Priorité :** P1 / P2 / P3
- **Type :** fonctionnelle / technique / correction
- **Statut :** À spécifier
- **Dépend de :** US-…, ou —
- **Branche / PR :** — (renseignés par `/debut-impl-US` et `/fin-impl-US`)

## Récit

**En tant que** <rôle>, **je veux** <action> **afin de** <bénéfice>.

Maquette : <planche et fichier de `docs/maquettes/`, principes concernés>, ou « sans objet » si l'US ne touche aucun
écran. Une US qui touche un écran respecte les principes et le vocabulaire d'icônes de `docs/maquettes/README.md` ;
tout écart est déclaré dans les **Hypothèses**. Si l'écran a une planche, le dernier critère est « Conforme à la
planche N » : il cite la capture de référence (`docs/maquettes/ihm/<n>-….png`), et la recette la compare à l'écran.

## Critères d'acceptation

Chaque critère est numéroté et couvert par au moins un test, dont le nom contient l'identifiant (`CA-1`…).

**CA-1 — <nom>**
- **Étant donné** …
- **Quand** …
- **Alors** …

**CA-2 — <nom>**
- **Étant donné** …
- **Quand** …
- **Alors** …

## Comportement hors ligne

Ce qui marche sans internet, ce qui est suspendu et ce que voit l'utilisateur. Écrire « sans objet » si
c'est le cas, en le justifiant.

## Cas limites et erreurs

- …

## Hypothèses

Les choix faits pour combler un trou dans les exigences. L'utilisateur les valide.

- …

## Questions bloquantes

- …

## Notes techniques

Pistes d'implémentation, ADR concernées, impacts sur le protocole. Le détail du code n'a pas sa place ici.

## Suivi

| Date | Événement |
|---|---|
| AAAA-MM-JJ | Créée |

<script lang="ts">
  // Miniature des niveaux emboîtés (US-046 CA-2) : la manifestation est un cadre foncé, chaque compétition une bande de
  // couleur, chaque épreuve une tuile (même langage visuel que la liste, le plan et l'assistant, CA-4). Les couleurs
  // viennent de la charte (`--plan-n`, `--marque`).
  interface Proprietes {
    /** Où se place l'élément : dans une manifestation, ajouté à l'existant, ou seul à côté des manifestations. */
    variante: 'manifestation' | 'completer' | 'seule';
    /** Description du dessin, pour les lecteurs d'écran. */
    etiquette: string;
  }

  let { variante, etiquette }: Proprietes = $props();
</script>

<div class="miniature" role="img" aria-label={etiquette}>
  {#if variante === 'manifestation'}
    <div class="cadre">
      <div class="bande" style="--couleur: var(--plan-0)"><span class="tuile"></span><span class="tuile"></span></div>
      <div class="bande" style="--couleur: var(--plan-1)"><span class="tuile"></span></div>
    </div>
  {:else if variante === 'completer'}
    <div class="cadre">
      <div class="bande" style="--couleur: var(--plan-0)">
        <span class="tuile"></span><span class="tuile ajout">+</span>
      </div>
      <div class="bande ajout" style="--couleur: var(--plan-1)"><span class="tuile ajout">+</span></div>
    </div>
  {:else}
    <div class="bande seule" style="--couleur: var(--plan-2)">
      <span class="tuile"></span><span class="tuile"></span>
    </div>
  {/if}
</div>

<style>
  .miniature {
    display: grid;
    align-content: center;
    min-height: 5.5rem;
  }

  .cadre {
    display: grid;
    gap: 0.35rem;
    padding: 0.5rem;
    border-radius: var(--rayon);
    background: var(--marque);
  }

  .bande {
    display: flex;
    gap: 0.3rem;
    align-items: center;
    padding: 0.3rem 0.4rem;
    border-left: 0.35rem solid var(--couleur);
    border-radius: 0.2rem;
    background: var(--surface);
  }

  .bande.seule {
    border: 1px solid var(--bordure-champ);
    border-left: 0.35rem solid var(--couleur);
  }

  .bande.ajout {
    border-style: dashed;
    border-left-style: solid;
    background: transparent;
  }

  .tuile {
    display: inline-grid;
    place-items: center;
    width: 2.2rem;
    height: 1.1rem;
    border: 1px solid var(--bordure-champ);
    border-radius: 0.3rem;
    background: var(--fond);
    color: var(--texte-discret);
    font-size: 0.8rem;
    line-height: 1;
  }

  .tuile.ajout {
    border-style: dashed;
    background: transparent;
  }

  .bande.ajout .tuile {
    background: transparent;
    color: var(--sur-marque);
  }
</style>

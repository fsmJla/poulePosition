<script lang="ts">
  // Icône animée de la poule (US-012), reprise de icon-animated.svg du pack : la diagonale apparaît case par case, puis
  // les victoires, puis la grille se vide (boucle de 4,2 s). Intégrée en SVG pour suivre la charte et s'arrêter quand
  // l'utilisateur demande à réduire les animations. Décorative : le texte voisin dit ce qui se passe.

  interface Proprietes {
    /** Taille affichée, en pixels. */
    taille?: number;
  }

  let { taille = 20 }: Proprietes = $props();

  const POSITIONS = [19, 36, 53, 70, 87];
  /** Diagonale, puis victoires : [colonne, ligne, délai en s]. */
  const DIAGONALE = [0, 1, 2, 3, 4].map((i) => [i, i, i * 0.1] as const);
  const VICTOIRES = [
    [2, 0],
    [4, 0],
    [3, 1],
    [0, 2],
    [4, 2],
    [1, 3],
    [2, 4],
  ].map(([colonne, ligne], i) => [colonne!, ligne!, 0.75 + i * 0.1] as const);
</script>

<svg class="icone-animee" viewBox="0 0 120 120" width={taille} height={taille} aria-hidden="true" focusable="false">
  <g class="respiration">
    <rect class="fond" width="120" height="120" rx="27" />
    {#each POSITIONS as y (y)}
      {#each POSITIONS as x (x)}
        <rect class="vide" {x} {y} width="14" height="14" rx="3" />
      {/each}
    {/each}
    {#each DIAGONALE as [colonne, ligne, delai] (`d${colonne}`)}
      <rect
        class="case-animee diagonale"
        style="animation-delay: {delai}s"
        x={POSITIONS[colonne]}
        y={POSITIONS[ligne]}
        width="14"
        height="14"
        rx="3"
      />
    {/each}
    {#each VICTOIRES as [colonne, ligne, delai] (`v${colonne}-${ligne}`)}
      <rect
        class="case-animee victoire"
        style="animation-delay: {delai}s"
        x={POSITIONS[colonne]}
        y={POSITIONS[ligne]}
        width="14"
        height="14"
        rx="3"
      />
    {/each}
  </g>
</svg>

<style>
  .icone-animee {
    flex: none;
  }

  .fond {
    fill: var(--palette-ardoise);
  }

  .vide {
    fill: var(--case-vide);
  }

  .diagonale {
    fill: var(--palette-tiffany);
  }

  .victoire {
    fill: var(--palette-sable);
  }

  .respiration {
    transform-origin: 60px 60px;
    animation: respirer 4.2s ease-in-out infinite;
  }

  .case-animee {
    transform-box: fill-box;
    transform-origin: center;
    animation: apparaitre 4.2s cubic-bezier(0.34, 1.56, 0.64, 1) infinite both;
  }

  @keyframes apparaitre {
    0% {
      transform: scale(0);
      opacity: 0;
    }
    9% {
      transform: scale(1.18);
      opacity: 1;
    }
    13%,
    84% {
      transform: scale(1);
      opacity: 1;
    }
    94%,
    100% {
      transform: scale(0.4);
      opacity: 0;
    }
  }

  @keyframes respirer {
    0%,
    40%,
    56%,
    100% {
      transform: scale(1);
    }
    48% {
      transform: scale(1.04);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .respiration,
    .case-animee {
      animation: none;
    }
  }
</style>

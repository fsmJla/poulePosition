<script lang="ts" module>
  import type { NomIcone } from '../lib/icones';

  export interface Onglet {
    id: string;
    libelle: string;
    icone: NomIcone;
    /** Adresse de l'onglet : le même onglet s'ouvre au rechargement ou au partage (US-056 CA-5). */
    chemin: string;
  }
</script>

<script lang="ts">
  // Onglets d'une page (US-056 CA-5), au motif ARIA « tablist » : un seul onglet dans l'ordre de tabulation, les flèches
  // gauche et droite, Début et Fin changent d'onglet (activation automatique, qui change l'adresse). Chaque onglet porte
  // une icône et un libellé (principe 4 de la maquette). Le panneau est `role="tabpanel"`, lié à l'onglet actif.
  import Icone from './Icone.svelte';

  interface Proprietes {
    onglets: Onglet[];
    actif: string;
    etiquette: string;
    naviguer: (chemin: string) => void;
  }

  let { onglets, actif, etiquette, naviguer }: Proprietes = $props();

  let liste: HTMLElement | undefined = $state();

  function surTouche(evenement: KeyboardEvent) {
    const rang = onglets.findIndex(({ id }) => id === actif);
    const cible =
      evenement.key === 'ArrowRight'
        ? (rang + 1) % onglets.length
        : evenement.key === 'ArrowLeft'
          ? (rang - 1 + onglets.length) % onglets.length
          : evenement.key === 'Home'
            ? 0
            : evenement.key === 'End'
              ? onglets.length - 1
              : -1;
    if (cible < 0) return;
    evenement.preventDefault();
    const onglet = onglets[cible];
    if (!onglet) return;
    naviguer(onglet.chemin);
    // Le focus suit l'onglet choisi, une fois le rendu fait.
    queueMicrotask(() => liste?.querySelector<HTMLElement>(`#onglet-${onglet.id}`)?.focus());
  }
</script>

<div class="onglets" role="tablist" aria-label={etiquette} bind:this={liste}>
  {#each onglets as onglet (onglet.id)}
    {@const selectionne = onglet.id === actif}
    <button
      type="button"
      role="tab"
      id="onglet-{onglet.id}"
      aria-selected={selectionne}
      aria-controls="panneau-{onglet.id}"
      tabindex={selectionne ? 0 : -1}
      class:actif={selectionne}
      onclick={() => naviguer(onglet.chemin)}
      onkeydown={surTouche}
    >
      <Icone nom={onglet.icone} taille={20} />
      {onglet.libelle}
    </button>
  {/each}
</div>

<style>
  .onglets {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    border-bottom: 1px solid var(--bordure);
  }

  button {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 3rem;
    padding: 0 1rem;
    border: none;
    border-bottom: 3px solid transparent;
    background: transparent;
    color: var(--texte-discret);
    font: inherit;
    cursor: pointer;
  }

  button.actif {
    border-bottom-color: var(--accent);
    color: var(--accent);
    font-weight: 600;
  }
</style>

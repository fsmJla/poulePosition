<script lang="ts">
  // Lien interne : change de page sans recharger l'application (History API, voir lib/routes.ts).
  import type { Snippet } from 'svelte';

  interface Proprietes {
    chemin: string;
    naviguer: (chemin: string) => void;
    children: Snippet;
  }

  let { chemin, naviguer, children }: Proprietes = $props();

  function suivre(evenement: MouseEvent) {
    // Ctrl, Maj, clic milieu : laisser le navigateur ouvrir un nouvel onglet.
    if (evenement.button !== 0 || evenement.ctrlKey || evenement.metaKey || evenement.shiftKey) return;
    evenement.preventDefault();
    naviguer(chemin);
  }
</script>

<a href={chemin} onclick={suivre}>{@render children()}</a>

<style>
  a {
    color: var(--accent);
    font-weight: 600;
  }
</style>

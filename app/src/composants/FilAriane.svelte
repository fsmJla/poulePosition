<script lang="ts">
  // Fil d'Ariane (US-054 CA-3) : « Accueil › manifestation › compétition › épreuve ». Chaque niveau sauf le dernier est
  // un lien ; le dernier porte aria-current="page". Un nom trop long est tronqué à l'écran (points de suspension), mais
  // reste entier pour les lecteurs d'écran et en infobulle.
  import type { NiveauFil } from '../lib/fil-ariane';
  import { textes } from '../lib/textes';
  import Icone from './Icone.svelte';

  interface Proprietes {
    niveaux: NiveauFil[];
    naviguer: (chemin: string) => void;
  }

  let { niveaux, naviguer }: Proprietes = $props();

  function suivre(evenement: MouseEvent, chemin: string) {
    if (evenement.button !== 0 || evenement.ctrlKey || evenement.metaKey || evenement.shiftKey) return;
    evenement.preventDefault();
    naviguer(chemin);
  }
</script>

<nav class="fil" aria-label={textes.entete.filAriane}>
  <ol>
    {#each niveaux as niveau, rang (rang)}
      <li>
        {#if niveau.chemin && rang < niveaux.length - 1}
          <a href={niveau.chemin} title={niveau.libelle} onclick={(e) => suivre(e, niveau.chemin!)}>{niveau.libelle}</a>
        {:else}
          <span aria-current={rang === niveaux.length - 1 ? 'page' : undefined} title={niveau.libelle}
            >{niveau.libelle}</span
          >
        {/if}
        {#if rang < niveaux.length - 1}<Icone nom="chevron" taille={16} />{/if}
      </li>
    {/each}
  </ol>
</nav>

<style>
  .fil {
    margin: 0 0 1rem;
    font-size: 0.95rem;
  }

  ol {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 0.5rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 0.5rem;
    color: var(--texte-discret);
  }

  a,
  span {
    overflow: hidden;
    max-width: 24ch;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  a {
    color: var(--accent);
    text-decoration: underline;
  }

  a:hover {
    color: var(--accent-survol);
  }

  span {
    color: var(--texte);
  }
</style>

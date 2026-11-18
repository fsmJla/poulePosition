<script lang="ts">
  // Navigation par étapes de la page d'une épreuve (US-058 CA-1 et CA-2) : les étapes du déroulement, puis, sous un
  // séparateur, les réglages. Une étape livrée est un lien ; une étape à venir reste visible, grisée, « À venir », sans
  // action. La liste vient de `lib/etapes-epreuve.ts`, seul endroit où l'on active une étape.
  import { cheminEtape, ETAPES_EPREUVE, type IdEtapeEpreuve } from '../lib/etapes-epreuve';
  import { textes } from '../lib/textes';
  import Icone from './Icone.svelte';

  interface Proprietes {
    epreuveId: string;
    /** Étape ouverte : mise en évidence et `aria-current="page"`. */
    courante: IdEtapeEpreuve;
    naviguer: (chemin: string) => void;
    /** US-082 CA-1 : un nombre après le libellé d'une étape (« 24 » inscrits). */
    comptes?: Partial<Record<IdEtapeEpreuve, string>>;
    /** US-092 CA-1 : étapes livrées mais pas encore ouvertes pour cette épreuve (grisées « À venir »). */
    indisponibles?: readonly IdEtapeEpreuve[];
  }

  let { epreuveId, courante, naviguer, comptes = {}, indisponibles = [] }: Proprietes = $props();

  const t = textes.pageEpreuve;

  function suivre(evenement: MouseEvent, chemin: string) {
    // Ctrl, Maj, clic milieu : laisser le navigateur ouvrir un nouvel onglet.
    if (evenement.button !== 0 || evenement.ctrlKey || evenement.metaKey || evenement.shiftKey) return;
    evenement.preventDefault();
    naviguer(chemin);
  }
</script>

<nav aria-label={t.navigation}>
  <ul>
    {#each ETAPES_EPREUVE as etape, rang (etape.id)}
      {@const chemin = indisponibles.includes(etape.id) ? null : cheminEtape(etape, epreuveId)}
      {#if etape.groupe === 'reglages' && ETAPES_EPREUVE[rang - 1]?.groupe !== 'reglages'}
        <li class="separateur" role="separator"></li>
      {/if}
      <li>
        {#if chemin}
          <a
            href={chemin}
            class:courante={etape.id === courante}
            aria-current={etape.id === courante ? 'page' : undefined}
            onclick={(evenement) => suivre(evenement, chemin)}
          >
            <Icone nom={etape.icone} />
            <span class="libelle">{t.etapes[etape.id]}</span>
            {#if comptes[etape.id]}<span class="compte">{comptes[etape.id]}</span>{/if}
          </a>
        {:else}
          <span class="a-venir" aria-disabled="true">
            <Icone nom={etape.icone} />
            <span class="libelle">{t.etapes[etape.id]}</span>
            <small>{t.aVenir}</small>
          </span>
        {/if}
      </li>
    {/each}
  </ul>
</nav>

<style>
  nav {
    align-self: start;
    padding: 0.5rem;
    border: 1px solid var(--bordure);
    border-radius: 14px;
    background: var(--surface);
  }

  ul {
    display: grid;
    gap: 0.125rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  a,
  .a-venir {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-height: 2.5rem;
    padding: 0 0.75rem;
    border-radius: 8px;
    text-decoration: none;
  }

  a {
    color: var(--texte);
    font-weight: 500;
  }

  a:hover {
    background: var(--surface-2);
  }

  a.courante {
    background: var(--accent-teinte);
    color: var(--accent);
    font-weight: 600;
  }

  .a-venir {
    color: var(--texte-inactif);
    cursor: default;
  }

  .libelle {
    flex: 1;
  }

  small {
    font-size: 0.75rem;
  }

  .compte {
    color: var(--texte-discret);
    font-size: 0.8rem;
    font-weight: 400;
  }

  .separateur {
    height: 1px;
    margin: 0.5rem 0.75rem;
    background: var(--bordure);
  }

  /* Écran étroit : la navigation passe au-dessus du contenu, en liste défilante ; sous 40 rem, la barre d'onglets du bas
     (BarreOngletsEpreuve, US-061) la remplace. */
  @media (max-width: 52rem) {
    nav {
      border-radius: var(--rayon);
    }

    ul {
      display: flex;
      overflow-x: auto;
    }

    a,
    .a-venir {
      white-space: nowrap;
    }

    .separateur {
      flex: none;
      width: 1px;
      height: auto;
      margin: 0.5rem 0.25rem;
    }
  }

  @media (max-width: 39.99rem) {
    nav {
      display: none;
    }
  }
</style>

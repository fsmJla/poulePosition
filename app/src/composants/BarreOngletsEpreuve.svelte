<script lang="ts">
  // Barre d'onglets de la page d'une épreuve sur smartphone (US-061 CA-4, planche 6) : fixe en bas de l'écran, avec les
  // quatre étapes du déroulement les plus utilisées (Résumé, Inscrits, Poules, Tableau) et « Plus », qui ouvre les autres
  // (Émargement, Impressions, Formule, Paramètres). Elle lit la même liste que la navigation latérale
  // (`lib/etapes-epreuve.ts`) : une étape livrée y devient un lien, une étape à venir reste grisée. Seule la feuille CSS
  // l'affiche, sous 40 rem ; au-delà, c'est la navigation latérale.
  import { onMount } from 'svelte';
  import { cheminEtape, ETAPES_EPREUVE, type EtapeEpreuve, type IdEtapeEpreuve } from '../lib/etapes-epreuve';
  import { textes } from '../lib/textes';
  import Icone from './Icone.svelte';

  interface Proprietes {
    epreuveId: string;
    courante: IdEtapeEpreuve;
    naviguer: (chemin: string) => void;
    /** US-092 et US-109 : étapes livrées mais pas encore ouvertes (grisées, comme la navigation latérale). */
    indisponibles?: readonly IdEtapeEpreuve[];
    /** US-149 CA-3 : étapes sans objet pour cette épreuve, non affichées. */
    absentes?: readonly IdEtapeEpreuve[];
  }

  let { epreuveId, courante, naviguer, indisponibles = [], absentes = [] }: Proprietes = $props();
  const cheminDe = (etape: EtapeEpreuve) => (indisponibles.includes(etape.id) ? null : cheminEtape(etape, epreuveId));

  const t = textes.pageEpreuve;
  const DANS_LA_BARRE: readonly IdEtapeEpreuve[] = ['resume', 'inscriptions', 'poules', 'tableau'];
  const principales = $derived(ETAPES_EPREUVE.filter(({ id }) => DANS_LA_BARRE.includes(id) && !absentes.includes(id)));
  const autres = $derived(ETAPES_EPREUVE.filter(({ id }) => !DANS_LA_BARRE.includes(id) && !absentes.includes(id)));

  let ouvert = $state(false);
  let conteneur: HTMLElement | undefined = $state();
  const pageDansPlus = $derived(autres.some(({ id }) => id === courante));

  const libelle = (etape: EtapeEpreuve) => (etape.id === 'inscriptions' ? t.barre.inscriptions : t.etapes[etape.id]);

  function suivre(evenement: MouseEvent, chemin: string) {
    // Ctrl, Maj, clic milieu : laisser le navigateur ouvrir un nouvel onglet.
    if (evenement.button !== 0 || evenement.ctrlKey || evenement.metaKey || evenement.shiftKey) return;
    evenement.preventDefault();
    ouvert = false;
    naviguer(chemin);
  }

  onMount(() => {
    const surClicExterieur = (evenement: PointerEvent) => {
      if (ouvert && conteneur && !conteneur.contains(evenement.target as Node)) ouvert = false;
    };
    window.addEventListener('pointerdown', surClicExterieur);
    return () => window.removeEventListener('pointerdown', surClicExterieur);
  });
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<nav
  aria-label={t.navigation}
  bind:this={conteneur}
  onkeydown={(evenement) => {
    if (evenement.key === 'Escape') ouvert = false;
  }}
>
  <ul>
    {#each principales as etape (etape.id)}
      {@const chemin = cheminDe(etape)}
      <li>
        {#if chemin}
          <a
            href={chemin}
            class="onglet"
            class:courante={etape.id === courante}
            aria-current={etape.id === courante ? 'page' : undefined}
            onclick={(evenement) => suivre(evenement, chemin)}
          >
            <Icone nom={etape.icone} taille={22} />
            <span>{libelle(etape)}</span>
          </a>
        {:else}
          <span class="onglet a-venir" aria-disabled="true">
            <Icone nom={etape.icone} taille={22} />
            <span>{libelle(etape)}</span>
          </span>
        {/if}
      </li>
    {/each}
    <li>
      <button
        type="button"
        class="onglet"
        class:courante={pageDansPlus}
        aria-haspopup="menu"
        aria-expanded={ouvert}
        aria-controls="menu-plus-epreuve"
        aria-current={pageDansPlus ? 'page' : undefined}
        onclick={() => (ouvert = !ouvert)}
      >
        <Icone nom="troisPoints" taille={22} />
        <span>{t.barre.plus}</span>
      </button>
    </li>
  </ul>
  {#if ouvert}
    <div class="menu" id="menu-plus-epreuve" role="menu" aria-label={t.barre.plus}>
      {#each autres as etape (etape.id)}
        {@const chemin = cheminDe(etape)}
        {#if chemin}
          <a
            role="menuitem"
            href={chemin}
            class:courante={etape.id === courante}
            onclick={(evenement) => suivre(evenement, chemin)}
          >
            <Icone nom={etape.icone} />
            {t.etapes[etape.id]}
          </a>
        {:else}
          <span role="menuitem" aria-disabled="true" class="a-venir">
            <Icone nom={etape.icone} />
            <span class="nom">{t.etapes[etape.id]}</span>
            <small>{t.aVenir}</small>
          </span>
        {/if}
      {/each}
    </div>
  {/if}
</nav>

<style>
  nav {
    display: none;
    position: fixed;
    right: 0;
    bottom: 0;
    left: 0;
    z-index: 30;
    border-top: 1px solid var(--bordure);
    background: var(--surface);
    /* Barre de geste et coins de l'appareil : la barre les respecte (viewport-fit=cover). */
    padding: 0 env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
  }

  ul {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .onglet {
    display: flex;
    flex-direction: column;
    gap: 2px;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    width: 100%;
    min-height: 56px;
    padding: 6px 4px;
    border: 0;
    border-top: 3px solid transparent;
    border-radius: 0;
    background: none;
    box-shadow: none;
    font-family: inherit;
    cursor: pointer;
    color: var(--texte-discret);
    font-size: 0.8rem;
    font-weight: 500;
    text-decoration: none;
  }

  .onglet.courante {
    border-top-color: var(--accent);
    color: var(--accent);
    font-weight: 700;
  }

  .a-venir {
    color: var(--texte-inactif);
    cursor: default;
  }

  .menu {
    position: absolute;
    right: max(0.5rem, env(safe-area-inset-right));
    bottom: calc(100% + 0.5rem);
    display: grid;
    min-width: 14rem;
    padding: 0.25rem;
    border: 1px solid var(--bordure);
    border-radius: var(--rayon);
    background: var(--surface);
    box-shadow: 0 6px 20px color-mix(in srgb, var(--texte) 25%, transparent);
  }

  .menu a,
  .menu .a-venir {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    box-sizing: border-box;
    min-height: 44px;
    padding: 0 0.75rem;
    border-radius: 8px;
    color: var(--texte);
    text-decoration: none;
  }

  .menu .a-venir {
    color: var(--texte-inactif);
  }

  .menu a.courante {
    background: var(--accent-teinte);
    color: var(--accent);
    font-weight: 600;
  }

  .nom {
    flex: 1;
  }

  small {
    font-size: 0.75rem;
  }

  @media (max-width: 39.99rem) {
    nav {
      display: block;
    }
  }

  /* Clavier virtuel ouvert (un champ a le focus) : la barre ne recouvre pas le champ en cours de saisie. */
  @media (max-width: 39.99rem) {
    :global(body:has(input:focus, textarea:focus, select:focus)) nav {
      display: none;
    }
  }
</style>

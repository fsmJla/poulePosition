<script lang="ts">
  // Sélecteur de thème (US-052) : trois boutons-icônes côte à côte, « Clair » (soleil), « Sombre » (lune) et « Auto »
  // (écran, suit le système). Le choix en cours est mis en évidence et annoncé (aria-pressed) ; chaque choix a son nom
  // en infobulle. Un clic suffit, sans menu.
  import { CHOIX_THEME, theme, type ChoixTheme } from '../lib/theme';
  import { textes } from '../lib/textes';

  interface Proprietes {
    /** Sur le fond ardoise de l'entête : couleurs de la marque au lieu de celles de la page. */
    surMarque?: boolean;
  }

  let { surMarque = false }: Proprietes = $props();

  const t = textes.theme;
  const choix = theme.choix;
</script>

<div class="selecteur" class:sur-marque={surMarque} role="group" aria-label={t.libelle}>
  {#each CHOIX_THEME as option (option)}
    <button
      type="button"
      aria-pressed={$choix === option}
      aria-label={t.choix[option]}
      title={t.choix[option]}
      data-choix={option}
      onclick={() => theme.choisir(option as ChoixTheme)}
    >
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        aria-hidden="true"
      >
        {#if option === 'clair'}
          <circle cx="12" cy="12" r="4" />
          <path
            d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
            stroke-linecap="round"
          />
        {:else if option === 'sombre'}
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" stroke-linejoin="round" />
        {:else}
          <rect x="3" y="4" width="18" height="12" rx="2" />
          <path d="M8 20h8M12 16v4" stroke-linecap="round" />
        {/if}
      </svg>
    </button>
  {/each}
</div>

<style>
  .selecteur {
    display: inline-flex;
    gap: 2px;
    padding: 2px;
    border: 1px solid var(--bordure);
    border-radius: 999px;
    background: var(--surface);
    flex: none;
  }

  button {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    padding: 0;
    border: none;
    border-radius: 999px;
    background: transparent;
    color: var(--texte-discret);
    cursor: pointer;
  }

  button:hover {
    color: var(--texte);
  }

  button[aria-pressed='true'] {
    background: var(--accent-fond);
    color: var(--sur-accent);
  }

  /* Entête : fond ardoise de la marque, sur lequel le choix actif s'inverse. */
  .sur-marque {
    border-color: color-mix(in srgb, var(--sur-marque) 40%, transparent);
    background: transparent;
  }

  .sur-marque button {
    color: var(--sur-marque);
  }

  .sur-marque button[aria-pressed='true'] {
    background: var(--sur-marque);
    color: var(--marque);
  }

  .sur-marque button:focus-visible {
    outline-color: var(--sur-marque);
  }
</style>

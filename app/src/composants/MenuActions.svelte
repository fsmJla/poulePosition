<script lang="ts" module>
  import type { NomIcone } from '../lib/icones';

  export interface ActionMenu {
    libelle: string;
    icone?: NomIcone;
    /** Précision sous le libellé (« avec son épreuve, après confirmation »). */
    detail?: string;
    /** Lien interne ; sinon l'action est `surChoix`. */
    chemin?: string;
    surChoix?: () => void;
    destructive?: boolean;
    /** Motif d'une action indisponible : elle reste visible, grisée, et le motif est écrit dessous. */
    indisponible?: string;
    /** Choix en cours d'un menu de choix (role="menuitemradio"). */
    coche?: boolean;
  }
</script>

<script lang="ts">
  // Menu « ⋯ » d'un objet (US-054 CA-6) : les actions secondaires au lieu d'une pile de boutons. Le bouton s'active au
  // clic, avec Entrée ou avec Espace ; le menu (role="menu") reçoit le focus sur sa première action, les flèches, Début
  // et Fin le parcourent, Échap ou un clic ailleurs le ferme en rendant le focus au bouton. L'action destructrice est
  // toujours la dernière, en rouge, sous un séparateur ; une action indisponible reste visible, grisée, avec son motif.
  // Le même composant sert au choix du thème (icône soleil, choix coché).
  import { onMount, tick } from 'svelte';
  import { entreeVisee, ordonnerActions } from '../lib/menu';
  import { textes } from '../lib/textes';
  import BoutonIcone from './BoutonIcone.svelte';
  import Icone from './Icone.svelte';

  interface Proprietes {
    /** Objet concerné : le bouton se nomme « Autres actions pour <nom> » (sauf `etiquette`). */
    nom?: string;
    etiquette?: string;
    actions: ActionMenu[];
    naviguer?: (chemin: string) => void;
    icone?: NomIcone;
    surMarque?: boolean;
    contour?: boolean;
    /** Identifiant unique du menu (le bouton le référence par aria-controls). */
    id: string;
  }

  let {
    nom = '',
    etiquette,
    actions,
    naviguer,
    icone = 'troisPoints',
    surMarque = false,
    contour = true,
    id,
  }: Proprietes = $props();

  const t = textes.entete;
  let ouvert = $state(false);
  let conteneur: HTMLElement | undefined = $state();
  let bouton: HTMLElement | undefined = $state();
  let liste: HTMLElement | undefined = $state();

  /** La destructive passe en dernier, sous un séparateur (lib/menu.ts). */
  const rangement = $derived(ordonnerActions(actions));
  const ordonnees = $derived(rangement.actions);
  const separateurAvant = $derived(rangement.separateurAvant);
  const choix = $derived(actions.some((a) => a.coche !== undefined));
  const nomBouton = $derived(etiquette ?? t.autresActions(nom));

  function entrees(): HTMLElement[] {
    return liste ? [...liste.querySelectorAll<HTMLElement>('[role^="menuitem"]')] : [];
  }

  function fermer(rendreFocus = false) {
    ouvert = false;
    if (rendreFocus) bouton?.focus();
  }

  async function basculer() {
    ouvert = !ouvert;
    if (ouvert) {
      await tick();
      entrees()[0]?.focus();
    }
  }

  function choisir(action: ActionMenu, evenement: MouseEvent) {
    if (action.indisponible) {
      evenement.preventDefault();
      return;
    }
    if (action.chemin && naviguer) {
      if (evenement.button !== 0 || evenement.ctrlKey || evenement.metaKey || evenement.shiftKey) return;
      evenement.preventDefault();
      fermer();
      naviguer(action.chemin);
      return;
    }
    fermer(true);
    action.surChoix?.();
  }

  function surTouche(evenement: KeyboardEvent) {
    if (!ouvert) return;
    if (evenement.key === 'Escape') {
      evenement.preventDefault();
      fermer(true);
      return;
    }
    if (evenement.key === 'Tab') {
      fermer();
      return;
    }
    const elements = entrees();
    const visee = entreeVisee(evenement.key, elements.indexOf(document.activeElement as HTMLElement), elements.length);
    if (visee === null) return;
    evenement.preventDefault();
    elements[visee]?.focus();
  }

  onMount(() => {
    const surClicExterieur = (evenement: PointerEvent) => {
      if (ouvert && conteneur && !conteneur.contains(evenement.target as Node)) fermer();
    };
    const surHistorique = () => fermer();
    document.addEventListener('pointerdown', surClicExterieur);
    window.addEventListener('popstate', surHistorique);
    return () => {
      document.removeEventListener('pointerdown', surClicExterieur);
      window.removeEventListener('popstate', surHistorique);
    };
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="menu-actions" bind:this={conteneur} onkeydown={surTouche}>
  <BoutonIcone
    {icone}
    nom={nomBouton}
    {surMarque}
    {contour}
    bind:element={bouton}
    aria-haspopup="menu"
    aria-expanded={ouvert}
    aria-controls={id}
    onclick={basculer}
  />
  {#if ouvert}
    <div class="menu" {id} role="menu" aria-label={nomBouton} bind:this={liste}>
      {#each ordonnees as action, rang (rang)}
        {#if rang === separateurAvant}<hr />{/if}
        {@const role = choix ? 'menuitemradio' : 'menuitem'}
        {@const motif = action.indisponible ? `${id}-motif-${rang}` : undefined}
        {#if action.chemin && !action.indisponible}
          <a
            {role}
            href={action.chemin}
            tabindex="-1"
            class:destructive={action.destructive}
            aria-checked={choix ? action.coche === true : undefined}
            onclick={(e) => choisir(action, e)}
          >
            {@render contenu(action)}
          </a>
        {:else}
          <button
            type="button"
            {role}
            tabindex="-1"
            class:destructive={action.destructive}
            aria-disabled={action.indisponible ? 'true' : undefined}
            aria-describedby={motif}
            aria-checked={choix ? action.coche === true : undefined}
            onclick={(e) => choisir(action, e)}
          >
            {@render contenu(action)}
          </button>
        {/if}
        {#if action.indisponible}<small class="motif" id={motif}>{action.indisponible}</small>{/if}
      {/each}
    </div>
  {/if}
</div>

{#snippet contenu(action: ActionMenu)}
  <span class="icone">
    {#if choix}
      {#if action.coche}<Icone nom="coche" />{/if}
    {:else if action.icone}
      <Icone nom={action.icone} />
    {/if}
  </span>
  <span class="texte">
    <span class="libelle">{action.libelle}</span>
    {#if action.detail}<small>{action.detail}</small>{/if}
  </span>
{/snippet}

<style>
  .menu-actions {
    position: relative;
    flex: none;
  }

  .menu {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    z-index: 20;
    box-sizing: border-box;
    width: max-content;
    min-width: 12rem;
    max-width: min(22rem, calc(100vw - 2rem));
    padding: 0.35rem 0;
    border: 1px solid var(--bordure);
    border-radius: 12px;
    background: var(--surface);
    color: var(--texte);
    box-shadow: var(--ombre-flottante);
  }

  a,
  button {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    box-sizing: border-box;
    width: 100%;
    min-height: 44px;
    padding: 0.6rem 1rem;
    border: none;
    background: transparent;
    color: var(--texte);
    font: inherit;
    font-size: 15px;
    text-align: left;
    text-decoration: none;
    cursor: pointer;
  }

  a:hover,
  button:hover,
  a:focus-visible,
  button:focus-visible {
    background: var(--surface-2);
  }

  a:focus-visible,
  button:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: -2px;
  }

  .icone {
    display: inline-flex;
    width: 20px;
    min-height: 24px;
    align-items: center;
    flex: none;
  }

  .texte {
    display: grid;
    min-width: 0;
  }

  .texte small,
  .motif {
    color: var(--texte-discret);
    font-size: 13px;
  }

  .motif {
    display: block;
    padding: 0 1rem 0.5rem calc(1rem + 20px + 0.75rem);
  }

  .destructive {
    color: var(--etat-erreur);
  }

  [aria-disabled='true'] {
    color: var(--texte-inactif);
    cursor: not-allowed;
  }

  hr {
    margin: 0.35rem 0;
    border: none;
    border-top: 1px solid var(--bordure);
  }
</style>

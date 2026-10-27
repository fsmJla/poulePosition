<script lang="ts">
  // Menu de compte (US-017), en haut à droite de l'entête, sur le modèle du menu de compte de GitHub : un bouton avatar
  // qui déplie le nom, l'e-mail et les actions du compte. Modèle « bouton qui déplie une liste » (aria-expanded), au
  // clavier avec Tab ou les flèches ; Échap, un clic en dehors ou le choix d'une entrée le referment.
  import { onMount, tick } from 'svelte';
  import type { CompteConnecte } from '@poule-position/protocole';
  import { entreeVisee } from '../lib/menu';
  import { CHEMINS } from '../lib/routes';
  import { textes } from '../lib/textes';
  import Avatar from './Avatar.svelte';

  interface Proprietes {
    compte: CompteConnecte;
    naviguer: (chemin: string) => void;
    surDeconnexion: () => void;
    /** US-006 : demande la confirmation de l'oubli de l'appareil (panneau sous l'entête). */
    surOubli: () => void;
  }

  let { compte, naviguer, surDeconnexion, surOubli }: Proprietes = $props();

  const t = textes.organisateur;
  let ouvert = $state(false);
  let conteneur: HTMLElement | undefined = $state();
  let bouton: HTMLButtonElement | undefined = $state();
  let liste: HTMLElement | undefined = $state();

  function entrees(): HTMLElement[] {
    return liste ? [...liste.querySelectorAll<HTMLElement>('a, button')] : [];
  }

  function fermer(rendreFocus = false) {
    ouvert = false;
    if (rendreFocus) bouton?.focus();
  }

  /** Choix d'une entrée : le menu se ferme avant l'action. */
  function choisir(action: () => void) {
    fermer();
    action();
  }

  function versProfil(evenement: MouseEvent) {
    if (evenement.button !== 0 || evenement.ctrlKey || evenement.metaKey || evenement.shiftKey) return;
    evenement.preventDefault();
    choisir(() => naviguer(CHEMINS.profil));
  }

  async function surTouche(evenement: KeyboardEvent) {
    if (!ouvert) return;
    if (evenement.key === 'Escape') {
      evenement.preventDefault();
      fermer(true);
      return;
    }
    const elements = entrees();
    const active = elements.indexOf(document.activeElement as HTMLElement);
    const visee = entreeVisee(evenement.key, active, elements.length);
    if (visee === null) return;
    evenement.preventDefault();
    await tick();
    elements[visee]?.focus();
  }

  onMount(() => {
    // CA-3 : un clic (ou un toucher) en dehors du menu le referme.
    const surClicExterieur = (evenement: PointerEvent) => {
      if (ouvert && conteneur && !conteneur.contains(evenement.target as Node)) fermer();
    };
    // Changement de page par l'historique (précédent, suivant) : le menu se referme aussi.
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
<div class="compte" bind:this={conteneur} onkeydown={surTouche}>
  <button
    type="button"
    class="avatar"
    bind:this={bouton}
    aria-expanded={ouvert}
    aria-controls="menu-compte"
    aria-label={t.menu.ouvrir(compte.nom)}
    onclick={() => (ouvert = !ouvert)}
  >
    <Avatar nom={compte.nom} couleur={compte.avatar} taille={36} />
  </button>
  {#if ouvert}
    <div class="menu" id="menu-compte" bind:this={liste}>
      <div class="identite">
        <Avatar nom={compte.nom} couleur={compte.avatar} taille={40} />
        <div class="textes">
          <strong title={compte.nom}>{compte.nom}</strong>
          <span title={compte.email}>{compte.email}</span>
        </div>
      </div>
      <ul>
        <li><a href={CHEMINS.profil} onclick={versProfil}>{t.menu.editerProfil}</a></li>
      </ul>
      <hr />
      <ul>
        <li><button type="button" onclick={() => choisir(surDeconnexion)}>{t.seDeconnecter}</button></li>
        <li><button type="button" onclick={() => choisir(surOubli)}>{t.oublier.bouton}</button></li>
      </ul>
    </div>
  {/if}
</div>

<style>
  .compte {
    position: relative;
    flex: none;
  }

  .avatar {
    display: grid;
    place-items: center;
    padding: 2px;
    border: 2px solid transparent;
    border-radius: 50%;
    background: transparent;
    cursor: pointer;
  }

  .avatar[aria-expanded='true'],
  .avatar:hover {
    border-color: var(--sur-marque);
  }

  .avatar:focus-visible {
    outline: 3px solid var(--sur-marque);
    outline-offset: 2px;
  }

  /* Carte du menu, alignée à droite sous l'avatar ; jamais plus large que l'écran. */
  .menu {
    position: absolute;
    top: calc(100% + 0.5rem);
    right: 0;
    z-index: 10;
    width: min(18rem, calc(100vw - 2rem));
    padding: 0.5rem 0;
    border: 1px solid var(--bordure);
    border-radius: 12px;
    background: var(--surface);
    color: var(--texte);
    box-shadow: var(--ombre-flottante);
  }

  .identite {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    padding: 0.5rem 1rem 0.75rem;
  }

  .textes {
    display: grid;
    min-width: 0;
  }

  .textes strong,
  .textes span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .textes span {
    color: var(--texte-discret);
    font-size: 0.9rem;
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  hr {
    margin: 0.4rem 0;
    border: none;
    border-top: 1px solid var(--bordure);
  }

  a,
  ul button {
    display: block;
    box-sizing: border-box;
    width: 100%;
    min-height: 44px;
    padding: 0.6rem 1rem;
    border: none;
    background: transparent;
    color: var(--texte);
    font: inherit;
    text-align: left;
    text-decoration: none;
    cursor: pointer;
  }

  a:hover,
  ul button:hover,
  a:focus-visible,
  ul button:focus-visible {
    background: var(--surface-2);
  }

  a:focus-visible,
  ul button:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: -2px;
  }
</style>

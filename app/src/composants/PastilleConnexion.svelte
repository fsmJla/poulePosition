<script lang="ts">
  // Pastille de connexion de l'accueil public (US-157 CA-3 à CA-5) : en pilule, du même style que le sélecteur de thème,
  // icône « Personnes » et « Se connecter » (ou « Accueil de l'organisateur » une fois connecté). Sur un écran étroit,
  // l'icône seule, avec le libellé en nom accessible et en infobulle.
  import Icone from './Icone.svelte';
  import { CHEMINS } from '../lib/routes';
  import { textes } from '../lib/textes';

  interface Proprietes {
    connecte: boolean;
    naviguer: (chemin: string) => void;
  }

  let { connecte, naviguer }: Proprietes = $props();

  const chemin = $derived(connecte ? CHEMINS.organisateur : CHEMINS.connexion);
  const libelle = $derived(connecte ? textes.accueil.espaceOrganisateur : textes.accueil.seConnecter);

  function suivre(evenement: MouseEvent) {
    if (evenement.button !== 0 || evenement.ctrlKey || evenement.metaKey || evenement.shiftKey) return;
    evenement.preventDefault();
    naviguer(chemin);
  }
</script>

<a class="pastille" href={chemin} aria-label={libelle} title={libelle} onclick={suivre}
  ><Icone nom="personnes" /><span class="libelle">{libelle}</span></a
>

<style>
  .pastille {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    box-sizing: border-box;
    min-width: 2.75rem;
    height: 2.75rem;
    padding: 0 0.9rem;
    border: 1px solid var(--bordure);
    border-radius: 999px;
    background: var(--surface);
    color: var(--texte);
    font-weight: 600;
    text-decoration: none;
    white-space: nowrap;
  }

  .pastille:hover {
    background: var(--surface-2);
  }

  /* CA-5 : sous 40 rem, l'icône seule. */
  @media (max-width: 40rem) {
    .pastille {
      justify-content: center;
      padding: 0;
    }

    .libelle {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
  }
</style>

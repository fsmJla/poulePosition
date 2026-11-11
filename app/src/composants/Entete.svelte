<script lang="ts">
  // Entête des pages réservées (US-014, US-054, planches 1 à 3) : la marque (retour à l'accueil de l'organisateur), puis
  // « Créer », « Comptes » (administrateurs), l'aide, le thème et le menu de compte (US-017). Le champ de recherche
  // viendra avec US-062. Sur un écran étroit (CA-7), il ne reste que la marque et le menu de compte, qui reçoit
  // « Comptes », l'aide et le thème. Bandeau « connexion locale » tant que la session ouverte hors ligne n'est pas
  // revalidée (US-005 CA-1). « Se déconnecter et oublier cet appareil » (US-006) se confirme dans un panneau sous
  // l'entête, sans boîte de dialogue du navigateur.
  import { onMount } from 'svelte';
  import type { CompteConnecte } from '@poule-position/protocole';
  import { CHEMINS } from '../lib/routes';
  import { CHOIX_THEME, theme, type ChoixTheme } from '../lib/theme';
  import { textes } from '../lib/textes';
  import BoutonIcone from './BoutonIcone.svelte';
  import Icone from './Icone.svelte';
  import MenuActions, { type ActionMenu } from './MenuActions.svelte';
  import MenuCompte from './MenuCompte.svelte';

  interface Proprietes {
    compte: CompteConnecte;
    surDeconnexion: () => void;
    surOubli: () => void;
    naviguer: (chemin: string) => void;
    locale?: boolean;
  }

  let { compte, surDeconnexion, surOubli, naviguer, locale = false }: Proprietes = $props();

  const t = textes.organisateur.oublier;
  const te = textes.entete;
  const choixTheme = theme.choix;
  const iconesTheme = { clair: 'soleil', sombre: 'lune', auto: 'ecran' } as const;
  const actionsTheme = $derived<ActionMenu[]>(
    CHOIX_THEME.map((option) => ({
      libelle: textes.theme.choix[option],
      icone: iconesTheme[option],
      coche: $choixTheme === option,
      surChoix: () => theme.choisir(option as ChoixTheme),
    })),
  );

  /** US-006 : confirmation de l'oubli affichée. */
  let aConfirmer = $state(false);
  const administrateur = $derived(compte.role === 'administrateur');
  let etroit = $state(window.matchMedia('(max-width: 639px)').matches);
  let enLigne = $state(navigator.onLine);

  onMount(() => {
    const requete = window.matchMedia('(max-width: 639px)');
    const surTaille = () => (etroit = requete.matches);
    const surReseau = () => (enLigne = navigator.onLine);
    requete.addEventListener('change', surTaille);
    window.addEventListener('online', surReseau);
    window.addEventListener('offline', surReseau);
    return () => {
      requete.removeEventListener('change', surTaille);
      window.removeEventListener('online', surReseau);
      window.removeEventListener('offline', surReseau);
    };
  });

  function vers(chemin: string) {
    return (evenement: MouseEvent) => {
      if (evenement.button !== 0 || evenement.ctrlKey || evenement.metaKey || evenement.shiftKey) return;
      evenement.preventDefault();
      naviguer(chemin);
    };
  }
</script>

<header>
  <a href={CHEMINS.organisateur} onclick={vers(CHEMINS.organisateur)} class="marque">{te.marque}</a>
  <div class="outils">
    {#if !etroit}
      <!-- « Créer » reste actif hors ligne : la page /creer grise elle-même ce qui demande une connexion (US-046). -->
      <a class="creer" href={CHEMINS.creer} onclick={vers(CHEMINS.creer)}><Icone nom="plus" />{te.creer}</a>
      {#if administrateur}
        {#if enLigne}
          <a class="navigation" href={CHEMINS.comptes} onclick={vers(CHEMINS.comptes)}
            ><Icone nom="personnes" />{te.comptes}</a
          >
        {:else}
          <span class="navigation inactif" aria-disabled="true" title={te.horsLigne}
            ><Icone nom="personnes" />{te.comptes}</span
          >
        {/if}
      {/if}
      <BoutonIcone icone="aide" nom={te.aide} chemin={CHEMINS.aideOrganisation} {naviguer} surMarque />
      <MenuActions
        id="menu-theme"
        icone="soleil"
        etiquette={te.theme}
        actions={actionsTheme}
        surMarque
        contour={false}
      />
    {/if}
    <MenuCompte {compte} {naviguer} {surDeconnexion} surOubli={() => (aConfirmer = true)} {etroit} {enLigne} />
  </div>
</header>
{#if aConfirmer}
  <div class="confirmation" id="confirmation-oubli" role="group" aria-labelledby="avertissement-oubli">
    <p id="avertissement-oubli">{t.avertissement}</p>
    <div class="choix">
      <button type="button" class="principal" onclick={surOubli}>{t.confirmer}</button>
      <button type="button" class="lien" onclick={() => (aConfirmer = false)}>{t.annuler}</button>
    </div>
  </div>
{/if}
{#if locale}
  <p class="locale" role="status">{textes.organisateur.connexionLocale}</p>
{/if}

<style>
  .locale {
    margin: 0;
    padding: 0.45rem max(1rem, env(safe-area-inset-left));
    border-bottom: 1px solid var(--bordure);
    background: var(--surface-2);
    color: var(--texte);
    font-size: 0.9rem;
    font-weight: 600;
    text-align: center;
  }

  /* Marque à gauche, outils à droite : une seule ligne, smartphone compris (US-017). Marges de la planche : 8 × 24 px. */
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.5rem max(1.5rem, env(safe-area-inset-left));
    background: var(--marque);
    color: var(--sur-marque);
  }

  /* « Créer », « Comptes », aide, thème puis menu de compte, à droite. */
  .outils {
    display: flex;
    flex: none;
    align-items: center;
    gap: 0.5rem;
  }

  .marque {
    display: flex;
    min-width: 0;
    border-radius: 6px;
    color: var(--sur-marque);
    font-family: var(--police-titre);
    font-size: 1.3rem;
    font-weight: 700;
    letter-spacing: -0.01em;
    text-decoration: none;
    white-space: nowrap;
  }

  .marque:focus-visible,
  .creer:focus-visible,
  .navigation:focus-visible {
    outline-color: var(--sur-marque);
  }

  .creer,
  .navigation {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    box-sizing: border-box;
    min-height: 44px;
    padding: 0 0.9rem;
    border-radius: var(--rayon);
    font-size: 15px;
    font-weight: 600;
    text-decoration: none;
  }

  .creer {
    background: var(--palette-tiffany);
    color: var(--sur-tiffany);
  }

  .navigation {
    position: relative;
    color: var(--sur-marque);
    font-weight: 400;
  }

  .navigation:hover {
    background: color-mix(in srgb, var(--sur-marque) 16%, transparent);
  }

  .inactif {
    opacity: 0.6;
  }

  .confirmation {
    display: grid;
    gap: 0.75rem;
    padding: 0.9rem max(1rem, env(safe-area-inset-left));
    border-bottom: 1px solid var(--etat-erreur);
    background: var(--surface-2);
    color: var(--texte);
  }

  .confirmation p {
    margin: 0;
    max-width: 60rem;
  }

  .choix {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    align-items: center;
  }

  .confirmation button {
    min-height: 44px;
    padding: 0 1rem;
    border-radius: var(--rayon);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  .principal {
    border: none;
    background: var(--accent-fond);
    color: var(--sur-accent);
  }

  .lien {
    border: none;
    background: none;
    color: var(--accent);
    text-decoration: underline;
  }
</style>

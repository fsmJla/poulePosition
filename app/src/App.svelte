<script lang="ts">
  // Coquille de l'application (US-003) : session restaurée au démarrage, routage entre pages publiques et réservées.
  import { onMount } from 'svelte';
  import type { Session } from '@poule-position/protocole';
  import { URL_SERVEUR_LOCAL } from './lib/connexion';
  import { resoudreRoute, CHEMINS } from './lib/routes';
  import { creerClientSession, urlHttp } from './lib/session';
  import { ouvrirStockage } from './lib/stockage';
  import Accueil from './pages/Accueil.svelte';
  import Connexion from './pages/Connexion.svelte';
  import Organisateur from './pages/Organisateur.svelte';

  const urlServeur = import.meta.env.VITE_URL_SERVEUR ?? (import.meta.env.DEV ? URL_SERVEUR_LOCAL : undefined);
  const client = creerClientSession({ urlServeur: urlHttp(urlServeur), stockage: ouvrirStockage() });

  let session: Session | null = $state(null);
  /** Faux tant que la session gardée n'est pas relue : évite d'afficher une page puis d'en changer. */
  let pret = $state(false);
  let chemin = $state(location.pathname);

  const route = $derived(resoudreRoute(chemin, session !== null));

  function naviguer(vers: string, remplacer = false) {
    if (remplacer) history.replaceState(null, '', vers);
    else history.pushState(null, '', vers);
    chemin = vers;
  }

  $effect(() => {
    if (pret && 'redirection' in route) naviguer(route.redirection, true);
  });

  onMount(() => {
    const surRetour = () => (chemin = location.pathname);
    window.addEventListener('popstate', surRetour);
    client.restaurer().then((restauree) => {
      session = restauree;
      pret = true;
    });
    return () => window.removeEventListener('popstate', surRetour);
  });

  function surConnexion(ouverte: Session) {
    session = ouverte;
    naviguer(CHEMINS.organisateur);
  }

  async function surDeconnexion() {
    await client.seDeconnecter();
    session = null;
    naviguer(CHEMINS.connexion);
  }
</script>

{#if pret && 'page' in route}
  {#if route.page === 'accueil'}
    <Accueil {urlServeur} connecte={session !== null} {naviguer} />
  {:else if route.page === 'connexion'}
    <Connexion {client} {surConnexion} {naviguer} />
  {:else if route.page === 'organisateur' && session}
    <Organisateur {session} {surDeconnexion} />
  {/if}
{/if}

<script lang="ts">
  // Coquille de l'application (US-003) : session restaurée au démarrage et revalidée à chaque retour en ligne
  // (US-005 CA-5), routage entre pages publiques et réservées.
  import { onMount } from 'svelte';
  import { URL_SERVEUR_LOCAL } from './lib/connexion';
  import { resoudreRoute, CHEMINS } from './lib/routes';
  import { creerClientSession, urlHttp } from './lib/session';
  import { estLocale, ouvrirStockage, type SessionAppareil } from './lib/stockage';
  import Entete from './composants/Entete.svelte';
  import Accueil from './pages/Accueil.svelte';
  import Comptes from './pages/Comptes.svelte';
  import Connexion from './pages/Connexion.svelte';
  import MotDePasseOublie from './pages/MotDePasseOublie.svelte';
  import MotDePasse from './pages/MotDePasse.svelte';
  import Profil from './pages/Profil.svelte';
  import Reinitialisation from './pages/Reinitialisation.svelte';
  import Organisateur from './pages/Organisateur.svelte';

  const urlServeur = import.meta.env.VITE_URL_SERVEUR ?? (import.meta.env.DEV ? URL_SERVEUR_LOCAL : undefined);
  const client = creerClientSession({ urlServeur: urlHttp(urlServeur), stockage: ouvrirStockage() });

  let session = $state<SessionAppareil | null>(null);
  /** Faux tant que la session gardée n'est pas relue : évite d'afficher une page puis d'en changer. */
  let pret = $state(false);
  let chemin = $state(location.pathname);

  const route = $derived(
    resoudreRoute(
      chemin,
      session !== null,
      session?.compte.temporaire ?? false,
      session?.compte.role === 'administrateur',
    ),
  );

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
    // US-005 CA-5 / CA-6 : de retour en ligne, la session est revalidée sans action (ou fermée, avec son motif).
    const surEnLigne = async () => {
      if (session) session = await client.restaurer();
    };
    window.addEventListener('popstate', surRetour);
    window.addEventListener('online', surEnLigne);
    client.restaurer().then((restauree) => {
      session = restauree;
      pret = true;
    });
    return () => {
      window.removeEventListener('popstate', surRetour);
      window.removeEventListener('online', surEnLigne);
    };
  });

  function surConnexion(ouverte: SessionAppareil) {
    session = ouverte;
    naviguer(CHEMINS.organisateur);
  }

  async function surDeconnexion() {
    await client.seDeconnecter();
    session = null;
    naviguer(CHEMINS.connexion);
  }

  /** US-006 : se déconnecter et effacer le vérificateur local du compte sur cet appareil. */
  async function surOubli() {
    await client.oublierCetAppareil();
    session = null;
    naviguer(CHEMINS.connexion);
  }

  /** Session refusée par le serveur pendant un usage (déjà effacée de l'appareil) : retour à la connexion. */
  function surSessionPerdue() {
    session = null;
    naviguer(CHEMINS.connexion);
  }
</script>

{#if pret && 'page' in route}
  {#if route.page === 'accueil'}
    <Accueil {urlServeur} connecte={session !== null} {naviguer} />
  {:else if route.page === 'connexion'}
    <Connexion {client} {surConnexion} {naviguer} />
  {:else if route.page === 'motDePasseOublie'}
    <MotDePasseOublie {client} {naviguer} />
  {:else if route.page === 'reinitialisation'}
    <Reinitialisation {client} {surConnexion} {naviguer} />
  {:else if session}
    <!-- Pages réservées : entête commun (US-014). -->
    <Entete compte={session.compte} {surDeconnexion} {surOubli} {naviguer} locale={estLocale(session)} />
    {#if route.page === 'organisateur'}
      <Organisateur {session} {naviguer} />
    {:else if route.page === 'motDePasse'}
      <MotDePasse {client} {session} surChangement={(nouvelle) => (session = nouvelle)} {surSessionPerdue} {naviguer} />
    {:else if route.page === 'profil'}
      <Profil {client} {session} surChangement={(nouvelle) => (session = nouvelle)} {surSessionPerdue} {naviguer} />
    {:else if route.page === 'comptes'}
      <Comptes {client} {surSessionPerdue} />
    {/if}
  {/if}
{/if}

<script lang="ts">
  // Coquille de l'application (US-003) : session restaurée au démarrage et revalidée à chaque retour en ligne
  // (US-005 CA-5), routage entre pages publiques et réservées. Envoi au serveur du journal des compétitions pilotées
  // ici, au démarrage, à la connexion et à chaque retour en ligne (US-022 CA-2). Création et page d'une compétition
  // (US-025), manifestations du club (US-023).
  import { onMount } from 'svelte';
  import { URL_SERVEUR_LOCAL } from './lib/connexion';
  import { resoudreRoute, CHEMINS } from './lib/routes';
  import { ouvrirJournal } from './lib/journal';
  import { creerClientSession, urlHttp } from './lib/session';
  import { estLocale, ouvrirStockage, type SessionAppareil } from './lib/stockage';
  import { creerSynchronisation } from './lib/synchronisation';
  import { creerAccueil } from './lib/accueil';
  import { creerClientEpreuves } from './lib/epreuves';
  import { creerClientManifestations } from './lib/manifestations';
  import { textes } from './lib/textes';
  import Entete from './composants/Entete.svelte';
  import Accueil from './pages/Accueil.svelte';
  import Competition from './pages/Competition.svelte';
  import Comptes from './pages/Comptes.svelte';
  import Connexion from './pages/Connexion.svelte';
  import MotDePasseOublie from './pages/MotDePasseOublie.svelte';
  import Manifestations from './pages/Manifestations.svelte';
  import MotDePasse from './pages/MotDePasse.svelte';
  import Formule from './pages/Formule.svelte';
  import Parametres from './pages/Parametres.svelte';
  import NouvelleCompetition from './pages/NouvelleCompetition.svelte';
  import Profil from './pages/Profil.svelte';
  import Reinitialisation from './pages/Reinitialisation.svelte';
  import Organisateur from './pages/Organisateur.svelte';

  const urlServeur = import.meta.env.VITE_URL_SERVEUR ?? (import.meta.env.DEV ? URL_SERVEUR_LOCAL : undefined);
  const client = creerClientSession({ urlServeur: urlHttp(urlServeur), stockage: ouvrirStockage() });

  let session = $state<SessionAppareil | null>(null);
  let annonces = $state<{ competitionId: string; texte: string }[]>([]);

  function fermerAnnonce(competitionId: string) {
    annonces = annonces.filter((annonce) => annonce.competitionId !== competitionId);
  }
  const journal = ouvrirJournal();
  const synchronisation = creerSynchronisation({
    urlServeur: urlHttp(urlServeur),
    journal,
    // Une session locale (US-005) n'a pas de jeton : les événements attendent sa revalidation en ligne.
    jeton: async () => (session && !estLocale(session) ? session.jeton : null),
  });
  const manifestations = creerClientManifestations({
    urlServeur: urlHttp(urlServeur),
    jeton: async () => (session && !estLocale(session) ? session.jeton : null),
    // US-023 CA-4 : les dates d'une manifestation sont confrontées aux compétitions connues de cet appareil.
    competitions: () => synchronisation.competitionsConnues(),
  });
  const epreuves = creerClientEpreuves({
    urlServeur: urlHttp(urlServeur),
    jeton: async () => (session && !estLocale(session) ? session.jeton : null),
  });
  const accueil = creerAccueil({ journal, synchronisation, manifestations, epreuves });
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

  // US-022 CA-2 : une session en ligne (connexion, revalidation) envoie ce qui attendait.
  $effect(() => {
    if (session && !estLocale(session)) void synchronisation.envoyerTout();
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
    const arreterSuppression = synchronisation.surSuppression(({ competitionId, nom, abandonnees }) => {
      const texte = textes.competitions.suppression.annonce(nom, abandonnees);
      annonces = [...annonces.filter((annonce) => annonce.competitionId !== competitionId), { competitionId, texte }];
    });
    const arreterEnvoi = synchronisation.surveiller();
    return () => {
      arreterSuppression();
      arreterEnvoi();
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
      <Organisateur {session} {accueil} {naviguer} />
    {:else if route.page === 'motDePasse'}
      <MotDePasse {client} {session} surChangement={(nouvelle) => (session = nouvelle)} {surSessionPerdue} {naviguer} />
    {:else if route.page === 'profil'}
      <Profil {client} {session} surChangement={(nouvelle) => (session = nouvelle)} {surSessionPerdue} {naviguer} />
    {:else if route.page === 'comptes'}
      <Comptes {client} {surSessionPerdue} />
    {:else if route.page === 'manifestations'}
      <Manifestations client={manifestations} clientEpreuves={epreuves} {naviguer} />
    {:else if route.page === 'nouvelleCompetition'}
      <NouvelleCompetition
        {session}
        {journal}
        {synchronisation}
        clientManifestations={manifestations}
        clientEpreuves={epreuves}
        {naviguer}
      />
    {:else if route.page === 'modifierCompetition' && route.competitionId}
      {#key route.competitionId}
        <NouvelleCompetition
          {session}
          {journal}
          {synchronisation}
          clientManifestations={manifestations}
          clientEpreuves={epreuves}
          competitionId={route.competitionId}
          {naviguer}
        />
      {/key}
    {:else if route.page === 'formuleCompetition' && route.competitionId}
      {#key route.competitionId}
        <Formule {session} competitionId={route.competitionId} {journal} {synchronisation} {naviguer} />
      {/key}
    {:else if route.page === 'parametresCompetition' && route.competitionId}
      {#key route.competitionId}
        <Parametres {session} competitionId={route.competitionId} {journal} {synchronisation} {naviguer} />
      {/key}
    {:else if route.page === 'competition' && route.competitionId}
      {#key route.competitionId}
        <Competition {session} competitionId={route.competitionId} {journal} {synchronisation} {naviguer} />
      {/key}
    {/if}
  {/if}
{/if}

<!-- US-039 CA-5 et CA-6 : ce PC vient d'effacer la copie d'une compétition supprimée par un administrateur. -->
{#if annonces.length > 0}
  <div class="annonces">
    {#each annonces as annonce (annonce.competitionId)}
      <p role="status">
        {annonce.texte}
        <button type="button" onclick={() => fermerAnnonce(annonce.competitionId)}
          >{textes.competitions.suppression.fermer}</button
        >
      </p>
    {/each}
  </div>
{/if}

<style>
  .annonces {
    position: fixed;
    inset: auto 1rem 1rem;
    display: grid;
    gap: 0.5rem;
    justify-items: center;
  }

  .annonces p {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
    max-width: 32rem;
    margin: 0;
    padding: 0.6rem 0.75rem;
    border-left: 4px solid var(--etat-attente);
    background: var(--surface);
    color: var(--texte);
    outline: 1px solid var(--bordure-champ);
  }

  .annonces button {
    padding: 0.3rem 0.7rem;
    border: 1px solid var(--bordure-champ);
    border-radius: var(--rayon);
    background: var(--surface);
    color: var(--texte);
    font: inherit;
    cursor: pointer;
  }
</style>

<script lang="ts">
  // Coquille de l'application (US-003) : session restaurée au démarrage et revalidée à chaque retour en ligne
  // (US-005 CA-5), routage entre pages publiques et réservées. Envoi au serveur du journal des épreuves pilotées
  // ici, au démarrage, à la connexion et à chaque retour en ligne (US-022 CA-2). Création et page d'une épreuve
  // (US-025), manifestations du club (US-023).
  import { onMount } from 'svelte';
  import { URL_SERVEUR_LOCAL } from './lib/connexion';
  import { resoudreRoute, CHEMINS } from './lib/routes';
  import { ouvrirJournal } from './lib/journal';
  import { creerClientSession, urlHttp } from './lib/session';
  import { estLocale, ouvrirStockage, type SessionAppareil } from './lib/stockage';
  import { creerSynchronisation } from './lib/synchronisation';
  import { creerAccueil } from './lib/accueil';
  import { creerClientCompetitions } from './lib/competitions';
  import { creerClientManifestations } from './lib/manifestations';
  import { textes } from './lib/textes';
  import BarreOutils from './composants/BarreOutils.svelte';
  import Entete from './composants/Entete.svelte';
  import Accueil from './pages/Accueil.svelte';
  import Epreuve from './pages/Epreuve.svelte';
  import Comptes from './pages/Comptes.svelte';
  import Connexion from './pages/Connexion.svelte';
  import MotDePasseOublie from './pages/MotDePasseOublie.svelte';
  import Manifestations from './pages/Manifestations.svelte';
  import MotDePasse from './pages/MotDePasse.svelte';
  import Formule from './pages/Formule.svelte';
  import Parametres from './pages/Parametres.svelte';
  import GrilleEpreuves from './pages/GrilleEpreuves.svelte';
  import AideOrganisation from './pages/AideOrganisation.svelte';
  import AssistantManifestation from './pages/AssistantManifestation.svelte';
  import Creer from './pages/Creer.svelte';
  import PlanManifestation from './pages/PlanManifestation.svelte';
  import NouvelleEpreuve from './pages/NouvelleEpreuve.svelte';
  import Profil from './pages/Profil.svelte';
  import Reinitialisation from './pages/Reinitialisation.svelte';
  import Organisateur from './pages/Organisateur.svelte';

  const urlServeur = import.meta.env.VITE_URL_SERVEUR ?? (import.meta.env.DEV ? URL_SERVEUR_LOCAL : undefined);
  const client = creerClientSession({ urlServeur: urlHttp(urlServeur), stockage: ouvrirStockage() });

  let session = $state<SessionAppareil | null>(null);
  let annonces = $state<{ epreuveId: string; texte: string }[]>([]);

  function fermerAnnonce(epreuveId: string) {
    annonces = annonces.filter((annonce) => annonce.epreuveId !== epreuveId);
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
    // US-023 CA-4 : les dates d'une manifestation sont confrontées aux épreuves connues de cet appareil.
    epreuves: () => synchronisation.epreuvesConnues(),
  });
  const competitions = creerClientCompetitions({
    urlServeur: urlHttp(urlServeur),
    jeton: async () => (session && !estLocale(session) ? session.jeton : null),
  });
  const accueil = creerAccueil({ journal, synchronisation, manifestations, competitions });
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
    const arreterSuppression = synchronisation.surSuppression(({ epreuveId, nom, abandonnees }) => {
      const texte = textes.epreuves.suppression.annonce(nom, abandonnees);
      annonces = [...annonces.filter((annonce) => annonce.epreuveId !== epreuveId), { epreuveId, texte }];
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
    <BarreOutils />
    <Accueil {urlServeur} connecte={session !== null} {naviguer} />
  {:else if route.page === 'connexion'}
    <BarreOutils />
    <Connexion {client} {surConnexion} {naviguer} />
  {:else if route.page === 'motDePasseOublie'}
    <BarreOutils />
    <MotDePasseOublie {client} {naviguer} />
  {:else if route.page === 'reinitialisation'}
    <BarreOutils />
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
      <Manifestations
        client={manifestations}
        clientCompetitions={competitions}
        {naviguer}
        administrateur={session.compte.role === 'administrateur'}
        epreuvesConnues={() => synchronisation.epreuvesConnues()}
        apresSuppressionContenu={async () => void (await synchronisation.listerEpreuvesDuClub())}
      />
    {:else if route.page === 'nouvelleEpreuve'}
      <NouvelleEpreuve
        {session}
        {journal}
        {synchronisation}
        clientManifestations={manifestations}
        clientCompetitions={competitions}
        {accueil}
        {naviguer}
      />
    {:else if route.page === 'grilleEpreuves' && route.competitionId}
      {#key route.competitionId}
        <GrilleEpreuves
          {session}
          {journal}
          {synchronisation}
          {accueil}
          competitionId={route.competitionId}
          {naviguer}
        />
      {/key}
    {:else if route.page === 'assistantManifestation'}
      <AssistantManifestation
        {session}
        {journal}
        {synchronisation}
        {accueil}
        clientManifestations={manifestations}
        clientCompetitions={competitions}
        {naviguer}
      />
    {:else if route.page === 'creer'}
      <Creer {accueil} {naviguer} />
    {:else if route.page === 'aideOrganisation'}
      <AideOrganisation {naviguer} />
    {:else if route.page === 'planManifestation' && route.manifestationId}
      {#key route.manifestationId}
        <PlanManifestation
          {session}
          {journal}
          {synchronisation}
          {accueil}
          manifestationId={route.manifestationId}
          {naviguer}
        />
      {/key}
    {:else if route.page === 'modifierEpreuve' && route.epreuveId}
      {#key route.epreuveId}
        <NouvelleEpreuve
          {session}
          {journal}
          {synchronisation}
          clientManifestations={manifestations}
          clientCompetitions={competitions}
          epreuveId={route.epreuveId}
          {accueil}
          {naviguer}
        />
      {/key}
    {:else if route.page === 'formuleEpreuve' && route.epreuveId}
      {#key route.epreuveId}
        <Formule {session} epreuveId={route.epreuveId} {journal} {synchronisation} {naviguer} />
      {/key}
    {:else if route.page === 'parametresEpreuve' && route.epreuveId}
      {#key route.epreuveId}
        <Parametres {session} epreuveId={route.epreuveId} {journal} {synchronisation} {naviguer} />
      {/key}
    {:else if route.page === 'epreuve' && route.epreuveId}
      {#key route.epreuveId}
        <Epreuve {session} epreuveId={route.epreuveId} {journal} {synchronisation} {naviguer} />
      {/key}
    {/if}
  {/if}
{/if}

<!-- US-039 CA-5 et CA-6 : ce PC vient d'effacer la copie d'une épreuve supprimée par un administrateur. -->
{#if annonces.length > 0}
  <div class="annonces">
    {#each annonces as annonce (annonce.epreuveId)}
      <p role="status">
        {annonce.texte}
        <button type="button" onclick={() => fermerAnnonce(annonce.epreuveId)}
          >{textes.epreuves.suppression.fermer}</button
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

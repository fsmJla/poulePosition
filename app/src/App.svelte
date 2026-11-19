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
  import { creerPresencePilote } from './lib/presence-pilote';
  import { creerAccesQr } from './lib/acces-qr';
  import { traiterSaisie } from './lib/table-saisies';
  import { vueSaisie } from '@poule-position/domaine';
  import { creerAccueil } from './lib/accueil';
  import { creerClientCompetitions } from './lib/competitions';
  import { creerClientManifestations } from './lib/manifestations';
  import { creerClientFichiers } from './lib/fichiers';
  import { creerClientPublic } from './lib/publication';
  import { textes } from './lib/textes';
  import BarreOutils from './composants/BarreOutils.svelte';
  import Entete from './composants/Entete.svelte';
  import Accueil from './pages/Accueil.svelte';
  import Direct from './pages/Direct.svelte';
  import Saisie from './pages/Saisie.svelte';
  import Epreuve from './pages/Epreuve.svelte';
  import Comptes from './pages/Comptes.svelte';
  import Connexion from './pages/Connexion.svelte';
  import MotDePasseOublie from './pages/MotDePasseOublie.svelte';
  import Manifestation from './pages/Manifestation.svelte';
  import MotDePasse from './pages/MotDePasse.svelte';
  import Formule from './pages/Formule.svelte';
  import Inscriptions from './pages/Inscriptions.svelte';
  import Emargement from './pages/Emargement.svelte';
  import Poules from './pages/Poules.svelte';
  import Classement from './pages/Classement.svelte';
  import Parametres from './pages/Parametres.svelte';
  import ImpressionAcces from './pages/ImpressionAcces.svelte';
  import GrilleEpreuves from './pages/GrilleEpreuves.svelte';
  import AideOrganisation from './pages/AideOrganisation.svelte';
  import AssistantManifestation from './pages/AssistantManifestation.svelte';
  import Creer from './pages/Creer.svelte';
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
  /** US-030 : affiches et feuilles de route, jointes en ligne, affichables hors ligne depuis la copie de l'appareil. */
  const fichiers = creerClientFichiers({
    urlServeur: urlHttp(urlServeur),
    jeton: async () => (session && !estLocale(session) ? session.jeton : null),
  });
  /** US-096 : jetons des QR codes (confiés au serveur, gardés sur ce PC pour le hors ligne). */
  const acces = creerAccesQr({
    urlServeur: urlHttp(urlServeur),
    journal,
    jeton: async () => (session && !estLocale(session) ? session.jeton : null),
  });
  /** US-031 : page d'accueil publique et lien public d'une épreuve, lus sans session. */
  const publication = creerClientPublic({ urlServeur: urlHttp(urlServeur) });
  const accueil = creerAccueil({ journal, synchronisation, manifestations, competitions });
  /** US-094 : WebSocket du pilote, une par épreuve pilotée ici qui se tire aujourd'hui (ADR-0028). */
  const presence = creerPresencePilote({
    urlServeur,
    synchronisation,
    // US-095 : vue de saisie publiée pour les smartphones, calculée à partir du journal local.
    vueDe: async (epreuveId) => {
      const { epreuve } = await journal.lire(epreuveId);
      if (!epreuve) return null;
      const copie = await competitions.copie();
      const competition = copie?.competitions.find(({ id }) => id === epreuve.rattachement.competitionId);
      return vueSaisie(epreuve, competition?.nom ?? null);
    },
    // US-099 : une saisie d'un smartphone, décidée par ce PC ; un score accepté part au serveur (et la vue suit).
    surSaisie: async (epreuveId, saisie) => {
      const accuse = await traiterSaisie(journal, epreuveId, saisie, {
        clubId: session?.compte.clubId,
        auteur: session?.compte.email ?? '',
      });
      if (accuse.decision === 'accepte' || accuse.decision === 'refuse') void synchronisation.envoyer(epreuveId);
      return accuse;
    },
  });
  let horsLignePilote = $state(false);
  presence.surEtat((horsLigne) => (horsLignePilote = horsLigne));
  /** Faux tant que la session gardée n'est pas relue : évite d'afficher une page puis d'en changer. */
  let pret = $state(false);
  let chemin = $state(location.pathname + location.search);

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

  // US-094 : la présence du pilote tourne tant qu'une session existe ; une session locale (US-005) attend le réseau.
  const avecSession = $derived(session !== null);
  $effect(() => {
    if (!avecSession) return;
    const arreter = presence.surveiller();
    // Une épreuve qui vient d'arriver sur le serveur ouvre sa WebSocket sans attendre la revue suivante.
    // US-095 CA-1 : un lot accepté (score, retrait…) republie la vue de saisie de son épreuve.
    const arreterEnvoi = synchronisation.surEnvoi((epreuveId) => {
      void presence.actualiser().then(() => presence.publier(epreuveId));
    });
    return () => {
      arreter();
      arreterEnvoi();
      horsLignePilote = false;
    };
  });

  onMount(() => {
    const surRetour = () => (chemin = location.pathname + location.search);
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
    <Accueil client={publication} connecte={session !== null} {naviguer} />
  {:else if route.page === 'direct' && route.epreuveId}
    <BarreOutils />
    <Direct client={publication} epreuveId={route.epreuveId} {naviguer} />
  {:else if route.page === 'saisie' && route.epreuveId}
    <!-- US-097 : page d'un smartphone entré par QR code, sans compte ni entête de l'organisateur. -->
    <Saisie epreuveId={route.epreuveId} {urlServeur} />
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
    <!-- Pages réservées : entête commun (US-014) ; action principale tiffany (US-054, app.css). -->
    <div class="pages-connectees">
      <Entete compte={session.compte} {surDeconnexion} {surOubli} {naviguer} {accueil} locale={estLocale(session)} />
      {#if route.page === 'organisateur'}
        <Organisateur {session} {accueil} {fichiers} {journal} {synchronisation} {naviguer} />
      {:else if route.page === 'motDePasse'}
        <MotDePasse
          {client}
          {session}
          surChangement={(nouvelle) => (session = nouvelle)}
          {surSessionPerdue}
          {naviguer}
        />
      {:else if route.page === 'profil'}
        <Profil {client} {session} surChangement={(nouvelle) => (session = nouvelle)} {surSessionPerdue} {naviguer} />
      {:else if route.page === 'comptes'}
        <Comptes {client} {surSessionPerdue} {naviguer} />
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
      {:else if route.page === 'manifestation' && route.manifestationId}
        {#key route.manifestationId}
          <Manifestation
            {session}
            {journal}
            {synchronisation}
            {accueil}
            clientManifestations={manifestations}
            clientCompetitions={competitions}
            {fichiers}
            manifestationId={route.manifestationId}
            onglet={route.onglet ?? 'competitions'}
            recherche={chemin.includes('?') ? `?${chemin.split('?')[1]}` : ''}
            apresSuppressionContenu={async () => void (await synchronisation.listerEpreuvesDuClub())}
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
          <Formule {session} epreuveId={route.epreuveId} {journal} {synchronisation} {accueil} {naviguer} />
        {/key}
      {:else if route.page === 'inscriptionsEpreuve' && route.epreuveId}
        {#key route.epreuveId}
          <Inscriptions {session} epreuveId={route.epreuveId} {journal} {synchronisation} {accueil} {naviguer} />
        {/key}
      {:else if route.page === 'emargementEpreuve' && route.epreuveId}
        {#key route.epreuveId}
          <Emargement {session} epreuveId={route.epreuveId} {journal} {synchronisation} {accueil} {naviguer} />
        {/key}
      {:else if route.page === 'poulesEpreuve' && route.epreuveId}
        {#key route.epreuveId}
          <Poules {session} epreuveId={route.epreuveId} {journal} {synchronisation} {accueil} {naviguer} {presence} />
        {/key}
      {:else if route.page === 'classementEpreuve' && route.epreuveId}
        {#key route.epreuveId}
          <Classement {session} epreuveId={route.epreuveId} {journal} {synchronisation} {accueil} {naviguer} />
        {/key}
      {:else if route.page === 'parametresEpreuve' && route.epreuveId}
        {#key route.epreuveId}
          <Parametres
            {session}
            epreuveId={route.epreuveId}
            {journal}
            {synchronisation}
            {accueil}
            {acces}
            {presence}
            {naviguer}
          />
        {/key}
      {:else if route.page === 'impressionAcces' && route.epreuveId}
        {#key route.epreuveId}
          <ImpressionAcces epreuveId={route.epreuveId} {journal} {acces} {naviguer} />
        {/key}
      {:else if route.page === 'epreuve' && route.epreuveId}
        {#key route.epreuveId}
          <Epreuve
            {session}
            epreuveId={route.epreuveId}
            {journal}
            {synchronisation}
            {fichiers}
            clientCompetitions={competitions}
            {accueil}
            {naviguer}
          />
        {/key}
      {/if}
    </div>
  {/if}
{/if}

<!-- US-094 CA-3 : la connexion au serveur d'une épreuve pilotée ici est perdue ; la compétition continue. -->
<p class="hors-ligne-pilote" class:visible={horsLignePilote} role="status" aria-live="polite">
  {horsLignePilote ? textes.epreuves.horsLignePilote : ''}
</p>

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
  /* Pastille flottante, comme l'attente d'envoi (US-090) : elle ne pousse pas le contenu. */
  .hors-ligne-pilote {
    position: fixed;
    left: 1rem;
    bottom: 1rem;
    z-index: 20;
    margin: 0;
    padding: 0.5rem 0.9rem;
    border: 1px solid var(--etat-attente-bordure);
    border-radius: 999px;
    background: var(--etat-attente-fond);
    color: var(--sur-etat-attente-fond);
    box-shadow: var(--ombre-flottante);
    font-size: 0.875rem;
    font-weight: 600;
    visibility: hidden;
  }

  .hors-ligne-pilote.visible {
    visibility: visible;
  }

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

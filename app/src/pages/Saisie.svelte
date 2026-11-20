<script lang="ts">
  // Saisie par smartphone (US-097, planche 12) : la page ouverte par le lien d'un QR code, sans compte. Le jeton est lu
  // dans le fragment de l'adresse puis gardé sur le téléphone, et retiré de l'adresse affichée. L'arbitre donne son nom
  // et choisit sa piste ; au retour sur le lien, il retrouve sa piste. Hors ligne, la dernière vue gardée s'affiche.
  import { onMount } from 'svelte';
  import AccesArbitre from '../composants/AccesArbitre.svelte';
  import EnteteSaisie from '../composants/EnteteSaisie.svelte';
  import MatchsPiste from '../composants/MatchsPiste.svelte';
  import QuiEtesVous from '../composants/QuiEtesVous.svelte';
  import MesMatchs from '../composants/MesMatchs.svelte';
  import SaisieMatch from '../composants/SaisieMatch.svelte';
  import MatchsTableau from '../composants/MatchsTableau.svelte';
  import SaisieMatchTableau, { type ScoreTableau } from '../composants/SaisieMatchTableau.svelte';
  import {
    matchsDeLaPiste,
    matchsTableauDeLaPiste,
    matchsTableauDuTireur,
    placesAffichees,
    tireurDeLaVue,
    type MatchDeLaPiste,
    type MatchTableauVue,
    type TireurVue,
  } from '@poule-position/domaine';
  import {
    creerSaisieSmartphone,
    ecrireMemoire,
    jetonDuFragment,
    lireMemoire,
    type EtatSaisie,
    type MemoireSaisie,
    type SaisieSmartphone,
  } from '../lib/saisie-smartphone';
  import { textes } from '../lib/textes';

  interface Proprietes {
    epreuveId: string;
    /** Adresse WebSocket du serveur ; absente s'il n'est pas configuré. */
    urlServeur: string | undefined;
  }

  let { epreuveId, urlServeur }: Proprietes = $props();

  const t = textes.saisie;

  let saisie = $state<SaisieSmartphone | null>(null);
  let etat = $state<EtatSaisie | null>(null);
  let memoire = $state<MemoireSaisie | null>(null);
  let sansJeton = $state(false);
  let changerPiste = $state(false);

  onMount(() => {
    const jeton = jetonDuFragment(location.hash);
    let gardee = lireMemoire(epreuveId);
    if (jeton && gardee?.jeton !== jeton) {
      // Nouveau lien (premier passage, ou QR régénéré) : le téléphone repart de zéro pour cette épreuve.
      gardee = { jeton, appareilId: null, role: null, nom: null, piste: null, vue: null };
      ecrireMemoire(epreuveId, gardee);
    }
    // Le jeton ne reste pas dans l'adresse affichée (capture d'écran, partage du lien).
    if (location.hash) history.replaceState(history.state, '', location.pathname + location.search);
    if (!gardee) {
      sansJeton = true;
      return;
    }
    memoire = gardee;
    const ouverte = creerSaisieSmartphone({
      urlServeur,
      epreuveId,
      memoire: gardee,
      garder: (nouvelle) => {
        memoire = nouvelle;
        ecrireMemoire(epreuveId, nouvelle);
      },
    });
    saisie = ouverte;
    const arreterEcoute = ouverte.surEtat((nouvel) => (etat = nouvel));
    return () => {
      arreterEcoute();
      ouverte.arreter();
    };
  });

  const vue = $derived(etat?.vue ?? null);
  const enTete = $derived(vue ? t.epreuve(vue.nom, textes.epreuves.armes[vue.arme]) : null);
  const refus = $derived(sansJeton ? 'lien' : (etat?.refus ?? null));
  const arbitrePret = $derived(Boolean(memoire?.nom && memoire.piste !== null) && !changerPiste);

  function commencer(nom: string, piste: number) {
    saisie?.choisir(nom, piste);
    changerPiste = false;
  }

  const tireurChoisi = $derived(tireurDeLaVue(vue, memoire?.tireurId ?? null));
  const nomDeLaSaisie = $derived(
    etat?.role === 'tireur' && tireurChoisi ? `${tireurChoisi.nom} ${tireurChoisi.prenom}` : (memoire?.nom ?? ''),
  );
  // US-099 : le match en cours de saisie, et l'identifiant de la saisie envoyée (pour suivre son accusé).
  let enSaisie = $state<MatchDeLaPiste | null>(null);
  /** US-101 : le match ouvert l'est pour être corrigé. */
  let enCorrection = $state(false);
  let idEnvoye = $state<string | null>(null);
  const accuse = $derived(idEnvoye ? (etat?.accuses[idEnvoye] ?? null) : null);
  const suivant = $derived.by(() => {
    if (!enSaisie || memoire?.piste == null) return null;
    const prochain = matchsDeLaPiste(vue, memoire.piste).maintenant;
    return prochain && !(prochain.poule === enSaisie.poule && prochain.numero === enSaisie.numero) ? prochain : null;
  });

  function ouvrir(match: MatchDeLaPiste | null, corriger = false) {
    enSaisie = match;
    enCorrection = corriger;
    idEnvoye = null;
  }

  // US-106 : le match du tableau en cours de saisie (ou de correction).
  let enTableau = $state<MatchTableauVue | null>(null);
  const tireursVue = $derived(
    new Map<string, TireurVue>((vue?.poules ?? []).flatMap((p) => p.tireurs.map((x) => [x.id, x] as const))),
  );

  function ouvrirTableau(match: MatchTableauVue | null, corriger = false) {
    enTableau = match;
    enCorrection = corriger;
    idEnvoye = null;
  }

  /** US-106 CA-4 : la saisie d'un match du tableau, dans l'ordre affiché (gauche, puis droite). */
  function envoyerTableau(match: MatchTableauVue, score: ScoreTableau) {
    const { places, touches } = placesAffichees(match);
    const [gauche, droite] = [places[0].tireurId, places[1].tireurId];
    if (!gauche || !droite) return null;
    const id = crypto.randomUUID();
    const parti = saisie?.envoyerSaisie({
      id,
      poule: 0,
      match: match.id,
      tireurA: gauche,
      tireurB: droite,
      touchesA: score.touchesA,
      touchesB: score.touchesB,
      auTemps: score.auTemps,
      nom: nomDeLaSaisie,
      ...(score.priorite && { parPriorite: score.priorite === 'A' ? gauche : droite }),
      ...(etat?.role === 'tireur' && memoire?.tireurId && { tireurId: memoire.tireurId }),
      ...(enCorrection && touches && { remplace: [touches[0], touches[1]] as [number, number] }),
    });
    idEnvoye = parti ? id : null;
    return idEnvoye;
  }

  function envoyer(match: MatchDeLaPiste, score: { touchesA: number; touchesB: number; auTemps: boolean }) {
    const id = crypto.randomUUID();
    const parti = saisie?.envoyerSaisie({
      id,
      poule: match.poule,
      tireurA: match.tireurA,
      tireurB: match.tireurB,
      ...score,
      // US-104 : un tireur signe de son nom (« DUBOIS Chloé »), un arbitre du nom qu'il a donné.
      nom: nomDeLaSaisie,
      ...(etat?.role === 'tireur' && memoire?.tireurId && { tireurId: memoire.tireurId }),
      // US-101 : une correction porte le score qu'elle remplace.
      ...(enCorrection && match.touches && { remplace: [match.touches[0], match.touches[1]] as [number, number] }),
    });
    idEnvoye = parti ? id : null;
    return idEnvoye;
  }
</script>

<div class="saisie">
  {#if !enSaisie && !enTableau}<EnteteSaisie epreuve={enTete} table={etat?.table ?? false} />{/if}

  {#if refus}
    <main class="message"><p role="alert">{t.refus[refus]}</p></main>
  {:else if !etat || (!vue && etat.connexion === 'connexion')}
    <main class="message"><p role="status">{t.chargement}</p></main>
  {:else if !vue && !etat.role}
    <main class="message"><p role="alert">{t.pasDeConnexion}</p></main>
  {:else if etat.role === 'tireur' && !memoire?.tireurId}
    <QuiEtesVous {vue} {epreuveId} choisir={(id) => saisie?.choisirTireur(id)} />
  {:else if enTableau && vue}
    <!-- US-106 (planche 15) : saisie d'un match du tableau. -->
    {#key enTableau.id}
      <SaisieMatchTableau
        {vue}
        match={enTableau}
        table={etat.table}
        {accuse}
        envoyer={(score) => envoyerTableau(enTableau as MatchTableauVue, score)}
        retour={() => ouvrirTableau(null)}
        correction={enCorrection}
      />
    {/key}
  {:else if etat.role === 'tireur' && memoire?.tireurId}
    {#if enSaisie && vue}
      {#key `${enSaisie.poule}-${enSaisie.numero}`}
        <SaisieMatch
          {vue}
          match={enSaisie}
          piste={vue.poules.find(({ numero }) => numero === enSaisie?.poule)?.piste ?? 0}
          table={etat.table}
          {accuse}
          envoyer={(score) => envoyer(enSaisie as MatchDeLaPiste, score)}
          retour={() => ouvrir(null)}
          suivant={null}
          ouvrirSuivant={() => ouvrir(null)}
        />
      {/key}
    {:else}
      <MesMatchs
        {vue}
        tireurId={memoire.tireurId}
        oublier={() => saisie?.choisirTireur(null)}
        saisir={(match) => ouvrir(match)}
        suspendue={!etat.table}
      />
      {#if vue?.tableau}
        <MatchsTableau
          matchs={matchsTableauDuTireur(vue, memoire.tireurId)}
          tireurs={tireursVue}
          saisir={vue.droits.tireurSaisitTableau ? (match) => ouvrirTableau(match) : undefined}
          suspendue={!etat.table}
        />
      {/if}
    {/if}
  {:else if !arbitrePret}
    <AccesArbitre {vue} nom={memoire?.nom ?? ''} piste={memoire?.piste ?? null} {commencer} />
  {:else if memoire?.piste !== null && memoire?.piste !== undefined}
    <!-- US-098 (planche 13) : match à saisir, matchs suivants et terminés de la piste. -->
    {#if enSaisie && vue}
      {#key `${enSaisie.poule}-${enSaisie.numero}`}
        <SaisieMatch
          {vue}
          match={enSaisie}
          piste={memoire.piste}
          table={etat.table}
          {accuse}
          envoyer={(score) => envoyer(enSaisie as MatchDeLaPiste, score)}
          retour={() => ouvrir(null)}
          {suivant}
          ouvrirSuivant={() => ouvrir(suivant)}
          correction={enCorrection}
        />
      {/key}
    {:else}
      <MatchsPiste
        {vue}
        piste={memoire.piste}
        nom={memoire.nom ?? ''}
        changerDePiste={() => (changerPiste = true)}
        saisir={(match) => ouvrir(match)}
        corriger={(match) => ouvrir(match, true)}
        suspendue={!etat.table}
        raison={etat.connexion === 'connecte' ? 'table' : 'telephone'}
        dernierEchange={etat.dernierEchange}
      />
      {#if vue?.tableau}
        <MatchsTableau
          matchs={matchsTableauDeLaPiste(vue, memoire.piste)}
          tireurs={tireursVue}
          saisir={vue.droits.arbitreSaisitScores ? (match) => ouvrirTableau(match) : undefined}
          corriger={vue.droits.correctionScore === 'arbitre' ? (match) => ouvrirTableau(match, true) : undefined}
          suspendue={!etat.table}
        />
      {/if}
    {/if}
  {/if}
</div>

<style>
  .saisie {
    min-height: 100vh;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    background: var(--fond);
    color: var(--texte);
  }

  .message {
    padding: 24px 16px;
  }

  .message p {
    margin: 0;
    font-size: 1.0625rem;
  }
</style>

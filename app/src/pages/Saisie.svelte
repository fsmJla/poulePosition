<script lang="ts">
  // Saisie par smartphone (US-097, planche 12) : la page ouverte par le lien d'un QR code, sans compte. Le jeton est lu
  // dans le fragment de l'adresse puis gardé sur le téléphone, et retiré de l'adresse affichée. L'arbitre donne son nom
  // et choisit sa piste ; au retour sur le lien, il retrouve sa piste. Hors ligne, la dernière vue gardée s'affiche.
  import { onMount } from 'svelte';
  import AccesArbitre from '../composants/AccesArbitre.svelte';
  import EnteteSaisie from '../composants/EnteteSaisie.svelte';
  import MatchsPiste from '../composants/MatchsPiste.svelte';
  import SaisieMatch from '../composants/SaisieMatch.svelte';
  import { matchsDeLaPiste, type MatchDeLaPiste } from '@poule-position/domaine';
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

  // US-099 : le match en cours de saisie, et l'identifiant de la saisie envoyée (pour suivre son accusé).
  let enSaisie = $state<MatchDeLaPiste | null>(null);
  let idEnvoye = $state<string | null>(null);
  const accuse = $derived(idEnvoye ? (etat?.accuses[idEnvoye] ?? null) : null);
  const suivant = $derived.by(() => {
    if (!enSaisie || memoire?.piste == null) return null;
    const prochain = matchsDeLaPiste(vue, memoire.piste).maintenant;
    return prochain && !(prochain.poule === enSaisie.poule && prochain.numero === enSaisie.numero) ? prochain : null;
  });

  function ouvrir(match: MatchDeLaPiste | null) {
    enSaisie = match;
    idEnvoye = null;
  }

  function envoyer(match: MatchDeLaPiste, score: { touchesA: number; touchesB: number; auTemps: boolean }) {
    const id = crypto.randomUUID();
    const parti = saisie?.envoyerSaisie({
      id,
      poule: match.poule,
      tireurA: match.tireurA,
      tireurB: match.tireurB,
      ...score,
      nom: memoire?.nom ?? '',
    });
    idEnvoye = parti ? id : null;
    return idEnvoye;
  }
</script>

<div class="saisie">
  {#if !enSaisie}<EnteteSaisie epreuve={enTete} table={etat?.table ?? false} />{/if}

  {#if refus}
    <main class="message"><p role="alert">{t.refus[refus]}</p></main>
  {:else if !etat || (!vue && etat.connexion === 'connexion')}
    <main class="message"><p role="status">{t.chargement}</p></main>
  {:else if !vue && !etat.role}
    <main class="message"><p role="alert">{t.pasDeConnexion}</p></main>
  {:else if etat.role === 'tireur'}
    <main class="message"><p role="status">{t.tireur.bientot}</p></main>
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
        />
      {/key}
    {:else}
      <MatchsPiste
        {vue}
        piste={memoire.piste}
        nom={memoire.nom ?? ''}
        changerDePiste={() => (changerPiste = true)}
        saisir={(match) => ouvrir(match)}
      />
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

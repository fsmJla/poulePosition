<script lang="ts">
  // Accueil de l'organisateur (US-003 CA-1, US-026), page réservée : nom et rôle du compte connecté, les actions de
  // création, et la liste du club : manifestations (repliables) avec leurs épreuves et leurs compétitions, puis les
  // compétitions isolées. La liste vient du serveur, ou de la dernière copie gardée sur l'appareil et des compétitions
  // locales (hors ligne) ; la création d'une manifestation ou d'une épreuve exige le réseau (US-023, US-024), celle
  // d'une compétition non (US-025). La gestion des comptes (US-007) reste réservée aux administrateurs, grisée hors ligne.
  // Le profil (US-016) et la déconnexion (US-003 CA-5) sont dans le menu de compte de l'entête (US-017).
  import { onMount } from 'svelte';
  import {
    construireListe,
    manifestationOuverte,
    type CompetitionListee,
    type ListeClub,
  } from '@poule-position/domaine';
  import type { SessionAppareil } from '../lib/stockage';
  import Lien from '../composants/Lien.svelte';
  import type { Accueil, DonneesAccueil } from '../lib/accueil';
  import { cheminCompetition, cheminNouvelleEpreuve, CHEMIN_NOUVELLE_MANIFESTATION, CHEMINS } from '../lib/routes';
  import { textes } from '../lib/textes';

  interface Proprietes {
    session: SessionAppareil;
    accueil: Accueil;
    naviguer: (chemin: string) => void;
  }

  let { session, accueil, naviguer }: Proprietes = $props();

  const t = textes.listeClub;
  const tc = textes.competitions;

  let horsLigne = $state(!navigator.onLine);
  let donnees: DonneesAccueil | null = $state(null);
  let afficherArchives = $state(false);
  /** Jour d'aujourd'hui (`AAAA-MM-JJ`), pour ouvrir la manifestation en cours. */
  const aujourdhui = new Date().toLocaleDateString('sv-SE');

  const liste: ListeClub | null = $derived(donnees ? construireListe(donnees, { afficherArchives }) : null);

  async function charger() {
    donnees = await accueil.charger();
  }

  onMount(() => {
    const surReseau = () => {
      horsLigne = !navigator.onLine;
      void charger();
    };
    window.addEventListener('online', surReseau);
    window.addEventListener('offline', surReseau);
    void charger();
    return () => {
      window.removeEventListener('online', surReseau);
      window.removeEventListener('offline', surReseau);
    };
  });
</script>

{#snippet competition(entree: CompetitionListee)}
  <li class="competition">
    <Lien chemin={cheminCompetition(entree.id)} {naviguer}>{entree.nom}</Lien>
    <span class="infos">
      {tc.armes[entree.arme]}
      {#if entree.categorie}· {entree.categorie}{/if}
      {#if entree.sexe}· {tc.sexes[entree.sexe]}{/if}
      {#if entree.date}· {t.jour(entree.date)}{/if}
    </span>
    <span class="etiquettes">
      <span>{tc.statuts[entree.statut]}</span>
      <span>{entree.publiee ? tc.publiee : tc.nonPubliee}</span>
      {#if entree.pilote}<span class="pilote">{tc.pilote}</span>{:else}<span>{t.lectureSeule}</span>{/if}
      {#if entree.nonEnvoyee}<span class="attente">{tc.pasEncoreEnvoyee}</span>{/if}
    </span>
  </li>
{/snippet}

{#snippet creation(chemin: string, libelle: string, nomAccessible?: string)}
  {#if horsLigne}
    <span class="inactive" aria-disabled="true">
      {libelle}
      <small>{t.horsLigne}</small>
    </span>
  {:else}
    <Lien {chemin} {naviguer} etiquette={nomAccessible}>{libelle}</Lien>
  {/if}
{/snippet}

<main>
  <h1>{textes.organisateur.bonjour(session.compte.nom)}</h1>
  <p class="role">{textes.roles[session.compte.role]}</p>
  <nav class="actions" aria-label={textes.organisateur.actions}>
    <!-- US-025 : la création d'une compétition fonctionne aussi hors ligne. -->
    <Lien chemin={CHEMINS.nouvelleCompetition} {naviguer}>{tc.nouvelle}</Lien>
    {@render creation(CHEMIN_NOUVELLE_MANIFESTATION, t.nouvelleManifestation)}
    <!-- US-023 : consultables hors ligne (dernière copie), modifiables en ligne seulement. -->
    <Lien chemin={CHEMINS.manifestations} {naviguer}>{textes.manifestations.entree}</Lien>
    {#if session.compte.role === 'administrateur'}
      {#if horsLigne}
        <span class="inactive" aria-disabled="true">
          {textes.comptes.entree}
          <small>{textes.comptes.horsLigne}</small>
        </span>
      {:else}
        <Lien chemin={CHEMINS.comptes} {naviguer}>{textes.comptes.entree}</Lien>
      {/if}
    {/if}
  </nav>

  <section class="liste" aria-labelledby="titre-liste">
    <h2 id="titre-liste">{t.titre}</h2>

    {#if donnees === null || liste === null}
      <p role="status">{t.chargement}</p>
    {:else}
      {#if donnees.horsLigne}
        <p class="avertissement" role="status">
          {donnees.copieLe !== null ? textes.manifestations.listeDu(donnees.copieLe) : t.horsLigneSansCopie}
        </p>
      {/if}

      {#if liste.vide}
        <p class="vide">{t.vide}</p>
      {:else}
        <div class="filtre">
          <label>
            <input type="checkbox" bind:checked={afficherArchives} />
            {t.afficherArchives}
          </label>
          {#if liste.archivesMasquees > 0}<small>{t.archivesMasquees(liste.archivesMasquees)}</small>{/if}
        </div>

        {#each liste.manifestations as noeud (noeud.manifestation.id)}
          <details class="manifestation" open={manifestationOuverte(noeud.manifestation, aujourdhui)}>
            <summary>
              <strong>{noeud.manifestation.nom}</strong>
              <span class="infos">
                {textes.manifestations.periode(noeud.manifestation.debut, noeud.manifestation.fin)}
                {#if noeud.manifestation.lieu}· {noeud.manifestation.lieu}{/if}
              </span>
            </summary>
            <div class="contenu">
              {@render creation(
                cheminNouvelleEpreuve(noeud.manifestation.id),
                t.nouvelleEpreuve,
                t.nouvelleEpreuveDans(noeud.manifestation.nom),
              )}
              {#each noeud.epreuves as { epreuve, competitions } (epreuve.id)}
                <div class="epreuve">
                  <h3>
                    {epreuve.nom}
                    {#if epreuve.arme}<small>{tc.armes[epreuve.arme]}</small>{/if}
                  </h3>
                  <ul>
                    {#each competitions as entree (entree.id)}{@render competition(entree)}{:else}
                      <li class="vide">{t.aucuneCompetition}</li>
                    {/each}
                  </ul>
                </div>
              {/each}
              {#if noeud.competitions.length > 0}
                <ul>
                  {#each noeud.competitions as entree (entree.id)}{@render competition(entree)}{/each}
                </ul>
              {/if}
            </div>
          </details>
        {/each}

        {#if liste.isolees.length > 0}
          <div class="epreuve">
            <h3>{t.isolees}</h3>
            <ul>
              {#each liste.isolees as entree (entree.id)}{@render competition(entree)}{/each}
            </ul>
          </div>
        {/if}
      {/if}
    {/if}
  </section>
</main>

<style>
  main {
    display: grid;
    justify-items: center;
    gap: 0.75rem;
    padding: 4rem 1rem;
    text-align: center;
  }

  h1 {
    margin: 0;
  }

  .role {
    margin: 0 0 1rem;
    padding: 0.2rem 0.8rem;
    border-radius: 999px;
    background: var(--surface);
    color: var(--texte-discret);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem 1.5rem;
    justify-content: center;
  }

  /* Entrée grisée hors ligne (US-007, US-026) : visible, mais sans lien. */
  .inactive {
    display: grid;
    color: var(--texte-discret);
    font-weight: 600;
  }

  .inactive small {
    font-weight: 400;
  }

  .liste {
    display: grid;
    gap: 0.9rem;
    width: min(100%, 44rem);
    margin-top: 1.5rem;
    text-align: left;
  }

  h2 {
    margin: 0;
    font-size: 1.2rem;
    text-align: center;
  }

  h3 {
    margin: 0;
    font-size: 1rem;
  }

  small,
  .infos {
    color: var(--texte-discret);
    font-weight: 400;
  }

  .filtre {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
    align-items: center;
  }

  .manifestation {
    border: 1px solid var(--bordure);
    border-radius: var(--rayon);
    background: var(--surface);
  }

  summary {
    display: grid;
    gap: 0.2rem;
    padding: 0.8rem 1rem;
    overflow-wrap: anywhere;
    cursor: pointer;
  }

  .contenu {
    display: grid;
    gap: 0.8rem;
    padding: 0 1rem 1rem;
  }

  .epreuve {
    display: grid;
    gap: 0.4rem;
  }

  ul {
    display: grid;
    gap: 0.5rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .competition {
    display: grid;
    gap: 0.2rem;
    padding: 0.6rem 0.75rem;
    border: 1px solid var(--bordure);
    border-radius: var(--rayon);
    background: var(--fond);
    overflow-wrap: anywhere;
  }

  .etiquettes {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  .etiquettes span {
    padding: 0.1rem 0.55rem;
    border-radius: 999px;
    background: var(--surface);
    color: var(--texte-discret);
    font-size: 0.8rem;
  }

  .etiquettes .pilote {
    color: var(--texte);
    font-weight: 600;
  }

  .etiquettes .attente {
    border-left: 3px solid var(--etat-attente);
  }

  .vide {
    margin: 0;
    color: var(--texte-discret);
  }

  .avertissement {
    margin: 0;
    padding: 0.6rem 0.75rem;
    border-left: 4px solid var(--etat-attente);
    background: var(--surface);
  }
</style>

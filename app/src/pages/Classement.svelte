<script lang="ts">
  // Classement des poules (US-092, planche 20) : tous les tireurs des poules, classés en temps réel par V/M, indice,
  // puis TD ; « provisoire » tant qu'un match reste à tirer. Calculé sur l'appareil à partir du journal local (hors
  // ligne compris) ; relu toutes les 2 s, et la copie du pilote est retéléchargée toutes les 30 s sur un autre appareil.
  import { onMount } from 'svelte';
  import {
    avancementPoules,
    classementDesPoules,
    participantsDe,
    poulesDe,
    type Epreuve,
  } from '@poule-position/domaine';
  import GabaritEpreuve from '../composants/GabaritEpreuve.svelte';
  import MenuActions from '../composants/MenuActions.svelte';
  import type { Accueil } from '../lib/accueil';
  import type { Journal } from '../lib/journal';
  import { cheminImprimer, cheminPoulesEpreuve } from '../lib/routes';
  import type { SessionAppareil } from '../lib/stockage';
  import type { Synchronisation } from '../lib/synchronisation';
  import { textes } from '../lib/textes';

  interface Proprietes {
    session: SessionAppareil;
    epreuveId: string;
    journal: Journal;
    synchronisation: Synchronisation;
    accueil: Accueil;
    naviguer: (chemin: string) => void;
    /** Intervalles de relecture (journal local, copie du pilote), en millisecondes. */
    relecture?: number;
    copie?: number;
  }

  let {
    epreuveId,
    journal,
    synchronisation,
    accueil,
    naviguer,
    relecture = 2000,
    copie = 30_000,
  }: Proprietes = $props();

  const t = textes.poules;
  const te = textes.epreuves;

  let epreuve = $state<Epreuve | null>(null);
  let chargee = $state(false);

  const etat = $derived(epreuve ? poulesDe(epreuve) : null);
  const touches = $derived(epreuve?.formule.touchesPoules ?? 5);
  const tireurs = $derived(epreuve ? new Map(participantsDe(epreuve).map((tireur) => [tireur.id, tireur])) : new Map());
  const lignes = $derived(etat ? classementDesPoules(etat, touches) : []);
  const avancement = $derived(etat ? avancementPoules(etat, touches) : { regles: 0, total: 0 });
  const definitif = $derived(avancement.total > 0 && avancement.regles === avancement.total);
  const etatsPoules = $derived(
    etat
      ? etat.poules.map((poule) => ({
          numero: poule.numero,
          terminee: lignes.filter((l) => l.poule === poule.numero).every(({ aTirer }) => aTirer === 0),
        }))
      : [],
  );

  async function recharger() {
    epreuve = (await journal.lire(epreuveId)).epreuve;
  }

  onMount(() => {
    let pilote = false;
    const relire = setInterval(() => void recharger(), relecture);
    const retelecharger = setInterval(() => {
      if (!pilote && document.visibilityState === 'visible') {
        void synchronisation.telechargerCopie(epreuveId).then(() => recharger());
      }
    }, copie);
    void (async () => {
      await synchronisation.telechargerCopie(epreuveId);
      pilote = (await journal.etat(epreuveId))?.pilote ?? false;
      await recharger();
      chargee = true;
      // Cas limite : avant le lancement des poules, l'étape renvoie vers « Poules ».
      if (epreuve && !poulesDe(epreuve).lancees) naviguer(cheminPoulesEpreuve(epreuveId));
    })();
    return () => {
      clearInterval(relire);
      clearInterval(retelecharger);
    };
  });

  const ratio = (valeur: number) =>
    valeur.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const signe = (valeur: number) => (valeur > 0 ? `+${valeur}` : String(valeur));
  const enCours = $derived(etatsPoules.filter(({ terminee }) => !terminee).map(({ numero }) => numero));
  const terminees = $derived(etatsPoules.filter(({ terminee }) => terminee).map(({ numero }) => numero));
</script>

{#snippet etape()}
  {#if !chargee}
    <p role="status">{te.chargement}</p>
  {:else if !epreuve || !etat}
    <p class="message" role="alert">{te.introuvable}</p>
  {:else}
    <div class="titre-etape">
      <div class="identite">
        <div class="ligne">
          <h2>{t.classementTitre}</h2>
          <span class="pastille" class:definitif role="status"
            >{definitif
              ? t.classementDefinitifEntete
              : t.classementProvisoireEntete(avancement.regles, avancement.total)}</span
          >
        </div>
        <p class="discret">{t.classementAide}</p>
      </div>
      <MenuActions
        id="menu-classement"
        nom={t.classementTitre}
        actions={[
          {
            libelle: t.imprimerClassement,
            icone: 'imprimante',
            surChoix: () => naviguer(cheminImprimer(epreuveId, { document: 'classementPoules' })),
          },
        ]}
      />
    </div>

    <section class="carte" aria-labelledby="titre-classement">
      <header>
        <h3 id="titre-classement">{t.classementEffectif(lignes.length, etat.poules.length)}</h3>
        <span class="discret">{t.etatPoules(terminees, enCours)}</span>
      </header>
      <div class="defile">
        <table>
          <thead>
            <tr>
              <th scope="col" class="droite"><abbr title={t.colonnesLongues.rang}>{t.colonnes.rang}</abbr></th>
              <th scope="col" class="gauche">{t.tireur}</th>
              <th scope="col" class="gauche">{t.club}</th>
              <th scope="col">{t.poulesColonne}</th>
              <th scope="col"><abbr title={t.colonnesLongues.victoires}>{t.colonnes.victoires}</abbr></th>
              <th scope="col"><abbr title={t.matchsTires}>M</abbr></th>
              <th scope="col"><abbr title={t.colonnesLongues.ratio}>{t.colonnes.ratio}</abbr></th>
              <th scope="col"><abbr title={t.colonnesLongues.indice}>{t.colonnes.indice}</abbr></th>
              <th scope="col"><abbr title={t.colonnesLongues.td}>{t.colonnes.td}</abbr></th>
              <th scope="col"><abbr title={t.colonnesLongues.tr}>{t.colonnes.tr}</abbr></th>
              <th scope="col" class="gauche">{t.etatColonne}</th>
            </tr>
          </thead>
          <tbody>
            {#each lignes as ligne, i (ligne.tireurId)}
              {@const tireur = tireurs.get(ligne.tireurId)}
              <tr class:podium={i < 3 && ligne.retrait === null} class:retire={ligne.retrait !== null}>
                <td class="droite rang"
                  >{ligne.rangGeneral ?? '—'}{#if ligne.exaequo}<span class="discret" title={t.exaequo}>=</span
                    >{/if}</td
                >
                <th scope="row" class="gauche nom"><strong>{tireur?.nom.toUpperCase()}</strong> {tireur?.prenom}</th>
                <td class="gauche discret">{tireur?.club}</td>
                <td>{ligne.poule}</td>
                <td>{ligne.victoires}</td>
                <td>{ligne.matchs}</td>
                <td><strong>{ratio(ligne.ratio)}</strong></td>
                <td>{signe(ligne.indice)}</td>
                <td>{ligne.touchesDonnees}</td>
                <td>{ligne.touchesRecues}</td>
                <td class="gauche">
                  {#if ligne.retrait}
                    <span class="motif">{t.motifs[ligne.retrait]}</span>
                  {:else if ligne.aTirer === 0}
                    <span class="termine">{t.pouleTerminee}</span>
                  {:else}
                    <span class="discret">{t.matchsATirer(ligne.aTirer)}</span>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <p class="pied">{t.classementLegende}</p>
    </section>
  {/if}
{/snippet}

{#if epreuve}
  <GabaritEpreuve {accueil} {epreuve} courante="classement" suite={t.classementTitre} {naviguer}>
    {@render etape()}
  </GabaritEpreuve>
{:else}
  <main>{@render etape()}</main>
{/if}

<style>
  .titre-etape {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem 1rem;
  }

  .identite {
    display: grid;
    gap: 0.25rem;
  }

  .ligne {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 0.75rem;
  }

  h2 {
    margin: 0;
    font-family: var(--police-titre, inherit);
    font-size: 1.6rem;
  }

  h3 {
    margin: 0;
    font-size: 1rem;
  }

  .pastille {
    padding: 0.15rem 0.75rem;
    border-radius: 999px;
    background: var(--etat-attente-fond);
    color: var(--sur-etat-attente-fond);
    font-size: 0.875rem;
    font-weight: 600;
  }

  .pastille.definitif {
    background: var(--etat-ok-fond);
    color: var(--sur-etat-ok-fond);
  }

  .discret {
    margin: 0;
    color: var(--texte-discret);
  }

  .carte {
    border: 1px solid var(--bordure);
    border-radius: 14px;
    background: var(--surface);
    overflow: hidden;
  }

  header {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.25rem 1rem;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--bordure);
  }

  header .discret {
    font-size: 0.875rem;
  }

  .defile {
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-variant-numeric: tabular-nums;
    text-align: center;
  }

  thead th {
    color: var(--texte-discret);
    font-size: 0.875rem;
    font-weight: 600;
  }

  th,
  td {
    padding: 0.6rem 0.5rem;
  }

  tbody tr {
    border-top: 1px solid var(--bordure);
  }

  tbody th {
    font-weight: 400;
  }

  abbr {
    text-decoration: none;
  }

  .gauche {
    text-align: left;
  }

  .droite {
    padding-left: 1rem;
    text-align: right;
  }

  .rang {
    font-weight: 600;
  }

  .nom {
    white-space: nowrap;
  }

  tr.podium {
    background: var(--accent-teinte);
  }

  tr.retire {
    color: var(--texte-discret);
  }

  .motif {
    padding: 0.1rem 0.6rem;
    border-radius: 999px;
    background: var(--etat-attente-fond);
    color: var(--sur-etat-attente-fond);
    font-size: 0.8rem;
    font-weight: 600;
  }

  .termine {
    color: var(--sur-etat-ok-fond);
    font-size: 0.875rem;
  }

  td .discret {
    font-size: 0.875rem;
  }

  .pied {
    margin: 0;
    padding: 0.75rem 1rem;
    border-top: 1px solid var(--bordure);
    color: var(--texte-discret);
    font-size: 0.875rem;
  }

  .message {
    margin: 0;
    color: var(--etat-erreur);
  }
</style>

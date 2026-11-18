<script lang="ts">
  // Poules constituées (US-086 et US-087, planche 9) : une carte par poule, avec ses tireurs et ses alertes (club en
  // double, taille hors de 5 à 7).
  import {
    clubsEnDouble,
    moyenneDesClassements,
    TAILLE_CONSEILLEE_MAX,
    TAILLE_CONSEILLEE_MIN,
    type EtatPoules,
    type Poule,
    type Tireur,
  } from '@poule-position/domaine';
  import Icone from './Icone.svelte';
  import { textes } from '../lib/textes';

  interface Proprietes {
    etat: EtatPoules;
    tireurs: Tireur[];
    manuelle: boolean;
    modifiable: boolean;
    repartirANouveau: () => void;
  }

  let { etat, tireurs, manuelle, modifiable, repartirANouveau }: Proprietes = $props();

  const t = textes.poules;
  const parId = $derived(new Map(tireurs.map((tireur) => [tireur.id, tireur])));
  const tailles = $derived(
    [...new Set(etat.poules.map(({ tireurIds }) => tireurIds.length))].filter((n) => n > 0).sort((a, b) => b - a),
  );
  const pistes = $derived(etat.poules.map(({ piste }) => piste));
  const resume = $derived(
    t.resume(
      etat.poules.length,
      tailles.length === 0 ? '' : `de ${tailles.join(' ou ')}`,
      t.pistesDe(Math.min(...pistes), Math.max(...pistes)),
      manuelle,
    ),
  );

  const alertes = (poule: Poule) => {
    const liste = clubsEnDouble(poule, tireurs).map(({ club, nombre }) => t.clubEnDouble(nombre, club));
    const taille = poule.tireurIds.length;
    if (taille > 0 && (taille < TAILLE_CONSEILLEE_MIN || taille > TAILLE_CONSEILLEE_MAX)) {
      liste.push(t.tailleHorsBornes(taille));
    }
    return liste;
  };
</script>

<div class="titre-etape">
  <div class="identite">
    <div class="ligne">
      <h2>{t.titre}</h2>
      <span class="pastille">{t.aVerifier}</span>
    </div>
    <p class="discret">{resume}</p>
  </div>
  {#if modifiable && !etat.lancees}
    <div class="actions">
      <button type="button" class="secondaire" onclick={repartirANouveau}>
        <Icone nom="flechesCroisees" taille={20} />{t.repartirANouveau}
      </button>
    </div>
  {/if}
</div>

<div class="grille">
  {#each etat.poules as poule (poule.numero)}
    {@const moyenne = moyenneDesClassements(poule, tireurs)}
    {@const signalements = alertes(poule)}
    <section class="carte" aria-labelledby="poule-{poule.numero}">
      <header>
        <h3 id="poule-{poule.numero}">{t.poule(poule.numero)}</h3>
        <span class="discret">{t.tireursPoule(poule.tireurIds.length)}{moyenne === null ? '' : t.moyenne(moyenne)}</span
        >
        <span class="piste">{t.pisteN(poule.piste)}</span>
      </header>
      {#each signalements as signalement (signalement)}
        <p class="alerte"><Icone nom="alerte" taille={18} />{signalement}</p>
      {/each}
      {#if poule.tireurIds.length === 0}
        <p class="vide">{t.pouleVide}</p>
      {:else}
        <ol>
          {#each poule.tireurIds as id (id)}
            {@const tireur = parId.get(id)}
            {#if tireur}
              <li>
                <span class="rang">{tireur.classement ?? '—'}</span>
                <span><strong>{tireur.nom.toUpperCase()}</strong> {tireur.prenom}</span>
                <span class="club">{tireur.club}</span>
              </li>
            {/if}
          {/each}
        </ol>
      {/if}
    </section>
  {/each}
</div>

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

  .discret,
  .vide {
    margin: 0;
    color: var(--texte-discret);
    font-size: 0.875rem;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  button {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    min-height: 2.75rem;
    padding: 0 1rem;
    border-radius: var(--rayon);
    font: inherit;
    cursor: pointer;
  }

  .secondaire {
    border: 1px solid var(--bordure-champ);
    background: var(--surface);
    color: var(--texte);
  }

  .grille {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(22rem, 1fr));
    gap: 1rem;
    align-items: start;
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
    gap: 0.25rem 0.6rem;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--bordure);
  }

  .piste {
    margin-left: auto;
    font-size: 0.875rem;
  }

  .alerte {
    display: flex;
    gap: 0.5rem;
    margin: 0;
    padding: 0.6rem 1rem;
    background: var(--etat-attente-fond);
    color: var(--sur-etat-attente-fond);
    font-size: 0.875rem;
  }

  .vide {
    padding: 1rem;
  }

  ol {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: grid;
    grid-template-columns: 2.5rem minmax(0, 1fr) auto;
    gap: 0.6rem;
    align-items: center;
    min-height: 3rem;
    padding: 0 1rem;
  }

  li + li {
    border-top: 1px solid var(--bordure);
  }

  .rang {
    text-align: right;
    color: var(--texte-discret);
  }

  .club {
    color: var(--texte-discret);
    font-size: 0.875rem;
  }
</style>

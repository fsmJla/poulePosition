<script lang="ts">
  // Tableau à afficher (US-127, planche 29) : l'arbre en paysage, par colonnes de tours ; chaque match montre ses deux
  // tireurs (rang, nom), les touches et le vainqueur en gras, ou son état (piste, à tirer) ; une place encore inconnue
  // est une ligne pointillée à remplir. A4 : les 4 derniers tours sur la dernière page ; A3 : jusqu'au tableau de 32 sur
  // une page. Le match pour la 3e place est sous la finale.
  import {
    pagesTableau,
    placesAffichees,
    type MatchTableau,
    type PlaceTableau,
    type StructureTableau,
    type Tireur,
  } from '@poule-position/domaine';
  import { textes } from '../../lib/textes';
  import FeuilleImprimee from '../FeuilleImprimee.svelte';

  interface Proprietes {
    structure: StructureTableau;
    format: 'a4' | 'a3';
    tireurs: ReadonlyMap<string, Tireur>;
    contexte: string;
    imprimeLe: Date;
  }

  let { structure, format, tireurs, contexte, imprimeLe }: Proprietes = $props();

  const t = textes.impressions.tableau;
  const tt = textes.tableau;
  const pages = $derived(pagesTableau(structure, format));
  const nom = (place: PlaceTableau) => {
    const tireur = place.tireurId ? tireurs.get(place.tireurId) : undefined;
    return tireur ? `${tireur.nom.toUpperCase()} ${tireur.prenom}` : t.aRemplir;
  };
  const titre = (page: (typeof pages)[number]) => {
    const premier = page.colonnes[0]!.taille;
    const dernier = page.colonnes.at(-1)!.taille;
    return premier === dernier ? t.titreTour(tt.nomDuTour(premier)) : t.titre(tt.nomDuTour(premier));
  };
</script>

{#snippet boite(match: MatchTableau)}
  {@const { places, touches } = placesAffichees(match)}
  <div class="match">
    {#each [0, 1] as i (i)}
      {@const place = places[i as 0 | 1]}
      <p class="ligne" class:gagne={match.vainqueur !== null && match.vainqueur === place.tireurId}>
        <span class="rang">{place.rang ? `(${place.rang})` : ''}</span>
        <span class="nom" class:vide={!place.tireurId}
          >{match.etat === 'exempt' && !place.tireurId ? '' : nom(place)}</span
        >
        <span class="score">{touches ? touches[i] : ''}</span>
      </p>
    {/each}
    <p class="etat">
      {match.etat === 'exempt' ? tt.etatMatch(match) : match.etat === 'attente' ? '' : tt.etatMatch(match)}
    </p>
  </div>
{/snippet}

{#each pages as page, i (i)}
  <FeuilleImprimee
    {contexte}
    titre={titre(page)}
    numero={i + 1}
    total={pages.length}
    {imprimeLe}
    orientation="paysage"
    papier={format}
    pied={t.legende}
  >
    <div class="colonnes" style:--colonnes={page.colonnes.length}>
      {#each page.colonnes as colonne (colonne.taille)}
        <section class="colonne" aria-label={tt.nomDuTour(colonne.taille)}>
          <h2>{tt.nomDuTour(colonne.taille)}</h2>
          <div class="matchs" class:etale={page.colonnes.length === 1}>
            {#each colonne.matchs as match (match.id)}{@render boite(match)}{/each}
            {#if colonne.taille === 2 && page.troisieme}
              <h2 class="troisieme">{tt.titreMatch(0, 1)}</h2>
              {@render boite(page.troisieme)}
            {/if}
          </div>
        </section>
      {/each}
    </div>
  </FeuilleImprimee>
{/each}

<style>
  .colonnes {
    flex: 1;
    display: grid;
    grid-template-columns: repeat(var(--colonnes), minmax(0, 1fr));
    gap: 7mm;
    min-height: 0;
  }

  .colonne {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  h2 {
    margin: 0 0 1.5mm;
    color: var(--papier-marque);
    font-size: 10.5pt;
  }

  .troisieme {
    margin-top: 4mm;
  }

  .matchs {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: space-around;
    gap: 1mm;
  }

  /* Une page d'un seul tour (premier tour d'un grand tableau) : ses matchs sur deux colonnes de 8. */
  .matchs.etale {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-template-rows: repeat(8, auto);
    grid-auto-flow: column;
    align-content: space-around;
    gap: 2mm 8mm;
  }

  .match {
    border: 1px solid var(--papier-trait);
    font-size: 8.5pt;
    break-inside: avoid;
  }

  .ligne {
    display: flex;
    gap: 1mm;
    margin: 0;
    padding: 0.6mm 1.5mm;
    border-bottom: 1px solid var(--papier-filet);
  }

  .gagne {
    font-weight: 700;
  }

  .rang {
    width: 7mm;
    color: var(--papier-encre-discrete);
  }

  .nom {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .nom.vide {
    color: var(--papier-trait);
  }

  .score {
    width: 5mm;
    text-align: right;
  }

  .etat {
    margin: 0;
    padding: 0.3mm 1.5mm;
    color: var(--papier-encre-discrete);
    font-size: 7.5pt;
  }
</style>

<script lang="ts">
  // Feuilles de match du tableau (US-126, planche 28) : les matchs à tirer d'un tour, deux par page A4, séparés par
  // « couper ici » ; pour chacun : le match, sa piste, les tireurs à gauche (meilleur rang) et à droite, une case de
  // touches chacun, le vainqueur, « au temps », la priorité, trois signatures et le tour suivant du vainqueur.
  import {
    decouperEnPages,
    matchsAImprimer,
    placesAffichees,
    type PlaceTableau,
    type StructureTableau,
    type Tireur,
  } from '@poule-position/domaine';
  import { textes } from '../../lib/textes';
  import FeuilleImprimee from '../FeuilleImprimee.svelte';

  interface Proprietes {
    structure: StructureTableau;
    tour: number;
    tireurs: ReadonlyMap<string, Tireur>;
    contexte: string;
    imprimeLe: Date;
  }

  let { structure, tour, tireurs, contexte, imprimeLe }: Proprietes = $props();

  const t = textes.impressions.feuillesMatch;
  const tt = textes.tableau;
  const pages = $derived(decouperEnPages(matchsAImprimer(structure, tour), 2));
  const suite = (taille: number) => (taille <= 2 ? t.finale : t.suite(tt.nomDuTour(taille / 2)));
  const tireurDe = (place: PlaceTableau) => (place.tireurId ? tireurs.get(place.tireurId) : undefined);
</script>

{#each pages as paire, i (i)}
  <FeuilleImprimee
    {contexte}
    titre={t.titre(tt.nomDuTour(tour))}
    numero={i + 1}
    total={pages.length}
    {imprimeLe}
    pied={t.pied}
  >
    {#each paire as match, j (match.id)}
      {@const { places } = placesAffichees(match)}
      <section class="match" aria-label={tt.titreMatch(match.tour, match.numero)}>
        <div class="tete">
          <h2>{tt.titreMatch(match.tour, match.numero)}</h2>
          <p class="piste">{t.piste(match.piste)}</p>
        </div>
        <div class="tireurs">
          {#each [places[0], places[1]] as place, k (k)}
            {@const tireur = tireurDe(place)}
            <div class="tireur">
              <p class="cote">{k === 0 ? t.cotes.gauche : t.cotes.droite}</p>
              <p class="nom">
                <span class="rang">({place.rang})</span> <strong>{tireur?.nom.toUpperCase()}</strong>
                {tireur?.prenom}
              </p>
              <p class="club">{tireur?.club}</p>
              <p class="touches">{t.touches} <span class="boite"></span></p>
            </div>
          {/each}
        </div>
        <p class="issue"><span>{t.vainqueur}</span><span>{t.auTemps}</span><span>{t.priorite}</span></p>
        <div class="signatures">
          {#each t.signatures as signature (signature)}<div class="signature">{signature}</div>{/each}
        </div>
        <p class="note">{t.rapporter} {match.tour === 0 ? '' : suite(match.tour)}</p>
      </section>
      {#if j === 0 && paire.length === 2}<p class="couper" aria-hidden="true">{t.couper}</p>{/if}
    {/each}
  </FeuilleImprimee>
{/each}

<style>
  .match {
    display: flex;
    flex-direction: column;
    gap: 3.5mm;
    height: 113mm;
    box-sizing: border-box;
    padding: 2mm 0;
  }

  .tete {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 4mm;
    padding-bottom: 1.5mm;
    border-bottom: 1px solid #555555;
  }

  h2 {
    margin: 0;
    color: #2f4b4a;
    font-family: var(--police-titre);
    font-size: 16pt;
  }

  .piste {
    margin: 0;
    font-size: 13pt;
    font-weight: 700;
  }

  .tireurs {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6mm;
  }

  .tireur p {
    margin: 0 0 1.2mm;
  }

  .cote {
    color: #444444;
    font-size: 9pt;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .nom {
    font-size: 13pt;
  }

  .rang,
  .club {
    color: #444444;
  }

  .club {
    font-size: 9.5pt;
  }

  .touches {
    display: flex;
    align-items: center;
    gap: 3mm;
    margin-top: 2mm !important;
  }

  .boite {
    width: 19mm;
    height: 14mm;
    border: 2px solid #111111;
  }

  .issue {
    display: flex;
    flex-wrap: wrap;
    gap: 2mm 6mm;
    margin: 0;
    font-size: 9.5pt;
  }

  .signatures {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 4mm;
  }

  .signature {
    height: 17mm;
    box-sizing: border-box;
    padding: 1.5mm 2mm;
    border: 1px solid #555555;
    font-size: 9pt;
    font-weight: 700;
  }

  .note {
    margin: 0;
    color: #444444;
    font-size: 9pt;
  }

  .couper {
    margin: 0;
    padding: 1mm 0;
    border-bottom: 2px dashed #777777;
    color: #555555;
    font-size: 8.5pt;
    text-align: center;
  }
</style>

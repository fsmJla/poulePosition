<script lang="ts">
  // Feuilles de poule à remplir (US-122, planche 24) : une page par poule, pour l'arbitre : « Poule N · Piste P », le QR
  // code des arbitres (US-096) s'il est gardé sur ce PC, la grille vide (diagonale foncée), l'ordre officiel des matchs
  // avec deux cases de score, les cadres « Arbitre » et « Fin de poule ».
  import { ordreDesMatchs, type Poule, type Tireur } from '@poule-position/domaine';
  import { textes } from '../../lib/textes';
  import CodeQr from '../CodeQr.svelte';
  import FeuilleImprimee from '../FeuilleImprimee.svelte';

  interface Proprietes {
    poules: readonly Poule[];
    /** Nombre total de poules de l'épreuve (pagination « Poule n / N »). */
    total: number;
    tireurs: ReadonlyMap<string, Tireur>;
    touches: number;
    /** Lien du QR code des arbitres, ou null sans jeton gardé sur ce PC. */
    lienArbitres: string | null;
    contexte: string;
    imprimeLe: Date;
  }

  let { poules, total, tireurs, touches, lienArbitres, contexte, imprimeLe }: Proprietes = $props();

  const t = textes.impressions.feuillePoule;
  const nom = (id: string) => tireurs.get(id)?.nom.toUpperCase() ?? '';
</script>

{#each poules as poule, i (poule.numero)}
  {@const matchs = ordreDesMatchs(poule.tireurIds.length)}
  {@const lignes = Math.ceil(matchs.length / 3)}
  <FeuilleImprimee
    {contexte}
    titre={t.titre(poule.numero, poule.piste)}
    numero={i + 1}
    total={poules.length}
    pagination={t.pagination(poule.numero, total)}
    {imprimeLe}
    pied={t.piedVierge}
  >
    {#snippet aDroite()}
      {#if lienArbitres}
        <div class="qr">
          <CodeQr texte={lienArbitres} nom={t.qrNom(poule.numero)} taille={92} />
          <p>{t.qr}</p>
        </div>
      {/if}
    {/snippet}
    <p class="sous-titre">{t.sousTitre(poule.tireurIds.length, matchs.length, touches)}</p>
    <table class="grille">
      <thead>
        <tr>
          <th scope="col" class="gauche">{t.tireur}</th>
          <th scope="col" class="gauche">{t.club}</th>
          <th scope="col"><span class="invisible">N°</span></th>
          {#each poule.tireurIds as id, j (id)}<th scope="col" class="case">{j + 1}</th>{/each}
          {#each t.colonnes as colonne (colonne)}<th scope="col" class="case resultat">{colonne}</th>{/each}
        </tr>
      </thead>
      <tbody>
        {#each poule.tireurIds as id, ligne (id)}
          <tr>
            <th scope="row" class="gauche nom"><strong>{nom(id)}</strong> {tireurs.get(id)?.prenom}</th>
            <td class="gauche club">{tireurs.get(id)?.club}</td>
            <td class="numero">{ligne + 1}</td>
            {#each poule.tireurIds as autre, colonne (autre)}
              <td class="case" class:diagonale={ligne === colonne}></td>
            {/each}
            {#each t.colonnes as colonne (colonne)}<td class="case"></td>{/each}
          </tr>
        {/each}
      </tbody>
    </table>

    <section aria-label={t.ordreSimple}>
      <h2>{t.ordre(touches)}</h2>
      <ol style:grid-template-rows="repeat({lignes}, auto)">
        {#each matchs as [a, b], k (k)}
          <li>
            <span class="rang">{k + 1}.</span>
            <span
              ><strong>{nom(poule.tireurIds[a - 1]!)}</strong> ({a}) – <strong>{nom(poule.tireurIds[b - 1]!)}</strong>
              ({b})</span
            >
            <span class="score"><span class="boite"></span>–<span class="boite"></span></span>
          </li>
        {/each}
      </ol>
    </section>

    <div class="cadres">
      <div class="cadre">
        <p class="fort">{t.arbitre}</p>
        <p>{t.nom}</p>
        <p>{t.signature}</p>
      </div>
      <div class="cadre">
        <p class="fort">{t.fin}</p>
        <p>{t.heure}</p>
        <p>{t.rapporter}</p>
      </div>
    </div>
  </FeuilleImprimee>
{/each}

<style>
  .qr {
    display: flex;
    align-items: center;
    gap: 3mm;
  }

  .qr p {
    width: 32mm;
    margin: 0;
    font-size: 9pt;
  }

  .sous-titre {
    margin: 0;
    font-size: 11pt;
  }

  .grille {
    border-collapse: collapse;
    font-size: 10.5pt;
  }

  .grille th,
  .grille td {
    padding: 1mm 1.5mm;
    border: 1px solid #555555;
    text-align: center;
  }

  .grille thead th {
    border: none;
    font-size: 9.5pt;
  }

  .grille tbody tr {
    height: 11.5mm;
  }

  .gauche {
    text-align: left !important;
  }

  .nom {
    font-weight: 400;
    white-space: nowrap;
  }

  .club {
    font-size: 9pt;
  }

  .numero {
    font-weight: 700;
  }

  .case {
    width: 11mm;
  }

  .diagonale {
    background: #2f4b4a;
    print-color-adjust: exact;
  }

  h2 {
    margin: 0 0 2mm;
    font-size: 11pt;
  }

  ol {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    grid-auto-flow: column;
    gap: 1.5mm 5mm;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: grid;
    grid-template-columns: 6mm minmax(0, 1fr) auto;
    align-items: center;
    gap: 1.5mm;
    padding: 1.2mm 0;
    border-bottom: 1px solid #cccccc;
  }

  .rang {
    color: #444444;
  }

  .score {
    display: inline-flex;
    align-items: center;
    gap: 1mm;
  }

  .boite {
    width: 7mm;
    height: 6mm;
    border: 1px solid #333333;
  }

  .cadres {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6mm;
    margin-top: auto;
  }

  .cadre {
    height: 24mm;
    box-sizing: border-box;
    padding: 2.5mm 3mm;
    border: 1px solid #555555;
  }

  .cadre p {
    margin: 0 0 2mm;
  }

  .fort {
    font-weight: 700;
  }

  .invisible {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
</style>

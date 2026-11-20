<script lang="ts">
  // Poules par piste, à afficher (US-124, planche 26) : un cadre par poule, « Poule N · Piste P », ses tireurs numérotés
  // (nom, prénom, club), en gros caractères ; six poules par page, sans couper une poule.
  import { decouperEnPages, type Poule, type Tireur } from '@poule-position/domaine';
  import { textes } from '../../lib/textes';
  import FeuilleImprimee from '../FeuilleImprimee.svelte';

  interface Proprietes {
    poules: readonly Poule[];
    tireurs: ReadonlyMap<string, Tireur>;
    contexte: string;
    imprimeLe: Date;
  }

  let { poules, tireurs, contexte, imprimeLe }: Proprietes = $props();

  const t = textes.impressions.poulesPistes;
  const tf = textes.impressions.feuillePoule;
  const pages = $derived(decouperEnPages(poules, 6));
</script>

{#each pages as groupe, i (i)}
  <FeuilleImprimee
    {contexte}
    titre={t.titre}
    numero={i + 1}
    total={pages.length}
    {imprimeLe}
    pied={textes.impressions.feuillePoule.piedResultats}
  >
    {#if i === 0}<p class="sous-titre">{t.sousTitre(poules.length)}</p>{/if}
    <div class="poules">
      {#each groupe as poule (poule.numero)}
        <section aria-label={tf.titre(poule.numero, poule.piste)}>
          <h2>{tf.titre(poule.numero, poule.piste)}</h2>
          <ol>
            {#each poule.tireurIds as id, j (id)}
              {@const tireur = tireurs.get(id)}
              <li>
                <span class="numero">{j + 1}</span>
                <span
                  ><strong>{tireur?.nom.toUpperCase()}</strong>
                  {tireur?.prenom}<br /><span class="club">{tireur?.club}</span></span
                >
              </li>
            {/each}
          </ol>
        </section>
      {/each}
    </div>
  </FeuilleImprimee>
{/each}

<style>
  .sous-titre {
    margin: 0;
    font-size: 13pt;
  }

  .poules {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-content: start;
    gap: 6mm;
  }

  section {
    border: 2px solid #2f4b4a;
    border-radius: 2.5mm;
    overflow: hidden;
    break-inside: avoid;
  }

  h2 {
    margin: 0;
    padding: 2mm 4mm;
    background: #2f4b4a;
    color: #ffffff;
    font-family: var(--police-titre);
    font-size: 17pt;
    print-color-adjust: exact;
  }

  ol {
    margin: 0;
    padding: 1.5mm 4mm 3mm;
    list-style: none;
    font-size: 12pt;
  }

  li {
    display: grid;
    grid-template-columns: 7mm minmax(0, 1fr);
    gap: 1.5mm;
    padding: 1.6mm 0;
    border-bottom: 1px solid #cccccc;
    line-height: 1.25;
  }

  .numero {
    font-weight: 700;
  }

  .club {
    color: #444444;
    font-size: 9.5pt;
  }
</style>

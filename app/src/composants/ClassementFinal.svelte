<script lang="ts">
  // Classement final d'une épreuve (US-115), au gabarit de la planche 20 « Classement des poules » : une ligne par tireur,
  // place (« 3= » pour des ex aequo), nom, club, tour d'élimination, rang après poules et état. « Provisoire » tant qu'un
  // match reste à régler ; seules les places acquises sont données.
  import type { LigneClassementFinal, Tireur } from '@poule-position/domaine';
  import { textes } from '../lib/textes';

  interface Proprietes {
    lignes: LigneClassementFinal[];
    tireurs: ReadonlyMap<string, Tireur>;
    /** Avancement du tableau : matchs réglés sur matchs à tirer. */
    regles: number;
    total: number;
    /** US-151 CA-4 : par équipes, les tireurs de chaque équipe, affichés sous son nom. */
    membres?: ReadonlyMap<string, string>;
    /** US-158 CA-6 : l'épreuve a été terminée avant la fin du tableau. */
    finAnticipee?: boolean;
  }

  let { lignes, tireurs, regles, total, membres, finAnticipee = false }: Proprietes = $props();

  const t = textes.tableau;
  const tp = textes.poules;
  const definitif = $derived(regles === total || finAnticipee);
</script>

<section class="carte" aria-labelledby="titre-classement-final">
  <header>
    <h3 id="titre-classement-final">
      {t.classementFinal} · {membres ? textes.equipes.effectif(lignes.length) : t.effectif(lignes.length)}
    </h3>
    <span class="pastille" class:definitif role="status"
      >{definitif ? t.classementDefinitif : t.classementProvisoire(regles, total)}</span
    >
  </header>
  {#if finAnticipee}<p class="discret mention" role="note">{t.finAnticipee}</p>{/if}
  <div class="defile">
    <table>
      <thead>
        <tr>
          <th scope="col" class="droite">{t.colonnes.place}</th>
          <th scope="col" class="gauche">{t.colonnes.tireur}</th>
          <th scope="col" class="gauche">{t.colonnes.club}</th>
          <th scope="col" class="gauche">{t.colonnes.tour}</th>
          <th scope="col">{t.colonnes.rang}</th>
          <th scope="col" class="gauche">{t.colonnes.etat}</th>
        </tr>
      </thead>
      <tbody>
        {#each lignes as ligne (ligne.tireurId)}
          {@const tireur = tireurs.get(ligne.tireurId)}
          <tr class:podium={ligne.place !== null && ligne.place <= 3} class:retire={ligne.place === null}>
            <td class="droite place"
              >{ligne.place ?? '—'}{#if ligne.exaequo}<span class="discret" title={tp.exaequo}>=</span>{/if}</td
            >
            <th scope="row" class="gauche nom"
              ><strong>{tireur?.nom.toUpperCase()}</strong>
              {tireur?.prenom}{#if membres?.get(ligne.tireurId)}<span class="membres"
                  >{membres.get(ligne.tireurId)}</span
                >{/if}</th
            >
            <td class="gauche discret">{tireur?.club}</td>
            <td class="gauche">{t.tourElimination(ligne.elimineAu)}</td>
            <td>{ligne.rang ?? '—'}</td>
            <td class="gauche">
              {#if ligne.retrait}
                <span class="motif">{t.motifCourt(ligne.retrait)}</span>
              {:else if ligne.etat !== 'classe'}
                <span class="discret">{t.etatsClassement[ligne.etat]}</span>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  <p class="pied">{t.legendeClassement}</p>
</section>

<style>
  .membres {
    display: block;
    color: var(--texte-discret);
    font-size: 0.85rem;
    font-weight: 400;
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
    align-items: center;
    gap: 0.25rem 1rem;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--bordure);
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
    color: var(--texte-discret);
  }

  .mention {
    margin: 0;
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

  .gauche {
    text-align: left;
  }

  .droite {
    padding-left: 1rem;
    text-align: right;
  }

  .place {
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
</style>

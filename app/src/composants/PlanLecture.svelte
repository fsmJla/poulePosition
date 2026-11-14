<script lang="ts">
  // Le plan d'une manifestation en lecture seule (US-047 CA-5, étape « Vérifier ») : les compétitions en lignes, les jours en
  // colonnes, une puce par épreuve. Le plan est construit par le domaine (`construireListePlan`, US-049).
  import type { Plan } from '@poule-position/domaine';
  import { textes } from '../lib/textes';

  interface Proprietes {
    plan: Plan;
  }

  let { plan }: Proprietes = $props();

  const t = textes.plan;
  const te = textes.epreuves;
  const libelleJour = (jour: string | null) => (jour === null ? t.jourAFixer : te.dateLongue(jour));
</script>

{#if plan.lignes.length === 0}
  <p class="vide">{textes.assistant.planVide}</p>
{:else}
  <div class="defilement">
    <table aria-label={t.colonnes}>
      <thead>
        <tr>
          <th scope="col">{t.competition}</th>
          {#each plan.colonnes as colonne (colonne.jour ?? 'a-fixer')}<th scope="col">{libelleJour(colonne.jour)}</th
            >{/each}
        </tr>
      </thead>
      <tbody>
        {#each plan.lignes as ligne (ligne.competition.id)}
          <tr>
            <th scope="row" class="competition">
              <div class="entree">
                <span class="couleur" style="--couleur: var(--plan-{ligne.couleur})" aria-hidden="true"></span>
                {ligne.competition.nom}
              </div>
            </th>
            {#each ligne.cases as tuiles, indice (indice)}
              <td>
                {#each tuiles as tuile (tuile.id)}
                  <span class="puce"
                    >{t.titreTuile(tuile.categorie ?? tuile.nom, tuile.sexe ? te.sexes[tuile.sexe] : null)}</span
                  >
                {/each}
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}

<style>
  .defilement {
    overflow-x: auto;
  }

  table {
    border-collapse: collapse;
    width: 100%;
  }

  th,
  td {
    padding: 0.5rem;
    border-bottom: 1px solid var(--bordure-champ);
    text-align: left;
    vertical-align: top;
  }

  thead th {
    text-transform: capitalize;
  }

  /* La cellule reste une cellule de tableau (sinon son trait de séparation est plus court et décalé, US-068) : la mise en
     ligne du liseré et du nom se fait dans un bloc interne. */
  .entree {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .couleur {
    flex: none;
    width: 0.4rem;
    height: 1.5rem;
    border-radius: 0.2rem;
    background: var(--couleur);
  }

  .puce {
    display: inline-block;
    margin: 0 0.3rem 0.3rem 0;
    padding: 0.15rem 0.5rem;
    border: 1px solid var(--bordure-champ);
    border-radius: 999px;
    background: var(--surface);
    font-size: 0.9rem;
  }

  .vide {
    margin: 0;
    color: var(--texte-discret);
  }
</style>

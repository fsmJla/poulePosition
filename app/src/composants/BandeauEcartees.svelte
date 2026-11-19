<script lang="ts">
  // Saisies smartphone écartées (US-102 CA-7, ADR-0005) : au retour de la table, une saisie dont le match avait déjà un
  // score (saisi depuis la feuille papier) est rejetée — le PC fait foi. Le bandeau les compte et ouvre leur liste :
  // le match, le score proposé, le score retenu, l'auteur.
  import { matchsDePoule, type EtatPoules, type LigneSaisie } from '@poule-position/domaine';
  import { textes } from '../lib/textes';
  import Icone from './Icone.svelte';

  interface Proprietes {
    lignes: LigneSaisie[];
    etat: EtatPoules;
    touches: number;
    /** Identifiants des tireurs par nom affiché (pour retrouver le score retenu). */
    nomsVersIds: Map<string, string>;
  }

  let { lignes, etat, touches, nomsVersIds }: Proprietes = $props();

  const t = textes.saisie.recues;

  const ecartees = $derived(lignes.filter((l) => l.resultat === 'refusee' && l.motif === 'MATCH_DEJA_SAISI'));
  let vues = $state(0);
  let ouvert = $state(false);
  const visible = $derived(ecartees.length > vues);

  const retenu = (l: LigneSaisie) => {
    const poule = etat.poules.find(({ numero }) => numero === l.poule);
    const a = nomsVersIds.get(l.nomA);
    const b = nomsVersIds.get(l.nomB);
    const match = poule
      ? matchsDePoule(etat, poule, touches).find(
          (m) => (m.tireurA === a && m.tireurB === b) || (m.tireurA === b && m.tireurB === a),
        )
      : undefined;
    if (!match?.touches) return '—';
    return match.tireurA === a ? `${match.touches[0]}–${match.touches[1]}` : `${match.touches[1]}–${match.touches[0]}`;
  };
  const libelleMatch = (l: LigneSaisie) =>
    l.numero === null ? t.poule(l.poule) : `${t.match(l.poule, l.numero)} (${l.nomA} – ${l.nomB})`;
</script>

{#if visible}
  <div class="ecartees" role="status">
    <div class="ligne">
      <Icone nom="alerte" />
      <span class="texte">{t.ecartees(ecartees.length)}</span>
      <button type="button" class="lien" aria-expanded={ouvert} onclick={() => (ouvert = !ouvert)}
        >{t.voirEcartees}</button
      >
      <button
        type="button"
        class="lien"
        onclick={() => {
          vues = ecartees.length;
          ouvert = false;
        }}>{t.fermer}</button
      >
    </div>
    {#if ouvert}
      <ul>
        {#each ecartees as l, i (`${l.date}-${i}`)}
          <li>{t.ecarteeLigne(libelleMatch(l), `${l.touchesA}–${l.touchesB}`, retenu(l), l.par ?? '')}</li>
        {/each}
      </ul>
    {/if}
  </div>
{/if}

<style>
  .ecartees {
    display: grid;
    gap: 6px;
    padding: 10px 14px;
    border: 1px solid var(--etat-attente-bordure);
    border-radius: 12px;
    background: var(--etat-attente-fond);
    color: var(--texte);
  }

  .ligne {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .ligne > :global(svg) {
    color: var(--sur-etat-attente-fond);
  }

  .texte {
    flex: 1;
    font-weight: 600;
  }

  .lien {
    min-height: 44px;
    padding: 0 4px;
    border: none;
    background: none;
    color: var(--accent);
    font: inherit;
    font-weight: 600;
    text-decoration: underline;
    cursor: pointer;
  }

  ul {
    margin: 0;
    padding-left: 1.5rem;
    font-size: 0.9375rem;
  }
</style>

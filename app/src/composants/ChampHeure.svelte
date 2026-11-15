<script lang="ts">
  // Champ d'heure (US-069) : deux listes, heures (00 à 23) et minutes (00, 15, 30, 45), à la place de `<input type="time">`,
  // qui ne peut pas limiter les minutes. La valeur est « HH:MM », ou vide (« Aucune heure »). Une valeur enregistrée avec
  // d'autres minutes (ancien format, import) reste affichée et conservée : elle s'ajoute à la liste, sans être arrondie.
  import { avecHeure, avecMinute, decouperHeure, HEURES, minutesProposees } from '../lib/heure';
  import { textes } from '../lib/textes';

  interface Proprietes {
    /** Identifiant de base (`<id>-heures`, `<id>-minutes`). */
    id: string;
    /** Libellé visible du champ, repris dans les noms accessibles des deux listes. */
    libelle: string;
    value: string;
    disabled?: boolean;
    invalide?: boolean;
    decritPar?: string;
  }

  let { id, libelle, value = $bindable(''), disabled = false, invalide = false, decritPar }: Proprietes = $props();

  const t = textes.heure;
  const decoupe = $derived(decouperHeure(value));
  const heure = $derived(decoupe?.heure ?? '');
  const minute = $derived(decoupe?.minute ?? '');
  const minutes = $derived(minutesProposees(value));

  const choisirHeure = (evenement: Event) =>
    (value = avecHeure(value, (evenement.currentTarget as HTMLSelectElement).value));
  const choisirMinute = (evenement: Event) =>
    (value = avecMinute(value, (evenement.currentTarget as HTMLSelectElement).value));
</script>

<div class="heure" role="group" aria-label={libelle} aria-describedby={decritPar}>
  <select
    id="{id}-heures"
    aria-label={t.heures(libelle)}
    aria-invalid={invalide ? 'true' : undefined}
    {disabled}
    value={heure}
    onchange={choisirHeure}
  >
    <option value="">{t.aucune}</option>
    {#each HEURES as h (h)}<option value={h}>{h}</option>{/each}
  </select>
  <span aria-hidden="true">:</span>
  <select
    id="{id}-minutes"
    aria-label={t.minutes(libelle)}
    aria-invalid={invalide ? 'true' : undefined}
    disabled={disabled || heure === ''}
    value={minute}
    onchange={choisirMinute}
  >
    {#if heure === ''}<option value="">--</option>{/if}
    {#each minutes as m (m)}<option value={m}>{m}</option>{/each}
  </select>
</div>

<style>
  .heure {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  select {
    min-width: 0;
    min-height: 44px;
    padding: 0.6rem 0.75rem;
    border: 1px solid var(--bordure-champ);
    border-radius: var(--rayon);
    background: var(--fond);
    color: var(--texte);
    font: inherit;
  }

  select:first-child {
    flex: 1 1 auto;
  }

  select[aria-invalid='true'] {
    border-color: var(--etat-erreur);
  }
</style>

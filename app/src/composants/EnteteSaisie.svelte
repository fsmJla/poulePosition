<script lang="ts">
  // Entête des écrans de saisie par smartphone (planches 12 à 18) : la marque, l'épreuve, et l'état de la table (le PC
  // pilote), dit par un texte et pas seulement par la couleur (US-097 CA-5).
  import { textes } from '../lib/textes';

  interface Proprietes {
    /** « M13 Dames · Sabre », ou rien tant que la vue n'est pas reçue. */
    epreuve: string | null;
    table: boolean;
  }

  let { epreuve, table }: Proprietes = $props();

  const t = textes.saisie;
</script>

<header class="entete">
  <div class="marque">
    <span class="nom">{t.marque}</span>
    {#if epreuve}<span class="epreuve">{epreuve}</span>{/if}
  </div>
  <span class="table" class:connectee={table} role="status">
    <span class="point" aria-hidden="true"></span>
    {table ? t.tableConnectee : t.tableDeconnectee}
  </span>
</header>

<style>
  .entete {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 16px;
    background: var(--marque);
    color: var(--sur-marque);
  }

  .marque {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .nom {
    font-family: var(--police-titre);
    font-weight: 700;
    font-size: 1.0625rem;
  }

  .epreuve {
    font-size: 0.8125rem;
    opacity: 0.9;
  }

  .table {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 28px;
    padding: 0 10px;
    border-radius: 999px;
    background: var(--etat-attente-fond);
    color: var(--sur-etat-attente-fond);
    font-size: 0.8125rem;
    font-weight: 600;
    white-space: nowrap;
  }

  .table.connectee {
    background: var(--etat-ok-fond);
    color: var(--sur-etat-ok-fond);
  }

  .point {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: var(--etat-attente);
  }

  .connectee .point {
    background: var(--etat-ok);
  }
</style>

<script lang="ts">
  // « Appareils connectés » (US-105, planche 21) : les smartphones entrés par QR code, qui ils sont, où ils saisissent,
  // s'ils sont connectés, combien de saisies ils ont faites ; « ⋯ › Exclure cet appareil… » coupe un seul appareil
  // (ADR-0007), « Réadmettre » lève l'exclusion. L'exclusion est inscrite au journal (le PC fait foi), puis envoyée au
  // serveur ; elle demande donc d'être en ligne.
  import { onMount } from 'svelte';
  import { lignesAppareils, type AppareilServeur, type Evenement, type LigneAppareil } from '@poule-position/domaine';
  import { ecrire, type Contexte } from '../lib/inscriptions';
  import type { Journal } from '../lib/journal';
  import type { PresencePilote } from '../lib/presence-pilote';
  import { textes } from '../lib/textes';
  import MenuActions from './MenuActions.svelte';

  interface Proprietes {
    epreuveId: string;
    dames: boolean;
    journal: Journal;
    presence: PresencePilote;
    /** Pilote en place : sinon la liste est en lecture seule. */
    pilote: boolean;
    contexte: Contexte;
    apresEcriture: () => void;
  }

  let { epreuveId, dames, journal, presence, pilote, contexte, apresEcriture }: Proprietes = $props();

  const t = textes.epreuves.appareils;

  let liste = $state<AppareilServeur[] | null>(null);
  let evenements = $state<Evenement[]>([]);
  let aExclure = $state<LigneAppareil | null>(null);
  let dialogue: HTMLDialogElement | undefined = $state();
  let enCours = $state(false);

  const lignes = $derived(liste ? lignesAppareils(liste, evenements) : []);
  const enLigne = $derived(lignes.filter((l) => l.connecte && !l.exclu).length);
  const exclus = $derived(lignes.filter((l) => l.exclu).length);

  const heure = (date: number) => {
    const d = new Date(date);
    return `${d.getHours()} h ${String(d.getMinutes()).padStart(2, '0')}`;
  };
  const etat = (l: LigneAppareil) => {
    const tireuse = l.role === 'tireur' && dames;
    if (l.exclu) return { texte: tireuse ? t.exclue : t.exclu, classe: 'exclu' };
    if (l.connecte) return { texte: tireuse ? t.connectee : t.connecte, classe: 'ok' };
    return { texte: l.vuLe ? t.vuA(heure(l.vuLe)) : t.jamaisVu, classe: 'attente' };
  };
  const qui = (l: LigneAppareil) => l.qui ?? (l.role === 'arbitre' ? t.arbitre : dames ? t.tireuse : t.tireur);

  async function relireJournal() {
    evenements = await journal.evenements(epreuveId);
  }

  onMount(() => {
    liste = presence.listeAppareils(epreuveId);
    void relireJournal();
    const arreter = presence.surAppareils((id) => {
      if (id !== epreuveId) return;
      liste = presence.listeAppareils(epreuveId);
      void relireJournal();
    });
    const arreterEtat = presence.surEtat(() => (liste = presence.listeAppareils(epreuveId)));
    return () => {
      arreter();
      arreterEtat();
    };
  });

  async function changer(ligne: LigneAppareil, exclu: boolean) {
    if (enCours) return;
    enCours = true;
    try {
      // Le journal d'abord (le PC fait foi), puis le serveur ferme la socket et refuse les reconnexions.
      await ecrire(journal, epreuveId, { type: 'AppareilExclu', donnees: { appareilId: ligne.id, exclu } }, contexte);
      presence.exclure(epreuveId, ligne.id, exclu);
      apresEcriture();
      await relireJournal();
    } finally {
      enCours = false;
      aExclure = null;
      dialogue?.close();
    }
  }

  function demanderExclusion(ligne: LigneAppareil) {
    aExclure = ligne;
    queueMicrotask(() => dialogue?.showModal());
  }
</script>

<section class="carte" aria-labelledby="titre-appareils">
  <div class="tete">
    <h3 id="titre-appareils">{t.titre}</h3>
    {#if liste}<span class="discret">{t.resume(enLigne, exclus)}</span>{/if}
  </div>
  <p class="discret aide">{t.aide}</p>

  {#if liste === null}
    <p class="discret aide" role="status">{t.horsLigne}</p>
  {:else if lignes.length === 0}
    <p class="discret aide" role="status">{t.aucun}</p>
  {:else}
    <div class="defile">
      <table>
        <thead>
          <tr>
            <th scope="col">{t.colonnes.appareil}</th>
            <th scope="col">{t.colonnes.qui}</th>
            <th scope="col">{t.colonnes.ou}</th>
            <th scope="col">{t.colonnes.etat}</th>
            <th scope="col" class="nombre">{t.colonnes.saisies}</th>
            <th scope="col"><span class="invisible">{t.colonnes.actions}</span></th>
          </tr>
        </thead>
        <tbody>
          {#each lignes as l (l.id)}
            {@const e = etat(l)}
            <tr class:grise={l.exclu}>
              <td class="discret">{l.id}</td>
              <td>{qui(l)}</td>
              <td>{l.poule === null ? '—' : t.poule(l.poule)}</td>
              <td><span class="etat"><span class={`point ${e.classe}`} aria-hidden="true"></span>{e.texte}</span></td>
              <td class="nombre">{t.saisies(l.saisies, l.refusees)}</td>
              <td>
                {#if pilote}
                  <MenuActions
                    id={`menu-appareil-${l.id}`}
                    nom={`${qui(l)} (${l.id})`}
                    contour={false}
                    actions={[
                      l.exclu
                        ? { libelle: t.readmettre, surChoix: () => void changer(l, false) }
                        : { libelle: t.exclure, destructive: true, surChoix: () => demanderExclusion(l) },
                    ]}
                  />
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</section>

{#if aExclure}
  <dialog
    bind:this={dialogue}
    aria-labelledby="titre-exclure"
    onclose={() => (aExclure = null)}
    oncancel={(evenement) => {
      if (enCours) evenement.preventDefault();
    }}
  >
    <h2 id="titre-exclure">{t.confirmerTitre(`${qui(aExclure)} (${aExclure.id})`)}</h2>
    <p>{t.confirmerDetail}</p>
    <div class="actions">
      <button type="button" class="secondaire" disabled={enCours} onclick={() => dialogue?.close()}>{t.annuler}</button>
      <button type="button" class="danger" disabled={enCours} onclick={() => aExclure && void changer(aExclure, true)}
        >{t.exclureConfirmer}</button
      >
    </div>
  </dialog>
{/if}

<style>
  .carte {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--bordure);
    border-radius: 14px;
    background: var(--surface);
  }

  .tete {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 12px;
    padding: 16px 20px 8px;
  }

  h3 {
    margin: 0;
    font-size: 1.25rem;
  }

  .discret {
    color: var(--texte-discret);
  }

  .aide {
    margin: 0;
    padding: 0 20px 12px;
    font-size: 0.875rem;
  }

  .defile {
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9375rem;
  }

  th {
    padding: 8px;
    color: var(--texte-discret);
    font-size: 0.8125rem;
    font-weight: 600;
    text-align: left;
  }

  td {
    padding: 4px 8px;
    border-top: 1px solid var(--bordure);
  }

  th:first-child,
  td:first-child {
    padding-left: 20px;
  }

  th:last-child,
  td:last-child {
    width: 44px;
    padding-right: 20px;
  }

  .nombre {
    text-align: right;
  }

  tr.grise {
    color: var(--texte-discret);
  }

  .etat {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .point {
    width: 8px;
    height: 8px;
    border-radius: 999px;
  }

  .point.ok {
    background: var(--etat-ok);
  }

  .point.attente {
    background: var(--etat-attente);
  }

  .point.exclu {
    background: var(--texte-discret);
  }

  .invisible {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }

  dialog {
    max-width: 28rem;
    padding: 20px;
    border: 1px solid var(--bordure);
    border-radius: 14px;
    background: var(--surface);
    color: var(--texte);
  }

  dialog h2 {
    font-size: 1.125rem;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .actions button {
    min-height: 44px;
    padding: 0 16px;
    border-radius: var(--rayon);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  .secondaire {
    border: 1px solid var(--bordure-champ);
    background: var(--surface);
    color: var(--texte);
  }

  .danger {
    border: none;
    background: var(--etat-erreur);
    color: var(--sur-accent);
  }
</style>

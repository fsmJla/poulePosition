<script lang="ts">
  // Carte de saisie d'un match du tableau (US-111, planche 11) : le match choisi, sa piste, les deux tireurs avec leur
  // rang, leurs touches et l'action principale « Valider le score ». Une égalité demande le vainqueur par priorité ; un
  // vainqueur qui n'atteint pas les touches du tableau gagne au temps. Le contrôle est celui du domaine.
  import {
    controleScoreTableau,
    matchsSuivants,
    placesAffichees,
    type DonneesScoreTableau,
    type MatchTableau,
    type StructureTableau,
    type Tireur,
  } from '@poule-position/domaine';
  import type { Snippet } from 'svelte';
  import { textes } from '../lib/textes';

  interface Proprietes {
    match: MatchTableau;
    structure: StructureTableau;
    tireurs: ReadonlyMap<string, Tireur>;
    /** Touches du tableau, d'après la formule en vigueur (US-028). */
    touches: number;
    modifiable: boolean;
    /** Écrit le score ; vrai s'il est enregistré. */
    saisir: (donnees: DonneesScoreTableau) => Promise<boolean>;
    choisir: (id: string) => void;
    /** Actions secondaires de la carte (appel sur une piste, retrait : US-112, US-113). */
    actions?: Snippet;
    /** US-112 : l'appel du match sur une piste, sous la piste. */
    appel?: Snippet;
  }

  let { match, structure, tireurs, touches, modifiable, saisir, choisir, actions, appel }: Proprietes = $props();

  const t = textes.tableau;
  const places = $derived(placesAffichees(match));
  const [haut, bas] = $derived(places.places);
  const nom = (id: string | null) => {
    const tireur = id ? tireurs.get(id) : undefined;
    return tireur ? `${tireur.nom.toUpperCase()} ${tireur.prenom}` : '';
  };
  const nomCourt = (id: string | null) => (id ? (tireurs.get(id)?.nom.toUpperCase() ?? '') : '');

  let touchesHaut = $state<number | null>(null);
  let touchesBas = $state<number | null>(null);
  let priorite = $state<'haut' | 'bas' | null>(null);
  let essaye = $state(false);
  let envoi = $state(false);
  let matchAffiche = '';

  // Le match change (choix dans l'arbre, ou score reçu) : les champs reprennent son score enregistré.
  $effect(() => {
    const cle = `${match.id}|${match.touches?.join('-') ?? ''}|${match.vainqueur ?? ''}`;
    if (cle === matchAffiche) return;
    matchAffiche = cle;
    touchesHaut = places.touches ? places.touches[0] : null;
    touchesBas = places.touches ? places.touches[1] : null;
    priorite = match.parPriorite ? (match.vainqueur === haut.tireurId ? 'haut' : 'bas') : null;
    essaye = false;
  });

  const nombre = (valeur: number | null | undefined) => (typeof valeur === 'number' ? valeur : Number.NaN);
  const egalite = $derived(typeof touchesHaut === 'number' && touchesHaut === touchesBas);
  const controle = $derived(
    controleScoreTableau(
      nombre(touchesHaut),
      nombre(touchesBas),
      touches,
      egalite ? (priorite === 'haut' ? 'A' : priorite === 'bas' ? 'B' : null) : null,
    ),
  );
  const auTemps = $derived(controle.ok && controle.auTemps);
  const vainqueur = $derived(controle.ok ? (controle.vainqueur === 'A' ? haut.tireurId : bas.tireurId) : null);
  /** CA-7 : un match réglé dont le match suivant est réglé ne se corrige plus. */
  const suivantRegle = $derived(
    match.etat === 'regle' ? (matchsSuivants(structure, match.id).find((m) => m.etat === 'regle') ?? null) : null,
  );
  const saisissable = $derived(
    modifiable && (match.etat === 'aTirer' || (match.etat === 'regle' && !match.retrait && !suivantRegle)),
  );
  const piste = $derived(
    match.piste === null
      ? t.pisteAAttribuer
      : match.enPiste || match.etat === 'regle'
        ? t.appele(match.piste, match.appeleA ?? 0)
        : t.enFile(match.piste),
  );

  async function valider(evenement: SubmitEvent) {
    evenement.preventDefault();
    essaye = true;
    if (!controle.ok || envoi || !haut.tireurId || !bas.tireurId) return;
    envoi = true;
    const donnees: DonneesScoreTableau = {
      match: match.id,
      tireurA: haut.tireurId,
      tireurB: bas.tireurId,
      touchesA: nombre(touchesHaut),
      touchesB: nombre(touchesBas),
      ...(egalite && vainqueur ? { parPriorite: vainqueur } : {}),
    };
    await saisir(donnees);
    envoi = false;
  }
</script>

<section class="carte" aria-label={t.carteSaisie}>
  <div class="identite">
    <h3>{t.titreMatch(match.tour, match.numero)}</h3>
    <span class="discret">{piste}</span>
    {#if modifiable && match.etat === 'aTirer'}{@render appel?.()}{/if}
  </div>

  {#if match.etat === 'attente'}
    <p class="discret attente">
      {t.enAttenteDe(
        haut.tireurId
          ? t.provenance(...(bas.provenance!.split('-').map(Number) as [number, number]), match.tour === 0)
          : t.provenance(...(haut.provenance!.split('-').map(Number) as [number, number]), match.tour === 0),
      )}
    </p>
  {:else if match.retrait}
    <p class="attente">{t.retraitConstat(t.motifCourt(match.retrait.motif), nom(match.retrait.tireurId))}</p>
    <div class="actions">{@render actions?.()}</div>
  {:else}
    <form id="saisie-tableau" class="score" onsubmit={valider} novalidate>
      <label class="tireur">
        <span class="rang">({haut.rang})</span>
        <strong>{nomCourt(haut.tireurId)}</strong>
        <span>{tireurs.get(haut.tireurId ?? '')?.prenom}</span>
        <input
          type="number"
          inputmode="numeric"
          min="0"
          max={touches}
          class:fort={vainqueur === haut.tireurId}
          aria-label={t.touchesDe(nom(haut.tireurId))}
          bind:value={touchesHaut}
          disabled={!saisissable}
        />
      </label>
      <span class="tiret" aria-hidden="true">–</span>
      <label class="tireur">
        <input
          type="number"
          inputmode="numeric"
          min="0"
          max={touches}
          class:fort={vainqueur === bas.tireurId}
          aria-label={t.touchesDe(nom(bas.tireurId))}
          bind:value={touchesBas}
          disabled={!saisissable}
        />
        <strong>{nomCourt(bas.tireurId)}</strong>
        <span>{tireurs.get(bas.tireurId ?? '')?.prenom}</span>
        <span class="rang">({bas.rang})</span>
      </label>
      {#if saisissable && egalite}
        <fieldset class="priorite">
          <legend>{t.priorite}</legend>
          <label><input type="radio" name="priorite" value="haut" bind:group={priorite} />{nom(haut.tireurId)}</label>
          <label><input type="radio" name="priorite" value="bas" bind:group={priorite} />{nom(bas.tireurId)}</label>
        </fieldset>
      {:else if match.parPriorite && !saisissable}
        <span class="discret">{t.prioriteMention} : {nomCourt(match.vainqueur)}</span>
      {/if}
      {#if auTemps && vainqueur}<p class="info" role="status">{t.victoireAuTemps(nomCourt(vainqueur))}</p>{/if}
      {#if essaye && !controle.ok && controle.raison === 'HORS_BORNES'}
        <p class="erreur" role="alert">{t.horsBornes(touches)}</p>
      {/if}
    </form>
    <div class="actions">
      {#if saisissable}
        <button type="submit" form="saisie-tableau" class="principal" disabled={envoi || (egalite && !priorite)}
          >{t.valider}</button
        >
      {/if}
      {#if suivantRegle}
        <p class="discret">
          {t.corrigerDabord(t.titreMatch(suivantRegle.tour, suivantRegle.numero).toLowerCase())}
          <button type="button" class="lien" onclick={() => choisir(suivantRegle.id)}
            >{t.titreMatch(suivantRegle.tour, suivantRegle.numero)}</button
          >
        </p>
      {/if}
      {@render actions?.()}
    </div>
  {/if}
</section>

<style>
  .carte {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px 20px;
    padding: 16px;
    border: 2px solid var(--accent);
    border-radius: 14px;
    background: var(--surface);
  }

  .identite {
    flex: 0 1 200px;
    display: flex;
    flex-direction: column;
  }

  h3 {
    margin: 0;
    font-size: 1rem;
  }

  .discret {
    margin: 0;
    color: var(--texte-discret);
    font-size: 0.875rem;
  }

  .attente {
    flex: 1;
  }

  .score {
    flex: 1 1 460px;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 10px 14px;
    margin: 0;
  }

  .tireur {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.95rem;
  }

  .rang,
  .tiret {
    color: var(--texte-discret);
  }

  input[type='number'] {
    width: 64px;
    height: 52px;
    box-sizing: border-box;
    border: 1px solid var(--bordure-champ);
    border-radius: 10px;
    background: var(--surface);
    color: var(--texte);
    font: inherit;
    font-size: 1.5rem;
    font-weight: 600;
    text-align: center;
  }

  input.fort {
    border: 2px solid var(--accent);
  }

  .priorite {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 16px;
    margin: 0;
    padding: 4px 12px 8px;
    border: 1px solid var(--etat-attente-bordure);
    border-radius: 10px;
  }

  .priorite label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
  }

  .info,
  .erreur {
    flex-basis: 100%;
    margin: 0;
    text-align: center;
    font-size: 0.9rem;
  }

  .erreur {
    color: var(--etat-erreur);
  }

  .actions {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
  }

  .principal {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    padding: 0 18px;
    border: none;
    border-radius: 10px;
    background: var(--palette-tiffany);
    color: var(--sur-tiffany);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  .principal:disabled {
    opacity: 0.6;
    cursor: default;
  }

  .lien {
    padding: 0;
    border: none;
    background: none;
    color: var(--accent);
    font: inherit;
    text-decoration: underline;
    cursor: pointer;
  }
</style>

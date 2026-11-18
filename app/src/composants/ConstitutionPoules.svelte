<script lang="ts">
  // Constitution des poules (US-086, planche 8) : nombre de poules proposé, méthode automatique (serpentin, clubs
  // séparés) ou manuelle (poules vides), première piste. Le résultat est écrit par la page (`PoulesComposees`).
  import {
    pouleEnSerpentin,
    poulesVides,
    propositionsDePoules,
    proposition,
    repartirEnSerpentin,
    TAILLE_CONSEILLEE_MAX,
    type Poule,
    type Tireur,
  } from '@poule-position/domaine';
  import Icone from './Icone.svelte';
  import { textes } from '../lib/textes';

  interface Proprietes {
    presents: Tireur[];
    inscrits: number;
    /** CA-7 : une composition existe déjà, elle sera remplacée. */
    remplace: boolean;
    cheminEmargement: string;
    naviguer: (chemin: string) => void;
    valider: (poules: Poule[], manuelle: boolean) => Promise<void>;
    annuler?: (() => void) | undefined;
  }

  let { presents, inscrits, remplace, cheminEmargement, naviguer, valider, annuler }: Proprietes = $props();

  const t = textes.poules;
  const propositions = $derived(propositionsDePoules(presents.length));
  let choix: number | 'autre' | null = $state(null);
  let autre = $state('');
  let methode: 'automatique' | 'manuelle' = $state('automatique');
  let separerClubs = $state(true);
  let hasard = $state(true);
  let premierePiste = $state('1');
  let envoi = $state(false);

  const recommandee = $derived(propositions.find(({ recommandee }) => recommandee)?.nombre ?? null);
  const autreNombre = $derived(Number(autre));
  const autreValide = $derived(
    Number.isInteger(autreNombre) && autreNombre >= 1 && autreNombre <= Math.floor(presents.length / 3),
  );
  const nombre = $derived(choix === 'autre' ? (autreValide ? autreNombre : null) : (choix ?? recommandee));
  const autreProposition = $derived(autreValide ? proposition(presents.length, autreNombre) : null);
  const piste = $derived(Number(premierePiste));
  const pisteValide = $derived(Number.isInteger(piste) && piste >= 1);
  const sansClassement = $derived(presents.filter(({ classement }) => classement === null).length);
  /** L'encart montre le serpentin pour le nombre choisi (4 colonnes au plus, 6 lignes). */
  const colonnes = $derived(Math.min(nombre ?? 4, 4));
  const lignes = $derived(Math.min(6, Math.ceil(presents.length / Math.max(1, nombre ?? 4))));

  async function soumettre(evenement: SubmitEvent) {
    evenement.preventDefault();
    if (nombre === null || !pisteValide || envoi) return;
    envoi = true;
    try {
      const poules =
        methode === 'manuelle'
          ? poulesVides(nombre, piste)
          : repartirEnSerpentin(presents, nombre, {
              separerClubs,
              hasardSansClassement: hasard,
              premierePiste: piste,
            });
      await valider(poules, methode === 'manuelle');
    } finally {
      envoi = false;
    }
  }
</script>

<div class="constitution">
  <form class="carte" onsubmit={soumettre} novalidate>
    <div class="bandeau">
      <Icone nom="listeCochee" taille={20} />
      <p>
        <strong>{t.presents(presents.length)}</strong>{t.surInscrits(inscrits)}
      </p>
      <a
        href={cheminEmargement}
        onclick={(evenement) => {
          evenement.preventDefault();
          naviguer(cheminEmargement);
        }}>{t.voirEmargement}</a
      >
    </div>

    {#if presents.length < 3}
      <p class="avertissement" role="status">{presents.length === 0 ? t.pointezDabord : t.auMoinsTrois}</p>
    {:else}
      <fieldset>
        <legend><strong>{t.nombre}</strong><span class="discret">{t.nombreDetail}</span></legend>
        <div class="cartes-choix">
          {#each propositions as p (p.nombre)}
            <label class="choix" class:coche={nombre === p.nombre && choix !== 'autre'}>
              <input
                type="radio"
                name="nombre"
                checked={nombre === p.nombre && choix !== 'autre'}
                onchange={() => (choix = p.nombre)}
              />
              <span class="intitule">{t.proposition(p.nombre, p.grande, p.petites)}</span>
              <span class="detail">
                {[
                  t.detailProposition(p.grande, p.grandes, p.petites),
                  p.recommandee ? t.recommandee : null,
                  t.matchsParPoule(p.matchsParPoule),
                  p.horsBornes ? t.horsBornes : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </label>
          {/each}
          <label class="choix" class:coche={choix === 'autre'}>
            <input type="radio" name="nombre" checked={choix === 'autre'} onchange={() => (choix = 'autre')} />
            <span class="intitule">{t.autreNombre}</span>
            <input
              class="petit"
              aria-label={t.nombreChoisi}
              inputmode="numeric"
              bind:value={autre}
              onfocus={() => (choix = 'autre')}
            />
            {#if choix === 'autre' && autreProposition}
              <span class="detail">
                {[
                  t.detailProposition(autreProposition.grande, autreProposition.grandes, autreProposition.petites) ??
                    t.proposition(autreProposition.nombre, autreProposition.grande, 0),
                  autreProposition.horsBornes ? t.horsBornes : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            {/if}
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend><strong>{t.repartition}</strong></legend>
        <div class="cartes-choix deux">
          {#each [['automatique', t.automatique, t.automatiqueDetail], ['manuelle', t.manuelle, t.manuelleDetail]] as const as [cle, intitule, detail] (cle)}
            <label class="choix" class:coche={methode === cle}>
              <input type="radio" name="methode" checked={methode === cle} onchange={() => (methode = cle)} />
              <span class="intitule">{intitule}</span>
              <span class="detail">{detail}</span>
            </label>
          {/each}
        </div>
      </fieldset>

      {#if methode === 'automatique'}
        <fieldset>
          <legend><strong>{t.options}</strong></legend>
          <label class="option"><input type="checkbox" bind:checked={separerClubs} />{t.separerClubs}</label>
          {#if sansClassement > 0}
            <label class="option"><input type="checkbox" bind:checked={hasard} />{t.hasard(sansClassement)}</label>
          {/if}
        </fieldset>
      {/if}

      <div class="piste">
        <label for="premiere-piste"><strong>{t.premierePiste}</strong></label>
        <input id="premiere-piste" class="petit" inputmode="numeric" bind:value={premierePiste} />
        <p class="discret">{t.pistesDetail}</p>
      </div>

      <div class="pied">
        <p class="discret">{remplace ? t.remplacee : t.rienDeFige}</p>
        <div class="boutons">
          {#if annuler}<button type="button" class="secondaire" onclick={annuler}>{t.annuler}</button>{/if}
          <button type="submit" class="principal" disabled={nombre === null || !pisteValide || envoi}>
            <Icone nom="flechesCroisees" taille={20} />{methode === 'manuelle' ? t.creerVides : t.repartir}
          </button>
        </div>
      </div>
    {/if}
  </form>

  <aside class="carte aide" aria-labelledby="titre-aide">
    <h3 id="titre-aide"><Icone nom="aide" taille={20} />{t.aideTitre}</h3>
    <p>{t.aideTexte}<strong>{t.serpentin}</strong>{t.aideSuite}</p>
    <table>
      <caption>{t.aideTableau}</caption>
      <thead>
        <tr>
          <th scope="col"><span class="invisible">{t.sens}</span></th>
          {#each Array.from({ length: colonnes }, (_, i) => i) as i (i)}<th scope="col">{t.poule(i + 1)}</th>{/each}
        </tr>
      </thead>
      <tbody>
        {#each Array.from({ length: lignes }, (_, l) => l) as l (l)}
          <tr>
            <td aria-label={l % 2 === 0 ? t.versLaDroite : t.versLaGauche}>{l % 2 === 0 ? '→' : '←'}</td>
            {#each Array.from({ length: colonnes }, (_, c) => c) as c (c)}
              <td>
                {#if nombre !== null}
                  {@const rang = Array.from({ length: nombre }, (_, k) => l * nombre + k).find(
                    (i) => pouleEnSerpentin(i, nombre) === c,
                  )}
                  {rang !== undefined && rang < presents.length ? rang + 1 : ''}
                {/if}
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
    <p class="discret">{t.aideClubs}</p>
    {#if nombre !== null && Math.ceil(presents.length / nombre) > TAILLE_CONSEILLEE_MAX}
      <p class="avertissement">{t.horsBornes}</p>
    {/if}
  </aside>
</div>

<style>
  .constitution {
    display: grid;
    grid-template-columns: minmax(0, 1.45fr) minmax(0, 1fr);
    gap: 1rem;
    align-items: start;
  }

  .carte {
    display: grid;
    gap: 1.25rem;
    padding: 1.25rem;
    border: 1px solid var(--bordure);
    border-radius: 14px;
    background: var(--surface);
  }

  .bandeau {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    border-radius: var(--rayon);
    background: var(--fond);
  }

  .bandeau p {
    flex: 1;
    margin: 0;
  }

  .bandeau a {
    color: var(--accent);
    font-weight: 600;
  }

  fieldset {
    display: grid;
    gap: 0.6rem;
    margin: 0;
    padding: 0;
    border: none;
  }

  legend {
    margin-bottom: 0.6rem;
    padding: 0;
  }

  .cartes-choix {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(9.5rem, 1fr));
    gap: 0.6rem;
  }

  .cartes-choix.deux {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .choix {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 0.25rem 0.5rem;
    align-content: start;
    padding: 0.75rem;
    border: 1px solid var(--bordure-champ);
    border-radius: var(--rayon);
    cursor: pointer;
  }

  .choix.coche {
    border: 2px solid var(--marque);
    background: var(--accent-teinte);
  }

  .intitule {
    font-weight: 600;
  }

  .detail,
  .choix .petit {
    grid-column: 2;
  }

  .detail,
  .discret {
    margin: 0;
    color: var(--texte-discret);
    font-size: 0.875rem;
  }

  .option {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    min-height: 2.75rem;
  }

  .option input {
    width: 1.25rem;
    height: 1.25rem;
    accent-color: var(--marque);
  }

  .piste {
    display: grid;
    gap: 0.4rem;
    justify-items: start;
  }

  input.petit {
    box-sizing: border-box;
    width: 6rem;
    min-height: 2.75rem;
    padding: 0 0.75rem;
    border: 1px solid var(--bordure-champ);
    border-radius: var(--rayon);
    background: var(--surface);
    color: var(--texte);
    font: inherit;
  }

  .pied {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding-top: 1rem;
    border-top: 1px solid var(--bordure);
  }

  .pied p {
    flex: 1 1 14rem;
  }

  .boutons {
    display: flex;
    gap: 0.5rem;
  }

  button {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    min-height: 2.75rem;
    padding: 0 1rem;
    border-radius: var(--rayon);
    font: inherit;
    cursor: pointer;
  }

  .principal {
    border: none;
    background: var(--palette-tiffany);
    color: var(--sur-tiffany);
    font-weight: 600;
  }

  .principal:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .secondaire {
    border: 1px solid var(--bordure-champ);
    background: var(--surface);
    color: var(--texte);
  }

  .aide {
    gap: 0.75rem;
  }

  .aide h3 {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0;
    font-size: 1rem;
  }

  .aide p {
    margin: 0;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
    text-align: center;
  }

  caption {
    margin-bottom: 0.4rem;
    color: var(--texte-discret);
    text-align: left;
  }

  th,
  td {
    padding: 0.45rem 0.25rem;
    border-bottom: 1px solid var(--bordure);
  }

  .avertissement {
    margin: 0;
    padding: 0.5rem 0.75rem;
    border-left: 4px solid var(--etat-attente);
    background: var(--surface);
  }

  .invisible {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }

  /* Principe 13 : sur un écran étroit, une colonne ; l'encart d'aide passe dessous. */
  @media (max-width: 52rem) {
    .constitution,
    .cartes-choix.deux {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>

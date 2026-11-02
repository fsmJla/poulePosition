<script lang="ts">
  // « Nouvelle compétition » (US-025), page réservée : la compétition est écrite dans le journal local, donc créée
  // aussi hors ligne ; ce PC en devient le pilote et l'envoi au serveur part aussitôt, ou au retour du réseau (US-022).
  // Le rattachement à une manifestation ou une épreuve sera proposé ici avec US-024 : la compétition est créée isolée.
  import { ARMES, CATEGORIES, SEXES, TYPES_COMPETITION, type ErreursCompetition } from '@poule-position/domaine';
  import Lien from '../composants/Lien.svelte';
  import { CATEGORIE_LIBRE, creerCompetition, saisieVide, type ErreurCreation } from '../lib/competitions';
  import type { Journal } from '../lib/journal';
  import { cheminCompetition, CHEMINS } from '../lib/routes';
  import type { SessionAppareil } from '../lib/stockage';
  import type { Synchronisation } from '../lib/synchronisation';
  import { textes } from '../lib/textes';

  interface Proprietes {
    session: SessionAppareil;
    journal: Journal;
    synchronisation: Synchronisation;
    naviguer: (chemin: string) => void;
  }

  let { session, journal, synchronisation, naviguer }: Proprietes = $props();

  const t = textes.competitions;

  const saisie = $state(saisieVide());
  let erreurs: ErreursCompetition = $state({});
  let erreur: ErreurCreation | null = $state(null);
  let enCours = $state(false);

  async function creer(evenement: SubmitEvent) {
    evenement.preventDefault();
    if (enCours) return;
    enCours = true;
    erreur = null;
    try {
      const resultat = await creerCompetition(journal, $state.snapshot(saisie), {
        clubId: session.compte.clubId,
        auteur: session.compte.email,
      });
      if (resultat.ok) {
        // US-022 : envoi après l'écriture ; hors ligne, la compétition attend le retour du réseau.
        void synchronisation.envoyer(resultat.competitionId);
        naviguer(cheminCompetition(resultat.competitionId));
      } else if ('erreurs' in resultat) {
        erreurs = resultat.erreurs;
      } else {
        erreurs = {};
        erreur = resultat.erreur;
      }
    } finally {
      enCours = false;
    }
  }

  /** Attributs d'accessibilité d'un champ, et identifiant de son message d'erreur. */
  const invalide = (champ: keyof ErreursCompetition) => ({
    'aria-invalid': erreurs[champ] ? ('true' as const) : undefined,
    'aria-describedby': erreurs[champ] ? `erreur-${champ}` : undefined,
  });
</script>

{#snippet message(champ: keyof ErreursCompetition)}
  {@const code = erreurs[champ]}
  {#if code}<span class="erreur" id="erreur-{champ}">{t.champs[code]}</span>{/if}
{/snippet}

<main>
  <h1>{t.titreNouvelle}</h1>

  <form onsubmit={creer} novalidate>
    <div class="champ">
      <label for="nom">{t.nom}</label>
      <input
        id="nom"
        type="text"
        placeholder={t.exempleNom}
        bind:value={saisie.nom}
        disabled={enCours}
        {...invalide('nom')}
      />
      {@render message('nom')}
    </div>

    <div class="ligne">
      <div class="champ">
        <label for="arme">{t.arme}</label>
        <select id="arme" bind:value={saisie.arme} disabled={enCours} {...invalide('arme')}>
          <option value="" disabled>{t.choisirArme}</option>
          {#each ARMES as arme (arme)}<option value={arme}>{t.armes[arme]}</option>{/each}
        </select>
        {@render message('arme')}
      </div>
      <div class="champ">
        <label for="type">{t.type}</label>
        <select id="type" bind:value={saisie.typeCompetition} disabled={enCours} {...invalide('typeCompetition')}>
          {#each TYPES_COMPETITION as type (type)}<option value={type}>{t.types[type]}</option>{/each}
        </select>
        {@render message('typeCompetition')}
      </div>
    </div>

    <div class="ligne">
      <div class="champ">
        <label for="categorie">{t.categorie} <small>({t.facultatif})</small></label>
        <select id="categorie" bind:value={saisie.categorie} disabled={enCours} {...invalide('categorie')}>
          <option value="">{t.aucuneCategorie}</option>
          {#each CATEGORIES as categorie (categorie)}<option value={categorie}>{categorie}</option>{/each}
          <option value={CATEGORIE_LIBRE}>{t.categorieLibre}</option>
        </select>
        {#if saisie.categorie === CATEGORIE_LIBRE}
          <input
            type="text"
            aria-label={t.categorieLibreChamp}
            bind:value={saisie.categorieLibre}
            disabled={enCours}
            {...invalide('categorie')}
          />
        {/if}
        {@render message('categorie')}
      </div>
      <div class="champ">
        <label for="sexe">{t.sexe} <small>({t.facultatif})</small></label>
        <select id="sexe" bind:value={saisie.sexe} disabled={enCours} {...invalide('sexe')}>
          <option value="">{t.aucunSexe}</option>
          {#each SEXES as sexe (sexe)}<option value={sexe}>{t.sexes[sexe]}</option>{/each}
        </select>
        {@render message('sexe')}
      </div>
    </div>

    <div class="champ">
      <label for="date">{t.date} <small>({t.facultatif})</small></label>
      <input id="date" type="date" bind:value={saisie.date} disabled={enCours} {...invalide('date')} />
      {@render message('date')}
    </div>

    <fieldset>
      <legend>{t.horaires} <small>({t.facultatif})</small></legend>
      <div class="ligne horaires">
        {#each ['appel', 'scratch', 'debutPoules'] as const as champ (champ)}
          <div class="champ">
            <label for={champ}>{t[champ]}</label>
            <input id={champ} type="time" bind:value={saisie[champ]} disabled={enCours} {...invalide(champ)} />
            {@render message(champ)}
          </div>
        {/each}
      </div>
    </fieldset>

    <div class="champ">
      <label for="lieu">{t.lieu} <small>({t.facultatif})</small></label>
      <input id="lieu" type="text" bind:value={saisie.lieu} disabled={enCours} {...invalide('lieu')} />
      {@render message('lieu')}
    </div>

    <div class="champ">
      <label for="commentaire">{t.commentaire} <small>({t.facultatif})</small></label>
      <textarea
        id="commentaire"
        rows="3"
        bind:value={saisie.commentaire}
        disabled={enCours}
        {...invalide('commentaire')}></textarea>
      {@render message('commentaire')}
    </div>

    {#if erreur}<p class="message" role="alert">{t.erreurs[erreur]}</p>{/if}
    <button type="submit" disabled={enCours}>{enCours ? t.enCours : t.creer}</button>
  </form>

  <Lien chemin={CHEMINS.organisateur} {naviguer}>{t.annuler}</Lien>
</main>

<style>
  main {
    display: grid;
    justify-items: center;
    gap: 1.25rem;
    padding: 3rem 1rem;
  }

  h1 {
    margin: 0;
    text-align: center;
  }

  form {
    display: grid;
    gap: 1.1rem;
    width: min(100%, 32rem);
  }

  .ligne {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
    gap: 1rem;
  }

  .champ {
    display: grid;
    align-content: start;
    gap: 0.3rem;
  }

  label,
  legend {
    font-weight: 600;
  }

  small {
    color: var(--texte-discret);
    font-weight: 400;
  }

  input,
  select,
  textarea {
    padding: 0.6rem 0.75rem;
    border: 1px solid var(--bordure-champ);
    border-radius: var(--rayon);
    background: var(--fond);
    color: var(--texte);
    font: inherit;
  }

  textarea {
    resize: vertical;
  }

  [aria-invalid='true'] {
    border-color: var(--etat-erreur);
  }

  .erreur {
    color: var(--etat-erreur);
    font-size: 0.85rem;
  }

  fieldset {
    display: grid;
    gap: 0.5rem;
    margin: 0;
    padding: 0;
    border: none;
  }

  .horaires label {
    font-weight: 400;
  }

  button {
    padding: 0.7rem;
    border: none;
    border-radius: var(--rayon);
    background: var(--accent-fond);
    color: var(--sur-accent);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .message {
    margin: 0;
    padding: 0.6rem 0.75rem;
    border-left: 4px solid var(--etat-erreur);
    background: var(--surface);
  }
</style>

<script lang="ts">
  // Épreuves d'une manifestation (US-024), sous la manifestation dans la page « Manifestations » : liste, création,
  // modification et suppression d'une épreuve vide. Ce sont des données du club stockées par le serveur : hors ligne,
  // la liste reste consultable depuis la dernière copie, et les actions sont grisées.
  import { ARMES, type ErreursEpreuve } from '@poule-position/domaine';
  import type { Epreuve, Manifestation } from '@poule-position/protocole';
  import { saisieDe, saisieVide, type ClientEpreuves, type ErreurEpreuves, type SaisieEpreuve } from '../lib/epreuves';
  import { textes } from '../lib/textes';

  interface Proprietes {
    manifestation: Manifestation;
    client: ClientEpreuves;
    /** Épreuves de cette manifestation. */
    epreuves: Epreuve[];
    horsLigne: boolean;
    /** Appelé quand une épreuve a changé : la page recharge la liste. */
    modifie: () => Promise<void>;
  }

  let { manifestation, client, epreuves, horsLigne, modifie }: Proprietes = $props();

  const t = textes.epreuves;
  const armes = textes.competitions.armes;
  /** Identifiant des champs : plusieurs manifestations peuvent afficher leur formulaire. */
  const idChamp = (champ: string) => `epreuve-${champ}-${manifestation.id}`;

  /** Formulaire ouvert : création (`nouvelle`), modification d'une épreuve, ou aucun. */
  let edition: Epreuve | 'nouvelle' | null = $state(null);
  let saisie: SaisieEpreuve = $state(saisieVide());
  let erreurs: ErreursEpreuve = $state({});
  /** Message global du formulaire (modification concurrente, réseau, manifestation disparue…). */
  let message: string | null = $state(null);
  /** Vrai si le message annonce une modification concurrente : « Recharger » l'accompagne. */
  let concurrente = $state(false);
  let enCours = $state(false);

  /** Épreuve dont la suppression attend confirmation. */
  let aSupprimer: Epreuve | null = $state(null);
  let erreurSuppression: ErreurEpreuves | null = $state(null);

  function ouvrir(cible: Epreuve | 'nouvelle') {
    edition = cible;
    saisie = cible === 'nouvelle' ? saisieVide() : saisieDe(cible);
    erreurs = {};
    message = null;
    concurrente = false;
    aSupprimer = null;
  }

  function fermer() {
    edition = null;
    erreurs = {};
    message = null;
    concurrente = false;
  }

  async function enregistrer(evenement: SubmitEvent) {
    evenement.preventDefault();
    if (enCours || edition === null) return;
    enCours = true;
    message = null;
    concurrente = false;
    try {
      const donnees = $state.snapshot(saisie);
      const resultat =
        edition === 'nouvelle'
          ? await client.creer(manifestation.id, donnees)
          : await client.modifier(edition, donnees);
      if (resultat.ok) {
        fermer();
        await modifie();
      } else if ('erreurs' in resultat) {
        erreurs = resultat.erreurs;
      } else {
        erreurs = {};
        if (resultat.erreur === 'MODIFIEE_ENTRE_TEMPS') {
          message = t.modifieeEntreTemps(resultat.epreuve.modifieePar);
          concurrente = true;
        } else {
          message = t.erreurs[resultat.erreur];
        }
      }
    } finally {
      enCours = false;
    }
  }

  async function recharger() {
    const ouverte = edition;
    await modifie();
    const aJour = ouverte !== 'nouvelle' && epreuves.find(({ id }) => id === ouverte?.id);
    if (aJour) ouvrir(aJour);
  }

  async function supprimer() {
    if (!aSupprimer || enCours) return;
    enCours = true;
    erreurSuppression = null;
    try {
      const resultat = await client.supprimer(aSupprimer.id);
      if (resultat.ok) {
        aSupprimer = null;
        await modifie();
      } else {
        erreurSuppression = resultat.erreur;
      }
    } finally {
      enCours = false;
    }
  }

  /** Attributs d'accessibilité d'un champ, et identifiant de son message d'erreur. */
  const invalide = (champ: keyof ErreursEpreuve) => ({
    'aria-invalid': erreurs[champ] ? ('true' as const) : undefined,
    'aria-describedby': erreurs[champ] ? idChamp(`erreur-${champ}`) : undefined,
  });
</script>

{#snippet erreurChamp(champ: keyof ErreursEpreuve)}
  {@const code = erreurs[champ]}
  {#if code}<span class="erreur" id={idChamp(`erreur-${champ}`)}>{t.champs[code]}</span>{/if}
{/snippet}

<section class="epreuves" aria-label={`${t.titre} de ${manifestation.nom}`}>
  <h3>{t.titre}</h3>

  {#if epreuves.length === 0}
    <p class="vide">{t.aucune}</p>
  {:else}
    <ul>
      {#each epreuves as epreuve (epreuve.id)}
        <li>
          <div class="infos">
            <strong>{epreuve.nom}</strong>
            {#if epreuve.arme}<span>{armes[epreuve.arme]}</span>{/if}
            {#if epreuve.commentaire}<span class="commentaire">{epreuve.commentaire}</span>{/if}
          </div>
          {#if aSupprimer?.id === epreuve.id}
            <div class="confirmation" role="group" aria-label={t.supprimer(epreuve.nom)}>
              <span>{t.confirmerSuppression(epreuve.nom)}</span>
              {#if erreurSuppression}<span class="erreur" role="alert">{t.erreurs[erreurSuppression]}</span>{/if}
              <div class="boutons">
                <button type="button" class="danger" onclick={supprimer} disabled={enCours || horsLigne}>
                  {t.confirmer}
                </button>
                <button type="button" class="secondaire" onclick={() => (aSupprimer = null)} disabled={enCours}>
                  {t.annuler}
                </button>
              </div>
            </div>
          {:else}
            <div class="boutons">
              <button
                type="button"
                class="secondaire"
                aria-label={t.modifier(epreuve.nom)}
                onclick={() => ouvrir(epreuve)}
                disabled={horsLigne}>{t.boutonModifier}</button
              >
              <button
                type="button"
                class="secondaire"
                aria-label={t.supprimer(epreuve.nom)}
                onclick={() => {
                  aSupprimer = epreuve;
                  erreurSuppression = null;
                }}
                disabled={horsLigne}>{t.boutonSupprimer}</button
              >
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}

  {#if edition === null}
    <button
      type="button"
      class="secondaire"
      aria-label={t.ajouter(manifestation.nom)}
      onclick={() => ouvrir('nouvelle')}
      disabled={horsLigne}
    >
      {t.nouvelle}
      {#if horsLigne}<small>{t.horsLigne}</small>{/if}
    </button>
  {:else}
    <form onsubmit={enregistrer} novalidate>
      <h4>{edition === 'nouvelle' ? t.nouvelle : t.titreModification(edition.nom)}</h4>
      <div class="champ">
        <label for={idChamp('nom')}>{t.nom}</label>
        <input
          id={idChamp('nom')}
          type="text"
          placeholder={t.exempleNom}
          bind:value={saisie.nom}
          disabled={enCours}
          {...invalide('nom')}
        />
        {@render erreurChamp('nom')}
      </div>
      <div class="champ">
        <label for={idChamp('arme')}>{t.arme} <small>({t.facultatif})</small></label>
        <select id={idChamp('arme')} bind:value={saisie.arme} disabled={enCours} {...invalide('arme')}>
          <option value="">{t.aucuneArme}</option>
          {#each ARMES as arme (arme)}<option value={arme}>{armes[arme]}</option>{/each}
        </select>
        {@render erreurChamp('arme')}
      </div>
      <div class="champ">
        <label for={idChamp('commentaire')}>{t.commentaire} <small>({t.facultatif})</small></label>
        <textarea
          id={idChamp('commentaire')}
          rows="2"
          bind:value={saisie.commentaire}
          disabled={enCours}
          {...invalide('commentaire')}></textarea>
        {@render erreurChamp('commentaire')}
      </div>

      {#if message}
        <p class="message" role="alert">
          {message}
          {#if concurrente}
            <button type="button" class="lien" onclick={recharger}>{t.recharger}</button>
          {/if}
        </p>
      {/if}
      {#if horsLigne}<p class="avertissement" role="status">{t.horsLigne}</p>{/if}
      <div class="boutons">
        <button type="submit" disabled={enCours || horsLigne}>
          {enCours ? t.enCours : edition === 'nouvelle' ? t.creer : t.enregistrer}
        </button>
        <button type="button" class="secondaire" onclick={fermer} disabled={enCours}>{t.annuler}</button>
      </div>
    </form>
  {/if}
</section>

<style>
  .epreuves {
    display: grid;
    gap: 0.6rem;
    padding-top: 0.6rem;
    border-top: 1px solid var(--bordure);
  }

  h3,
  h4 {
    margin: 0;
    font-size: 1rem;
  }

  ul {
    display: grid;
    gap: 0.5rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: grid;
    gap: 0.5rem;
    padding: 0.6rem 0.75rem;
    border: 1px solid var(--bordure);
    border-radius: var(--rayon);
    background: var(--fond);
  }

  form {
    display: grid;
    gap: 0.8rem;
  }

  .champ {
    display: grid;
    align-content: start;
    gap: 0.3rem;
  }

  label {
    font-weight: 600;
  }

  small {
    color: var(--texte-discret);
    font-weight: 400;
  }

  input,
  select,
  textarea {
    padding: 0.5rem 0.7rem;
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

  button {
    display: grid;
    padding: 0.55rem 0.9rem;
    border: none;
    border-radius: var(--rayon);
    background: var(--accent-fond);
    color: var(--sur-accent);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  button small {
    color: inherit;
  }

  button.secondaire {
    border: 1px solid var(--bordure-champ);
    background: var(--surface);
    color: var(--texte);
  }

  button.danger {
    background: var(--etat-erreur);
  }

  button.lien {
    display: inline;
    padding: 0;
    background: none;
    color: var(--accent);
    text-decoration: underline;
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .boutons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
  }

  .infos {
    display: grid;
    gap: 0.2rem;
    overflow-wrap: anywhere;
  }

  .infos span {
    color: var(--texte-discret);
  }

  .commentaire {
    white-space: pre-line;
  }

  .confirmation {
    display: grid;
    gap: 0.5rem;
  }

  .vide {
    margin: 0;
    color: var(--texte-discret);
  }

  .avertissement,
  .message {
    margin: 0;
    padding: 0.5rem 0.7rem;
    background: var(--surface);
  }

  .avertissement {
    border-left: 4px solid var(--etat-attente);
  }

  .message {
    border-left: 4px solid var(--etat-erreur);
  }
</style>

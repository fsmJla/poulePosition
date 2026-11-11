<script lang="ts">
  // « Mon profil » (US-016), page réservée : l'utilisateur modifie son propre nom et la couleur de son avatar, et
  // trouve ici le changement de mot de passe (US-010). La page s'affiche hors ligne ; l'enregistrement exige le réseau.
  import { onMount, untrack } from 'svelte';
  import { validerNom, COULEURS_AVATAR, type CouleurAvatar } from '@poule-position/domaine';
  import Avatar from '../composants/Avatar.svelte';
  import FilAriane from '../composants/FilAriane.svelte';
  import Lien from '../composants/Lien.svelte';
  import { filSousAccueil } from '../lib/fil-ariane';
  import { CHEMINS } from '../lib/routes';
  import type { ClientSession, ErreurProfil } from '../lib/session';
  import type { SessionAppareil } from '../lib/stockage';
  import { textes } from '../lib/textes';

  interface Proprietes {
    client: ClientSession;
    session: SessionAppareil;
    surChangement: (session: SessionAppareil) => void;
    surSessionPerdue: () => void;
    naviguer: (chemin: string) => void;
  }

  let { client, session, surChangement, surSessionPerdue, naviguer }: Proprietes = $props();

  const t = textes.profil;

  let nom = $state(untrack(() => session.compte.nom));
  let couleur: CouleurAvatar = $state(untrack(() => session.compte.avatar));
  let enCours = $state(false);
  let enregistre = $state(false);
  let erreur: ErreurProfil | null = $state(null);
  let horsLigne = $state(!navigator.onLine);

  const erreurNom = $derived(validerNom(nom) as keyof typeof t.champs | null);
  const modification = $derived({
    ...(nom.trim() !== session.compte.nom && { nom: nom.trim() }),
    ...(couleur !== session.compte.avatar && { avatar: couleur }),
  });
  const modifie = $derived(Object.keys(modification).length > 0);

  onMount(() => {
    const surReseau = () => (horsLigne = !navigator.onLine);
    window.addEventListener('online', surReseau);
    window.addEventListener('offline', surReseau);
    return () => {
      window.removeEventListener('online', surReseau);
      window.removeEventListener('offline', surReseau);
    };
  });

  async function enregistrer(evenement: SubmitEvent) {
    evenement.preventDefault();
    if (enCours || erreurNom || !modifie) return;
    enCours = true;
    erreur = null;
    enregistre = false;
    try {
      const resultat = await client.modifierProfil(modification);
      if (resultat.ok) {
        enregistre = true;
        surChangement(resultat.session);
      } else if (resultat.erreur === 'SESSION_INVALIDE') {
        surSessionPerdue();
      } else {
        erreur = resultat.erreur;
      }
    } finally {
      enCours = false;
    }
  }
</script>

<main>
  <FilAriane niveaux={filSousAccueil(t.titre, [], textes.entete.accueil)} {naviguer} />
  <h1>{t.titre}</h1>
  <Avatar nom={nom.trim() || session.compte.nom} {couleur} taille={88} libelle={t.avatarDe(session.compte.nom)} />

  <form onsubmit={enregistrer} novalidate>
    <div class="champ">
      <label for="nom">{t.nom}</label>
      <input
        id="nom"
        type="text"
        autocomplete="name"
        bind:value={nom}
        disabled={enCours}
        aria-invalid={erreurNom ? 'true' : undefined}
        aria-describedby={erreurNom ? 'erreur-nom' : undefined}
      />
      {#if erreurNom}<span class="erreur" id="erreur-nom">{t.champs[erreurNom]}</span>{/if}
    </div>

    <fieldset>
      <legend>{t.avatar}</legend>
      <div class="couleurs">
        {#each COULEURS_AVATAR as option (option)}
          <label class="couleur" style:background="var(--avatar-{option})">
            <input
              type="radio"
              name="couleur"
              value={option}
              bind:group={couleur}
              disabled={enCours}
              aria-label={t.couleur(option)}
            />
          </label>
        {/each}
      </div>
    </fieldset>

    <dl>
      <dt>{t.email}</dt>
      <dd>{session.compte.email}</dd>
      <dt>{t.role}</dt>
      <dd>{textes.roles[session.compte.role]}</dd>
    </dl>

    {#if horsLigne || erreur}
      <p class="message" role="alert">{horsLigne ? t.horsLigne : t.erreurs[erreur as ErreurProfil]}</p>
    {:else if enregistre && !modifie}
      <p class="succes" role="status">{t.enregistre}</p>
    {/if}
    <button type="submit" disabled={enCours || horsLigne || erreurNom !== null || !modifie}>
      {enCours ? t.enCours : t.enregistrer}
    </button>
  </form>

  <nav class="liens">
    <Lien chemin={CHEMINS.motDePasse} {naviguer}>{t.changerMotDePasse}</Lien>
    <Lien chemin={CHEMINS.organisateur} {naviguer}>{t.retour}</Lien>
  </nav>
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
    width: min(100%, 22rem);
  }

  .champ {
    display: grid;
    gap: 0.3rem;
  }

  label,
  legend,
  dt {
    font-weight: 600;
  }

  input[type='text'] {
    padding: 0.6rem 0.75rem;
    border: 1px solid var(--bordure-champ);
    border-radius: var(--rayon);
    background: var(--fond);
    color: var(--texte);
    font: inherit;
  }

  input[aria-invalid='true'] {
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

  .couleurs {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
  }

  /* Pastille de couleur : le bouton radio natif reste en place (clavier, lecteur d'écran), sans être dessiné. */
  .couleur {
    position: relative;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    cursor: pointer;
  }

  .couleur input {
    position: absolute;
    inset: 0;
    margin: 0;
    border-radius: 50%;
    appearance: none;
    cursor: pointer;
  }

  .couleur input:checked {
    outline: 3px solid var(--texte);
    outline-offset: 3px;
  }

  .couleur input:focus-visible {
    outline: 3px solid var(--focus);
    outline-offset: 3px;
  }

  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.3rem 1rem;
    margin: 0;
  }

  dd {
    margin: 0;
    overflow-wrap: anywhere;
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

  .message,
  .succes {
    margin: 0;
    padding: 0.6rem 0.75rem;
    background: var(--surface);
  }

  .message {
    border-left: 4px solid var(--etat-erreur);
  }

  .succes {
    border-left: 4px solid var(--etat-ok);
  }

  .liens {
    display: grid;
    justify-items: center;
    gap: 0.6rem;
  }
</style>

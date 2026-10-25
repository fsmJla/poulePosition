<script lang="ts">
  // Gestion des comptes (US-007), page réservée aux administrateurs : liste, création avec mot de passe temporaire
  // affiché une seule fois, modification du nom et du rôle. Exige le réseau (docs/protocole.md §9).
  import { onMount } from 'svelte';
  import { validerNouveauCompte, validerNom, ROLES, type Role } from '@poule-position/domaine';
  import type { CompteResume } from '@poule-position/protocole';
  import type { ClientSession, ErreurComptes } from '../lib/session';
  import { textes } from '../lib/textes';

  interface Proprietes {
    client: ClientSession;
    surSessionPerdue: () => void;
  }

  let { client, surSessionPerdue }: Proprietes = $props();

  const t = textes.comptes;
  const formatDate = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' });

  let comptes: CompteResume[] | null = $state(null);
  let erreurListe: ErreurComptes | null = $state(null);

  // Création
  let email = $state('');
  let nom = $state('');
  let role: Role = $state('organisateur');
  let enCreation = $state(false);
  let erreurCreation: ErreurComptes | null = $state(null);
  let cree: { nom: string; motDePasse: string } | null = $state(null);
  let copie = $state(false);
  const erreursSaisie = $derived(validerNouveauCompte({ email, nom, role }));
  const saisieValide = $derived(Object.keys(erreursSaisie).length === 0);

  // Modification
  let enEdition: string | null = $state(null);
  let nomEdite = $state('');
  let roleEdite: Role = $state('organisateur');
  let erreurEdition: ErreurComptes | null = $state(null);

  /** Erreur du serveur : une session perdue ramène à la connexion, le reste s'affiche. */
  function traiter(erreur: ErreurComptes): ErreurComptes | null {
    if (erreur === 'SESSION_INVALIDE') {
      surSessionPerdue();
      return null;
    }
    return erreur;
  }

  onMount(async () => {
    const resultat = await client.listerComptes();
    if (resultat.ok) comptes = resultat.comptes;
    else erreurListe = traiter(resultat.erreur);
  });

  async function creer(evenement: SubmitEvent) {
    evenement.preventDefault();
    if (!saisieValide || enCreation) return;
    enCreation = true;
    erreurCreation = null;
    try {
      const resultat = await client.creerCompte({ email, nom, role });
      if (!resultat.ok) {
        erreurCreation = traiter(resultat.erreur);
        return;
      }
      comptes = [...(comptes ?? []), resultat.compte].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
      cree = { nom: resultat.compte.nom, motDePasse: resultat.motDePasseTemporaire };
      copie = false;
      email = nom = '';
      role = 'organisateur';
    } finally {
      enCreation = false;
    }
  }

  async function copier() {
    if (!cree) return;
    await navigator.clipboard.writeText(cree.motDePasse);
    copie = true;
  }

  function editer(compte: CompteResume) {
    enEdition = compte.id;
    nomEdite = compte.nom;
    roleEdite = compte.role;
    erreurEdition = null;
  }

  async function enregistrer(compte: CompteResume) {
    if (validerNom(nomEdite) !== null) return;
    const modification = {
      ...(nomEdite.trim() !== compte.nom && { nom: nomEdite.trim() }),
      ...(roleEdite !== compte.role && { role: roleEdite }),
    };
    if (Object.keys(modification).length === 0) {
      enEdition = null;
      return;
    }
    const resultat = await client.modifierCompte(compte.id, modification);
    if (!resultat.ok) {
      erreurEdition = traiter(resultat.erreur);
      return;
    }
    comptes = (comptes ?? []).map((existant) => (existant.id === compte.id ? resultat.compte : existant));
    enEdition = null;
  }
</script>

<main>
  <h1>{t.titre}</h1>

  <section class="carte" aria-labelledby="titre-creation">
    <h2 id="titre-creation">{t.creation.titre}</h2>
    <form onsubmit={creer} novalidate>
      <div class="champ">
        <label for="nouvel-email">{t.creation.email}</label>
        <input
          id="nouvel-email"
          type="email"
          autocomplete="off"
          bind:value={email}
          disabled={enCreation}
          aria-invalid={email !== '' && erreursSaisie.email ? 'true' : undefined}
          aria-describedby={email !== '' && erreursSaisie.email ? 'erreur-email' : undefined}
        />
        {#if email !== '' && erreursSaisie.email}
          <span class="erreur" id="erreur-email">{t.champs[erreursSaisie.email as keyof typeof t.champs]}</span>
        {/if}
      </div>
      <div class="champ">
        <label for="nouveau-nom">{t.creation.nom}</label>
        <input
          id="nouveau-nom"
          type="text"
          autocomplete="off"
          bind:value={nom}
          disabled={enCreation}
          aria-invalid={nom !== '' && erreursSaisie.nom ? 'true' : undefined}
          aria-describedby={nom !== '' && erreursSaisie.nom ? 'erreur-nom' : undefined}
        />
        {#if nom !== '' && erreursSaisie.nom}
          <span class="erreur" id="erreur-nom">{t.champs[erreursSaisie.nom as keyof typeof t.champs]}</span>
        {/if}
      </div>
      <div class="champ">
        <label for="nouveau-role">{t.creation.role}</label>
        <select id="nouveau-role" bind:value={role} disabled={enCreation}>
          {#each ROLES as option (option)}<option value={option}>{textes.roles[option]}</option>{/each}
        </select>
      </div>
      <button type="submit" class="principal" disabled={!saisieValide || enCreation}>
        {enCreation ? t.creation.enCours : t.creation.valider}
      </button>
    </form>
    {#if erreurCreation}<p class="bandeau" role="alert">{t.erreurs[erreurCreation]}</p>{/if}
  </section>

  {#if cree}
    <section class="carte mot-de-passe" aria-labelledby="titre-mot-de-passe">
      <h2 id="titre-mot-de-passe">{t.motDePasseTemporaire.titre}</h2>
      <p>{t.motDePasseTemporaire.explication(cree.nom)}</p>
      <div class="secret">
        <code data-testid="mot-de-passe-temporaire">{cree.motDePasse}</code>
        <button type="button" class="secondaire" onclick={copier}>
          {copie ? t.motDePasseTemporaire.copie : t.motDePasseTemporaire.copier}
        </button>
      </div>
      <button type="button" class="lien" onclick={() => (cree = null)}>{t.motDePasseTemporaire.fermer}</button>
    </section>
  {/if}

  <section class="carte" aria-label={t.titre}>
    {#if erreurListe}
      <p class="bandeau" role="alert">{t.erreurs[erreurListe]}</p>
    {:else if comptes === null}
      <p role="status">{t.chargement}</p>
    {:else}
      {#if erreurEdition}<p class="bandeau" role="alert">{t.erreurs[erreurEdition]}</p>{/if}
      <div class="tableau">
        <table>
          <thead>
            <tr>
              <th scope="col">{t.colonnes.nom}</th>
              <th scope="col">{t.colonnes.email}</th>
              <th scope="col">{t.colonnes.role}</th>
              <th scope="col">{t.colonnes.etat}</th>
              <th scope="col">{t.colonnes.derniereConnexion}</th>
              <th scope="col"><span class="masque">{t.colonnes.actions}</span></th>
            </tr>
          </thead>
          <tbody>
            {#each comptes as compte (compte.id)}
              <tr>
                {#if enEdition === compte.id}
                  <td>
                    <input aria-label={t.colonnes.nom} type="text" bind:value={nomEdite} />
                  </td>
                  <td>{compte.email}</td>
                  <td>
                    <select aria-label={t.colonnes.role} bind:value={roleEdite}>
                      {#each ROLES as option (option)}<option value={option}>{textes.roles[option]}</option>{/each}
                    </select>
                  </td>
                {:else}
                  <td>{compte.nom}</td>
                  <td>{compte.email}</td>
                  <td>{textes.roles[compte.role]}</td>
                {/if}
                <td>
                  <span class="etat" data-actif={compte.actif}>{compte.actif ? t.actif : t.desactive}</span>
                  {#if compte.temporaire}<small>{t.temporaire}</small>{/if}
                </td>
                <td>{compte.derniereConnexion === null ? t.jamais : formatDate.format(compte.derniereConnexion)}</td>
                <td class="actions">
                  {#if enEdition === compte.id}
                    <button type="button" class="principal" onclick={() => enregistrer(compte)}>{t.enregistrer}</button>
                    <button type="button" class="lien" onclick={() => (enEdition = null)}>{t.annuler}</button>
                  {:else}
                    <button type="button" class="secondaire" onclick={() => editer(compte)}>
                      <span aria-hidden="true">✎</span><span class="masque">{t.modifier(compte.nom)}</span>
                    </button>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </section>
</main>

<style>
  main {
    display: grid;
    gap: 1.25rem;
    width: min(100% - 2rem, 60rem);
    margin: 2rem auto;
  }

  h1,
  h2 {
    margin: 0;
  }

  h2 {
    font-size: 1.15rem;
  }

  .carte {
    display: grid;
    gap: 1rem;
    min-width: 0;
    padding: 1.25rem;
    border: 1px solid var(--bordure);
    border-radius: 14px;
    background: var(--surface);
  }

  form {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
    gap: 0.9rem;
    align-items: end;
  }

  .champ {
    display: grid;
    gap: 0.3rem;
    align-self: start;
  }

  label {
    font-size: 0.9rem;
    font-weight: 600;
  }

  input,
  select {
    box-sizing: border-box;
    width: 100%;
    min-height: 44px;
    padding: 0 0.75rem;
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

  button {
    min-height: 44px;
    padding: 0 1rem;
    border-radius: var(--rayon);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  .principal {
    border: none;
    background: var(--accent-fond);
    color: var(--sur-accent);
  }

  .principal:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .secondaire {
    border: 1px solid var(--accent);
    background: transparent;
    color: var(--accent);
  }

  .lien {
    justify-self: start;
    border: none;
    background: none;
    color: var(--accent);
    text-decoration: underline;
  }

  .bandeau {
    margin: 0;
    padding: 0.7rem 0.9rem;
    border: 1px solid var(--etat-erreur);
    border-radius: var(--rayon);
    background: var(--surface-2);
  }

  .mot-de-passe {
    border-color: var(--accent);
  }

  .mot-de-passe p {
    margin: 0;
  }

  .secret {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    align-items: center;
  }

  code {
    padding: 0.5rem 0.8rem;
    border-radius: var(--rayon);
    background: var(--surface-2);
    font-size: 1.2rem;
    letter-spacing: 0.08em;
  }

  /* Le tableau défile seul sur petit écran : jamais la page. */
  .tableau {
    overflow-x: auto;
  }

  table {
    width: 100%;
    min-width: 40rem;
    border-collapse: collapse;
  }

  th {
    padding: 0.6rem;
    color: var(--texte-discret);
    font-size: 0.8rem;
    letter-spacing: 0.04em;
    text-align: left;
    text-transform: uppercase;
  }

  td {
    padding: 0.6rem;
    border-top: 1px solid var(--bordure);
    vertical-align: middle;
  }

  td small {
    display: block;
    color: var(--texte-discret);
  }

  .etat[data-actif='false'] {
    color: var(--etat-erreur);
  }

  .actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
  }

  .masque {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>

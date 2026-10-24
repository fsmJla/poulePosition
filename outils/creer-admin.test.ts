// Commande d'installation (US-002) : saisies, envoi au serveur, et parcours complet contre le Worker dans workerd.
import { PassThrough, Writable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { unstable_startWorker } from 'wrangler';
import {
  analyserArguments,
  executer,
  questionneurTerminal,
  saisirAdministrateur,
  verifierTerminal,
  type Questionneur,
  URLS_SERVEUR,
} from './creer-admin';

/** Questionneur simulé : répond dans l'ordre et garde ce qui a été affiché. */
function simuler(reponses: string[]): Questionneur & { affiches: string[]; questions: string[] } {
  const affiches: string[] = [];
  const questions: string[] = [];
  return {
    affiches,
    questions,
    async demander(question) {
      questions.push(question);
      const reponse = reponses.shift();
      if (reponse === undefined) throw new Error(`Pas de réponse prévue pour « ${question} »`);
      return reponse;
    },
    afficher(message) {
      affiches.push(message);
    },
  };
}

const SAISIE_VALIDE = ['admin@club.fr', 'Julien Lameyre', 'mot-de-passe-solide', 'mot-de-passe-solide'];

describe('analyserArguments', () => {
  it('choisit le serveur de l’environnement ou une adresse donnée', () => {
    expect(analyserArguments(['--env', 'preview'])).toEqual({ url: URLS_SERVEUR.preview });
    expect(analyserArguments(['--env', 'production'])).toEqual({ url: URLS_SERVEUR.production });
    expect(analyserArguments(['--url', 'http://localhost:8790/'])).toEqual({ url: 'http://localhost:8790' });
  });

  it('refuse des arguments absents ou invalides', () => {
    for (const argv of [[], ['--env', 'staging'], ['--url', 'ftp://x'], ['--env']]) {
      expect(analyserArguments(argv), argv.join(' ')).toHaveProperty('erreur');
    }
  });
});

describe('saisirAdministrateur', () => {
  it('US-002 CA-5 : redemande chaque saisie invalide avec un message clair', async () => {
    const questionneur = simuler([
      'pas-un-email',
      ' Admin@Club.fr ',
      '   ',
      'Julien Lameyre',
      'court',
      'mot-de-passe-solide',
      'autre-chose-encore',
      'mot-de-passe-solide',
      'mot-de-passe-solide',
    ]);
    expect(await saisirAdministrateur(questionneur)).toEqual({
      email: ' Admin@Club.fr ',
      nom: 'Julien Lameyre',
      motDePasse: 'mot-de-passe-solide',
    });
    expect(questionneur.affiches).toEqual([
      'E-mail invalide.',
      'Le nom est obligatoire.',
      'Le mot de passe doit faire au moins 10 caractères.',
      'Les deux mots de passe sont différents : recommencez.',
    ]);
  });
});

describe('executer', () => {
  it('US-002 hors ligne : serveur injoignable → message clair, code de sortie 1', async () => {
    const questionneur = simuler([...SAISIE_VALIDE, 'secret']);
    const fetchEnPanne = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
    expect(await executer(['--url', 'http://localhost:1'], questionneur, fetchEnPanne)).toBe(1);
    expect(questionneur.affiches.at(-1)).toBe('Serveur injoignable : vérifiez la connexion');
  });

  it('US-002 CA-5 : arguments invalides → aide, sans rien demander ni envoyer', async () => {
    const questionneur = simuler([]);
    const envoi = vi.fn();
    expect(await executer([], questionneur, envoi)).toBe(1);
    expect(envoi).not.toHaveBeenCalled();
    expect(questionneur.questions).toEqual([]);
    expect(questionneur.affiches[0]).toMatch(/npm run creer-admin -- --env preview/);
  });
});

describe('parcours complet contre le serveur', () => {
  type Worker = Awaited<ReturnType<typeof unstable_startWorker>>;
  let worker: Worker;
  let url: string;

  beforeAll(async () => {
    worker = await unstable_startWorker({
      config: fileURLToPath(new URL('../serveur/wrangler.toml', import.meta.url).href),
      bindings: {
        CLUB_ID: { type: 'plain_text', value: `test-${crypto.randomUUID()}` },
        POIVRE: { type: 'secret_text', value: 'poivre-de-test' },
        SECRET_INSTALLATION: { type: 'secret_text', value: 'secret-de-test' },
      },
      dev: { server: { port: 0 }, inspector: false, persist: false },
    });
    url = (await worker.url).origin;
  });

  afterAll(async () => {
    await worker?.dispose();
  });

  it('US-002 CA-4 : un secret faux est refusé avec un message clair', async () => {
    const questionneur = simuler([...SAISIE_VALIDE, 'secret-faux']);
    expect(await executer(['--url', url], questionneur)).toBe(1);
    expect(questionneur.affiches.at(-1)).toBe("Secret d'installation invalide");
  });

  it('US-002 CA-1 : crée l’administrateur et affiche « Administrateur créé », puis CA-3 : refuse une seconde fois', async () => {
    const premiere = simuler([...SAISIE_VALIDE, 'secret-de-test']);
    expect(await executer(['--url', url], premiere)).toBe(0);
    expect(premiere.affiches.at(-1)).toBe('Administrateur créé : admin@club.fr');

    const seconde = simuler(['autre@club.fr', 'Autre', 'mot-de-passe-solide', 'mot-de-passe-solide', 'secret-de-test']);
    expect(await executer(['--url', url], seconde)).toBe(1);
    expect(seconde.affiches.at(-1)).toBe('Un administrateur existe déjà : utilisez la gestion des comptes');
  });
});

/**
 * Reconstitue les lignes réellement visibles à l'écran à partir de ce qu'écrit readline : `ESC[1G` ramène le
 * curseur en début de ligne, `ESC[0J` efface la suite (c'est ainsi que la question disparaissait).
 */
function lignesVisibles(texte: string): string[] {
  const lignes: string[] = [];
  let ligne = '';
  let colonne = 0;
  // Les codes de terminal commencent par le caractère de contrôle ESC : c'est précisément ce qu'on analyse.
  // eslint-disable-next-line no-control-regex
  for (const morceau of texte.split(/(\u001b\[[0-9;]*[A-Za-z]|\r?\n)/)) {
    if (morceau === '\u001b[1G') colonne = 0;
    else if (morceau === '\u001b[0J' || morceau === '\u001b[0K') ligne = ligne.slice(0, colonne);
    else if (/^\r?\n$/.test(morceau)) {
      lignes.push(ligne);
      ligne = '';
      colonne = 0;
    } else if (!morceau.startsWith('\u001b')) {
      ligne = ligne.slice(0, colonne) + morceau + ligne.slice(colonne + morceau.length);
      colonne += morceau.length;
    }
  }
  return ligne ? [...lignes, ligne] : lignes;
}

describe('questionneurTerminal', () => {
  /** Terminal simulé : on tape dans `entree`, on lit ce qui s'affiche dans `affiche()`. */
  function terminal() {
    const entree = new PassThrough();
    let texte = '';
    const sortie = new Writable({
      write(morceau, _encodage, suite) {
        texte += String(morceau);
        suite();
      },
    });
    return { entree, sortie, affiche: () => texte };
  }

  it('US-002 recette : la question reste affichée, et la réponse est lue', async () => {
    const { entree, sortie, affiche } = terminal();
    const questionneur = questionneurTerminal(entree, sortie);
    const reponse = questionneur.demander('E-mail : ');
    entree.write('admin@club.fr\n');
    expect(await reponse).toBe('admin@club.fr');
    expect(lignesVisibles(affiche())).toContain('E-mail : admin@club.fr');
    questionneur.fermer();
  });

  it('US-002 recette : une saisie masquée affiche la question mais jamais ce qui est tapé', async () => {
    const { entree, sortie, affiche } = terminal();
    const questionneur = questionneurTerminal(entree, sortie);
    const reponse = questionneur.demander('Mot de passe : ', true);
    entree.write('mot-de-passe-secret\n');
    expect(await reponse).toBe('mot-de-passe-secret');
    expect(lignesVisibles(affiche())).toContain('Mot de passe : ');
    expect(affiche()).not.toContain('mot-de-passe-secret');
    questionneur.fermer();
  });

  it('US-002 recette : session complète, frappe touche par touche, sans aucune fuite des saisies masquées', async () => {
    const { entree, sortie, affiche } = terminal();
    const questionneur = questionneurTerminal(entree, sortie);
    const taper = async (texte: string) => {
      for (const touche of texte) entree.write(touche);
      entree.write('\r');
    };
    const reponses: string[] = [];
    for (const [question, masquer, saisie] of [
      ['E-mail : ', false, 'admin@club.fr'],
      ['Mot de passe : ', true, 'mot-de-passe-secret'],
      ['Confirmation : ', true, 'mot-de-passe-secret'],
      ["Secret d'installation : ", true, 'secret-installation'],
      ['Nom : ', false, 'Julien'],
    ] as const) {
      const reponse = questionneur.demander(question, masquer);
      await taper(saisie);
      reponses.push(await reponse);
    }
    questionneur.fermer();
    expect(reponses).toEqual([
      'admin@club.fr',
      'mot-de-passe-secret',
      'mot-de-passe-secret',
      'secret-installation',
      'Julien',
    ]);
    expect(affiche()).not.toContain('mot-de-passe-secret');
    expect(affiche()).not.toContain('secret-installation');
    expect(lignesVisibles(affiche())).toEqual([
      'E-mail : admin@club.fr',
      'Mot de passe : ',
      'Confirmation : ',
      "Secret d'installation : ",
      'Nom : Julien',
    ]);
  });
});

describe('verifierTerminal', () => {
  it('US-002 recette : refuse de démarrer hors d’un vrai terminal (saisies impossibles à masquer), avec la marche à suivre', () => {
    expect(verifierTerminal(true)).toBeNull();
    const message = verifierTerminal(false);
    expect(message).toMatch(/vrai terminal/);
    expect(message).toMatch(/PowerShell/);
  });
});

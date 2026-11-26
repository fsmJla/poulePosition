import { describe, expect, it } from 'vitest';
import { analyserImportEquipes, lireCsvEquipes, type LigneEquipeFichier } from './import-equipes';
import type { Equipe } from './equipes';
import type { Tireur } from './tireurs';

const BOM = String.fromCharCode(0xfeff);
const EN_TETE = 'Équipe;Nom 1;Prénom 1;Licence 1;Club 1;Classement 1;Nom 2;Prénom 2;Licence 2;Club 2;Classement 2';

const inscrit = (id: string, nom: string, prenom: string, champs: Partial<Tireur> = {}): Tireur => ({
  id,
  nom,
  prenom,
  club: 'Pessac',
  classement: null,
  licence: null,
  present: false,
  heure: null,
  ...champs,
});
const equipe = (id: string, nom: string, titulaires: string[]): Equipe => ({
  id,
  nom,
  titulaires,
  remplacant: null,
  tirage: 0.5,
});
const lignes = (csv: string): LigneEquipeFichier[] => {
  const lu = lireCsvEquipes(csv);
  if (!lu.ok) throw new Error(`illisible : ${lu.erreur}`);
  return lu.lignes;
};
const vide = { typeEpreuve: 'equipes2' as const, tireurs: [], equipes: [] };

describe('lecture du CSV d’équipes (US-156)', () => {
  it('CA-1 : lit les équipes, les guillemets, les retours Windows, les lignes vides et les espaces', () => {
    const csv = `${BOM}${EN_TETE}\r\n"Pessac ""1""";DUBOIS ; Chloé;123;PESSAC;12;MARTIN;Léa;;;\r\n\r\n;;;;;;;;;;\r\nTalence 1;A;B;;;;C;D;;;\r\n`;
    const lues = lignes(csv);
    expect(lues).toHaveLength(2);
    expect(lues[0]).toMatchObject({ nom: 'Pessac "1"' });
    expect(lues[0]!.titulaires[0]).toEqual({
      nom: 'DUBOIS',
      prenom: 'Chloé',
      licence: '123',
      club: 'PESSAC',
      classement: '12',
    });
    expect(lues[0]!.remplacant).toBeNull();
    expect(lues[1]!.nom).toBe('Talence 1');
  });

  it('CA-1 : les en-têtes se reconnaissent sans accents ni casse, dans n’importe quel ordre', () => {
    const lues = lignes('prenom 2;NOM 2;prenom 1;nom 1;EQUIPE\nLéa;MARTIN;Chloé;DUBOIS;Pessac 1');
    expect(lues[0]!.titulaires.map(({ nom }) => nom)).toEqual(['DUBOIS', 'MARTIN']);
  });

  it('CA-1 : le troisième titulaire et le remplaçant sont repris s’ils sont renseignés', () => {
    const lues = lignes(`${EN_TETE};Nom 3;Prénom 3;Nom R;Prénom R\nP1;A;B;;;;C;D;;;;E;F;G;H`);
    expect(lues[0]!.titulaires).toHaveLength(3);
    expect(lues[0]!.remplacant).toMatchObject({ nom: 'G', prenom: 'H' });
  });

  it('CA-5 : un fichier sans les colonnes attendues est refusé, avec les colonnes manquantes', () => {
    expect(lireCsvEquipes('NOM;PRENOM\nDUBOIS;Chloé')).toEqual({
      ok: false,
      erreur: 'COLONNES_MANQUANTES',
      manquantes: ['Équipe', 'Nom 1', 'Prénom 1', 'Nom 2', 'Prénom 2'],
    });
    expect(lireCsvEquipes('<?xml version="1.0"?><Base/>')).toMatchObject({ ok: false, erreur: 'COLONNES_MANQUANTES' });
  });

  it('cas limite : un fichier sans ligne d’équipe est refusé', () => {
    expect(lireCsvEquipes(`${EN_TETE}\n;;;;;;;;;;\n`)).toEqual({ ok: false, erreur: 'AUCUNE_EQUIPE' });
    expect(lireCsvEquipes('')).toMatchObject({ ok: false, erreur: 'COLONNES_MANQUANTES' });
  });
});

describe('analyse de l’import d’équipes (US-156)', () => {
  it('CA-2 et CA-3 : équipes importables, tireurs à inscrire, déjà inscrits et rapprochés par le nom', () => {
    const tireurs = [
      inscrit('t1', 'DUBOIS', 'Chloé', { licence: '111' }),
      inscrit('t2', 'MARTIN', 'Léa'),
      inscrit('t3', 'ROUX', 'Eva', { licence: '333' }),
    ];
    const analyse = analyserImportEquipes(
      lignes(
        `${EN_TETE}\nPessac 1;DUBOIS;Chloé;111;;;PETIT;Louise;222;Bayonne;18\nPessac 2;Martin;LÉA;;;;ROUX;Eva;999;;`,
      ),
      { typeEpreuve: 'equipes2', tireurs, equipes: [] },
    );
    expect(analyse.total).toBe(2);
    expect(analyse.ecartees).toEqual([]);
    expect(analyse.importables).toHaveLength(2);
    expect(analyse.importables[0]!.titulaires).toEqual([
      { tireurId: 't1' },
      { nouveau: { nom: 'PETIT', prenom: 'Louise', club: 'Bayonne', classement: 18, licence: '222' } },
    ]);
    // Martin Léa : même nom sans licence → rapproché ; ROUX Eva avec une autre licence → autre tireur, à inscrire.
    expect(analyse.importables[1]!.titulaires[0]).toEqual({ tireurId: 't2' });
    expect(analyse.importables[1]!.titulaires[1]).toMatchObject({ nouveau: { nom: 'ROUX', licence: '999' } });
    expect(analyse.aInscrire).toBe(2);
    expect(analyse.dejaInscrits).toBe(2);
    expect(analyse.rapproches).toEqual([{ importe: 'MARTIN LÉA', inscrit: 'MARTIN Léa' }]);
  });

  it('CA-4 : nom d’équipe manquant ou trop long', () => {
    const analyse = analyserImportEquipes(lignes(`${EN_TETE}\n;A;B;;;;C;D;;;\n${'x'.repeat(61)};A;B;;;;C;D;;;`), vide);
    expect(analyse.ecartees.map(({ motif }) => motif)).toEqual(['NOM_EQUIPE_MANQUANT', 'NOM_EQUIPE_MANQUANT']);
    expect(analyse.importables).toEqual([]);
  });

  it('CA-4 : nom déjà pris dans l’épreuve ou plus haut dans le fichier, le reste est importé', () => {
    const analyse = analyserImportEquipes(
      lignes(
        `${EN_TETE}\nPessac 1;A;B;;;;C;D;;;\nPESSAC 1;E;F;;;;G;H;;;\nTalence 1;E;F;;;;G;H;;;\npessac 1 ;I;J;;;;K;L;;;`,
      ),
      { typeEpreuve: 'equipes2', tireurs: [], equipes: [equipe('e1', 'Pessac 1', [])] },
    );
    expect(analyse.ecartees.map(({ nom, motif }) => [nom, motif])).toEqual([
      ['Pessac 1', 'NOM_EQUIPE_PRIS'],
      ['PESSAC 1', 'NOM_EQUIPE_PRIS'],
      ['pessac 1', 'NOM_EQUIPE_PRIS'],
    ]);
    expect(analyse.importables.map(({ nom }) => nom)).toEqual(['Talence 1']);
  });

  it('CA-4 : le nombre de titulaires doit être celui du type d’épreuve', () => {
    const csv = `${EN_TETE};Nom 3;Prénom 3\nDeux;A;B;;;;C;D;;;;;\nTrois;A;B;;;;C;D;;;;E;F`;
    const deux = analyserImportEquipes(lignes(csv), vide);
    expect(deux.importables.map(({ nom }) => nom)).toEqual(['Deux']);
    expect(deux.ecartees).toMatchObject([{ nom: 'Trois', motif: 'NOMBRE_TITULAIRES' }]);
    const trois = analyserImportEquipes(lignes(csv), { ...vide, typeEpreuve: 'equipes3' });
    expect(trois.importables.map(({ nom }) => nom)).toEqual(['Trois']);
    expect(trois.ecartees).toMatchObject([{ nom: 'Deux', motif: 'NOMBRE_TITULAIRES' }]);
  });

  it('CA-4 : un titulaire sans nom ou sans prénom écarte l’équipe', () => {
    const analyse = analyserImportEquipes(lignes(`${EN_TETE}\nP1;DUBOIS;;;;;C;D;;;`), vide);
    expect(analyse.ecartees).toMatchObject([{ nom: 'P1', motif: 'NOM_TIREUR_MANQUANT' }]);
  });

  it('CA-4 : le même tireur deux fois dans l’équipe', () => {
    const analyse = analyserImportEquipes(lignes(`${EN_TETE}\nP1;A;B;1;;;A;B;1;;\nP2;A;B;;;;a;b;;;`), vide);
    expect(analyse.ecartees.map(({ motif }) => motif)).toEqual(['DOUBLON_DANS_EQUIPE', 'DOUBLON_DANS_EQUIPE']);
  });

  it('CA-4 : un tireur déjà dans une équipe de l’épreuve, ou dans une équipe plus haut du fichier', () => {
    const tireurs = [inscrit('t1', 'DUBOIS', 'Chloé', { licence: '111' }), inscrit('t2', 'MARTIN', 'Léa')];
    const analyse = analyserImportEquipes(
      lignes(`${EN_TETE}\nP1;MARTIN;Léa;;;;X;Y;;;\nP2;DUBOIS;Chloé;111;;;Z;W;;;\nP3;Z;W;;;;V;U;;;\nP4;Z;W;;;;T;S;;;`),
      { typeEpreuve: 'equipes2', tireurs, equipes: [equipe('e1', 'Pessac 9', ['t1', 't9'])] },
    );
    expect(analyse.ecartees).toEqual([
      { nom: 'P2', motif: 'TIREUR_DEJA_EN_EQUIPE', tireur: 'DUBOIS Chloé', equipe: 'Pessac 9' },
      { nom: 'P4', motif: 'TIREUR_DEJA_EN_EQUIPE', tireur: 'Z W', equipe: 'P3' },
    ]);
    expect(analyse.importables.map(({ nom }) => nom)).toEqual(['P1', 'P3']);
    // Une équipe écartée n’inscrit personne.
    expect(analyse.aInscrire).toBe(3);
  });

  it('cas limite : classement vide, nul ou non numérique vaut « sans classement »', () => {
    const analyse = analyserImportEquipes(lignes(`${EN_TETE}\nP1;A;B;;;abc;C;D;;;0`), vide);
    const [a, b] = analyse.importables[0]!.titulaires;
    expect(a).toMatchObject({ nouveau: { classement: null, licence: null, club: '' } });
    expect(b).toMatchObject({ nouveau: { classement: null } });
  });

  it('cas limite : 100 équipes (200 tireurs) s’analysent d’un seul lot', () => {
    const corps = Array.from({ length: 100 }, (_, i) => `E${i};N${2 * i};P;;;;N${2 * i + 1};P;;;`).join('\n');
    const analyse = analyserImportEquipes(lignes(`${EN_TETE}\n${corps}`), vide);
    expect(analyse.importables).toHaveLength(100);
    expect(analyse.aInscrire).toBe(200);
  });
});

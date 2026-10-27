import { describe, expect, it } from 'vitest';
import { courrielReinitialisation, echapperHtml } from './gabarits';
import { courrielValide } from './logique';

const LIEN = 'https://poule-position-livid.vercel.app/reinitialisation#AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

describe('e-mail de réinitialisation (US-019 CA-7)', () => {
  const courriel = courrielReinitialisation({ destinataire: 'julien@club.fr', nom: 'Julien Lameyre', lien: LIEN });

  it('US-019 CA-1 : objet, destinataire, et un e-mail complet', () => {
    expect(courriel.destinataire).toBe('julien@club.fr');
    expect(courriel.sujet).toBe('Poule Position : réinitialiser votre mot de passe');
    expect(courrielValide(courriel)).toBe(true);
  });

  it('US-019 CA-7 : bandeau ardoise avec « Poule Position » en blanc, et bouton sarcelle vers le lien', () => {
    expect(courriel.html).toMatch(/background(-color)?:\s*#2f4b4a/i);
    expect(courriel.html).toMatch(/color:\s*#ffffff[^>]*>\s*Poule Position/i);
    expect(courriel.html).toMatch(
      /<a href="[^"]+"[^>]*background(-color)?:\s*#066f6c[^>]*>\s*Choisir un nouveau mot de passe/i,
    );
    expect(courriel.html).toContain(`href="${LIEN}"`);
  });

  it('US-019 CA-7 : lien en clair, durée de validité et mention « ignorez cet e-mail », sans image ni feuille de style', () => {
    expect(courriel.html.split(LIEN).length - 1).toBeGreaterThanOrEqual(2);
    expect(courriel.html).toContain('1 heure');
    expect(courriel.html).toContain('Si vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail.');
    expect(courriel.html).not.toMatch(/<img|<style|<link|var\(--/i);
  });

  it('US-019 CA-7 : une version texte l’accompagne, avec le nom, le lien et la durée', () => {
    expect(courriel.texte).toContain('Bonjour Julien Lameyre,');
    expect(courriel.texte).toContain(LIEN);
    expect(courriel.texte).toContain('1 heure');
    expect(courriel.texte).toContain('ignorez cet e-mail');
    expect(courriel.texte).not.toMatch(/<[a-z]/i);
  });

  it('US-019 : le nom est échappé dans le HTML (pas d’injection de balises)', () => {
    const piege = courrielReinitialisation({
      destinataire: 'julien@club.fr',
      nom: '<script>alert(1)</script> & "Cie"',
      lien: LIEN,
    });
    expect(piege.html).not.toContain('<script>');
    expect(piege.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;Cie&quot;');
  });

  it('echapperHtml échappe les cinq caractères spéciaux', () => {
    expect(echapperHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
  });
});

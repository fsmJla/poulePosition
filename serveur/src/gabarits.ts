// Gabarits des e-mails (US-019 CA-7), aux couleurs de l'application (charte d'US-011). Les messageries ignorent les
// feuilles de style et les variables CSS : les couleurs sont écrites dans chaque balise, la mise en page est faite de
// tableaux, et aucune image n'est utilisée (souvent bloquées). Une version texte accompagne toujours le HTML.
import type { Courriel } from './logique';

/** Couleurs de la charte (app/src/app.css), recopiées : un e-mail ne peut pas lire la feuille de style. */
const COULEURS = {
  marque: '#2f4b4a', // --palette-ardoise
  surMarque: '#ffffff',
  accent: '#066f6c', // --accent-fond
  surAccent: '#ffffff',
  fond: '#f7f4ef', // --fond
  surface: '#ffffff',
  texte: '#1c2b2a', // --texte
  texteDiscret: '#55615f', // --texte-discret
} as const;

const POLICE = "'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/** Échappe un texte pour l'insérer dans du HTML (contenu ou valeur d'attribut). */
export function echapperHtml(texte: string): string {
  return texte
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** Mise en page commune : bandeau « Poule Position », carte blanche, pied de page discret. */
function miseEnPage(contenu: string, piedDePage: string): string {
  const c = COULEURS;
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background-color:${c.fond};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${c.fond};font-family:${POLICE};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:${c.surface};border-radius:12px;overflow:hidden;">
<tr><td style="background-color:${c.marque};padding:20px 28px;"><span style="color:${c.surMarque};font-size:22px;font-weight:700;">Poule Position</span></td></tr>
<tr><td style="padding:28px;color:${c.texte};font-size:16px;line-height:1.5;">${contenu}</td></tr>
<tr><td style="padding:0 28px 24px;color:${c.texteDiscret};font-size:13px;line-height:1.5;">${piedDePage}</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

/** US-019 CA-1 / CA-7 : e-mail du lien de réinitialisation, valable 1 heure. */
export function courrielReinitialisation({
  destinataire,
  nom,
  lien,
}: {
  destinataire: string;
  nom: string;
  lien: string;
}): Courriel {
  const c = COULEURS;
  const lienHtml = echapperHtml(lien);
  const ignorer = 'Si vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail.';
  const contenu = `<p style="margin:0 0 16px;">Bonjour ${echapperHtml(nom)},</p>
<p style="margin:0 0 24px;">Vous avez demandé à réinitialiser votre mot de passe. Choisissez-en un nouveau avec ce bouton&nbsp;:</p>
<p style="margin:0 0 24px;"><a href="${lienHtml}" style="display:inline-block;background-color:${c.accent};color:${c.surAccent};text-decoration:none;font-weight:600;padding:12px 22px;border-radius:10px;">Choisir un nouveau mot de passe</a></p>
<p style="margin:0 0 8px;">Ce lien est valable <strong>1 heure</strong> et ne sert qu’une fois. Si le bouton ne s’affiche pas, copiez ce lien dans votre navigateur&nbsp;:</p>
<p style="margin:0;word-break:break-all;"><a href="${lienHtml}" style="color:${c.accent};">${lienHtml}</a></p>`;
  return {
    destinataire,
    sujet: 'Poule Position : réinitialiser votre mot de passe',
    html: miseEnPage(contenu, ignorer),
    texte: [
      `Bonjour ${nom},`,
      '',
      'Vous avez demandé à réinitialiser votre mot de passe. Choisissez-en un nouveau en ouvrant ce lien :',
      lien,
      '',
      'Ce lien est valable 1 heure et ne sert qu’une fois.',
      '',
      ignorer,
      '',
      'Poule Position',
    ].join('\n'),
  };
}

// Faux serveur SMTP pour les tests d'intégration (US-019) : écoute en local, accepte toute authentification, garde
// les e-mails reçus, sans jamais rien envoyer. Il ne propose pas STARTTLS : la session reste en clair, en local.
import { createServer, type Server, type Socket } from 'node:net';

export interface CourrielRecu {
  de: string;
  a: string[];
  /** Message brut (en-têtes et corps, tel que transmis après DATA). */
  donnees: string;
}

export interface FauxSmtp {
  port: number;
  recus: CourrielRecu[];
  /** Attend qu'au moins `nombre` e-mails soient reçus (l'envoi se fait après la réponse du Worker). */
  attendre(nombre: number, delai?: number): Promise<CourrielRecu[]>;
  fermer(): Promise<void>;
}

function servir(socket: Socket, recus: CourrielRecu[]) {
  let tampon = '';
  let enDonnees = false;
  let courant: CourrielRecu = { de: '', a: [], donnees: '' };
  let etapeAuth: 'utilisateur' | 'mot-de-passe' | null = null;
  const repondre = (ligne: string) => socket.write(`${ligne}\r\n`);

  repondre('220 faux-smtp ESMTP');
  socket.on('data', (morceau) => {
    tampon += morceau.toString('latin1');
    for (;;) {
      if (enDonnees) {
        const fin = tampon.indexOf('\r\n.\r\n');
        if (fin < 0) return;
        courant.donnees = tampon.slice(0, fin);
        tampon = tampon.slice(fin + 5);
        enDonnees = false;
        recus.push(courant);
        courant = { de: '', a: [], donnees: '' };
        repondre('250 2.0.0 accepté');
        continue;
      }
      const finLigne = tampon.indexOf('\r\n');
      if (finLigne < 0) return;
      const ligne = tampon.slice(0, finLigne);
      tampon = tampon.slice(finLigne + 2);
      const commande = ligne.toUpperCase();
      if (etapeAuth === 'utilisateur') {
        etapeAuth = 'mot-de-passe';
        repondre('334 UGFzc3dvcmQ6');
      } else if (etapeAuth === 'mot-de-passe') {
        etapeAuth = null;
        repondre('235 2.7.0 authentifié');
      } else if (commande.startsWith('EHLO') || commande.startsWith('HELO')) {
        socket.write('250-faux-smtp\r\n250-AUTH LOGIN PLAIN\r\n250 8BITMIME\r\n');
      } else if (commande.startsWith('AUTH LOGIN')) {
        etapeAuth = 'utilisateur';
        repondre('334 VXNlcm5hbWU6');
      } else if (commande.startsWith('AUTH PLAIN')) {
        repondre('235 2.7.0 authentifié');
      } else if (commande.startsWith('MAIL FROM')) {
        courant.de = ligne.slice(10).trim();
        repondre('250 2.1.0 ok');
      } else if (commande.startsWith('RCPT TO')) {
        courant.a.push(ligne.slice(8).trim());
        repondre('250 2.1.5 ok');
      } else if (commande === 'DATA') {
        enDonnees = true;
        repondre('354 terminer par <CRLF>.<CRLF>');
      } else if (commande === 'QUIT') {
        repondre('221 2.0.0 au revoir');
        socket.end();
        return;
      } else {
        repondre('250 ok');
      }
    }
  });
  socket.on('error', () => {});
}

export async function demarrerFauxSmtp(): Promise<FauxSmtp> {
  const recus: CourrielRecu[] = [];
  const serveur: Server = createServer((socket) => servir(socket, recus));
  await new Promise<void>((resolu) => serveur.listen(0, '127.0.0.1', resolu));
  const adresse = serveur.address();
  if (adresse === null || typeof adresse === 'string') throw new Error('Faux SMTP : adresse inattendue');
  return {
    port: adresse.port,
    recus,
    async attendre(nombre, delai = 10_000) {
      const fin = Date.now() + delai;
      while (recus.length < nombre) {
        if (Date.now() > fin) throw new Error(`Faux SMTP : ${recus.length} e-mail(s) reçu(s), ${nombre} attendu(s)`);
        await new Promise((resolu) => setTimeout(resolu, 50));
      }
      return recus;
    },
    fermer: () => new Promise<void>((resolu) => serveur.close(() => resolu())),
  };
}

/** Texte lisible d'un message reçu : parties quoted-printable et base64 décodées, mises bout à bout. */
export function texteDuMessage(donnees: string): string {
  const sansCoupures = donnees.replace(/=\r\n/g, '');
  const qp = sansCoupures.replace(/=([0-9A-F]{2})/g, (_tout, hexa: string) => String.fromCharCode(parseInt(hexa, 16)));
  const base64 = [
    ...donnees.matchAll(/Content-Transfer-Encoding:\s*base64\r\n(?:[^\r\n]+\r\n)*\r\n([A-Za-z0-9+/=\r\n]+)/gi),
  ]
    .map((partie) => Buffer.from((partie[1] ?? '').replace(/\r\n/g, ''), 'base64').toString('latin1'))
    .join('\n');
  return Buffer.from(`${qp}\n${base64}`, 'latin1').toString('utf8');
}

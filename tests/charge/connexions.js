// Test de charge k6 : N clients WebSocket connectés à une épreuve (pic attendu : 150, exigences §6).
// JAMAIS lancé automatiquement : uniquement à la main, avec l'utilisateur (/test-charge), contre la PREVIEW.
//
//   npm run test:charge                                (preview, 150 clients, palier de 2 min)
//   npm run test:charge -- -e CLIENTS=50 -e DUREE=1m
//
// Par défaut : Worker de preview, avec l'origine de la preview Vercel de dev (autorisée par le serveur).
import { check } from 'k6';
import ws from 'k6/ws';

const URL_SERVEUR = __ENV.URL_SERVEUR || 'wss://poule-position-serveur-preview.spuc-escrime.workers.dev';
const ORIGINE = __ENV.ORIGINE || 'https://poule-position-git-dev-fsmjlas-projects.vercel.app';
const CLIENTS = Number(__ENV.CLIENTS || 150);
const DUREE = __ENV.DUREE || '2m';

if (/poule-position-serveur\./.test(URL_SERVEUR)) throw new Error('Interdit : ce test ne vise jamais la production.');

export const options = {
  scenarios: {
    pic: {
      executor: 'ramping-vus',
      stages: [
        { duration: '30s', target: CLIENTS },
        { duration: DUREE, target: CLIENTS },
        { duration: '15s', target: 0 },
      ],
    },
  },
  thresholds: {
    checks: ['rate>0.99'],
    ws_connecting: ['p(95)<2000'],
  },
};

export default function () {
  const url = `${URL_SERVEUR}/epreuves/charge/connexion`;
  const reponse = ws.connect(url, { headers: { Origin: ORIGINE } }, (socket) => {
    socket.on('message', (message) => {
      const contenu = JSON.parse(message);
      if (contenu.type === 'bienvenue') check(contenu, { 'bienvenue reçu': (c) => c.epreuveId === 'charge' });
    });
    // Ping de maintien, comme l'application (texte exact du protocole).
    socket.setInterval(() => socket.send('{"v":1,"type":"ping"}'), 30_000);
    socket.setTimeout(() => socket.close(), 60_000);
  });
  check(reponse, { 'connexion acceptée (101)': (r) => r && r.status === 101 });
}

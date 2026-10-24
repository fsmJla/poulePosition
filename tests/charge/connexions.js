// Test de charge k6 : N clients WebSocket connectés à une compétition (pic attendu : 150, exigences §6).
// JAMAIS lancé automatiquement : uniquement à la main, avec l'utilisateur (/test-charge), contre la PREVIEW.
//
//   k6 run -e URL_SERVEUR=wss://poule-position-serveur-preview.<sous-domaine>.workers.dev \
//          -e ORIGINE=https://poule-position-git-dev-fsmjlas-projects.vercel.app tests/charge/connexions.js
//
// Options : -e CLIENTS=150 (clients simultanés), -e DUREE=2m (durée du palier).
import { check } from 'k6';
import ws from 'k6/ws';

const URL_SERVEUR = __ENV.URL_SERVEUR;
const ORIGINE = __ENV.ORIGINE;
const CLIENTS = Number(__ENV.CLIENTS || 150);
const DUREE = __ENV.DUREE || '2m';

if (!URL_SERVEUR || !ORIGINE) throw new Error('URL_SERVEUR et ORIGINE sont obligatoires (voir en tête du script).');
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
  const url = `${URL_SERVEUR}/competitions/charge/connexion`;
  const reponse = ws.connect(url, { headers: { Origin: ORIGINE } }, (socket) => {
    socket.on('message', (message) => {
      const contenu = JSON.parse(message);
      if (contenu.type === 'bienvenue') check(contenu, { 'bienvenue reçu': (c) => c.competitionId === 'charge' });
    });
    // Ping de maintien, comme l'application (texte exact du protocole).
    socket.setInterval(() => socket.send('{"v":1,"type":"ping"}'), 30_000);
    socket.setTimeout(() => socket.close(), 60_000);
  });
  check(reponse, { 'connexion acceptée (101)': (r) => r && r.status === 101 });
}

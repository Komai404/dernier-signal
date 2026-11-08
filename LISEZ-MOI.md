# DERNIER SIGNAL — version site et appli

Jeu de déduction post-apocalyptique, jouable à distance, de 4 à 16 joueurs.
Ce dossier contient le site complet : le jeu, son serveur et l'appli installable.

---

## 1. Jouer tout de suite sur cet ordinateur

1. Installe **Node.js** (version LTS) depuis https://nodejs.org si ce n'est pas déjà fait.
2. Double-clique sur le lanceur :
   - Windows : `Lancer-Windows.bat`
   - Mac : `Lancer-Mac.command` (la première fois : clic droit, puis Ouvrir)
   - Linux : `lancer-linux.sh`
3. Le site s'ouvre sur http://localhost:8080 (page d'accueil avec les règles, les rôles et les cartes 3D).
   Clique sur « Jouer en ligne » pour lancer le jeu (http://localhost:8080/jouer.html).
   **Laisse la fenêtre noire ouverte** pendant la partie.

Aucune installation de paquet n'est nécessaire : le serveur n'a aucune dépendance.

## 2. Jouer à plusieurs

**Dans la même maison (même Wi-Fi)** : au démarrage, la fenêtre affiche une adresse
« Sur le réseau local », par exemple `http://192.168.1.20:8080`. Les autres joueurs l'ouvrent
sur leur ordinateur ou leur téléphone, entrent leur nom et le code de la partie.

**À distance (chacun chez soi)** : il faut mettre le site en ligne. Le plus simple, gratuit :

- **Render** : crée un compte sur https://render.com, envoie ce dossier sur un dépôt GitHub,
  puis « New + » → « Blueprint » et choisis le dépôt (le fichier `render.yaml` règle tout).
  Tu obtiens une adresse du type `https://dernier-signal.onrender.com` à partager.
- **N'importe quel hébergeur Node.js** (Railway, Fly.io, un VPS…) : commande de démarrage
  `node server.js`. Un `Dockerfile` est fourni.

Remarque : sur l'offre gratuite de Render, le site se met en veille après un moment sans
visite ; la première ouverture peut prendre une minute.

## 3. Installer l'appli

Quand le site est ouvert en `https://` (en ligne) ou sur `localhost` :

- **Ordinateur (Chrome, Edge)** : bouton « Installer l'appli » en haut de l'accueil,
  ou l'icône d'installation dans la barre d'adresse.
- **Android** : menu ⋮ → « Installer l'application ».
- **iPhone / iPad (Safari)** : bouton Partager → « Sur l'écran d'accueil ».

L'appli s'ouvre en plein écran, avec sa propre icône. Sans connexion, elle permet
toujours la **partie d'essai contre des bots**.

## 4. Le mode 3D

À la création (ou dans le salon), l'hôte choisit **Classique** ou **3D**, puis une carte :
la Forêt (tentes), la Prison (cellules), la Ville en ruines (maisons) ou le Laboratoire (chambres).
Chaque joueur a son logement, avec sa carte posée sur la table. Dans le salon, chacun règle son
personnage (peau, cheveux, coupe, haut, bas, couvre-chef, accessoire).

Commandes : **ZQSD** ou **WASD** pour marcher, la souris pour regarder (clique d'abord sur le jeu),
**Maj** pour courir, **E** pour agir, **T** pour parler, **Tab** pour la tablette (tout le jeu en
version classique), **V** pour la vue extérieure, **R** pour « prêt à voter ». Sur téléphone :
joystick à gauche, glisser à droite pour regarder, bouton « Agir ».

- La nuit, tu commences dans ton logement. Tu peux rester ou sortir : pour utiliser ton pouvoir,
  va à la porte du joueur visé et appuie sur E. Attention, les autres peuvent te voir passer.
- Le Réanimateur agit au cimetière, sur la tombe d'un éliminé. Le Constructeur bâtit depuis son lit.
- Le jour, tout le monde se retrouve autour du feu. Pour voter, va au poteau du joueur et appuie sur E. Le bouton « Voter blanc » permet de ne désigner personne.
- Le bouton « Guide » (touche G) explique les règles et les commandes à tout moment.
- Ta carte se ferme avec la croix en haut à droite, Échap ou E.
- Un joueur éliminé devient un fantôme : il se promène sans être vu.
- Le bouton « Vue classique » repasse en 2D à tout moment (utile sur un appareil peu puissant).
  Un joueur en vue classique reste visible dans le monde des autres (chez lui la nuit, au feu le jour).
- La nuit, chacun porte une lanterne : on voit les autres passer de loin. Sur un appareil lent, la
  résolution baisse automatiquement pour rester fluide.

## Chat vocal

Sur le site (Render ou ton propre serveur), chaque joueur peut parler au micro :

- En arrivant dans une partie, un bandeau propose « Autoriser le micro ». Le navigateur demande
  alors la permission. On peut aussi l'activer plus tard avec le bouton **VOCAL** en haut.
- **Mode classique** : tout le monde s'entend. **Mode 3D** : chat de proximité, la voix baisse avec
  la distance (réglable dans `const VOICE`, valeurs `NEAR` et `FAR`) et vient du bon côté.
- Les règles du canal écrit s'appliquent : la nuit, seule la tanière peut se parler ; les éliminés
  et les contaminés n'ont plus la parole devant les survivants.
- Dans le panneau VOCAL : couper son micro (touche M en 3D), rendre muet un joueur, régler le volume
  de chaque joueur, de son micro et le volume général.
- Le son passe directement d'un joueur à l'autre (WebRTC) ; le serveur ne fait que les présenter.
  Sur certains réseaux très fermés (entreprise, école), la connexion directe peut échouer.
- Pas de chat vocal dans la version claude.ai ni dans la partie d'essai.

## Téléphone

Le jeu se joue en vertical ou en horizontal. À l'horizontale, l'interface se resserre : en classique,
l'action à gauche et la discussion à droite ; en 3D, gros bouton Agir à droite. MENU → « Plein écran
à l'horizontale » cache la barre du navigateur (Android). Sur iPhone, ajoute le site à l'écran
d'accueil pour jouer en plein écran.

L'aide à l'écran (le bandeau « À toi de jouer ») se masque avec sa croix et se remet dans
MENU → Aide à l'écran.

## 5. Nouveaux rôles

- **Le Constructeur** (survivants) : une fois par partie, il construit une seconde maison. Si la
  tanière vient le contaminer ensuite, il dort ailleurs : la contamination échoue et il reçoit un
  indice (trois noms, dont celui du Mordu). Il n'a pas le droit de le partager.
- **L'Empoisonneur** (contaminés) : il reçoit sa carte avant tout le monde et empoisonne un joueur,
  qui reçoit un faux rôle choisi par l'Empoisonneur. Le faux rôle n'agit jamais vraiment : le jeu
  invente toujours un prétexte. Le poison ne prend pas sur le Mordu original.
- **Le Discret** (survivants) : au début, le jeu annonce à tous qu'un certain rôle est en jeu.
  C'est la couverture du Discret, qui doit se faire passer pour lui. Chaque nuit, il imite le
  pouvoir de n'importe quel rôle pour une nuit, même la contamination du Mordu (dès la 2e nuit).

Les cartes de ces trois rôles sont provisoires : remplace `public/cards/constructeur.webp`,
`empoisonneur.webp` et `discret.webp` par tes propres dessins (image carrée) en gardant les noms.

## 6. Les bots

Les bots comprennent ce qu'on leur écrit et répondent à la question posée :

- « Brume t'es quoi ? » → il donne son rôle, le garde secret ou ment s'il est contaminé ;
- « qui vous soupçonnez ? », « tu votes qui ? », « pourquoi ? » → ils donnent un nom et leur raison ;
- une accusation contre un bot → il se défend, puis donne son rôle si on insiste ;
- « je suis Scientifique, j'ai analysé X : contaminé » → ils en tiennent compte et votent en conséquence ;
- quelqu'un qui change de rôle annoncé, ou deux joueurs qui annoncent le même rôle → ils le remarquent ;
- « comment on joue ? », « il s'est passé quoi cette nuit ? » → ils expliquent ou résument.

Ils ne parlent pas tous en même temps : deux bots lancent la discussion, les autres répondent quand on
leur parle. Dans la tanière, un bot contaminé suit la cible proposée par un humain.

**Bots encore plus intelligents (IA Claude)** :

- Sur la version claude.ai, la case « Bots pilotés par l'IA Claude » est cochée par défaut dans le salon
  (Claude demande l'autorisation au lancement).
- Sur ton site Render, c'est possible avec une clé d'API Anthropic (payante, quelques centimes par
  partie) : sur https://console.anthropic.com crée une clé, puis dans Render → ton service →
  **Environment** → ajoute `ANTHROPIC_API_KEY` avec la clé. La case apparaît alors dans le salon.
  Seul l'hôte de la partie peut l'utiliser, avec une limite de 400 messages par heure et par partie.

## 7. Confidentialité des rôles

- Chaque joueur ne reçoit que sa propre carte et ses propres résultats.
- Le serveur refuse de donner à un joueur la boîte privée d'un autre, et seul l'hôte
  lit les actions secrètes (votes, choix de nuit).
- En `https://` et sur `localhost`, tout est en plus **chiffré** de bout en bout entre
  chaque joueur et l'hôte.
- Le moteur de la partie tourne dans le navigateur de l'hôte : **l'hôte doit garder la
  page ouverte**. Pour une partie sans aucun doute possible, l'hôte coche
  « Je suis maître du jeu » et ne joue pas.

## 8. Le panneau du maître du jeu

En cochant « Je suis maître du jeu » à la création, l'hôte obtient un panneau réservé
(les joueurs n'y ont jamais accès) pour :

- **choisir les rôles** dans le salon (panneau « Distribution des cartes ») : pour chaque joueur,
  « Au hasard » ou un rôle imposé. Tu peux en imposer un seul, plusieurs ou tous ; les autres cartes
  sont tirées au hasard. Ce choix reste invisible pour les joueurs ;
- lancer la partie, passer à la phase suivante (nuit → aube → vote → nuit) ;
- mettre le chrono en pause, ajouter 30 secondes ;
- voir tous les rôles, les camps, les contaminations et les éliminations ;
- modifier ou annuler une action de nuit, imposer ou empêcher la contamination ;
- consulter et corriger les votes en direct ;
- corriger une erreur : changer un rôle, un camp, éliminer ou ramener un joueur,
  rendre un pouvoir à usage unique ;
- forcer la fin (victoire d'un camp ou arrêt sans vainqueur).

Toutes les corrections sont notées dans l'historique et le joueur concerné est prévenu.

## 9. Modifier les règles

Tout le jeu est dans `public/jouer.html` (la page d'accueil du site est `public/index.html`). Ouvre-le avec un éditeur de texte
(Bloc-notes, TextEdit, VS Code…) et cherche ces blocs, en haut du script :

| Ce que tu veux changer | Cherche |
|---|---|
| Durées, durée minimale d'une nuit, nombre de joueurs, options de règles | `const CONFIG = {` |
| Nom, pouvoir, objectif et limites d'un rôle | `const ROLES = {` |
| Ordre d'apparition des rôles spéciaux selon le nombre de joueurs | `const SPECIAL_ORDER` |
| Textes des actions de nuit | `const ACTS = {` |
| Résolution de la nuit (contamination, Scientifique, Chasseur…) | `function resolveNight()` |
| Conditions de victoire | `function checkWin()` |
| Commandes du maître du jeu | `function mjOp(m)` |
| Cartes 3D (couleurs, décors, logements) | `const MAPS3D` et `const DECO3D` |
| Comportement et phrases des bots | `function botLine(` |

Exemples de réglages dans `CONFIG` :

- `FIRST_DAY_VOTE: false` → pas de vote le premier jour (le Mordu ne contamine qu'à partir de la
  deuxième nuit). Passe à `true` pour voter dès le jour 1.
- `CONTAMINATED_CAN_TALK_BY_DAY: false` → passe à `true` pour que les contaminés puissent
  parler (et bluffer) le jour.
- `NIGHT_ENDS_EARLY: false` → la nuit dure tout son chrono. Passe à `true` pour qu'elle se termine
  dès que tout le monde a agi.
- `ANNOUNCE_REPELLED: true` → annonce qu'une contamination a été repoussée par le Gardien.
- `SCIENTIST_SEES_CONTAMINATION: true` → le Scientifique voit aussi si sa cible est contaminée.

Le pouvoir du **Chasseur** est provisoire : son texte est dans `ROLES.chasseur` et son effet
dans `resolveNight()` (section « chasseur »).

Après une modification, recharge simplement la page (le serveur n'a pas besoin d'être relancé).
Si l'appli installée affiche encore l'ancienne version, ferme-la et rouvre-la.

## 10. Contenu du dossier

```
server.js              le serveur (temps réel, règles d'accès, sauvegarde des parties)
public/index.html      le site (accueil, règles, rôles, cartes 3D)
public/jouer.html      le jeu complet
public/shots/          captures des cartes 3D
public/cards/          les cartes
public/sw.js           fonctionnement hors ligne de l'appli
public/manifest.webmanifest, icon-*.png   appli installable
data/                  parties en cours (créé automatiquement, effacé après 3 jours d'inactivité)
Lancer-*.{bat,command}, lancer-linux.sh   lanceurs
render.yaml, Dockerfile                   mise en ligne
```

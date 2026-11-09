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

## Profil, pièces, boutique et codes

- **PROFIL** (en haut, ou sur l'accueil) : ton profil, tes statistiques, la **boutique**, ton **casier**
  (titre, badges, cadre, effet de pseudo, thème de l'interface, tenue), tes **emotes**, ta **chambre**,
  les **codes** et les **archives** (pages secrètes).
- Chaque partie terminée rapporte des pièces : 50 pour avoir joué, +100 en cas de victoire, +25 si tu
  as survécu jusqu'au bout. Bonus du jour : +150. Les réglages sont dans `const ECO`.
- Clique sur le nom d'un joueur pour voir son profil (badge à gauche du pseudo, titre à droite
  entre crochets, VIP, niveau, parties jouées et gagnées).
- **CODE** : entre un code pour recevoir pièces, objets, titres, thèmes, emotes, pages secrètes…
  Les codes sont dans `const CODES` (ajoute ou modifie-les facilement). `BESTFRIEND` suivi d'un numéro :
  deux amis qui entrent le même numéro et jouent ensemble reçoivent le badge Duo. Les **LOST CODES**
  sont cachés dans le jeu ; en trouver 4 ouvre PROJECT : UNDERGROUND. Les codes d'événement ne marchent
  que pendant leur période (`const EVENTS`).
- **Emotes en 3D** : touche **B** (ou bouton Emotes sur téléphone) pour la roue de 6 emotes.
- **Chambre** : avec la Clé de chambre (boutique) ou un code, décore ton logement 3D (6 emplacements).
- **Triche (CKE26)** : changer de rôle, donner un rôle, voir les rôles et les votes, double vote,
  invincible, ressusciter, etc. L'hôte peut l'interdire dans le salon (« Codes de triche autorisés »),
  et chaque triche est notée dans l'historique du maître du jeu. Attention : n'importe qui qui connaît
  le code peut tricher dans une partie où c'est autorisé.
- Le profil est enregistré dans le navigateur (pas de compte). Changer d'appareil ou vider les données
  du site repart de zéro. Sur ton site, le classement des meilleurs joueurs est partagé par tous.

## Comptes joueurs

Dans **PROFIL**, chacun peut **créer un compte** (pseudo + mot de passe d'au moins 6 caractères) puis
**se connecter** sur n'importe quel appareil : pièces, objets, codes, titres, tenue et statistiques
sont sauvegardés automatiquement. Le mot de passe n'est jamais envoyé tel quel (empreinte PBKDF2,
protégée encore par scrypt côté serveur). Sur la version claude.ai, la sauvegarde est automatique
sur le compte Claude.

**Important sur Render gratuit** : le disque est effacé à chaque redémarrage. Le jeu se protège
(chaque appareil connecté recrée son compte tout seul), mais pour des comptes vraiment permanents,
branche une base gratuite **Upstash Redis** (2 minutes) :

1. Crée un compte sur https://upstash.com, puis **Create Database** (Redis, offre gratuite).
2. Dans la base, section **REST API**, copie `UPSTASH_REDIS_REST_URL` et `UPSTASH_REDIS_REST_TOKEN`.
3. Sur Render → ton service → **Environment** → ajoute ces deux variables avec leurs valeurs → **Save**.

Le serveur redémarre et les comptes sont alors stockés pour de bon.

## Compte administrateur

Le compte admin n'existe que si tu le configures sur Render. Son mot de passe n'est jamais écrit dans le code ni dans GitHub.

1. Sur Render, ouvre le service **dernier-signal**, puis **Environment**.
2. Ajoute la variable `ADMIN_PASSWORD` avec un mot de passe long que toi seul connais.
3. Facultatif : ajoute `ADMIN_NAME` pour choisir le pseudo de l'admin (par défaut : `admin`).
4. Enregistre. Render redémarre le site.
5. Sur le site : **Profil → Se connecter** avec ce pseudo et ce mot de passe. Un onglet **Admin** apparaît.

Ce que permet l'onglet Admin :

- **Codes** : créer, modifier, désactiver ou retirer tes propres codes (nom, message, récompenses à choisir dans une liste, dates de début et de fin, nombre d'utilisations maximum). Tu peux aussi retirer du jeu n'importe lequel des codes existants, ou remplacer ses récompenses. Les joueurs ne peuvent pas voir la liste de tes codes : le navigateur ne reçoit que leur empreinte.
- **Joueurs** : voir tous les comptes (pièces, XP, parties, codes…), leur envoyer un cadeau, les suspendre, changer leur mot de passe, les supprimer.
- **Cadeaux** : offrir un cadeau à tous les joueurs, avec une date limite si tu veux.
- **Site** : annonce en haut de l'écran d'accueil, message d'accueil, pièces et XP multipliées en fin de partie, soldes dans la boutique, événement offert, message de maintenance, cadeau de bienvenue.
- **Statistiques** : nombre de comptes, de joueurs connectés, de parties.
- **Codes en lot** : générer jusqu'à 200 codes à usage unique d'un coup (concours, live), puis supprimer le lot.
- **Direct** : envoyer un message qui s'affiche en grand chez tous les joueurs connectés, et changer la météo des parties 3D (neige, cendres, lucioles).
- **Économie** : pièces de départ, gains par partie, victoire et survie, XP, bonus du jour, plafond des activités 3D, prix et jackpot de la roue, prix des agrandissements de maison, durées par défaut des parties.
- **Prix boutique** : changer le prix de n'importe quel objet (0 = gratuit).
- **Contenu** : texte d'accueil, noms des bots, récompenses de connexion des 7 jours.
- **Classement** : retirer un joueur ou tout remettre à zéro.
- **Journal** : tout ce que l'admin a fait, et qui a utilisé tes codes limités.
- **Fiche joueur** (onglet Joueurs) : fixer ses pièces, son XP et son niveau de maison, retirer un objet, rendre un code de nouveau utilisable, remettre ses statistiques à zéro.
- **Développeur** : sur le compte admin tout est gratuit (toutes les boutiques, la maison, la roue), tout est débloqué automatiquement, n'importe quel code peut être réutilisé même hors de sa période, bonus du jour, roue et succès sont illimités, le panneau de triche est ouvert. Boutons : 9 999 999 pièces, niveau 100, garde-manger plein, 10 coffres, gains ×2, modifier son propre profil, se donner n'importe quelle récompense, exporter et importer tous les réglages du site.
- **Parties en direct** : voir les parties en cours, les rejoindre, leur envoyer un message, les fermer.
- **Télécommande** (dans Parties en direct) : lancer la partie, phase suivante, pause, +30 s, finir le chrono, déclarer la victoire d’un camp ou arrêter, éliminer ou ressusciter un joueur, changer son camp, l’expulser, ajouter des bots, écrire dans le chat de la partie, retour au salon. L’hôte de la partie doit être connecté.
- **Super-pouvoirs** (pour toi seul) : vitesse ×2, ×3, ×5 en 3D, traverser les murs, affichage développeur (images par seconde, position), téléportation (maison, centre, étang, clairière, parcours, puits), réclamer tous les succès, feu d’artifice, pluie de pièces, oublier ses codes utilisés, maison niveau 1 ou 6, mode stream (onglet Admin caché, Ctrl + Maj + A pour le retrouver), télécharger et restaurer son profil.
- **Monde** : couleur principale du site, compte à rebours sur l’accueil, happy hour (pièces multipliées à certaines heures), XP multipliée le week-end, code du jour mis en avant, message défilant, date de fin de l’annonce, mots interdits dans le chat et dans les pseudos, nouveautés et liens (Discord, YouTube…) sur l’accueil, fermer les inscriptions, la boutique, la roue ou les codes, désactiver le mode 3D ou classique, mode fête (confettis), sondage pour les joueurs avec résultats en direct.
- **Outils** : inspecteur de code (récompenses, période, déjà utilisé ou non), tirage de codes au hasard pour les concours, ligne de commande de récompenses, retirer ou remettre une famille de codes d’un coup (par exemple tous les POKE).
- **Joueurs (en plus)** : trier la liste, l’exporter en tableau CSV, cadeau à plusieurs joueurs d’un coup, et sur la fiche : déconnecter partout, rendre muet, message privé, avertissement, note privée, renommer le compte, voir et réécrire son profil complet, annuler ses cadeaux en attente.
- **Codes, journal, statistiques (en plus)** : dupliquer un code, le prolonger de 7 jours, remettre son compteur à zéro ; chercher dans le journal et le télécharger ; nouveaux comptes du jour et de la semaine, pièces en circulation, joueur le plus riche.

Sans Upstash, les réglages et les codes admin sont effacés à chaque redémarrage de Render, comme les comptes. Avec Upstash, tout est gardé.

## Modèles 3D (Blockbench)

Les personnages et les décors de la 3D sont faits avec Blockbench. Les fichiers sont dans `modeles/` :

- `personnage.bbmodel` : le corps des joueurs, en 6 os (jambes, torse, bras, tête) que le jeu anime.
- `decors.bbmodel` : pins (trois niveaux de détail), chêne, arbre mort, rocher, buisson, fleurs, champignon, souche, tronc couché, caisse, tonneau, lampadaire, banc, lanterne, panneau, voiture, feu de camp, tombe, bordure de la place, poteau de vote.
- `maison.bbmodel` : lit, table, chaise, lampe de table, fenêtre à volets, lanterne murale, boîte aux lettres, cheminée, lierre.
- `skins.bbmodel` : les 15 couvre-chefs, les 7 accessoires et les 7 objets de dos de la boutique (os `tete`, `torse`, `cape`, `aile_g`, `aile_d`).

Pour retoucher un modèle :

1. Ouvre le fichier `.bbmodel` dans Blockbench et modifie-le. Chaque groupe du premier niveau est un modèle ; ses sous-groupes sont des os (leur origine sert de pivot).
2. Le nom d'un cube donne sa couleur : un rôle (`tone` peau, `hair` cheveux, `top` haut, `bottom` pantalon, `leaf` feuillage, `bark` écorce, `stone`, `wood`, `metal`, `light`…) ou une couleur `#rrggbb`. On peut l'éclaircir ou l'assombrir avec `*0.8`. Ajoute `~` pour qu'il bouge au vent, `!` pour qu'il brille (vitres, lampes).
3. Enregistre, puis lance `node outils/blockbench/convertir.js` : il produit la ligne `const BBM = …` à mettre dans le jeu.

Les plans d'origine sont dans `outils/blockbench/specs.js` (`node outils/blockbench/fabriquer-bbmodel.js` refait les fichiers Blockbench).

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

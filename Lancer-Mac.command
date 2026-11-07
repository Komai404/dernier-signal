#!/bin/bash
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js n'est pas installé. Installe la version LTS depuis https://nodejs.org puis relance ce fichier."
  open https://nodejs.org
  read -n 1 -s -r -p "Appuie sur une touche pour fermer."
  exit 1
fi
(sleep 1.5; open http://localhost:8080) &
node server.js

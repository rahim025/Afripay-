# AfriPay

Envoyer et recevoir de l'argent partout en Afrique, avec conversion automatique dans la monnaie du destinataire.

Projet repris de zéro avec une structure claire : site vitrine séparé de l'API backend.

## Structure

```
afripay/
├── client/          Site vitrine (HTML/CSS/JS, sans dépendance)
│   ├── index.html
│   ├── inscription.html
│   └── icon.svg
└── server/          API backend (Node.js/Express + Supabase/Postgres)
    ├── server.js
    ├── config/
    ├── controllers/
    ├── middleware/
    ├── routes/
    └── supabase/
        └── schema.sql   Schéma SQL à exécuter dans Supabase (SQL Editor)
```

## Démarrer le backend en local

```bash
cd server
cp .env.example .env   # puis renseigner SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY et JWT_SECRET
npm install
npm run dev
```

Avant le premier démarrage, exécuter le contenu de `server/supabase/schema.sql`
dans l'éditeur SQL de ton projet Supabase (crée les tables `users` et
`transactions`).

`SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` se trouvent dans Supabase →
Project Settings → API. Utilise bien la clé **service_role** (jamais la clé
`anon`, et jamais côté frontend/navigateur).

L'API démarre sur `http://localhost:5000`. Vérifier qu'elle tourne avec `GET /api/health`.

## Démarrer le frontend en local

Ouvrir simplement `client/index.html` dans un navigateur.

## Déploiement

- **Frontend** : GitHub Pages ou Netlify (dossier `client/`).
- **Backend** : Render, avec un projet Supabase (variables d'environnement `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` et `JWT_SECRET` à définir dans le dashboard).

## Statut

🟡 En cours — flux complet inscription → vérification par code → connexion → tableau de bord, connecté au backend. Taux de change toujours fictifs, pas de vraie passerelle de paiement (dépôt de démonstration uniquement), pas de service SMS/email réel (le code de vérification est loggé côté serveur).

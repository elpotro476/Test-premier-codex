# Vérification V3.1 — 9 octobre 2026

## Résultats locaux

- 14 tests sur **PostgreSQL 17.6 réel**, migrations appliquées dans la base jetable `semin_v3_test`. RLS, accès anonyme refusé, isolation des espaces, droits lecteur/éditeur/admin, clés non modifiables, aucun accès direct aux écritures ou suppressions, unicité SKU/EAN, EAN absent, valeurs invalides, conservation des champs absents du patch, audit, archivage/restauration, variantes, dernier administrateur, révocation et révisions. Deux connexions concurrentes : une seule écriture acceptée, l'autre refusée, un seul événement de mise à jour.
- 9 tests Chromium de V3 : démonstration CRUD fictive, contrôle EAN/doublons, confirmation d'archivage/restauration, tactile, accès après connexion, lecteur sans édition, requêtes authentifiées, conflit de révision, erreurs Auth, expiration/rafraîchissement, absence de stockage de jetons, déconnexion et réponse tardive, rejet de clé privilégiée et CSP limitée au projet. Les réponses Auth/REST sont **simulées**, aucune fiche envoyée à Supabase.
- 13 tests V1/V2 : imports Excel, profils/mappings, contrôles et exports conservés, fiches IndexedDB, sauvegardes/reimports/conflits et tactile. Aucun fichier de V1/V2/Windows modifié.
- Audit de l'artefact démo : connexion réseau interdite (`connect-src 'none'`), aucune configuration de projet/clé/jeton réelle, uniquement un produit fictif et du code. Aucune donnée commerciale ni catalogue réel ajouté dans le dépôt. Contrôle syntaxe JS et diff Git effectué.

Total : **36 tests réussis localement**. Le workflow V3.1 reprend ces suites et prépare seulement un ZIP de démonstration ; il ne déploie aucun site ni base.

## Ce qui n'est pas validé

Émission et vérification de JWT par Supabase Auth réel, SMTP/invitations/récupération, MFA/SSO, région et contrat d'hébergement, restauration d'une sauvegarde cloud, performances avec un catalogue professionnel et appareil Lenovo physique pour cette V3. Le PostgreSQL local simule seulement le contrat `auth.uid()` ; cela n'est pas un audit DSI ni une certification de production.

Suivre [la recette Supabase](GUIDE-SUPABASE.md) avec un projet développement fictif avant toute utilisation professionnelle ou déploiement V3. Le site V2 et les données locales restent indépendants. Imports centraux Excel/JSON V2, attributs avancés et modules marketplace appartiennent aux lots suivants.

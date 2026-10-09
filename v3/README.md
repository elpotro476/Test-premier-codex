# SEMIN Marketplace Studio — V3.1

Prototype central séparé de V1/V2. Aucune base cloud ni nouvelle publication créées. Commencer par [l'audit et l'architecture](ARCHITECTURE.md) puis [les étapes Supabase](GUIDE-SUPABASE.md). La V3 centralisée transmet les données au projet Supabase configuré ; son utilisation professionnelle nécessite la validation DSI.

## Réalisé

Migrations PostgreSQL, RLS, rôles admin/editor/reader, commandes transactionnelles de création/modification/archivage/restauration, historique avant/après, unicité SKU/EAN, isolation par espace et révisions contre les écrasements. Interface française tactile, Auth email/mot de passe avec jetons en mémoire, pagination/recherche, sélection d'espace et administration des rôles. Démonstration fictive en mémoire sans API. V1/V2 et Windows sont inchangés.

## Tester et préparer la démonstration (développeur)

```sh
node v3/build.mjs
```

Ouvrir `v3/dist/index.html` dans Chrome si les fichiers locaux sont autorisés. Le build sans configuration propose uniquement la démonstration fictive. Aucun compte Supabase requis pour celle-ci. Sur Android un hébergement HTTPS séparé nécessitera une autorisation.

Les tests PostgreSQL utilisent une base **jetable nommée semin_v3_test**, avec PostgreSQL 17. Les commandes ci-dessous sont réservées au développement et ne publient aucun port PostgreSQL. Docker doit déjà fonctionner :

```sh
docker run -d --name semin-v3-postgres -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=semin_v3_test postgres:17.6
docker exec semin-v3-postgres pg_isready -U postgres
docker exec -i semin-v3-postgres psql -X -v ON_ERROR_STOP=1 -U postgres -d semin_v3_test < v3/tests/auth-fixture.sql
docker exec -i semin-v3-postgres psql -X -v ON_ERROR_STOP=1 -U postgres -d semin_v3_test < v3/supabase/migrations/001_catalogue.sql
docker exec -i semin-v3-postgres psql -X -v ON_ERROR_STOP=1 -U postgres -d semin_v3_test < v3/supabase/migrations/002_commands.sql
SEMIN_PSQL='docker exec -i semin-v3-postgres psql -X -U postgres -d semin_v3_test' python3 -m unittest discover -s v3/tests -p test_postgres.py -v
```

Les comptes et rôles du fichier fixture imitent Supabase pour tester PostgreSQL ; **ne pas exécuter cette fixture dans Supabase**. Les tests refusent une autre base. Après les essais, supprimer uniquement ce conteneur jetable avec `docker rm -f semin-v3-postgres`.

Tests navigateur (outils sur le poste développeur / CI uniquement) :

```sh
python3 -m pip install playwright==1.62.0
python3 -m playwright install chromium
python3 -m unittest discover -s v3/tests -p test_frontend.py -v
python3 -m unittest discover -s web/tests -v
```

Dans un environnement avec Chromium système, ajouter `SEMIN_TEST_CHROMIUM=/usr/bin/chromium`. Le workflow **V3.1 — Base et interface** automatise migrations/tests PostgreSQL, interface V3 et non-régression V1/V2, puis prépare un artefact **SEMIN-V3.1-Demo**. Il ne déploie pas Pages. Les tests d'interface centrale utilisent des réponses HTTP fictives ; une recette sur Supabase réel reste nécessaire.

Pour connecter un projet de développement, construire avec `node v3/build.mjs .local/v3-config.json` selon le guide. Cette configuration n'est jamais nécessaire aux tests publics.

# SEMIN Marketplace Template Manager

Prototype local en français pour remplir des templates Excel à partir d’un catalogue. Aucun appel à une API externe, aucune donnée confidentielle et aucun remplissage inventé. Les fichiers de démonstration sont explicitement fictifs.

## V3.1 — Prototype central séparé

[Le lot V3.1](v3/README.md) prépare PostgreSQL / Supabase, Auth, rôles et CRUD du catalogue central, sans modifier V1/V2 ni le site publié. [Architecture et limites](v3/ARCHITECTURE.md), [connexion manuelle à Supabase](v3/GUIDE-SUPABASE.md). Aucun service cloud ni abonnement créé. Contrairement à V1/V2, une V3 configurée transmet les fiches au projet Supabase choisi ; validation DSI requise avant données réelles. Le workflow V3 teste et prépare une démonstration fictive sans déployer Pages.

## V2 — Premier lot catalogue maître (à valider avant déploiement)

Le catalogue maître local IndexedDB est ajouté à la version navigateur, avec fiches modifiables, attributs extensibles, reimports prévisualisés, détection de doublons et sauvegardes JSON. Le parcours V1 et le projet Windows sont conservés. Voir [l’architecture V2 et son périmètre](web/ARCHITECTURE-V2.md). Les autres modules marketplace seront développés par lots ; aucune mise à jour Pages n’est déployée sans validation de cette version.

## Version navigateur Android / Windows (sans Python)

Une version distincte traite les fichiers entièrement dans Chrome. Voir le [guide tablette et navigateur](web/GUIDE-ANDROID-WINDOWS.md). Le fichier autonome est `web/SEMIN-Marketplace.html` ; le workflow **Version navigateur** teste et prépare son ZIP téléchargeable, sans publier de site. L’hébergement HTTPS recommandé pour Android exige un accord explicite ; le workflow de publication est manuel et ne se déclenche pas lors des pushes. Les correspondances sont enregistrées dans Chrome, avec sauvegarde/restauration JSON. Le projet Windows ci-dessous est conservé.

## Version Windows autonome (sans Python)

La compilation automatisée est disponible dans [Actions → Application Windows](https://github.com/elpotro476/Test-premier-codex/actions/workflows/windows.yml). Le package autonome est publié **uniquement après génération et tests réussis du véritable .exe Windows**. Consultez le [guide Windows 11](GUIDE-WINDOWS-11.md) pour télécharger l’artefact, extraire le package et lancer `SEMIN-Marketplace.exe` par double-clic. Python et les dépendances sont embarqués ; le navigateur affiche la même interface locale. Les correspondances sont sauvegardées dans `%LOCALAPPDATA%\SEMIN-Marketplace\mappings.json`, hors du dossier de l’exécutable.

`Code → Download ZIP` contient les sources et ne remplace pas le package autonome. Une compilation Linux ne peut pas produire ce .exe ; le workflow utilise Windows x64.

## Lancer depuis les sources sur Windows (développement)

1. Installez Python 3.12 ou ultérieur depuis python.org (cochez « Add Python to PATH »), puis téléchargez ou clonez ce dépôt.
2. Vous pouvez ensuite double-cliquer sur **Lancer-SEMIN.bat** : il prépare Python et ouvre le navigateur. Gardez sa fenêtre ouverte. Le premier lancement nécessite Internet pour installer les dépendances.

Pour un lancement manuel, ouvrez PowerShell dans le dossier du projet et exécutez :

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe app.py
```

3. Ouvrez `http://127.0.0.1:8000` dans Edge, Chrome ou Firefox. Gardez PowerShell ouvert. Arrêtez avec Ctrl+C. Si le port est occupé : `app.py --port 8001`.

Les dépendances sont téléchargées à l’installation seulement ; l’application fonctionne ensuite sans Internet. Aucun logiciel Excel n’est nécessaire pour produire le fichier.

### Linux / environnement cloud

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python app.py
```

Le serveur écoute uniquement sur l’interface locale. Le prototype n’est pas un service hébergé accessible depuis un autre ordinateur ; pour Windows, exécutez-le sur votre propre PC.

## Essayer le parcours

1. Cliquez sur **Charger la démonstration** : un catalogue de trois produits et un template fictif sont chargés.
2. Le contrôle détecte les erreurs du troisième produit : description manquante, EAN invalide et prix négatif. L’export reste désactivé.
3. Désélectionnez `DEMO-003`, puis cliquez sur **Contrôler les données**.
4. Modifiez une correspondance si nécessaire ; cochez les champs réellement obligatoires. Nommez la marketplace et enregistrez le profil.
5. Exportez et ouvrez le fichier : la feuille « Instructions », les en-têtes, les formats et les validations Excel sont conservés.
6. Pour vos fichiers : importez deux `.xlsx`, choisissez les feuilles, la ligne d’en-tête et la première ligne vierge destinée aux produits, puis analysez-les. Recherchez un SKU/EAN et sélectionnez les produits.

Le bouton de démonstration remplace les imports en cours. Les profils de correspondances sont conservés dans `.local/mappings.json`, ignoré par Git. Ils sont réutilisables seulement si les noms et positions des colonnes concordent. Les catalogues restent en mémoire du serveur ; ils ne sont pas enregistrés par l’application. Arrêter le serveur efface les sessions. Un export télécharge le résultat sur le PC.

## Règles et limites de cette première version

- `.xlsx` uniquement : maximum 15 Mo, 50 000 lignes et 250 colonnes par feuille. Macros `.xlsm`, ancien `.xls` et fichiers chiffrés non pris en charge.
- Les colonnes sont suggérées par nom et synonymes français/anglais. Les ambiguïtés restent sans correspondance. Les noms commerciaux de marketplaces n’ajoutent aucune règle cachée.
- Les astérisques dans les en-têtes et les mentions « obligatoire » / « required » dans les commentaires suggèrent les champs requis. **Vérifiez toujours les cases obligatoires selon la documentation réelle de votre marketplace** : les règles conditionnelles et contraintes propres aux plateformes ne sont pas déduites automatiquement.
- Contrôles : champs requis, EAN-13 avec clé, doublons SKU/EAN, prix/poids non négatifs et stock entier non négatif. Les valeurs ressemblant à des formules sont bloquées. Les formules du catalogue doivent être remplacées par leurs valeurs avant import.
- Les SKU/EAN restent des chaînes ; les zéros initiaux sont conservés s’ils existent en texte ou via un format Excel composé de zéros. Des chiffres déjà perdus dans le fichier source ne peuvent pas être récupérés.
- Les zones de destination doivent être vierges et non fusionnées. Aucune instruction ou valeur existante n’est écrasée. Les autres feuilles, colonnes, commentaires, largeurs, styles et validations standard sont conservés par openpyxl. Le style de la première ligne de données est recopié sur les nouvelles cellules sans style.
- Les extensions Excel avancées (certains objets graphiques, contrôles, signatures, validations propriétaires) ne sont pas garanties par openpyxl. Vérifiez un export sur une copie de chaque template réel avant utilisation. Les validations Excel sont conservées, mais toutes leurs règles ne sont pas évaluées par le contrôle du prototype.
- Aperçu limité à 200 produits ; sélectionner les résultats inclut tous les produits filtrés. Aucune édition ou invention de données produits dans l’application : corrigez le catalogue et réimportez-le.
- Pas d’authentification, ni de partage multi-utilisateur : usage local seulement. Les exports sont à vérifier avant import marketplace.

## Tester

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

Les tests existants couvrent le moteur Excel et le parcours HTTP, notamment les contrôles, les exports, la préservation des feuilles/styles/validations, les profils et le refus d’exports invalides. Sous Linux, remplacez le chemin Python par `.venv/bin/python`.

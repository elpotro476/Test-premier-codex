SEMIN Marketplace — Guide Windows 11
===================================

RÉCUPÉRER LA VERSION AUTONOME

1. Connectez-vous à GitHub avec le compte ayant accès au dépôt :
   https://github.com/elpotro476/Test-premier-codex
2. Ouvrez l’onglet Actions, puis « Application Windows ».
3. Ouvrez la dernière exécution réussie (coche verte) correspondant à cette version.
4. En bas de la page, dans Artifacts, téléchargez « SEMIN-Marketplace-Windows-11 ».
   Si la compilation est en cours, attendez. Si elle est rouge, aucun package utilisable n’est publié.
5. Faites un clic droit sur l’archive téléchargée, puis « Extraire tout ».
6. Dans les fichiers extraits, vous trouverez SEMIN-Marketplace-Windows-11.zip.
   Faites à nouveau « Extraire tout » sur ce ZIP. Cette deuxième archive est le package de l’application.
7. Gardez le dossier SEMIN-Marketplace entier, avec son sous-dossier _internal.
   Ne copiez pas seulement le fichier .exe et ne le lancez pas depuis le ZIP.

Le bouton Code > Download ZIP fournit le code source, pas l’application autonome.
Les artefacts restent téléchargeables pendant 90 jours. Pour les recréer : dans Actions,
ouvrez « Application Windows », cliquez Run workflow, sélectionnez main et lancez.
Cette opération nécessite des droits suffisants sur le dépôt et GitHub Actions activé.

LANCER L’APPLICATION

Double-cliquez sur SEMIN-Marketplace.exe.
Aucune installation de Python, aucun terminal et aucun droit administrateur ne sont nécessaires
au fonctionnement de l’application. Le programme contient Python et ses dépendances.

Une petite fenêtre française SEMIN apparaît et ouvre votre navigateur habituel (Edge, Chrome...).
Gardez cette fenêtre ouverte : elle fait fonctionner l’application locale.
Si vous fermez seulement l’onglet du navigateur, cliquez « Ouvrir l’application » dans la fenêtre SEMIN.
Pour arrêter, cliquez « Fermer l’application » et confirmez.

Sur un ordinateur professionnel, votre politique informatique peut bloquer un exécutable
non signé. Ce package n’est pas signé avec un certificat d’entreprise. Si Windows ou votre
organisation le bloque, demandez à votre service informatique de le valider ; ne désactivez
pas les protections du poste. La compilation ne garantit pas l’autorisation de votre entreprise.

PREMIER ESSAI

1. Cliquez « Charger la démonstration » : trois produits fictifs sont chargés.
2. Trois erreurs sont détectées pour DEMO-003. L’export est bloqué.
3. Désélectionnez DEMO-003, puis cliquez « Contrôler les données ».
4. Exportez les deux produits valides. Le fichier est enregistré via votre navigateur,
   normalement dans Téléchargements.

UTILISER VOS PROPRES FICHIERS

1. Glissez votre catalogue Excel .xlsx et le template vierge .xlsx dans les zones d’import.
2. Choisissez la feuille de chaque fichier et la ligne contenant les en-têtes.
3. Choisissez la première ligne de données vierge du template, puis analysez les fichiers.
4. Recherchez vos SKU ou EAN et cochez les produits à exporter.
5. Vérifiez les correspondances proposées. Choisissez les bonnes colonnes dans les listes.
6. Vérifiez les cases des champs obligatoires d’après la documentation de votre marketplace.
7. Saisissez le nom de la marketplace et cliquez « Enregistrer les correspondances ».
8. Cliquez « Contrôler les données ». Corrigez les erreurs dans le catalogue source et réimportez-le.
9. Exportez et vérifiez le résultat dans Excel avant l’import marketplace.

CONFIDENTIALITÉ ET SAUVEGARDE

Le programme n’utilise aucune API externe, aucun service de télémétrie ni aucune ressource web distante.
Le navigateur communique uniquement avec 127.0.0.1, qui désigne votre propre ordinateur.
Le programme écoute exclusivement cette adresse, sur un port local choisi automatiquement.
Aucun fichier Excel et aucune donnée produit ne sont transmis à un serveur externe par l’application.
Les uploads restent en mémoire ; ils disparaissent à l’arrêt et doivent être réimportés.
Les fichiers exportés restent dans le dossier de téléchargement choisi dans votre navigateur.
Les extensions du navigateur et les logiciels de votre entreprise ne sont pas contrôlés par l’application.

Les correspondances sont conservées entre les utilisations dans :
%LOCALAPPDATA%\SEMIN-Marketplace\mappings.json

Pour ouvrir ce dossier : appuyez sur Windows + R, collez
%LOCALAPPDATA%\SEMIN-Marketplace
puis validez. Vous pouvez sauvegarder le fichier mappings.json.
Il contient les noms de colonnes et règles de correspondance, pas les données des produits.
Une nouvelle version de l’application conserve ce fichier si elle est lancée avec le même compte Windows.
Pour réutiliser un profil, choisissez-le dans « Correspondance enregistrée » après l’analyse.
Les noms et positions des colonnes doivent correspondre aux fichiers du profil.

LIMITES À CONNAÎTRE

Fichiers .xlsx uniquement : 15 Mo maximum, 50 000 lignes et 250 colonnes par feuille.
Les .xls, .xlsm, macros et classeurs chiffrés ne sont pas pris en charge.
Le programme ne complète jamais les informations manquantes avec des données inventées.
Les règles propres à chaque marketplace doivent être vérifiées par vous.
Les feuilles, formats et validations Excel standard sont conservés, mais les objets Excel avancés
ne sont pas tous garantis. Testez chaque template réel sur une copie avant utilisation.
Les cellules déjà remplies ou fusionnées dans la zone de destination ne sont pas écrasées.
La liste complète des règles et limites est dans le README du dépôt.

VÉRIFICATION DE LA COMPILATION

Le workflow crée un .exe Windows sur un runner Windows 64 bits, puis lance réellement ce binaire
avec Python retiré du PATH. Il vérifie l’interface Tkinter, les ressources embarquées,
les imports, les contrôles, le blocage d’un export invalide et l’export Excel.
Deux lancements du .exe vérifient la persistance des correspondances.
Les rapports windows-test-1.json et windows-test-2.json sont joints à l’artefact.
SHA256.txt contient l’empreinte du ZIP de l’application.
La disponibilité d’un workflow dans le dépôt ne signifie pas qu’un .exe a déjà été produit.

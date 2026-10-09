# V3.1 — connecter et vérifier un environnement Supabase

Ce lot n'a créé aucun projet cloud ni abonnement. Il contient une interface séparée, des migrations et des tests fictifs. V2 reste sur son URL actuelle. **Ne pas appliquer le fichier `tests/auth-fixture.sql` sur Supabase** : il ne sert qu'à simuler Auth sur PostgreSQL local.

## 1. Préparer un projet de développement (action du propriétaire / DSI)

1. Examiner [l'architecture](ARCHITECTURE.md), région, DPA, quotas et [coûts actuels](https://supabase.com/pricing). Choisir le plan sans engagement non autorisé. Ce guide ne demande pas de carte bancaire.
2. Dans Supabase, créer un projet **développement** avec un nom sans information commerciale, dans la région approuvée. Conserver le mot de passe PostgreSQL dans le coffre DSI ; ne pas le mettre dans GitHub ou transmettre en conversation.
3. Dans Authentication → Providers / Email, désactiver les nouvelles inscriptions publiques. V3.1 ne propose pas d'inscription.
4. Dans Authentication → Users, créer deux ou trois comptes de test avec email/mot de passe, dont un administrateur. Utiliser uniquement des comptes autorisés et des produits fictifs. Ce prototype ne propose pas encore de parcours d'acceptation d'invitation ni de récupération de mot de passe ; l'administrateur doit fournir un compte déjà activé. Avant production, ajouter et tester ces parcours et MFA selon la DSI. Ne jamais enregistrer les mots de passe dans le dépôt.
5. Paramètres Auth : limiter les URLs de site et redirection au site prévu, valider durée des sessions et politique de mots de passe. Pour une future invitation/récupération professionnelle, configurer SMTP entreprise ; l'envoi réel de messages ne fait pas partie de ce travail.

## 2. Appliquer le schéma

Depuis SQL Editor, sur le **projet de développement neuf**, exécuter une fois chaque fichier dans cet ordre :

1. `supabase/migrations/001_catalogue.sql`.
2. `supabase/migrations/002_commands.sql`.

Les migrations sont transactionnelles mais ne sont pas réexécutables sans suivi ; consigner nom/date/résultat de chacune. Elles ne contiennent aucun produit ni utilisateur réel. Pour les évolutions, appliquer seulement les nouvelles migrations, sans DROP ni réinitialisation du projet.

Créer ensuite l'espace et sa première personne administratrice, exclusivement dans SQL Editor avec les droits administratifs. Remplacer les UUID de l'exemple par ceux choisis et par l'UUID **réel du compte de test** présent dans Authentication → Users :

```sql
begin;
insert into public.organizations(id,name)
values ('10000000-0000-4000-8000-000000000001','Espace de test fictif');
insert into public.memberships(organization_id,user_id,role)
values ('10000000-0000-4000-8000-000000000001',
        'REMPLACER_PAR_UUID_COMPTE_AUTH','admin');
commit;
```

L'instruction échoue volontairement si le compte Auth n'existe pas. Les rôles ne doivent pas être ajoutés dans les métadonnées utilisateur. L'interface Utilisateurs permet ensuite d'attribuer reader/editor/admin à d'autres UUID Auth. Il n'y a pas d'API anonyme de création d'espace, de suppression d'utilisateur ou de suppression physique de produit.

Des familles de test peuvent être créées en SQL d'administration ; l'écran V3.1 permet d'associer une famille mais pas encore de modifier leur dictionnaire. Les sous-familles sont des lignes `families` avec `parent_id` du même espace.

## 3. Configurer uniquement les informations publiques

Copier l'URL HTTPS du projet et la clé **publishable** dans Settings → API / API Keys (l'ancienne clé `anon` est aussi acceptée). Jamais de `service_role`, `sb_secret_…`, mot de passe PostgreSQL ou clé JWT privée.

Sur le poste de développement, créer `.local/v3-config.json` (dossier ignoré par Git) :

```json
{
  "url": "https://REMPLACER-PAR-REFERENCE-PROJET.supabase.co",
  "publicKey": "REMPLACER-PAR-CLE-PUBLIQUE"
}
```

Construire avec Node, **sur le poste de développement uniquement** :

```sh
node v3/build.mjs .local/v3-config.json
```

Le build refuse les clés privilégiées et limite la CSP à ce projet. Le résultat est `v3/dist/index.html`, ignoré par Git ; aucune publication automatique. Node n'est pas nécessaire aux utilisateurs finaux. Une modification d'URL nécessite un nouveau build.

Sans argument (`node v3/build.mjs`), seul le mode fictif fonctionne, avec `connect-src 'none'`. Le HTML peut être ouvert dans Chrome si sa politique autorise les fichiers locaux. Pour les tests internes du développeur, utiliser un serveur statique ; pour Lenovo, prévoir une URL HTTPS **après validation distincte**, sans remplacer V2. Certains postes refusent les HTML locaux.

Une configuration production doit utiliser un autre projet Supabase et un autre build. Ne pas réutiliser un espace dans le même projet pour faire passer développement et production pour deux environnements isolés. Ne jamais utiliser une clé administratrice pour résoudre un refus RLS.

## 4. Recette manuelle obligatoire avant données réelles

Avec des comptes et données fictifs :

- Hors connexion Auth : aucune fiche centrale accessible ; clé publique seule : lectures et RPC refusées.
- Administrateur : attribuer éditeur/lecteur ; impossible de rétrograder le dernier administrateur.
- Éditeur : créer une fiche, EAN vide autorisé ; EAN invalide/doublon SKU/EAN refusé ; dates/révisions actualisées et audit présent.
- Lecteur : consulter uniquement, aucun enregistrement/archivage/gestion des rôles, même en appelant directement l'API.
- Second espace avec autre utilisateur : aucune donnée du premier espace lisible/modifiable.
- Deux appareils : ouvrir la même fiche, modifier sur l'un ; modification depuis l'autre refusée jusqu'à actualisation. Vérifier également la révocation de rôle pendant une session.
- Archiver/restaurer : confirmation requise, données/identifiants conservés ; parent et variantes archivés/restaurés dans le bon ordre.
- Déconnexion / expiration : catalogue et jetons effacés de l'interface. Recharger nécessite une connexion. Vérifier les logs Auth et les erreurs RPC sans publier de captures contenant des secrets.
- Réseau : uniquement l'hôte Supabase configuré, aucune télémétrie ni chargement d'images distantes. La V3 transmet les fiches au serveur, ce que V2 ne fait pas.
- Windows et Lenovo Chrome : ergonomie réelle, interruptions réseau, changement d'espace et session, fermeture/réouverture. Tester la V2 séparément ; son stockage local reste intact.

Les tests SQL locaux simulent `auth.uid()` et les rôles PostgreSQL ; les tests navigateur interceptent des réponses HTTP fictives. Ils ne prouvent pas la configuration d'un projet hébergé, l'émission des JWT, les emails, MFA ni la restauration d'un backup cloud. Valider cette recette sur Supabase développement avant toute publication V3 ou donnée professionnelle.

## 5. Sauvegardes et restauration

- V2 : conserver une sauvegarde JSON avant toute future migration. Ce lot ne l'importe pas et ne supprime rien.
- PostgreSQL : vérifier les sauvegardes disponibles selon le plan Supabase, leur rétention, les coûts et l'option PITR. Les fichiers stockés dans un futur bucket et les comptes Auth ne doivent pas être présumés couverts de la même façon.
- Prévoir un export régulier approuvé par la DSI (`supabase db dump` ou `pg_dump` avec une connexion et un coffre sécurisés), couvrant tables SEMIN, politiques, fonctions, droits et historique ; les comptes Auth sont liés par UUID et nécessitent une stratégie cohérente de restauration. Aucun secret en ligne de commande enregistrée ou dans GitHub.
- Chiffrer les sauvegardes, contrôler les accès, les stocker hors du dépôt et documenter fréquence/rétention/RPO/RTO. Ne pas sauvegarder de données professionnelles dans des artefacts Actions publics.
- Faire un exercice de restauration dans un **projet distinct** : comptes/UUID, appartenances, RLS, droits, produits, révisions et audit. Comparer les comptes et tester la recette avant bascule. Aucun mécanisme automatisé de sauvegarde n'est prétendu livré dans V3.1.
- Retour arrière : la V2 et ses JSON restent disponibles. Ne pas tenter de détruire/réinitialiser la base centrale pour revenir à V2 ; restaurer une sauvegarde centrale seulement après validation administrative.

## 6. Ce qui reste après préparation

Créer/configurer le projet développement, appliquer les migrations, connecter les comptes, réaliser la recette Auth/REST réelle, valider la sécurité DSI et les sauvegardes. Puis décider d'un hébergement V3 séparé. V3.2 ajoutera imports Excel/JSON V2 et attributs ; V3.3 ajoutera contenus/mappings/templates/exports marketplace. Aucun de ces lots n'est activé par cette procédure.

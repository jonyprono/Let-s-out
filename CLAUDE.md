# Let's Out — Guide du Projet & Contexte Technique

Bienvenue sur le projet **Let's Out**, une application mobile-first et web pour la découverte d'événements, les sorties entre membres ("Outsters"), les discussions de groupe et privées, et la rencontre à proximité via OUT RADAR.

---

## 1. Architecture & Stack Technique

Monorepo géré avec **pnpm** :
- **Frontend (`apps/web`)** :
  - React 18, Vite, TypeScript
  - Tailwind CSS, Lucide React (icônes), Sonner (toasts)
  - TanStack React Query v5, React Router v6/v7
  - Capacitor pour les applications mobiles Android & iOS
- **Backend (`apps/api`)** :
  - Node.js, Fastify, TypeScript
  - Prisma ORM avec base de données PostgreSQL
  - Authentification JWT, WebSockets en temps réel pour le chat et les notifications
  - Notifications Push via Firebase Cloud Messaging (FCM) & Capacitor Push

---

## 2. Commandes Essentielles de Validation

Toujours exécuter et valider ces commandes après chaque modification :
- **Vérification TypeScript Backend :**
  ```bash
  pnpm --filter @letsout/api typecheck
  ```
- **Vérification TypeScript Frontend :**
  ```bash
  pnpm --filter @letsout/web typecheck
  ```
- **Migrations Prisma :**
  ```bash
  pnpm --filter @letsout/api prisma migrate deploy
  ```

---

## 3. Travaux Récemment Effectués & État Actuel

### A. OUT RADAR (Rencontres et visibilité à proximité)
- **Visibilité géolocalisée :** Durées configurables (30, 60, 180 minutes) avec expiration automatique stricte côté serveur et purge des coordonnées GPS.
- **Rayons de recherche :** 1 km, 5 km et 10 km (avec calcul Haversine et tiers de proximité sans jamais exposer les coordonnées brutes).
- **Protection & Sécurité :** Vérification de l'âge (18+ ans requis), anti-triangulation (délai de 10s entre les scans), gestion des blocages mutuels.
- **Invitations & Discussions :**
  - Invitations radar avec statuts `PENDING`, `ACCEPTED`, `DECLINED`.
  - **Correction majeure appliquée :** À chaque acceptation d'invitation radar, le backend crée une **toute nouvelle conversation dédiée** (`isRadar: true`) au lieu de recycler une ancienne conversation DM entre les deux utilisateurs.
  - Le frontend navigue vers `/chat/:conversationId`, masquant automatiquement la barre de navigation inférieure (`BottomNav`) pour donner accès à la saisie de message complète, aux photos et à l'audio.

### B. Système de Sondages dans le Chat (Polls)
- **Modèles Prisma déployés :** `Poll`, `PollOption`, `PollVote`.
- **Règles :** Création jusqu'à 15 options ou plus, choix unique par utilisateur (un vote remplace le précédent), mise à jour en temps réel via WebSocket (`poll_voted`).
- **Composants :** `CreatePollModal.tsx` et `PollCard.tsx`.

### C. Badge de Certification Personnalisé
- Composant `VerifiedBadge.tsx` aux couleurs de l'application (orange `#FF7A00` avec coche blanche) utilisé sur tous les profils et listes de membres.

### D. Gestion des Événements & Groupes
- Modale de confirmation avant de quitter un groupe (`GroupChatInfoSheet.tsx`).
- Restriction de partage pour les événements publics nécessitant approbation de l'organisateur : seuls les membres ayant rejoint ou l'organisateur peuvent partager le code d'accès.

### E. Notifications Push Android
- Icône de notification monochrome `ic_stat_notification.png` générée pour toutes les résolutions (`drawable`, `mdpi`, `hdpi`, `xhdpi`, `xxhdpi`, `xxxhdpi`) avec couleur d'accentuation `#FF7A00`.

---

## 4. Règles de Développement & Bonnes Pratiques
- **Zéro régression :** Ne jamais casser les flux existants (authentification, paiement, événements, chat normal).
- **Style UI :** Respecter scrupuleusement la charte Tailwind existante, le thème sombre/clair, et les composants UI sans ajouter de bibliothèques superflues.
- Toujours valider avec `pnpm --filter @letsout/web typecheck` et `pnpm --filter @letsout/api typecheck`.


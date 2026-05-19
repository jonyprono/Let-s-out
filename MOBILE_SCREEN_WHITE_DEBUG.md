# 🔍 Diagnostic Écran Blanc - Network Access Troubleshooting

## Problème
Écran blanc quand on accède à l'app depuis un téléphone sur le réseau local.

## 🔧 Corrections appliquées

### 1. Vite Server Configuration
**File**: `apps/web/vite.config.ts`
- ✅ Configuré pour écouter sur `0.0.0.0` (toutes les interfaces réseau)
- ✅ Ajouté support CORS
- ✅ Optimisation des chunks pour chargement rapide
- ✅ Désactivé `strictPort` pour éviter les conflits

### 2. HTML Loading State
**File**: `apps/web/index.html`
- ✅ Ajouté indicateur de chargement visible
- ✅ Ajoute gestion des erreurs globales
- ✅ Affiche les messages d'erreur pour debugging

## 🚀 Comment tester

### Étape 1: Redémarrer le serveur Vite
```bash
# Tuer les serveurs existants
# Depuis la racine du projet:
pnpm dev

# Le serveur Vite devrait maintenant afficher:
# ➜  Local:   http://localhost:3000
# ➜  Network: http://192.168.1.138:3000
```

**Important**: L'URL réseau doit être affichée. Si elle ne l'est pas, il y a un problème de configuration.

### Étape 2: Accéder depuis le téléphone
1. Ouvrez le navigateur du téléphone
2. Tapez: `http://192.168.1.138:3000`
3. Attendez le chargement (spinner visible)

### Étape 3: Déboguer les erreurs

Si vous voyez un écran blanc ou une erreur, ouvrez la console du navigateur:

#### Sur Chrome Mobile / Android
1. Connectez votre téléphone Android à votre PC avec USB
2. Ouvrez Chrome → `chrome://inspect`
3. Cochez "Discover USB devices"
4. Cliquez "inspect" sur votre app
5. Ouvrez la Console pour voir les erreurs

#### Sur Safari Mobile / iOS
1. Sur Mac, connectez l'iPhone via USB
2. Ouvrez Safari → Préférences → Onglet Avancé
3. Cochez "Show Develop menu in menu bar"
4. Allez à Develop → [Votre iPhone] → Inspectez l'app
5. Ouvrez la Console pour voir les erreurs

### Étape 4: Erreurs courantes

#### Erreur: "Cannot GET /"
- Le serveur Vite n'est pas accessible depuis le réseau
- Vérifiez: `ping 192.168.1.138`
- Vérifiez le firewall Windows

#### Erreur: "Mixed Content" (HTTPS/HTTP)
- Cause: Mélange de HTTP et HTTPS
- Solution: Utilisez HTTP partout en développement

#### Erreur: "CORS policy"
- Le serveur API bloque les requêtes du réseau
- Vérifiez: `apps/api/src/plugins/cors.ts`
- Doit accepter `192.168.1.138:3000`

#### Erreur: "Cannot find module" ou "Cannot read property"
- Problème de bundling ou de chemins
- Ouvrez la Console pour voir le détail exact
- Possible: Chemins d'imports invalides

## 📋 Checklist de diagnostic

- [ ] `pnpm dev` affiche "Network: http://192.168.1.X:3000"
- [ ] Le téléphone peut pinger la machine (command: `ping 192.168.1.138`)
- [ ] Firewall Windows permet port 3000
- [ ] `.env.local` configure correctement l'API
- [ ] Pas d'erreurs dans la console du navigateur mobile
- [ ] API est accessible depuis le téléphone (test: `curl http://192.168.1.138:3001/health`)

## 🔐 Vérifier Firewall Windows

### Permettre Vite sur le Firewall

**Windows Defender Firewall:**
1. Allez à: Windows Defender Firewall → Paramètres avancés
2. Cliquez: Nouvelles règles entrantes
3. Sélectionnez: Programme → Suivant
4. Parcourez: node.exe ou `C:\Program Files\nodejs\node.exe`
5. Acceptez les connexions privées
6. Nommez: "Vite Dev Server"
7. Validez

**Ou via PowerShell (Admin):**
```powershell
New-NetFirewallRule -DisplayName "Vite Dev Port 3000" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
```

## 🌐 Vérifier Accès Réseau

Depuis votre PC (PowerShell):
```powershell
# Vérifier que le port 3000 est en écoute
netstat -ano | findstr :3000

# Vérifier l'adresse IP locale
ipconfig

# Tester l'accès depuis PowerShell
Invoke-WebRequest http://192.168.1.138:3000
```

Depuis le téléphone (terminal si disponible):
```bash
# Vérifier la connectivité réseau
ping 192.168.1.138

# Tester l'accès à Vite
curl http://192.168.1.138:3000

# Tester l'accès à l'API
curl http://192.168.1.138:3001/health
```

## 📱 Configuration Mobile Spécifique

### Android (Emulator)
- Emulator: Utilisez `10.0.2.2` au lieu de `127.0.0.1`
- Device réel: Utilisez l'IP locale
- Firewall: Autorisez port 3000/3001

### iOS (Emulator)
- Simulator: Utilisez `localhost` ou `127.0.0.1`
- Device réel: Utilisez l'IP locale
- Certificats: En dev, acceptez les certificats non valides

## 📊 Exemple de Network Tab

Ouvrez DevTools → Network tab et cherchez:
- `GET /` → Status 200 ✅
- `GET /src/main.tsx` → Status 200 ✅
- `GET /src/app/App.tsx` → Status 200 ✅
- `GET /@vite/client` → Status 200 ✅

Si vous voyez 404 ou erreurs réseau, le serveur ne serve pas les fichiers correctement.

## 🆘 Si ça marche toujours pas

1. **Collectez les logs:**
   - Ouvrez console DevTools du téléphone
   - Copiez TOUS les messages d'erreur
   - Attachez à votre rapport

2. **Vérifiez la connexion réseau:**
   - Assurez-vous d'être sur le même WiFi
   - Pas de VPN activé
   - IP locale identique (192.168.1.x)

3. **Redémarrez services:**
   ```bash
   # Arrêtez turbo/pnpm
   # Kills all Node processes
   taskkill /F /IM node.exe
   
   # Relancez
   pnpm dev
   ```

4. **Vérifiez la config Vite:**
   - `vite.config.ts` doit avoir `host: '0.0.0.0'`
   - `server: { cors: true }`
   - Pas de `hostname` restrictif

## 📝 Exemple de messages corrects

Quand `pnpm dev` fonctionne correctement, vous devriez voir:

```
➜  Local:   http://localhost:3000/
➜  Network: http://192.168.1.138:3000/

➜  press h + enter to show help
```

**Si vous ne voyez pas "Network", c'est le problème principal.**

---

**Prochaines étapes:**
1. Vérifiez que le serveur affiche bien l'URL réseau
2. Accédez depuis le téléphone
3. Ouvrez la console du téléphone si écran blanc
4. Partagez les erreurs exactes pour debug


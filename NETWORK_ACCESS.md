# 🌐 Local Network Access Guide

This guide explains how to access your Letsout application from other devices connected to the same network.

## Prerequisites

- Your machine (server) is connected to a network
- Other devices are on the **same network** (same WiFi or Ethernet)
- Ports 3000 (frontend) and 3001 (API) are not blocked by your firewall

## Quick Setup

### Option 1: Automatic (Recommended)

Run the setup script to automatically detect your machine's IP address and configure the environment:

```bash
pnpm setup-network
```

This will:
- Detect your local IP address
- Update `.env.local` for the web app
- Display your machine's IP for easy sharing

### Option 2: Manual Configuration

#### 1. Find Your Machine's Local IP Address

**Windows:**
```powershell
ipconfig
# Look for "IPv4 Address" under "Ethernet adapter" or "Wireless LAN adapter"
# Example: 192.168.1.100
```

**Mac/Linux:**
```bash
ifconfig
# or
ip addr show
# Look for "inet" address (not 127.0.0.1)
# Example: 192.168.1.100
```

#### 2. Update `.env.local` in the web app

Create or edit `apps/web/.env.local`:

```env
VITE_API_URL=http://YOUR_IP:3001/api/v1
VITE_WS_URL=ws://YOUR_IP:3001
VITE_STRIPE_PUBLIC_KEY=
```

Replace `YOUR_IP` with your actual local IP address.

Example:
```env
VITE_API_URL=http://192.168.1.100:3001/api/v1
VITE_WS_URL=ws://192.168.1.100:3001
```

## Starting the Application

```bash
# From the root directory
pnpm dev
```

The application will start on:
- Frontend: `http://localhost:3000` (local machine)
- API: `http://localhost:3001` (local machine)

## Accessing from Other Devices

Once configured, you can access the application from other devices:

### Web Browsers (Desktop/Mobile)

- **Other machines on the network:** `http://YOUR_IP:3000`
  - Example: `http://192.168.1.100:3000`

- **Mobile devices on the same network:** Open your browser and navigate to `http://YOUR_IP:3000`
  - This works on both iOS Safari and Android browsers

### Capacitor Mobile Apps (iOS/Android)

If you're building native mobile apps with Capacitor:

1. During development, ensure the Capacitor configuration uses your local IP
2. The app will automatically connect to the API at the configured endpoint
3. After running `pnpm setup-network`, rebuild the Capacitor apps:

```bash
# For Android
pnpm --filter web exec capacitor sync android
pnpm --filter web exec capacitor open android

# For iOS
pnpm --filter web exec capacitor sync ios
pnpm --filter web exec capacitor open ios
```

## Troubleshooting

### "Connection Refused" Error

1. **Verify the IP address** is correct:
   ```bash
   ping YOUR_IP
   ```

2. **Check firewall settings:**
   - Windows: Ensure ports 3000 and 3001 are allowed through Windows Firewall
   - Mac: System Settings → Network → Firewall
   - Linux: Check `sudo ufw status`

3. **Verify the app is running:**
   ```bash
   # From the root directory
   pnpm dev
   ```

4. **Verify the .env.local is being used:**
   - Check that `apps/web/.env.local` exists
   - Look for the IP in the browser console or check the Network tab in DevTools
   - The URL should show your IP, not localhost

### "Can't connect from other devices"

1. Ensure all devices are on the **same network** (same WiFi network)
   - Check WiFi SSID matches
   - Verify all devices can ping each other
2. Check if your network has port restrictions (some corporate/guest networks do)
3. Verify that your machine's firewall allows incoming connections on ports 3000 and 3001
4. Try disabling VPN if you have one enabled

### WebSocket Connection Issues

If real-time features (chat, notifications) don't work:

1. Ensure `VITE_WS_URL` in `.env.local` uses `ws://` (not `http://`)
   - WebSocket requires `ws://` protocol, not `http://`
   - Secure connections would use `wss://` (WebSocket Secure)

2. Check that your network allows WebSocket connections
   - Some networks/firewalls block WebSocket
   - Try testing on a different network

3. Verify the server is running:
   ```bash
   pnpm dev
   ```

4. Check browser console for WebSocket errors:
   - Open DevTools → Network → WS (WebSocket filter)
   - Look for connection attempts and errors

### Mobile App Issues

**iOS Capacitor App:**
- Ensure your Mac and iPhone are on the same WiFi
- Check that cleartext traffic is allowed (already configured in capacitor.config.ts)
- Try rebuilding the app: `pnpm --filter web exec capacitor sync ios`

**Android Capacitor App:**
- Ensure your development machine and Android device are on the same WiFi
- Check Network Security Configuration in Android
- Try rebuilding the app: `pnpm --filter web exec capacitor sync android`

**App shows "Cannot reach server":**
1. Run `pnpm setup-network` again
2. Rebuild and redeploy the Capacitor app
3. Check that the .env.local has the correct IP

## Network Configuration Reference

### What Gets Configured

When you run `pnpm setup-network`, the following happens:

1. **Your local IP is detected** (e.g., `192.168.1.100`)
2. **`apps/web/.env.local` is created** with:
   - `VITE_API_URL=http://YOUR_IP:3001/api/v1`
   - `VITE_WS_URL=ws://YOUR_IP:3001`
3. **Frontend uses this IP** to connect to the backend
4. **API automatically allows** connections from:
   - localhost
   - 127.0.0.1
   - Any private IP address (10.x.x.x, 172.16-31.x.x, 192.168.x.x)

### Environment Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `VITE_API_URL` | Backend API endpoint (REST) | `http://192.168.1.100:3001/api/v1` |
| `VITE_WS_URL` | WebSocket endpoint (real-time) | `ws://192.168.1.100:3001` |
| `VITE_STRIPE_PUBLIC_KEY` | Stripe public key (if using payments) | `pk_test_...` |

## Security Notes

⚠️ **Warning:** When accessible from the network, ensure:

- You're on a **trusted network only** (home/office WiFi)
- The application is for **development use only**
- Consider using a VPN if accessing from outside your home network
- Disable network access (remove .env.local) when not needed
- Never expose production databases to the network

## Advanced: Static IP Configuration

If you want to use a static IP that doesn't change:

1. **Set a static IP on your machine** (varies by OS)
2. **Update `.env.local` manually** with the static IP
3. **Share the IP with your team** for easy access

## Support & Questions

- Check the main README.md for project structure
- Review `.env.local` to see the configured IP
- Run `pnpm setup-network` again if the IP changes

---

**Happy testing! 🚀**


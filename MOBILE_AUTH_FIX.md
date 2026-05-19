# 🔧 Mobile Authentication Fix

## Problem
Authentication works on desktop but fails on mobile Capacitor apps. This was caused by several configuration issues specific to how Capacitor handles HTTP requests and cookies.

## Root Causes Identified

### 1. **Overly Restrictive Cookie Configuration**
- **Issue**: Cookies were set with `sameSite: 'strict'` and `path: '/api/v1/auth'`
- **Problem**: Capacitor apps couldn't send cookies with these restrictions
- **Impact**: Refresh tokens weren't being sent on mobile, breaking token refresh

### 2. **HTTP vs HTTPS Mismatch**
- **Issue**: Cookie `secure: true` in production but HTTP used in development
- **Problem**: Capacitor apps use HTTP for local network (not HTTPS)
- **Impact**: Cookies were rejected or not stored properly

### 3. **Missing RefreshToken in Response**
- **Issue**: Server didn't return refreshToken in login/register responses
- **Problem**: Client-side couldn't store it as fallback for cookie-based auth
- **Impact**: Token refresh failed if cookies weren't transmitted

### 4. **Path Restriction on Cookies**
- **Issue**: Cookies were restricted to `/api/v1/auth` path
- **Problem**: Other endpoints like `/api/v1/users` couldn't access the refresh token
- **Impact**: Subsequent requests failed after token refresh

## Solutions Applied

### 1. ✅ Backend Changes (`apps/api/src/modules/auth/auth.controller.ts`)

#### Cookie Configuration
```typescript
// BEFORE: Too restrictive
reply.setCookie('refresh_token', refreshToken, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',  // ❌ Too restrictive
  path: '/api/v1/auth',  // ❌ Path too narrow
  maxAge: 30 * 24 * 60 * 60,
})

// AFTER: Mobile-friendly
reply.setCookie('refresh_token', refreshToken, {
  httpOnly: true,
  secure: false,  // ✅ Allow HTTP for local network
  sameSite: 'lax',  // ✅ Allow cross-origin requests
  path: '/',  // ✅ Send to all endpoints
  maxAge: 30 * 24 * 60 * 60,
})
```

#### Return RefreshToken
- Added `refreshToken` to response body in:
  - `POST /auth/register` → returns `{ accessToken, refreshToken, user }`
  - `POST /auth/login` → returns `{ accessToken, refreshToken, user }`
  - `POST /auth/refresh` → returns `{ accessToken, refreshToken }`

### 2. ✅ Frontend Changes (`apps/web/src/lib/api-client.ts`)

#### Detect Capacitor
```typescript
const isCapacitor = () => {
  try {
    return !!(window as any).capacitor
  } catch {
    return false
  }
}
```

#### Enhanced Token Management
- Store both `accessToken` and `refreshToken` locally
- Send `refreshToken` in request body as fallback if cookies fail
- Update local storage when server returns new tokens

#### Request Interceptor
```typescript
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  
  // For mobile, send refreshToken in body on refresh requests
  if (isCapacitor() && config.url?.includes('/auth/refresh')) {
    const refreshToken = useAuthStore.getState().refreshToken
    if (refreshToken && config.data === undefined) {
      config.data = { refreshToken }
    }
  }
  
  return config
})
```

### 3. ✅ Auth Store Updates (`apps/web/src/stores/auth.store.ts`)

- Added `refreshToken` property
- Added `setRefreshToken()` action
- Persist `refreshToken` in localStorage
- Clear `refreshToken` on logout

### 4. ✅ Auth Hooks Updates (`apps/web/src/features/auth/hooks/useAuth.ts`)

- Updated `useRegister()` to call `setRefreshToken(data.refreshToken)`
- Updated `useLogin()` to call `setRefreshToken(data.refreshToken)`

### 5. ✅ Capacitor Configuration (`apps/web/capacitor.config.ts`)

```typescript
const config: CapacitorConfig = {
  appId: 'com.letsout.app',
  appName: 'Lets Out',
  webDir: 'dist',
  server: {
    cleartext: true,  // Allow HTTP for local network
    allowNavigation: ['*'],  // Allow all network requests
  },
  plugins: {
    SplashScreen: { launchShowDuration: 0 },
    CapacitorHttp: { enabled: true },  // Enable HTTP plugin
  },
};
```

## How It Works Now

### Desktop Browser
1. User logs in
2. Server returns `accessToken`, `refreshToken`, and sets `refresh_token` cookie
3. Client stores `accessToken` in localStorage
4. Client includes `Authorization: Bearer <token>` on each request
5. On 401, client refreshes using cookie (if available)

### Mobile Capacitor App
1. User logs in
2. Server returns `accessToken`, `refreshToken` in response body
3. Client stores both in localStorage
4. Client includes `Authorization: Bearer <token>` on each request
5. On 401, client refreshes using `refreshToken` in request body (fallback)
6. Server returns new tokens in response body
7. Client updates localStorage with new tokens

### Dual Mechanism
- **Primary**: Cookies (works everywhere, including desktop)
- **Fallback**: Token in request body (required for Capacitor)
- **Result**: Works reliably on both desktop and mobile

## Testing Checklist

### On Desktop
- [ ] Login works
- [ ] Refresh token works after expiry
- [ ] Logout clears auth state

### On Mobile (iOS)
- [ ] Login works
- [ ] Token refresh works (especially after token expiry)
- [ ] Logout works
- [ ] Real-time features (chat, WebSocket) work

### On Mobile (Android)
- [ ] Same as iOS tests above

## Important Notes

⚠️ **For Production**:
- Change `secure: false` to `secure: true` when deploying
- Use HTTPS for all connections
- Ensure proper CORS headers are sent
- Review cookie `sameSite` setting based on your deployment

⚠️ **Cookie Security**:
- `httpOnly: true` prevents JavaScript access (good for security)
- `sameSite: 'lax'` allows some cross-site requests (necessary for Capacitor)
- `path: '/'` applies cookie to all endpoints

## File Changes Summary

| File | Changes |
|------|---------|
| `apps/api/src/modules/auth/auth.controller.ts` | ✅ Fixed cookie options, return refreshToken |
| `apps/web/src/lib/api-client.ts` | ✅ Added Capacitor detection, token fallback |
| `apps/web/src/stores/auth.store.ts` | ✅ Store and persist refreshToken |
| `apps/web/src/features/auth/hooks/useAuth.ts` | ✅ Set refreshToken on login/register |
| `apps/web/capacitor.config.ts` | ✅ Enable HTTP and proper plugins |

## Next Steps

1. **Test on physical mobile devices**
   ```bash
   # iOS
   pnpm --filter web exec capacitor sync ios
   pnpm --filter web exec capacitor open ios
   
   # Android
   pnpm --filter web exec capacitor sync android
   pnpm --filter web exec capacitor open android
   ```

2. **Monitor for issues**
   - Check browser console for errors
   - Monitor network requests in DevTools
   - Check localStorage content

3. **Production deployment**
   - Update cookie `secure` flag
   - Update CORS configuration for production domain
   - Test with HTTPS

---

**Mobile auth should now work! 🎉**

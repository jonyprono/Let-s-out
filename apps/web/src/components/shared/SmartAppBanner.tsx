import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function SmartAppBanner() {
  const [isVisible, setIsVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    // Hide if it's already the native app
    if (Capacitor.isNativePlatform()) {
      return;
    }

    // Check if dismissed previously in session
    if (sessionStorage.getItem('smart-banner-dismissed')) {
      return;
    }

    const ua = navigator.userAgent || navigator.vendor || (window as any).opera;
    const isMobileAndroid = /android/i.test(ua);
    const isMobileIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    
    // Check if we are inside a Webview (like Instagram or Facebook in-app browser)
    // If so, we still want to show the banner to encourage opening in the real app
    
    if (isMobileAndroid) setIsAndroid(true);
    if (isMobileIOS) setIsIOS(true);

    if (isMobileAndroid || isMobileIOS) {
      // Delay slightly so it doesn't jarringly appear on splash
      const timer = setTimeout(() => setIsVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  if (!isVisible) return null;

  const handleDismiss = () => {
    sessionStorage.setItem('smart-banner-dismissed', 'true');
    setIsVisible(false);
  };

  const handleDownload = () => {
    if (isAndroid) {
      window.location.href = 'https://play.google.com/store/apps/details?id=com.fihodecorp.letsout';
    } else if (isIOS) {
      window.location.href = 'https://apps.apple.com/app/idYOUR_APP_STORE_ID'; // TODO: Update with real App Store ID when available
    } else {
      window.location.href = 'https://letsout.app';
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-between p-3 bg-white dark:bg-[#1A1A1A] border-b border-gray-200 dark:border-white/10 shadow-md animate-in slide-in-from-top-full duration-300 lg:hidden">
      
      <div className="flex items-center gap-3">
        <button 
          onClick={handleDismiss}
          className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
        <img 
          src="/icons/icon-192.webp" 
          alt="Let's Out" 
          className="w-10 h-10 rounded-[10px] shadow-sm border border-gray-100 dark:border-white/10"
        />
        <div className="flex flex-col">
          <span className="text-[14px] font-bold text-gray-900 dark:text-white leading-tight">Let's Out</span>
          <span className="text-[11px] text-gray-500 dark:text-gray-400">Gratuit - {isIOS ? 'App Store' : 'Google Play'}</span>
        </div>
      </div>

      <Button 
        onClick={handleDownload}
        className="h-8 px-4 text-[13px] font-semibold rounded-full bg-[#FF7A00] text-white hover:bg-[#FF7A00]/90 shadow-sm"
      >
        Ouvrir
      </Button>

    </div>
  );
}

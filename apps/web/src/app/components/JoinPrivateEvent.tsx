import { useState, useEffect } from 'react';
import { ChevronLeft, QrCode, Loader2, Camera } from 'lucide-react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { Capacitor } from '@capacitor/core';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function JoinPrivateEvent() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [hasPermission, setHasPermission] = useState(true);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      checkPermissions();
    }
    
    return () => {
      if (isScanning) {
        stopScan();
      }
    };
  }, []);

  const checkPermissions = async () => {
    try {
      const { camera } = await BarcodeScanner.checkPermissions();
      if (camera === 'granted') {
        setHasPermission(true);
      } else if (camera === 'prompt') {
        const result = await BarcodeScanner.requestPermissions();
        setHasPermission(result.camera === 'granted');
      } else {
        setHasPermission(false);
      }
    } catch (e) {
      console.error(e);
      setHasPermission(false);
    }
  };

  const startScan = async () => {
    if (!Capacitor.isNativePlatform()) {
      toast.info('Le scanner de QR code est uniquement disponible sur l\'application mobile. Veuillez entrer le code manuellement.');
      return;
    }

    if (!hasPermission) {
      toast.error('Permission d\'utiliser la caméra refusée.');
      return;
    }

    try {
      document.body.classList.add('barcode-scanner-active');
      setIsScanning(true);
      
      await BarcodeScanner.addListener('barcodesScanned', async (result: any) => {
        if (result.barcodes && result.barcodes.length > 0) {
          const value = result.barcodes[0].displayValue || result.barcodes[0].rawValue;
          if (value) {
            await stopScan();
            setCode(value);
            handleJoin(value);
          }
        }
      });

      await BarcodeScanner.startScan();
    } catch (e) {
      toast.error('Erreur lors du démarrage du scanner');
      stopScan();
    }
  };

  const stopScan = async () => {
    document.body.classList.remove('barcode-scanner-active');
    setIsScanning(false);
    try {
      await BarcodeScanner.removeAllListeners();
      await BarcodeScanner.stopScan();
    } catch (e) {
      // ignore
    }
  };

  const handleJoin = async (submitCode: string = code) => {
    if (isLoading) return; // Prevent duplicate requests
    
    const finalCode = submitCode.trim();
    if (!finalCode) {
      toast.error('Veuillez entrer un code');
      return;
    }

    setIsLoading(true);
    try {
      const { data } = await apiClient.post(`/events/join-by-code/${finalCode}`, {});
      
      if (data.requiresPayment) {
        toast.info('Cet événement est payant.');
        navigate(`/events/${data.event.id}/pay`);
      } else if (data.alreadyJoined) {
        toast.success('Vous participez déjà à cet événement.');
        navigate(`/events/${data.event.id}`);
      } else {
        toast.success('Vous avez rejoint l\'événement privé ! 🎉');
        navigate(`/events/${data.event.id}`);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Code invalide ou erreur serveur');
    } finally {
      setIsLoading(false);
    }
  };

  if (isScanning) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col bg-transparent">
        <div className="absolute top-0 left-0 right-0 px-6 pt-safe-6 pb-6 flex justify-between items-center z-10" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)' }}>
          <button onClick={stopScan} className="w-10 h-10 bg-[#F5F5F5] dark:bg-[#2A2A2A] rounded-full flex items-center justify-center active:scale-95 transition-transform">
            <ChevronLeft className="w-6 h-6 text-gray-800 dark:text-gray-200" strokeWidth={2.5} />
          </button>
          <span className="text-white font-bold">Scanner le code QR</span>
          <div className="w-10" />
        </div>
        
        {/* Scanner overlay hole */}
        <div className="flex-1 border-[40px] border-black/50 relative">
          <div className="absolute inset-0 border-2 border-action-primary shadow-[0_0_0_4000px_rgba(0,0,0,0.5)]">
            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-action-primary -ml-[2px] -mt-[2px]" />
            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-action-primary -mr-[2px] -mt-[2px]" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-action-primary -ml-[2px] -mb-[2px]" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-action-primary -mr-[2px] -mb-[2px]" />
          </div>
        </div>

        <div className="p-8 text-center bg-black/80 pb-12 z-10">
          <p className="text-white text-sm mb-6">Placez le QR code au centre du cadre</p>
          <button onClick={stopScan} className="px-6 py-3 bg-white/20 rounded-full text-white font-bold">
            Annuler
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-white flex flex-col">
      <div className="px-6 pt-safe-4 pb-4 border-b border-gray-100 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 flex items-center justify-center bg-gray-100 rounded-full">
          <ChevronLeft className="w-5 h-5 text-gray-700" />
        </button>
        <h1 className="text-[17px] font-bold text-[#1A1A1A]">Événement privé</h1>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center -mt-10">
        <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mb-6">
          <QrCode className="w-10 h-10 text-action-primary" />
        </div>
        
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Rejoindre via code</h2>
        <p className="text-gray-500 mb-8 text-sm">
          Entrez le code unique à 10 caractères ou scannez le QR code de l'événement.
        </p>

        <div className="w-full max-w-sm space-y-4">
          <Input
            type="text"
            placeholder="Ex: A1B2C3D4E5"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="text-center text-xl font-mono tracking-widest font-bold uppercase"
          />
          
          <Button
            onClick={() => handleJoin()}
            disabled={isLoading || !code.trim()}
            className="w-full"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Rejoindre l'événement"}
          </Button>

          <div className="relative py-4">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
            <div className="relative flex justify-center"><span className="bg-white px-4 text-xs text-gray-400 font-medium uppercase tracking-wider">ou</span></div>
          </div>

          <Button
            variant="outline"
            onClick={startScan}
            className="w-full flex items-center justify-center gap-2"
          >
            <Camera className="w-5 h-5" />
            Scanner le QR code
          </Button>
        </div>
      </div>
    </div>
  );
}

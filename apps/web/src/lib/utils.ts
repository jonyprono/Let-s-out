import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { toast } from 'sonner'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date, format = 'short') {
  const d = new Date(date)
  if (format === 'short') {
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  }
  if (format === 'time') {
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function formatPrice(amount: number, currency = 'EUR') {
  if (amount === 0) return 'Gratuit'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(amount)
}

export function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function truncate(str: string, max = 100) {
  return str.length > max ? str.slice(0, max) + '…' : str
}

export const fallbackCopyTextToClipboard = (text: string) => {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  // Avoid scrolling to bottom
  textArea.style.top = "0";
  textArea.style.left = "0";
  textArea.style.position = "fixed";

  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    const successful = document.execCommand('copy');
    if (successful) {
      toast.success('Lien copié !');
    } else {
      toast.error('Impossible de copier le lien');
    }
  } catch (err) {
    toast.error('Impossible de copier le lien');
  }

  document.body.removeChild(textArea);
};

export const shareLink = async (title: string, text: string, url: string) => {
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
    } catch (err) {
      console.error('Error sharing:', err);
    }
  } else {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(url);
        toast.success('Lien copié !');
      } catch {
        fallbackCopyTextToClipboard(url);
      }
    } else {
      fallbackCopyTextToClipboard(url);
    }
  }
};

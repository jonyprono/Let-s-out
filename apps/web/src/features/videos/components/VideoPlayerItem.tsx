import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { countComments, videoCommentSource } from '@/features/social/api';
import { shareUrl } from '@/lib/share-links';
import { hapticFeedback } from '@/lib/haptics';
import { CommentThreadPanel } from '@/features/social/components/CommentThreadPanel';
import { X, Heart, MessageCircle, Share2, Loader2, Trash2, CalendarPlus, Play, Volume2, VolumeX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useVideoSoundStore } from '@/stores/video-sound.store';
import { EventVideo, videosApi } from '../api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth.store';
import { useUserProfile } from '@/features/users/UserProfileContext';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { getFullscreenPosterUrl } from '../utils/video-url';
import { ConfirmSheet } from '@/components/shared/ConfirmSheet';
import { useVideoFit, FIT_CLASS } from '../utils/video-fit';

interface Props {
  video: EventVideo;
  isActive: boolean;
  isNear?: boolean;
}

export function VideoPlayerItem({ video, isActive, isNear = true }: Props) {
  const qc = useQueryClient();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { openUserProfile } = useUserProfile();
  const [showComments, setShowComments] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  // Track if the video has had its first successful play (to avoid false buffering state)
  const hasPlayedOnceRef = useRef(false);

  const [progress, setProgress] = useState(0);
  // Use raw URL — no Cloudinary transforms that break HTTP Range requests (206 Partial Content)
  const videoUrl = video.url || '';
  const [isBuffering, setIsBuffering] = useState(false);
  const [isUserPaused, setIsUserPaused] = useState(false);
  const [hasPlaybackError, setHasPlaybackError] = useState(false);

  // Affiche aux proportions de la vidéo (et non la vignette paysage 480×270 des cartes)
  const posterUrl = getFullscreenPosterUrl(video);
  // Cadrage commun : verticale = cover (plein écran), horizontale = contain sur fond flou
  const { fit, onLoadedMetadata: onFitMetadata } = useVideoFit();

  // ── Son ──────────────────────────────────────────────────────────────
  // Préférence mémorisée (store persistant). Le son est piloté via la ref :
  // l'attribut React `muted` n'est pas répercuté sur le DOM après le montage.
  const vlogMuted = useVideoSoundStore((s) => s.vlogMuted);
  const setVlogMuted = useVideoSoundStore((s) => s.setVlogMuted);
  // Coupé par le navigateur (lecture automatique avec son refusée) sans que l'utilisateur l'ait choisi
  const [mutedByBrowser, setMutedByBrowser] = useState(false);
  // État RÉEL de l'élément <video> (synchronisé par l'événement `volumechange`) : l'icône
  // reflète toujours ce qu'on entend, jamais une supposition.
  const [elementMuted, setElementMuted] = useState(vlogMuted);
  const isMuted = elementMuted;

  const attemptPlay = useCallback((videoEl: HTMLVideoElement) => {
    videoEl.muted = useVideoSoundStore.getState().vlogMuted;
    setMutedByBrowser(false);
    // play() direct (comme le lecteur des pages) : sur iOS, c'est play() qui déclenche le
    // chargement — `preload` seul ne charge pas les données, donc `canplay` n'arrivait jamais.
    const playPromise = videoEl.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        if (err.name === 'NotAllowedError' && !videoEl.muted) {
          // Lecture avec son refusée (web sans geste récent) : on lit en muet,
          // le bouton affiche « muet » et un tap le réactive.
          videoEl.muted = true;
          setMutedByBrowser(true);
          videoEl.play().catch(() => {});
        }
      });
    }
  }, []);

  // Applique la préférence quand elle change (ex. choix fait sur un autre vlog)
  useEffect(() => {
    const videoEl = videoRef.current;
    if (videoEl && !mutedByBrowser) videoEl.muted = vlogMuted;
  }, [vlogMuted, mutedByBrowser]);

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const videoEl = videoRef.current;
    if (!videoEl) return;
    // Geste utilisateur : le navigateur autorise désormais le son
    const nextMuted = !videoEl.muted;
    videoEl.muted = nextMuted;
    setMutedByBrowser(false);
    setVlogMuted(nextMuted);
    if (videoEl.paused && !isUserPaused) videoEl.play().catch(() => {});
  };

  // Libération du décodeur quand la vidéo sort de la fenêtre (visible ± 1) ou à la fermeture.
  // Sans cela, iOS garde le lecteur matériel de chaque <video> retiré du DOM jusqu'au
  // ramasse-miettes : les vlogs suivants n'obtiennent plus de décodeur (image figée, pas de son).
  useEffect(() => {
    if (!isNear) return;
    const videoEl = videoRef.current;
    return () => {
      if (!videoEl) return;
      videoEl.pause();
      videoEl.removeAttribute('src');
      videoEl.load();
    };
    // Volontairement lié à isNear seul : le nettoyage ne doit viser que l'élément qui disparaît.
  }, [isNear]);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    if (isActive) {
      hasPlayedOnceRef.current = false;
      setIsUserPaused(false);
      setIsBuffering(false);
      attemptPlay(videoEl);
    } else {
      videoEl.pause();
      videoEl.currentTime = 0;
      hasPlayedOnceRef.current = false;
      setIsBuffering(false);
      setIsUserPaused(false);
      setShowComments(false);
      setShowShareSheet(false);
    }
  }, [isActive, attemptPlay]);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const p = (videoRef.current.currentTime / videoRef.current.duration) * 100;
      setProgress(isNaN(p) ? 0 : p);
    }
  };
  
  // Commentaires (fil partagé avec les pages) — même clé que le panneau : compteur lu en cache
  const commentSource = useMemo(() => videoCommentSource(video.id), [video.id]);
  const { data: commentThreads } = useQuery({ queryKey: commentSource.queryKey, queryFn: commentSource.list, enabled: showComments });
  const commentsTotal = commentThreads ? countComments(commentThreads) : (video._count?.comments || 0);

  // Local state for optimistic updates
  const [hasLiked, setHasLiked] = useState(
    video.reactions && video.reactions.length > 0
  );
  const [likesCount, setLikesCount] = useState(video._count?.reactions || 0);

  const toggleLikeMut = useMutation({
    mutationFn: () => videosApi.toggleReaction(video.id, '❤️'),
    onMutate: async () => {
      hapticFeedback.impact(); // vibration légère au like
      const wasLiked = hasLiked;
      setHasLiked(!wasLiked);
      setLikesCount((prev) => (wasLiked ? prev - 1 : prev + 1));
      return { wasLiked };
    },
    onError: (_err, _variables, context) => {
      if (context) {
        setHasLiked(context.wasLiked);
        setLikesCount((prev) => (context.wasLiked ? prev + 1 : prev - 1));
      }
      toast.error(t('videoPlayerItem.erreurLorsDeLaReaction'));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['videos'] });
      qc.invalidateQueries({ queryKey: ['feed', 'videos'] });
    }
  });

  // Lien direct vers CE vlog (/videos/:id) : ouvre la vidéo, inscription obligatoire pour les visiteurs
  const videoLink = shareUrl({ kind: 'video', id: video.id });

  const handleShareNative = async () => {
    try {
      const { Share } = await import('@capacitor/share');
      await Share.share({
        title: video.title,
        text: t('videoPlayerItem.decouvreDeLEvenementSur', { v0: video.title, v1: video.event.title }),
        url: videoLink,
        dialogTitle: t('videoPlayerItem.partagerCetteVideo'),
      });
    } catch {
      if (navigator.share) {
        try {
          await navigator.share({ title: video.title, url: videoLink });
        } catch {
          copyLink();
        }
      } else {
        copyLink();
      }
    }
  };

  const copyLink = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(videoLink);
      } else {
        const el = document.createElement('textarea');
        el.value = videoLink;
        el.style.position = 'fixed';
        el.style.opacity = '0';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      toast.success(t('videoPlayerItem.lienCopie'));
    } catch {
      toast.error(t('videoPlayerItem.impossibleDeCopier'));
    }
  };

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    const videoEl = videoRef.current;
    if (!videoEl) return;

    if (videoEl.paused) {
      videoEl.play().catch(() => {});
      setIsUserPaused(false);
    } else {
      videoEl.pause();
      setIsUserPaused(true);
    }
  };

  return (
    <div className="relative w-full h-[100dvh] min-h-[100dvh] snap-start snap-always shrink-0 flex items-center justify-center bg-black overflow-hidden select-none">
      {/* Ambient background glow for seamless visual continuity */}
      {posterUrl && (
        <div
          className={`absolute inset-0 bg-cover bg-center filter blur-2xl scale-110 pointer-events-none ${fit === 'contain' ? 'opacity-60' : 'opacity-25'}`}
          style={{ backgroundImage: `url(${posterUrl})` }}
        />
      )}

      {/* Main Video or Poster Placeholder for distant items */}
      {isNear ? (
        <video
          ref={videoRef}
          src={videoUrl}
          poster={posterUrl}
          // Voisine : métadonnées + 1re image préchargées ; vidéo visible : chargement complet
          preload={isActive ? 'auto' : 'metadata'}
          loop
          controls={false}
          controlsList="nodownload nofullscreen noremoteplayback"
          disablePictureInPicture
          disableRemotePlayback
          playsInline
          webkit-playsinline="true"
          x5-playsinline="true"
          onCanPlay={(e) => {
            // Filet de sécurité : relance si la vidéo active est encore en pause (ex. après une erreur réseau)
            if (isActive && !isUserPaused && e.currentTarget.paused) {
              attemptPlay(e.currentTarget);
            }
          }}
          onVolumeChange={(e) => setElementMuted(e.currentTarget.muted)}
          onPlaying={() => {
            // Video actually started playing — clear any buffering state
            hasPlayedOnceRef.current = true;
            setIsBuffering(false);
          }}
          onWaiting={() => {
            // Only show buffering spinner if video has already started once (avoid false initial state)
            if (hasPlayedOnceRef.current) {
              setIsBuffering(true);
            }
          }}
          onLoadedMetadata={(e) => {
            setElementMuted(e.currentTarget.muted);
            onFitMetadata(e);
          }}
          onTimeUpdate={handleTimeUpdate}
          onError={(e) => {
            // Previously silent: an undecodable codec/format on iOS left the
            // frame frozen/black forever with no feedback. Surface it instead.
            console.error('[VideoPlayerItem] video error', e.currentTarget.error, videoUrl);
            setHasPlaybackError(true);
          }}
          onLoadStart={() => setHasPlaybackError(false)}
          className={`w-full h-full ${FIT_CLASS[fit]} pointer-events-none relative z-0`}
        />
      ) : posterUrl ? (
        <img
          src={posterUrl}
          alt={video.title}
          className="w-full h-full object-cover pointer-events-none relative z-0"
          loading="lazy"
        />
      ) : null}

      {/* Transparent overlay to capture clicks without triggering native video controls */}
      <div 
        className="absolute inset-0 z-10 cursor-pointer" 
        onClick={togglePlay}
      />

      {/* Playback error — e.g. undecodable format/codec on this device */}
      {hasPlaybackError && isActive && (
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
          <div className="px-4 py-2.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 text-white text-[13px] text-center">
            <span>{t('videoPlayerItem.videoIllisibleSurCetAppareil')}</span>
          </div>
        </div>
      )}

      {/* Center Buffering Indicator */}
      {isBuffering && isActive && !hasPlaybackError && (
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
          <div className="w-14 h-14 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center border border-white/10 shadow-xl">
            <Loader2 className="w-8 h-8 animate-spin text-white" />
          </div>
        </div>
      )}

      {/* Center Play Button Overlay when user paused */}
      {isUserPaused && (
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none animate-in fade-in zoom-in-75 duration-150">
          <div className="w-16 h-16 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-2xl">
            <Play className="w-8 h-8 text-white fill-white translate-x-0.5" />
          </div>
        </div>
      )}

      {/* Overlay Information & Interactions (TikTok style) */}
      <div className="absolute inset-0 pointer-events-none flex flex-col justify-end">
        {/* Gradient shadow for text readability */}
        <div className="absolute bottom-0 left-0 right-0 h-[60%] bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none" />


        <div className="relative z-10 flex items-end justify-between p-4 pb-safe-6 pointer-events-auto">
          {/* Info */}
          <div className="flex-1 pr-12 text-white">
            <h2 className="text-[16px] font-bold mb-1 shadow-sm">{video.title}</h2>
            <p 
              className="text-[14px] text-white/90 mb-2 cursor-pointer active:opacity-70"
              onClick={() => openUserProfile(video.userId, undefined, { title: video.event.title })}
            >
              @{(video.user as any).profile?.displayName || (video.user as any).username || 'Utilisateur'}
            </p>
            <div 
              className="inline-flex items-center gap-1.5 px-2 py-1 bg-white/20 backdrop-blur-md rounded-lg text-[12px] font-medium cursor-pointer active:scale-95 transition-transform"
              onClick={() => navigate(`/events/${video.eventId}`)}
            >
              <span>📍 {video.event.title}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col items-center gap-6">
            {/* Son / muet — icône seule, reflet de l'état réel de la vidéo (comme le lecteur des pages).
                L'ancien libellé « Pas de son » venait d'une détection de piste audio fausse sur iOS
                (les 5 vlogs en production ont tous une piste audio). */}
            <button
              type="button"
              onClick={toggleMute}
              aria-pressed={!isMuted}
              aria-label={isMuted ? t('vlogs.soundOn') : t('vlogs.soundOff')}
              className="flex flex-col items-center gap-1"
            >
              <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center">
                {isMuted ? (
                  <VolumeX className="w-6 h-6 text-white" aria-hidden="true" />
                ) : (
                  <Volume2 className="w-6 h-6 text-white" aria-hidden="true" />
                )}
              </div>
            </button>

            <button
              onClick={() => toggleLikeMut.mutate()}
              className="flex flex-col items-center gap-1 group"
            >
              <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center">
                <Heart 
                  className={`w-6 h-6 transition-colors ${hasLiked ? 'text-red-500 fill-red-500' : 'text-white'}`} 
                />
              </div>
              <span className="text-white text-[12px] font-medium drop-shadow-md">{likesCount}</span>
            </button>

            <button 
              onClick={() => setShowComments(true)}
              className="flex flex-col items-center gap-1"
            >
              <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center">
                <MessageCircle className="w-6 h-6 text-white" />
              </div>
              <span className="text-white text-[12px] font-medium drop-shadow-md">{video._count?.comments || 0}</span>
            </button>

            <button 
              onClick={() => setShowShareSheet(true)}
              aria-label={t('social.share')}
              className="flex flex-col items-center gap-1"
            >
              <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center">
                <Share2 className="w-6 h-6 text-white" />
              </div>
              
            </button>

            {/* Delete button — author or event organizer */}
            {user && (video.userId === user.id || (video.event as any)?.creatorId === user.id || ((video.event as any)?.coHostIds || []).includes(user.id)) && (
              <button 
                onClick={() => setConfirmDelete(true)}
                className="flex flex-col items-center gap-1"
              >
                <div className="w-12 h-12 rounded-full bg-red-500/20 backdrop-blur-md flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-400" />
                </div>
                <span className="text-red-400 text-[12px] font-medium drop-shadow-md"><span>{t('videoPlayerItem.supprimer')}</span></span>
              </button>
            )}
          </div>
        </div>
        
        {/* Persistent "Create Similar Event" Button */}
        <div className="relative z-10 w-full px-4 mb-3 pointer-events-auto">
          <button 
            onClick={() => {
              const tagsQuery = (video.event as any).tags?.length ? `&tags=${(video.event as any).tags.join(',')}` : '';
              navigate(`/events/create?category=${video.event.category}${tagsQuery}`);
            }}
            className="w-full py-2.5 px-3 bg-white/20 backdrop-blur-md border border-white/30 rounded-xl text-white font-medium text-[13px] min-[390px]:text-[14px] leading-snug flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-lg"
          >
            <CalendarPlus className="w-5 h-5 shrink-0" />
            {/* Libellé long : sur les petits écrans il passe sur 2 lignes centrées au lieu de déborder */}
            <span className="min-w-0 text-center">{t('videoPlayerItem.creerUnEvenementOuSortieSimilaire')}</span>
          </button>
        </div>
        
        {/* Custom Progress Bar at the very bottom */}
        <div className="w-full h-1 bg-white/20">
          <div 
            className="h-full bg-white transition-all duration-100 ease-linear" 
            style={{ width: `${progress}%` }} 
          />
        </div>
      </div>

      {/* Comments Bottom Sheet */}
      {showComments && (
        <>
          <div 
            className="absolute inset-0 bg-black/50 z-20 pointer-events-auto" 
            onClick={() => setShowComments(false)}
          />
          <div className="absolute bottom-0 left-0 right-0 h-[60vh] bg-white dark:bg-[#1A1A1A] z-30 rounded-t-3xl flex flex-col animate-in slide-in-from-bottom duration-300 pointer-events-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-white/10">
              <h3 className="font-bold text-[16px]"><span>{t('videoPlayerItem.commentaires', { v0: commentsTotal })}</span></h3>
              <button onClick={() => setShowComments(false)} className="p-2">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Fil (likes, réponses @mention, 1 niveau) + saisie — composant partagé avec les pages */}
            <CommentThreadPanel
              source={commentSource}
              enabled={showComments}
              authorUserId={video.userId}
            />
          </div>
        </>
      )}
      {/* Confirmation de suppression (feuille Let's Out, au lieu du dialogue natif) */}
      <ConfirmSheet
        open={confirmDelete}
        title={t('videoPlayerItem.confirmDeleteTitle')}
        description={t('videoPlayerItem.confirmDeleteText')}
        confirmText={t('videoPlayerItem.supprimer')}
        cancelText={t('videoPlayerItem.annuler')}
        isPending={deleting}
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          setDeleting(true);
          try {
            await videosApi.delete(video.id);
            setConfirmDelete(false);
            toast.success(t('videoPlayerItem.videoSupprimee'));
            qc.invalidateQueries({ queryKey: ['videos'] });
            qc.invalidateQueries({ queryKey: ['feed', 'videos'] });
          } catch {
            toast.error(t('videoPlayerItem.erreurLorsDeLaSuppression2'));
          } finally {
            setDeleting(false);
          }
        }}
      />
      {/* Share Sheet */}
      {showShareSheet && (
        <>
          <div
            className="absolute inset-0 bg-black/60 z-40 pointer-events-auto"
            onClick={() => setShowShareSheet(false)}
          />
          <div className="absolute bottom-0 left-0 right-0 z-50 bg-white dark:bg-[#1A1A1A] rounded-t-3xl animate-in slide-in-from-bottom duration-300 pointer-events-auto">
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
            </div>
            <div className="px-6 pt-3 pb-2">
              <h3 className="font-bold text-[17px] text-gray-900 dark:text-white mb-1">{video.title}</h3>
              <p className="text-[13px] text-gray-500">{video.event.title}</p>
            </div>
            <div className="px-4 pb-4 space-y-2" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 16px))' }}>
              <button
                onClick={() => { setShowShareSheet(false); handleShareNative(); }}
                className="w-full flex items-center gap-4 p-4 bg-gray-50 dark:bg-white/5 rounded-2xl"
              >
                <div className="w-11 h-11 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
                  <Share2 className="w-5 h-5 text-orange-500" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-[15px] text-gray-900 dark:text-white"><span>{t('videoPlayerItem.partagerEnDehors')}</span></p>
                  <p className="text-[12px] text-gray-500">WhatsApp, Instagram, SMS…</p>
                </div>
              </button>
              <button
                onClick={() => { setShowShareSheet(false); copyLink(); }}
                className="w-full flex items-center gap-4 p-4 bg-gray-50 dark:bg-white/5 rounded-2xl"
              >
                <div className="w-11 h-11 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                </div>
                <div className="text-left">
                  <p className="font-semibold text-[15px] text-gray-900 dark:text-white"><span>{t('videoPlayerItem.copierLeLien')}</span></p>
                  <p className="text-[12px] text-gray-500"><span>{t('videoPlayerItem.copiezLAdresseDeLa')}</span></p>
                </div>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

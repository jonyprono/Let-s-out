import { v2 as cloudinary } from 'cloudinary';

import { v4 as uuidv4 } from 'uuid';

/**
 * Configure Cloudinary.
 * - If CLOUDINARY_URL is set, the SDK parses it automatically — don't override it.
 * - Otherwise fall back to the three individual env vars.
 */
if (!process.env.CLOUDINARY_URL) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}
// When CLOUDINARY_URL is present the SDK self-configures; we just need to call cloudinary.config()
// once so it picks the env var up.
else {
  cloudinary.config(true); // parse CLOUDINARY_URL
}

/**
 * Uploads a raw Buffer directly to Cloudinary.
 * Collecting the buffer before streaming avoids issues with Fastify's
 * multipart internals (stream already consumed by the time we pipe).
 */
export const uploadBufferToCloudinary = (
  buffer: Buffer,
  folder: string,
  filename: string
): Promise<string> => uploadBufferToCloudinaryDetailed(buffer, folder, filename).then((r) => r.url);

/** Résultat détaillé d'un envoi (durée en secondes pour une vidéo, sinon null) */
export interface CloudinaryUploadInfo {
  url: string;
  publicId: string;
  resourceType: string;
  duration: number | null;
}

/** Même envoi que uploadBufferToCloudinary, avec les métadonnées (ex. durée d'une vidéo) */
export const uploadBufferToCloudinaryDetailed = (
  buffer: Buffer,
  folder: string,
  filename: string
): Promise<CloudinaryUploadInfo> => {
  return new Promise((resolve, reject) => {
    const isVideo = /\.(mp4|webm|mov|avi|mkv|3gp)$/i.test(filename);
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: `${filename.split('.')[0]}-${uuidv4()}`,
        resource_type: isVideo ? 'video' : 'auto',
        chunk_size: 6000000,
        overwrite: true,
        invalidate: true,
      },
      (error, result) => {
        if (error) {
          console.error('[Cloudinary] upload error:', JSON.stringify(error));
          reject(error);
        } else if (result) {
          const d = Number((result as any).duration);
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
            resourceType: result.resource_type,
            duration: Number.isFinite(d) && d > 0 ? d : null,
          });
        } else {
          reject(new Error('[Cloudinary] Unknown error: no result returned'));
        }
      }
    );

    uploadStream.end(buffer);
  });
};

/** Suppression d'un fichier envoyé puis refusé (ex. vidéo trop longue). Ne lève jamais. */
export const destroyCloudinaryAsset = async (publicId: string, resourceType: string): Promise<void> => {
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType, invalidate: true });
  } catch (err) {
    console.error('[Cloudinary] destroy error:', err);
  }
};

// ── Pièces KYC : stockage PRIVÉ ─────────────────────────────────────────────
// Les pièces d'identité / selfies sont envoyés en `type: authenticated` : l'URL publique classique
// ne fonctionne pas, seul un lien SIGNÉ généré par le serveur (admin) permet de les afficher.
// En base on stocke une RÉFÉRENCE, jamais un lien : `cloudinary:authenticated/<resource>/<public_id>.<ext>`.
export const KYC_REF_PREFIX = 'cloudinary:authenticated/';
/** Durée de validité d'un lien signé de pièce KYC (secondes) */
const KYC_SIGNED_URL_TTL_S = 600;

/** Envoie une pièce KYC en privé ; renvoie la référence à stocker en base. */
export const uploadKycFile = (buffer: Buffer, folder: string, filename: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: `${filename.split('.')[0]}-${uuidv4()}`,
        resource_type: 'image',
        type: 'authenticated',
        overwrite: false,
      },
      (error, result) => {
        if (error) {
          console.error('[Cloudinary] KYC upload error:', error?.message);
          reject(error);
        } else if (result) {
          resolve(`${KYC_REF_PREFIX}${result.resource_type}/${result.public_id}${result.format ? '.' + result.format : ''}`);
        } else {
          reject(new Error('[Cloudinary] Unknown error: no result returned'));
        }
      }
    );
    uploadStream.end(buffer);
  });
};

/**
 * Lien d'affichage d'une pièce KYC, à n'appeler QUE dans une route réservée aux admins.
 * - référence privée → lien signé expirant au bout de KYC_SIGNED_URL_TTL_S ;
 * - ancien lien public (avant migration) → renvoyé tel quel (transition) ;
 * - toute autre valeur → null.
 */
export const kycFileUrl = (stored: string | null | undefined): string | null => {
  if (!stored) return null;
  if (stored.startsWith(KYC_REF_PREFIX)) {
    const m = stored.slice(KYC_REF_PREFIX.length).match(/^(image|raw|video)\/(.+?)(?:\.([a-z0-9]+))?$/i);
    if (!m) return null;
    const [, resourceType, publicId, ext] = m;
    return cloudinary.utils.private_download_url(publicId, ext || 'jpg', {
      resource_type: resourceType,
      type: 'authenticated',
      expires_at: Math.floor(Date.now() / 1000) + KYC_SIGNED_URL_TTL_S,
      attachment: false,
    });
  }
  return /^https:\/\//.test(stored) ? stored : null;
};

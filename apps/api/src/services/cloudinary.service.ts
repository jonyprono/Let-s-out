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
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: `${filename.split('.')[0]}-${uuidv4()}`,
        resource_type: 'auto',
        overwrite: true,
        invalidate: true,
      },
      (error, result) => {
        if (error) {
          console.error('[Cloudinary] upload error:', JSON.stringify(error));
          reject(error);
        } else if (result) {
          resolve(result.secure_url);
        } else {
          reject(new Error('[Cloudinary] Unknown error: no result returned'));
        }
      }
    );

    uploadStream.end(buffer);
  });
};

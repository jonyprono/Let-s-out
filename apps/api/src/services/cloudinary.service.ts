import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary. It will automatically pick up CLOUDINARY_URL from env if set,
// or individual variables if passed.
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Uploads a readable stream (e.g. from fastify multipart) directly to Cloudinary.
 */
export const uploadStreamToCloudinary = (
  stream: NodeJS.ReadableStream,
  folder: string,
  filename: string
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: filename.split('.')[0], // Cloudinary handles extensions typically, but we provide base name
        resource_type: 'auto',
      },
      (error, result) => {
        if (error) {
          console.error('Cloudinary upload error:', error);
          reject(error);
        } else if (result) {
          resolve(result.secure_url);
        } else {
          reject(new Error('Unknown error during Cloudinary upload'));
        }
      }
    );

    stream.pipe(uploadStream);
  });
};

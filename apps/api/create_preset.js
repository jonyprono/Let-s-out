import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: 'dy6uzfvym',
  api_key: '347585118275937',
  api_secret: '-oGz1RnOvIaL4HlV8sbnWzJAuMw'
});

async function run() {
  try {
    const res = await cloudinary.api.create_upload_preset({
      name: 'event_videos_unsigned',
      unsigned: true,
      folder: 'event_videos',
      allowed_formats: ['mp4', 'mov', 'webm']
    });
    console.log('Upload preset created:', res.name);
  } catch (error) {
    if (error.error && error.error.message && error.error.message.includes('already exists')) {
        console.log('Upload preset already exists: event_videos_unsigned');
    } else {
        console.error('Error creating upload preset:', error);
    }
  }
}

run();

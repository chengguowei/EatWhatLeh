import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Uploads an image file to a Supabase Storage bucket.
 * Falls back to a local Object URL if Supabase credentials are missing (for offline/mock testing).
 * 
 * @param file The image File object to upload
 * @param bucket The target bucket: 'review-photos' or 'restaurant-photos'
 * @returns The public URL of the uploaded image
 */
export async function uploadPhoto(file: File, bucket: 'review-photos' | 'restaurant-photos'): Promise<string> {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('⚠️ Supabase credentials missing from frontend/.env. Falling back to local preview URL.');
    return URL.createObjectURL(file);
  }

  const fileExt = file.name.split('.').pop() || 'jpg';
  const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
  const filePath = `uploads/${fileName}`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) {
    console.error('Supabase upload error:', error);
    throw error;
  }

  const { data } = supabase.storage
    .from(bucket)
    .getPublicUrl(filePath);

  return data.publicUrl;
}

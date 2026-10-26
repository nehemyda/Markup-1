import { Attachment } from '../types';

// Files are uploaded to the server when the pin is saved (pins keep links, see firebaseSync). Images are still
// downscaled and saved as JPEG to keep pages fast; other files are capped at the server's upload limit.
export const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_IMAGE_WIDTH = 1600;

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// Downscale (default 1600px wide) and re-encode as JPEG (white background for transparent images)
export async function compressImage(src: string, quality = 0.8, maxWidth = MAX_IMAGE_WIDTH): Promise<string> {
  const img = new Image();
  img.src = src;
  await img.decode();
  const scale = Math.min(1, maxWidth / img.naturalWidth);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', quality);
}

function formatSize(bytes: number): string {
  return bytes > 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

// Turn uploaded files into attachments; returns the attachments plus the names of files that were too large
export async function filesToAttachments(files: File[]): Promise<{ attachments: Attachment[]; rejected: string[] }> {
  const attachments: Attachment[] = [];
  const rejected: string[] = [];
  for (const file of files) {
    try {
      let type: Attachment['type'] = 'code';
      if (file.type.startsWith('image/')) type = 'image';
      else if (file.type.startsWith('video/')) type = 'video';
      else if (file.type.includes('pdf')) type = 'pdf';

      let url: string;
      if (type === 'image' && file.type !== 'image/svg+xml' && file.type !== 'image/gif') {
        url = await compressImage(await readAsDataUrl(file));
      } else if (file.size > MAX_FILE_BYTES) {
        rejected.push(`${file.name} (${formatSize(file.size)})`);
        continue;
      } else {
        url = await readAsDataUrl(file);
      }
      // Base64 text is about 4/3 of the bytes it encodes
      const storedBytes = Math.round((url.length * 3) / 4);
      if (storedBytes > MAX_FILE_BYTES) {
        rejected.push(`${file.name} (${formatSize(file.size)})`);
        continue;
      }
      attachments.push({
        id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: file.name,
        size: formatSize(storedBytes),
        type,
        url,
      });
    } catch (err) {
      console.warn('Could not read file', file.name, err);
      rejected.push(file.name);
    }
  }
  return { attachments, rejected };
}

export function rejectedFilesMessage(rejected: string[]): string {
  return `These files are too large to attach (limit ${Math.round(MAX_FILE_BYTES / (1024 * 1024))} MB, images are compressed automatically):\n${rejected.join('\n')}`;
}

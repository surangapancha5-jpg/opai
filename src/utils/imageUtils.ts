/**
 * Compresses an uploaded image File into a crisp data URL suitable for MongoDB storage.
 */
export function compressImageFile(
  file: File,
  maxWidth = 600,
  maxHeight = 600,
  quality = 0.82
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('Invalid image file'));
      img.src = String(event.target?.result || '');
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Generates a built-in Red & Black SVG Data URI avatar so users can pick a stylized DP anytime.
 */
export const PRESET_RED_BLACK_AVATARS: { label: string; dataUri: string }[] = [
  {
    label: 'Crimson Blade',
    dataUri: `data:image/svg+xml;utf8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><defs><linearGradient id="g1" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#09090b"/><stop offset="55%" stop-color="#450a0a"/><stop offset="100%" stop-color="#dc2626"/></linearGradient></defs><rect width="120" height="120" fill="url(#g1)"/><polygon points="60,18 98,88 60,72 22,88" fill="#ef4444" opacity="0.9"/><circle cx="60" cy="54" r="10" fill="#09090b"/></svg>`
    )}`,
  },
  {
    label: 'Obsidian Core',
    dataUri: `data:image/svg+xml;utf8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="#070709"/><circle cx="60" cy="60" r="44" fill="none" stroke="#dc2626" stroke-width="6"/><circle cx="60" cy="60" r="24" fill="#991b1b"/><circle cx="60" cy="60" r="10" fill="#ff1e38"/></svg>`
    )}`,
  },
  {
    label: 'Scarlet Pulse',
    dataUri: `data:image/svg+xml;utf8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="#08080a"/><path d="M15,60 L40,60 L52,26 L68,94 L80,60 L105,60" fill="none" stroke="#ff1e38" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg>`
    )}`,
  },
  {
    label: 'Red Eclipse',
    dataUri: `data:image/svg+xml;utf8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="#050505"/><circle cx="64" cy="58" r="36" fill="#dc2626"/><circle cx="52" cy="54" r="32" fill="#09090b"/></svg>`
    )}`,
  },
];

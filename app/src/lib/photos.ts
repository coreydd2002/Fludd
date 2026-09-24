"use client";

import imageCompression from "browser-image-compression";

/**
 * Phone cameras produce 3–12MB images, and a tech may add several per pool on a
 * cell connection at the side of a house. Compressing in the browser before
 * upload is the difference between a visit that finishes and one that stalls.
 *
 * browser-image-compression is used rather than a hand-rolled canvas resize
 * because it applies the EXIF orientation flag. Without that, portrait photos
 * from iOS arrive rotated 90° — the canvas keeps the pixels but drops the tag.
 */
const MAX_EDGE_PX = 1600;
const MAX_SIZE_MB = 0.9;

export async function compressPhoto(file: File): Promise<File> {
  const compressed = await imageCompression(file, {
    maxWidthOrHeight: MAX_EDGE_PX,
    maxSizeMB: MAX_SIZE_MB,
    useWebWorker: true,
    fileType: "image/jpeg",
    initialQuality: 0.8,
  });

  // The library can hand back a Blob; the storage client wants a named File.
  return new File([compressed], `${crypto.randomUUID()}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

/** Path inside the private `visit-photos` bucket. The leading segment is what
 *  the storage RLS policy checks, so it must be the company id. */
export function photoPath(companyId: string, visitId: string, fileName: string): string {
  return `${companyId}/${visitId}/${fileName}`;
}

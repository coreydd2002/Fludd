"use client";

import { useRef, useState } from "react";

import { compressPhoto, photoPath } from "@/lib/photos";
import { createClient } from "@/lib/supabase/client";

export type PhotoItem = { id: string; storage_path: string; url: string };

export function PhotoStrip({
  companyId,
  visitId,
  initial,
  disabled,
}: {
  companyId: string;
  visitId: string;
  initial: PhotoItem[];
  disabled?: boolean;
}) {
  const [photos, setPhotos] = useState<PhotoItem[]>(initial);
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    const supabase = createClient();

    for (const file of Array.from(files)) {
      setBusy((n) => n + 1);
      try {
        const compressed = await compressPhoto(file);
        const path = photoPath(companyId, visitId, compressed.name);

        const { error: uploadError } = await supabase.storage
          .from("visit-photos")
          .upload(path, compressed, { contentType: "image/jpeg" });
        if (uploadError) throw uploadError;

        const { data: row, error: rowError } = await supabase
          .from("visit_photos")
          .insert({ visit_id: visitId, storage_path: path, position: photos.length })
          .select("id, storage_path")
          .single();
        if (rowError) throw rowError;

        // A local object URL renders instantly; the signed URL is only needed
        // after a reload, when the server generates it.
        setPhotos((prev) => [
          ...prev,
          { id: row.id, storage_path: row.storage_path, url: URL.createObjectURL(compressed) },
        ]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "That photo didn't upload.");
      } finally {
        setBusy((n) => n - 1);
      }
    }

    if (inputRef.current) inputRef.current.value = "";
  }

  async function remove(photo: PhotoItem) {
    const supabase = createClient();
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
    const { error: delError } = await supabase.from("visit_photos").delete().eq("id", photo.id);
    if (delError) {
      setPhotos((prev) => [...prev, photo]);
      setError("Could not remove that photo.");
      return;
    }
    await supabase.storage.from("visit-photos").remove([photo.storage_path]);
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {photos.map((photo) => (
          <div key={photo.id} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element -- blob: and
                signed storage URLs are not routable through the image optimizer */}
            <img
              src={photo.url}
              alt="Pool service photo"
              className="size-24 rounded-sm object-cover ring-1 ring-line"
            />
            {!disabled ? (
              <button
                type="button"
                onClick={() => remove(photo)}
                aria-label="Remove photo"
                className="absolute -right-1.5 -top-1.5 grid size-7 place-items-center rounded-pill bg-card text-lg leading-none text-ink-soft shadow-sm ring-1 ring-line"
              >
                ×
              </button>
            ) : null}
          </div>
        ))}

        {busy > 0 ? (
          <div className="grid size-24 place-items-center rounded-sm bg-brand-tint text-xs font-bold text-brand-dark ring-1 ring-line">
            Adding…
          </div>
        ) : null}
      </div>

      {!disabled ? (
        <>
          <input
            ref={inputRef}
            id="photo-input"
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="sr-only"
            onChange={(e) => addFiles(e.target.files)}
          />
          <label
            htmlFor="photo-input"
            className="mt-3 inline-flex min-h-tap cursor-pointer items-center rounded-pill bg-card px-5 font-bold text-ink ring-1 ring-line"
          >
            Add photo
          </label>
        </>
      ) : null}

      {error ? (
        <p role="alert" className="mt-2 text-sm text-err">
          {error}
        </p>
      ) : null}
    </div>
  );
}

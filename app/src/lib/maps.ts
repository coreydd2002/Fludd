import type { MapsPref } from "./supabase/database.types";

/**
 * A directions link, not a maps API. The address is whatever the tech typed, so
 * it is passed straight to the map app's search — which handles partial and
 * misspelled addresses far better than geocoding it ourselves would.
 */
export function directionsUrl(address: string, pref: MapsPref = "google"): string {
  const destination = encodeURIComponent(address.trim());
  return pref === "apple"
    ? `https://maps.apple.com/?daddr=${destination}`
    : `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
}

import { Platform } from 'react-native';
import * as Application from 'expo-application';
import { File, Paths } from 'expo-file-system';
import { startActivityAsync } from 'expo-intent-launcher';

// Cada push a main publica una Release con la APK y este version.json
// (ver .github/workflows/apk-release.yml). "latest/download" no consume el
// límite de la API de GitHub, que todas las terminales comparten por IP.
const VERSION_URL = 'https://github.com/Oscarhernandez2006/TERMINALES-MOVILES-APP/releases/latest/download/version.json';

export interface VersionPublicada {
  version: string;
  versionCode: number;
  apk: string;
}

export function versionInstalada(): { version: string; versionCode: number | null } {
  const code = Number(Application.nativeBuildVersion);
  return {
    version: Application.nativeApplicationVersion ?? '—',
    versionCode: Number.isInteger(code) && code > 0 ? code : null,
  };
}

/** Solo las APK instaladas en Android se actualizan solas (no Expo Go ni desarrollo). */
export function actualizacionHabilitada(): boolean {
  return Platform.OS === 'android' && !__DEV__ && versionInstalada().versionCode !== null;
}

/** Devuelve la versión publicada si es más nueva que la instalada; null si está al día. */
export async function buscarActualizacion(): Promise<VersionPublicada | null> {
  const instalada = versionInstalada().versionCode;
  if (instalada === null) return null;
  const res = await fetch(`${VERSION_URL}?t=${Date.now()}`, { headers: { 'Cache-Control': 'no-cache' } });
  if (!res.ok) throw new Error(`No se pudo consultar la versión (${res.status})`);
  const pub = (await res.json()) as VersionPublicada;
  if (!Number.isInteger(pub.versionCode) || !pub.apk) throw new Error('version.json inválido');
  return pub.versionCode > instalada ? pub : null;
}

/** Descarga la APK y abre el instalador de Android (el operario confirma "Instalar"). */
export async function instalarActualizacion(pub: VersionPublicada): Promise<void> {
  const destino = new File(Paths.cache, `sigpro-terminal-${pub.versionCode}.apk`);
  if (destino.exists) destino.delete();
  const apk = await File.downloadFileAsync(pub.apk, destino);
  await startActivityAsync('android.intent.action.VIEW', {
    data: apk.contentUri,
    type: 'application/vnd.android.package-archive',
    flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
  });
}

import { supabaseAdmin } from "./supabaseAdmin";

/**
 * Comprueba que un objeto exista en Storage sin descargarlo por completo.
 */
export const storageObjectExists = async (
  bucket: string,
  path: string,
): Promise<boolean> => {
  const normalizedPath = path.trim();

  if (!normalizedPath) {
    return false;
  }

  const lastSlash = normalizedPath.lastIndexOf("/");
  const folder = lastSlash >= 0 ? normalizedPath.slice(0, lastSlash) : "";
  const fileName =
    lastSlash >= 0 ? normalizedPath.slice(lastSlash + 1) : normalizedPath;

  const { data, error } = await supabaseAdmin.storage.from(bucket).list(folder, {
    limit: 100,
    search: fileName,
  });

  if (error) {
    console.error(`Error al verificar ${bucket}/${normalizedPath}:`, error);
    return false;
  }

  return (data ?? []).some((entry) => entry.name === fileName);
};

/**
 * Copia un objeto a su ruta final y elimina el archivo temporal.
 */
export const promoteStorageObject = async (
  bucket: string,
  stagingPath: string,
  finalPath: string,
): Promise<boolean> => {
  if (stagingPath === finalPath) {
    return storageObjectExists(bucket, finalPath);
  }

  const { error: copyError } = await supabaseAdmin.storage
    .from(bucket)
    .copy(stagingPath, finalPath);

  if (copyError) {
    console.error(
      `Error al promover ${bucket}/${stagingPath} → ${finalPath}:`,
      copyError,
    );
    return false;
  }

  const { error: removeError } = await supabaseAdmin.storage
    .from(bucket)
    .remove([stagingPath]);

  if (removeError) {
    console.warn(
      `Archivo promovido pero no se pudo eliminar staging ${bucket}/${stagingPath}:`,
      removeError,
    );
  }

  return true;
};

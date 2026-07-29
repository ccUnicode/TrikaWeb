export function getSafeRedirect(url: string | null | undefined, defaultUrl: string = '/profile'): string {
  if (!url) return defaultUrl;
  
  // Aceptamos rutas relativas internas que comienzan con un único '/', 
  // asegurándonos de que no sean '//' ni '/\' para evitar redirecciones a dominios externos
  if (url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/\\')) {
    return url;
  }
  
  return defaultUrl;
}

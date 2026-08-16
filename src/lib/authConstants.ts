export const UNI_EMAIL_SUFFIX = '@uni.pe';

export function isUniPeEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase().endsWith(UNI_EMAIL_SUFFIX);
}

export const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,30}$/;

const FREE_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.co.uk',
  'ymail.com',
  'hotmail.com',
  'hotmail.co.uk',
  'outlook.com',
  'live.com',
  'msn.com',
  'aol.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'proton.me',
  'protonmail.com',
  'gmx.com',
  'gmx.net',
  'mail.com',
  'zoho.com',
  'yandex.com',
  'pm.me',
]);

export function isFreeEmail(email: string): boolean {
  const at = email.trim().toLowerCase().lastIndexOf('@');
  if (at < 0) return false;
  const domain = email
    .trim()
    .toLowerCase()
    .slice(at + 1)
    .replace(/^\[|\]$/g, '');
  return FREE_DOMAINS.has(domain);
}

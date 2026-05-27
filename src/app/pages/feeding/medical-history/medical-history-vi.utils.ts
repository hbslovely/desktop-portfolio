/** Bỏ dấu + đ → d để so khớp tiếng Việt (ô≈o, ă≈a…) */
export function foldViKey(s: string): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\u0111/g, 'd')
    .replace(/\u0110/g, 'd')
    .toLowerCase();
}

/** So khớp chuỗi con sau khi gộp dấu — gõ "o" hay "ô" đều được */
export function viFoldIncludes(haystack: string, needle: string): boolean {
  const n = foldViKey(needle);
  if (!n) return true;
  return foldViKey(haystack).includes(n);
}

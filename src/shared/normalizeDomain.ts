/**
 * Reduce user input to the bare domain DataForSEO's domain endpoints expect.
 *
 * People paste full URLs ("https://inovela.se/om-oss"), so strip the scheme,
 * any credentials, `www.`, the port, and everything from the first slash on.
 * Returns "" when nothing usable is left.
 */
export function normalizeDomain(input: string): string {
  let value = input.trim().toLowerCase();
  if (!value) return "";

  value = value.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  // Strip user:pass@ credentials before the host.
  value = value.replace(/^[^/@]*@/, "");
  // Drop path, query and fragment.
  value = value.split(/[/?#]/)[0] ?? "";
  // Drop an explicit port.
  value = value.split(":")[0] ?? "";
  value = value.replace(/^www\./, "");
  // Trailing dot is legal in DNS but not what the API wants.
  value = value.replace(/\.$/, "");

  return value;
}

import { lookup } from 'node:dns/promises';

/**
 * Determines if an IP address belongs to a private, loopback, or reserved range.
 * This is a critical utility for SSRF (Server-Side Request Forgery) protection,
 * preventing the proxy from accessing internal network resources.
 *
 * @param ip - The IP address string to check.
 * @returns True if the IP is private/reserved, false otherwise.
 */
export const isPrivateIP = (ip: string): boolean => {
  const ipv4Regex =
    /^(?:10|127|172\.(?:1[6-9]|2[0-9]|3[01])|192\.168|169\.254)\..*/;

  const isIPv6Loopback = ip === '::1' || ip === '0:0:0:0:0:0:0:1';

  return ipv4Regex.test(ip) || isIPv6Loopback;
};

/**
 * Resolves a hostname to its primary IPv4 address.
 * Used to perform IP-level security checks after domain validation.
 *
 * @param hostname - The domain name to resolve.
 * @returns A Promise resolving to the IP address string, or null if resolution fails.
 */
export const resolveIP = async (hostname: string): Promise<string | null> => {
  try {
    const result = await lookup(hostname, { family: 4 });
    return result.address;
  } catch {
    return null;
  }
};

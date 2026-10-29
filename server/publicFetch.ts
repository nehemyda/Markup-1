// Fetching a web address for someone (the review proxy, AI image review, screenshots): public internet addresses only.
// Without this, anyone could make the server fetch addresses inside its own network (cloud metadata, databases,
// admin pages). Every connection is checked, including each redirect and every address a name resolves to.
// PAGE_FETCH_ALLOW_HOSTS (comma-separated host:port, e.g. 127.0.0.1:8881 for the local WordPress test site) is let through.
import dns from 'dns';
import net from 'net';
import { Agent, fetch, RequestInit } from 'undici';

export class BlockedAddressError extends Error {}

const blocked = new net.BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12],
  ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24],
  ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) blocked.addSubnet(address, prefix, 'ipv4');
for (const [address, prefix] of [
  ['::', 128], ['::1', 128], ['2001:db8::', 32], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8],
] as const) blocked.addSubnet(address, prefix, 'ipv6');

// IPv6 addresses that carry an IPv4 address (::ffff:10.0.0.1, NAT64 64:ff9b::a00:1) are judged by that IPv4 address.
// (They can't go in the list above: BlockList matches every IPv4 address against such ranges.)
function embeddedIPv4(ip: string): string | null {
  const dotted = ip.match(/^(?:::ffff:|64:ff9b::)(\d+\.\d+\.\d+\.\d+)$/i);
  if (dotted) return dotted[1];
  const hex = ip.match(/^(?:::ffff:|64:ff9b::)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
  if (!hex) return null;
  const [hi, lo] = [parseInt(hex[1], 16), parseInt(hex[2], 16)];
  return [hi >> 8, hi & 255, lo >> 8, lo & 255].join('.');
}

export const isPublicAddress = (ip: string): boolean => {
  if (net.isIP(ip) === 0) return false;
  const v4 = net.isIPv6(ip) ? embeddedIPv4(ip) : ip;
  return v4 ? !blocked.check(v4, 'ipv4') : !blocked.check(ip, 'ipv6');
};

const allowedHosts = () =>
  new Set((process.env.PAGE_FETCH_ALLOW_HOSTS || '').split(',').map((h) => h.trim().toLowerCase()).filter(Boolean));

// host:port as the allow list writes it (the default port included)
const hostAndPort = (url: URL) => `${url.hostname}:${url.port || (url.protocol === 'https:' ? '443' : '80')}`.toLowerCase();

export function isAllowedPrivateHost(url: URL) {
  return allowedHosts().has(hostAndPort(url));
}

// Names are checked when they are looked up for the connection, so a name can't point somewhere else later
const publicOnly = new Agent({
  connect: {
    lookup: (hostname, options, callback) => {
      dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
        if (err) return callback(err, '', 0);
        const list = addresses as dns.LookupAddress[];
        if (!list.length || list.some((a) => !isPublicAddress(a.address))) {
          return callback(new BlockedAddressError(`${hostname} is not a public internet address.`), '', 0);
        }
        if ((options as dns.LookupOptions).all) return (callback as any)(null, list);
        callback(null, list[0].address, list[0].family);
      });
    },
  },
});

// Throws BlockedAddressError for anything but a public http(s) address
export async function checkPublicUrl(raw: string | URL): Promise<URL> {
  const url = new URL(raw);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new BlockedAddressError('Only http and https addresses can be opened.');
  if (url.username || url.password) throw new BlockedAddressError('Addresses with a user name or password are not allowed.');
  if (isAllowedPrivateHost(url)) return url;
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = net.isIP(host) ? [host] : (await dns.promises.lookup(host, { all: true })).map((a) => a.address);
  if (!addresses.length || addresses.some((a) => !isPublicAddress(a))) {
    throw new BlockedAddressError(`${url.hostname} is not a public internet address.`);
  }
  return url;
}

// fetch() for addresses people give us. Redirects are followed here (up to 5), each one checked again.
export async function fetchPublic(raw: string, init: Omit<RequestInit, 'redirect' | 'dispatcher'> = {}) {
  let url = new URL(raw);
  for (let hop = 0; hop <= 5; hop++) {
    await checkPublicUrl(url);
    const res = await fetch(url, { ...init, redirect: 'manual', dispatcher: isAllowedPrivateHost(url) ? undefined : publicOnly });
    const location = res.headers.get('location');
    if (res.status < 300 || res.status >= 400 || !location) return res;
    await res.body?.cancel().catch(() => {});
    url = new URL(location, url);
  }
  throw new BlockedAddressError('The address redirected too many times.');
}

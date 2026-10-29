import { DEFAULT_SERVER, disconnect, getConfig } from './shared.js';

const input = document.getElementById('server');
const status = document.getElementById('status');

const show = (text, ok = true) => {
  status.textContent = text;
  status.style.color = ok ? '#047857' : '#e11d48';
};

async function save(value) {
  let origin;
  try {
    const url = new URL(value.trim());
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
    origin = url.origin;
  } catch {
    return show('Enter a full address, like https://vpin.example.com', false);
  }
  const { server } = await getConfig();
  if (origin === server) return show('Saved.');
  // The extension may only talk to this address after Chrome asks you
  if (origin !== DEFAULT_SERVER) {
    const granted = await chrome.permissions.request({ origins: [`${origin}/*`] });
    if (!granted) return show('Chrome did not allow access to that address.', false);
  }
  // A key belongs to one Vpin: connect again on the new address
  await disconnect();
  await chrome.storage.local.set({ server: origin });
  input.value = origin;
  show('Saved. Open the extension and click Connect.');
}

document.getElementById('save').addEventListener('click', () => save(input.value));
document.getElementById('reset').addEventListener('click', () => save(DEFAULT_SERVER));
getConfig().then((c) => (input.value = c.server));

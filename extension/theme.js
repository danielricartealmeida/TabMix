// Preferência visual independente das configurações de áudio.
(() => {
  const allowed = new Set(['system', 'light', 'dark']);
  const system = matchMedia('(prefers-color-scheme: dark)');
  let preference = 'system';
  function apply() {
    document.documentElement.dataset.theme = preference === 'system' ? (system.matches ? 'dark' : 'light') : preference;
    document.documentElement.dataset.preference = preference;
    const select = document.getElementById('theme');
    if (select) select.value = preference;
  }
  apply();
  system.addEventListener('change', apply);
  const loaded = chrome.storage.local.get({ theme: 'system' }).then(({ theme }) => {
    preference = allowed.has(theme) ? theme : 'system'; apply();
  }).catch(() => apply());
  document.addEventListener('DOMContentLoaded', async () => {
    await loaded;
    const select = document.getElementById('theme');
    select.addEventListener('change', async () => {
      preference = allowed.has(select.value) ? select.value : 'system'; apply();
      try { await chrome.storage.local.set({ theme: preference }); }
      catch { document.getElementById('themeStatus').textContent = 'Não foi possível salvar o tema.'; }
    });
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.theme) return;
    preference = allowed.has(changes.theme.newValue) ? changes.theme.newValue : 'system'; apply();
  });
})();

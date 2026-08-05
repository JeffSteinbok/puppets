const enhanceCodeBlock = (pre) => {
  if (pre.classList.contains('mermaid') || pre.closest('.file-explorer')) return;
  const code = pre.querySelector('code');
  if (!code) return;

  const outer = pre.closest('.highlighter-rouge') || pre;
  if (outer.parentElement?.classList.contains('code-panel')) return;

  const wrapper = document.createElement('div');
  wrapper.className = 'code-panel';
  outer.parentNode.insertBefore(wrapper, outer);
  wrapper.appendChild(outer);

  const button = document.createElement('button');
  button.className = 'copy-code';
  button.type = 'button';
  button.textContent = 'Copy';
  button.setAttribute('aria-label', 'Copy code to clipboard');
  button.addEventListener('click', async () => {
    await navigator.clipboard.writeText(code.textContent);
    button.textContent = 'Copied';
    window.setTimeout(() => {
      button.textContent = 'Copy';
    }, 1400);
  });
  wrapper.appendChild(button);
};

document.querySelectorAll('pre').forEach((pre) => {
  enhanceCodeBlock(pre);
});

document.querySelectorAll('[data-file-explorer]').forEach((explorer) => {
  const items = [...explorer.querySelectorAll('[data-file-url]')];
  const name = explorer.querySelector('[data-file-explorer-name]');
  const code = explorer.querySelector('[data-file-explorer-code]');
  const open = explorer.querySelector('[data-file-explorer-open]');
  const copy = explorer.querySelector('[data-file-explorer-copy]');

  const load = async (item) => {
    items.forEach(candidate => candidate.classList.toggle('is-active', candidate === item));
    name.textContent = item.dataset.fileName;
    code.textContent = 'Loading...';
    open.href = item.dataset.fileUrl;

    try {
      const response = await fetch(item.dataset.fileUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      code.textContent = await response.text();
    } catch (error) {
      code.textContent = `Could not load ${item.dataset.fileName}: ${error.message}`;
    }
  };

  items.forEach(item => item.addEventListener('click', () => load(item)));
  copy.addEventListener('click', async () => {
    await navigator.clipboard.writeText(code.textContent);
    copy.textContent = 'Copied';
    window.setTimeout(() => {
      copy.textContent = 'Copy';
    }, 1400);
  });

  if (items[0]) load(items[0]);
});

if (window.mermaid) {
  window.mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    securityLevel: 'strict',
    themeVariables: {
      background: '#11111b',
      primaryColor: '#1e1e2e',
      primaryTextColor: '#cdd6f4',
      primaryBorderColor: '#89b4fa',
      lineColor: '#a6adc8',
      secondaryColor: '#181825',
      tertiaryColor: '#313244',
    },
  });
  window.mermaid.run({ querySelector: '.mermaid' }).catch((error) => {
    console.error('Could not render Mermaid diagram', error);
  });
}

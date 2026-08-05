document.querySelectorAll('pre').forEach((pre) => {
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
});

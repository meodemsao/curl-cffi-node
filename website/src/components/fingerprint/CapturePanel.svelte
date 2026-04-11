<script lang="ts">
  import { onMount } from 'svelte';

  interface FingerprintData {
    ja3: string;
    ja4: string;
    akamai: string;
    userAgent: string;
    httpVersion: string;
    tlsVersion: string;
    cipherCount: number;
    extensionCount: number;
    extensions: string[];
    h2Settings: string[];
    h2PseudoOrder: string;
  }

  let loading = $state(true);
  let error = $state('');
  let fingerprint = $state<FingerprintData | null>(null);
  let copied = $state('');
  let rawJson = $state<any>(null);

  async function capture() {
    loading = true;
    error = '';
    try {
      // Try our server-side proxy first (avoids CORS), fallback to direct
      let res: Response;
      try {
        res = await fetch('/api/capture');
      } catch {
        res = await fetch('https://tls.peet.ws/api/all');
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      rawJson = data;

      const settingsFrame = data.http2?.sent_frames?.find((f: any) => f.frame_type === 'SETTINGS');
      const headersFrame = data.http2?.sent_frames?.find((f: any) => f.frame_type === 'HEADERS');
      const pseudoOrder = headersFrame?.headers
        ?.filter((h: string) => h.startsWith(':'))
        .map((h: string) => h.split(':')[1]?.[0])
        .join('') || '';

      fingerprint = {
        ja3: data.tls?.ja3_hash || 'N/A',
        ja4: data.tls?.ja4 || 'N/A',
        akamai: data.http2?.akamai_fingerprint || 'N/A',
        userAgent: data.user_agent || 'N/A',
        httpVersion: data.http_version || 'N/A',
        tlsVersion: data.tls?.version || 'N/A',
        cipherCount: data.tls?.ciphers?.length || 0,
        extensionCount: data.tls?.extensions?.length || 0,
        extensions: data.tls?.extensions?.map((e: any) => e.name) || [],
        h2Settings: settingsFrame?.settings || [],
        h2PseudoOrder: pseudoOrder,
      };

      // Dispatch event so ContributeForm can auto-attach fingerprint data
      window.dispatchEvent(new CustomEvent('fingerprint-captured', {
        detail: { raw: data, parsed: fingerprint }
      }));
    } catch (e: any) {
      error = e.message || 'Failed to capture fingerprint';
    } finally {
      loading = false;
    }
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text);
    copied = label;
    setTimeout(() => copied = '', 2000);
  }

  function copyFullJson() {
    if (rawJson) {
      navigator.clipboard.writeText(JSON.stringify(rawJson, null, 2));
      copied = 'json';
      setTimeout(() => copied = '', 2000);
    }
  }

  // Generate dynamic code snippet based on captured fingerprint
  function generateCodeSnippet(): string {
    if (!fingerprint || !rawJson) return '';

    const ciphers = rawJson.tls?.ciphers?.map((c: any) => c.name || c).join(',\n    ') || '';
    const extensions = rawJson.tls?.extensions?.map((e: any) => e.name || e).join(',\n    ') || '';
    const h2Settings = fingerprint.h2Settings.join(', ') || 'N/A';

    return `import { Session } from 'curl-cffi-node';

// Your browser's TLS fingerprint
// JA3:    ${fingerprint.ja3}
// JA4:    ${fingerprint.ja4}
// Akamai: ${fingerprint.akamai}
// H2:     ${h2Settings}

const session = new Session({
  // Use a built-in browser preset that matches your fingerprint
  impersonate: 'chrome131',

  // Or use raw fingerprint values for exact match:
  ja3: '${rawJson.tls?.ja3 || 'N/A'}',
  akamai: '${fingerprint.akamai}',
  headers: {
    'User-Agent': '${fingerprint.userAgent}',
  },
});

const response = await session.get('https://example.com');
console.log(response.status); // 200`;
  }

  // Simple syntax highlighting for the generated code
  function highlightCode(code: string): string {
    if (!code) return '';
    
    // Process line by line for cleaner highlighting
    return code.split('\n').map(line => {
      // Escape HTML
      let escaped = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      
      // Full-line comments
      if (/^\s*\/\//.test(escaped)) {
        return `<span class="hl-comment">${escaped}</span>`;
      }
      
      // Inline comments at end of line
      escaped = escaped.replace(/(\/\/.*)$/, '<span class="hl-comment">$1</span>');
      
      // Strings (single quotes only, outside comments)
      escaped = escaped.replace(/'([^'<]*)'/g, '<span class="hl-string">\'$1\'</span>');
      
      // Keywords
      escaped = escaped.replace(/\b(import|export|from|const|let|var|new|await|async|function|return)\b/g, '<span class="hl-keyword">$1</span>');
      
      // Types/classes
      escaped = escaped.replace(/\b(Session|console)\b/g, '<span class="hl-type">$1</span>');
      
      // Methods after dot
      escaped = escaped.replace(/\.(get|post|log|status)\b/g, '.<span class="hl-method">$1</span>');
      
      return escaped;
    }).join('\n');
  }

  onMount(capture);
</script>

<div class="space-y-6">
  {#if loading}
    <div class="flex flex-col items-center justify-center py-16 gap-4">
      <div class="w-10 h-10 border-2 border-[var(--color-accent-cyan)] border-t-transparent rounded-full animate-spin"></div>
      <p class="text-[var(--color-text-secondary)] text-sm">Capturing your browser fingerprint...</p>
    </div>
  {:else if error}
    <div class="p-6 rounded-xl bg-red-500/10 border border-red-500/30 text-center">
      <p class="text-red-400 font-medium mb-2">Capture Failed</p>
      <p class="text-sm text-[var(--color-text-secondary)] mb-4">{error}</p>
      <button onclick={capture} class="px-4 py-2 rounded-lg bg-[var(--color-accent-blue)] text-white text-sm font-medium hover:opacity-80 transition-opacity">
        Retry
      </button>
    </div>
  {:else if fingerprint}
    <!-- Main fingerprint card -->
    <div class="rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] overflow-hidden glow-cyan">
      <div class="flex items-center justify-between px-5 py-3 border-b border-[var(--color-border)]">
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-[var(--color-accent-green)] pulse-glow"></span>
          <span class="text-sm font-medium text-[var(--color-text-primary)]">Your Browser Fingerprint</span>
        </div>
        <div class="flex items-center gap-2">
          <button onclick={capture} class="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-accent-cyan)] transition-colors px-2 py-1 rounded-md hover:bg-[var(--color-bg-card-hover)]" title="Recapture">
            ↻ Refresh
          </button>
          <button onclick={copyFullJson} class="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-accent-cyan)] transition-colors px-2 py-1 rounded-md hover:bg-[var(--color-bg-card-hover)]">
            {copied === 'json' ? '✓ Copied' : '📋 Full JSON'}
          </button>
        </div>
      </div>

      <div class="p-5 space-y-4">
        <!-- Hash trio -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          {#each [
            { label: 'JA3 Hash', value: fingerprint.ja3, key: 'ja3' },
            { label: 'JA4', value: fingerprint.ja4, key: 'ja4' },
            { label: 'Akamai H2 FP', value: fingerprint.akamai, key: 'akamai' }
          ] as item}
            <button 
              onclick={() => copyToClipboard(item.value, item.key)}
              class="group p-3 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)] hover:border-[var(--color-accent-cyan)]/50 transition-all text-left"
            >
              <div class="flex items-center justify-between mb-1.5">
                <span class="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-medium">{item.label}</span>
                <span class="text-[10px] text-[var(--color-accent-cyan)] opacity-0 group-hover:opacity-100 transition-opacity">
                  {copied === item.key ? '✓ Copied' : 'Click to copy'}
                </span>
              </div>
              <code class="text-xs text-[var(--color-accent-cyan)] font-mono break-all leading-relaxed">{item.value}</code>
            </button>
          {/each}
        </div>

        <!-- Details grid -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          {#each [
            { label: 'HTTP Version', value: fingerprint.httpVersion },
            { label: 'TLS Ciphers', value: `${fingerprint.cipherCount} ciphers` },
            { label: 'TLS Extensions', value: `${fingerprint.extensionCount} extensions` },
            { label: 'H2 Pseudo Order', value: fingerprint.h2PseudoOrder || 'N/A' },
          ] as detail}
            <div class="p-3 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)]">
              <div class="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-medium mb-1">{detail.label}</div>
              <div class="text-sm text-[var(--color-text-primary)] font-medium">{detail.value}</div>
            </div>
          {/each}
        </div>

        <!-- User Agent -->
        <div class="p-3 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)]">
          <div class="flex items-center justify-between mb-1">
            <span class="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-medium">User-Agent</span>
            <button onclick={() => copyToClipboard(fingerprint?.userAgent || '', 'ua')} class="text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-accent-cyan)] transition-colors">
              {copied === 'ua' ? '✓' : '📋'}
            </button>
          </div>
          <code class="text-xs text-[var(--color-text-secondary)] font-mono break-all">{fingerprint.userAgent}</code>
        </div>

        <!-- H2 Settings -->
        {#if fingerprint.h2Settings.length > 0}
          <div class="p-3 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)]">
            <div class="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-medium mb-2">HTTP/2 Settings</div>
            <div class="flex flex-wrap gap-1.5">
              {#each fingerprint.h2Settings as setting}
                <span class="text-[11px] px-2 py-0.5 rounded-md bg-[var(--color-bg-card)] border border-[var(--color-border)] text-[var(--color-text-secondary)] font-mono">
                  {setting}
                </span>
              {/each}
            </div>
          </div>
        {/if}

        <!-- TLS Extensions -->
        {#if fingerprint.extensions.length > 0}
          <details class="group">
            <summary class="cursor-pointer text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors flex items-center gap-1.5 py-1">
              <span class="group-open:rotate-90 transition-transform text-[10px]">▶</span>
              TLS Extensions ({fingerprint.extensionCount})
            </summary>
            <div class="mt-2 p-3 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)]">
              <div class="flex flex-wrap gap-1.5">
                {#each fingerprint.extensions as ext}
                  <span class="text-[10px] px-2 py-0.5 rounded-md bg-[var(--color-bg-card)] border border-[var(--color-border)] text-[var(--color-text-secondary)] font-mono">
                    {ext}
                  </span>
                {/each}
              </div>
            </div>
          </details>
        {/if}
      </div>
    </div>

    <!-- curl-cffi-node code snippet (dynamic) -->
    <div class="rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] overflow-hidden">
      <div class="flex items-center justify-between px-5 py-3 border-b border-[var(--color-border)]">
        <div class="flex items-center gap-2">
          <span class="text-sm text-[var(--color-text-secondary)]">Use this fingerprint with curl-cffi-node</span>
          <span class="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-accent-green)]/15 text-[var(--color-accent-green)] font-medium">LIVE</span>
        </div>
        <button 
          onclick={() => copyToClipboard(generateCodeSnippet(), 'code')}
          class="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-accent-cyan)] transition-colors px-2 py-1 rounded-md hover:bg-[var(--color-bg-card-hover)]"
        >
          {copied === 'code' ? '✓ Copied' : '📋 Copy Code'}
        </button>
      </div>
      <pre class="!rounded-none !border-0 !m-0 p-5 overflow-x-auto"><code class="text-[13px] font-mono leading-relaxed">{@html highlightCode(generateCodeSnippet())}</code></pre>
    </div>
  {/if}
</div>

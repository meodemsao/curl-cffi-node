<script lang="ts">
  import { onMount } from 'svelte';

  // Auto-detected fields
  let deviceName = $state('');
  let browserName = $state('');
  let browserVersion = $state('');
  let osName = $state('');
  let deviceType = $state('desktop');

  // Fingerprint data from CapturePanel
  let rawFingerprint = $state<any>(null);
  let hasFingerprintData = $state(false);

  // Form state
  let submitting = $state(false);
  let submitted = $state(false);
  let submitError = $state('');

  // Parse User-Agent to auto-fill browser, OS, and device info
  function parseUserAgent(ua: string) {
    // Browser detection
    if (/Edg\/(\d[\d.]*)/i.test(ua)) {
      browserName = 'Edge';
      browserVersion = RegExp.$1;
    } else if (/OPR\/(\d[\d.]*)/i.test(ua)) {
      browserName = 'Opera';
      browserVersion = RegExp.$1;
    } else if (/Chrome\/(\d[\d.]*)/i.test(ua) && !/Edg|OPR/i.test(ua)) {
      browserName = 'Chrome';
      browserVersion = RegExp.$1;
    } else if (/Version\/(\d[\d.]*).*Safari/i.test(ua)) {
      browserName = 'Safari';
      browserVersion = RegExp.$1;
    } else if (/Firefox\/(\d[\d.]*)/i.test(ua)) {
      browserName = 'Firefox';
      browserVersion = RegExp.$1;
    }

    // OS detection
    if (/iPhone|iPad/.test(ua)) {
      const match = ua.match(/OS (\d+[_.\d]*)/);
      osName = `iOS ${match ? match[1].replace(/_/g, '.') : ''}`.trim();
      deviceType = /iPad/.test(ua) ? 'tablet' : 'mobile';
    } else if (/Android ([\d.]+)/.test(ua)) {
      osName = `Android ${RegExp.$1}`;
      deviceType = /Mobile/.test(ua) ? 'mobile' : 'tablet';
    } else if (/Mac OS X ([\d_]+)/.test(ua)) {
      osName = `macOS ${RegExp.$1.replace(/_/g, '.')}`;
      deviceType = 'desktop';
    } else if (/Windows NT ([\d.]+)/.test(ua)) {
      const ver = RegExp.$1;
      const winMap: Record<string, string> = { '10.0': '10/11', '6.3': '8.1', '6.2': '8', '6.1': '7' };
      osName = `Windows ${winMap[ver] || ver}`;
      deviceType = 'desktop';
    } else if (/Linux/.test(ua)) {
      osName = 'Linux';
      deviceType = 'desktop';
    } else if (/CrOS/.test(ua)) {
      osName = 'ChromeOS';
      deviceType = 'desktop';
    }
  }

  onMount(() => {
    // Auto-fill from User-Agent
    parseUserAgent(navigator.userAgent);

    // Listen for fingerprint data from CapturePanel
    window.addEventListener('fingerprint-captured', ((e: CustomEvent) => {
      rawFingerprint = e.detail.raw;
      hasFingerprintData = true;
    }) as EventListener);
  });

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!hasFingerprintData) {
      submitError = 'Fingerprint not captured yet. Please wait for capture to complete.';
      return;
    }

    submitting = true;
    submitError = '';

    try {
      const payload = {
        fingerprint: rawFingerprint,
        metadata: {
          deviceName: deviceName || undefined,
          browserName: browserName || undefined,
          browserVersion: browserVersion || undefined,
          osName: osName || undefined,
          deviceType,
          userAgent: navigator.userAgent,
        },
      };

      const res = await fetch('/api/fingerprints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      submitted = true;
    } catch (e: any) {
      submitError = e.message || 'Submission failed';
    } finally {
      submitting = false;
    }
  }
</script>

{#if submitted}
  <div class="p-8 rounded-xl bg-[var(--color-accent-green)]/10 border border-[var(--color-accent-green)]/30 text-center">
    <div class="text-4xl mb-3">🎉</div>
    <p class="text-[var(--color-accent-green)] font-semibold text-lg mb-1">Thank you!</p>
    <p class="text-sm text-[var(--color-text-secondary)]">Your fingerprint has been recorded. It will be available in the community gallery soon.</p>
  </div>
{:else}
  <form onsubmit={handleSubmit} class="rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] overflow-hidden">
    <div class="px-5 py-3 border-b border-[var(--color-border)]">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-sm font-medium text-[var(--color-text-primary)]">Contribute Your Fingerprint</h3>
          <p class="text-xs text-[var(--color-text-muted)] mt-0.5">Help build the largest browser fingerprint database</p>
        </div>
        {#if hasFingerprintData}
          <span class="inline-flex items-center gap-1.5 text-xs text-[var(--color-accent-green)] bg-[var(--color-accent-green)]/10 px-2.5 py-1 rounded-full">
            <span class="w-1.5 h-1.5 rounded-full bg-[var(--color-accent-green)] pulse-glow"></span>
            Fingerprint attached
          </span>
        {:else}
          <span class="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-primary)] px-2.5 py-1 rounded-full">
            <span class="w-3 h-3 border border-[var(--color-text-muted)] border-t-transparent rounded-full animate-spin"></span>
            Waiting for capture...
          </span>
        {/if}
      </div>
    </div>

    <div class="p-5 space-y-4">
      <!-- Auto-detected info banner -->
      {#if browserName || osName}
        <div class="flex items-center gap-2 p-3 rounded-lg bg-[var(--color-accent-cyan)]/5 border border-[var(--color-accent-cyan)]/20">
          <span class="text-xs">🔍</span>
          <p class="text-xs text-[var(--color-accent-cyan)]">
            Auto-detected: <strong>{browserName} {browserVersion}</strong> on <strong>{osName}</strong>
            ({deviceType}). You can edit these fields below.
          </p>
        </div>
      {/if}

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label for="cf-name" class="block text-xs text-[var(--color-text-muted)] mb-1.5 font-medium">Device Name (optional)</label>
          <input id="cf-name" type="text" bind:value={deviceName} placeholder="e.g. MacBook Pro M3, iPhone 15 Pro"
            class="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent-cyan)] focus:outline-none transition-colors" />
        </div>
        <div>
          <label for="cf-device" class="block text-xs text-[var(--color-text-muted)] mb-1.5 font-medium">Device Type</label>
          <select id="cf-device" bind:value={deviceType}
            class="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent-cyan)] focus:outline-none transition-colors">
            <option value="desktop">Desktop</option>
            <option value="mobile">Mobile</option>
            <option value="tablet">Tablet</option>
          </select>
        </div>
        <div>
          <label for="cf-browser" class="block text-xs text-[var(--color-text-muted)] mb-1.5 font-medium">Browser Name</label>
          <input id="cf-browser" type="text" bind:value={browserName} placeholder="e.g. Chrome, Safari, Firefox"
            class="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent-cyan)] focus:outline-none transition-colors" />
        </div>
        <div>
          <label for="cf-version" class="block text-xs text-[var(--color-text-muted)] mb-1.5 font-medium">Browser Version</label>
          <input id="cf-version" type="text" bind:value={browserVersion} placeholder="e.g. 131.0.6778.86"
            class="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent-cyan)] focus:outline-none transition-colors" />
        </div>
      </div>
      <div>
        <label for="cf-os" class="block text-xs text-[var(--color-text-muted)] mb-1.5 font-medium">Operating System</label>
        <input id="cf-os" type="text" bind:value={osName} placeholder="e.g. macOS 15.2, Windows 11, iOS 18.0"
          class="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent-cyan)] focus:outline-none transition-colors" />
      </div>

      {#if submitError}
        <div class="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
          <p class="text-sm text-red-400">{submitError}</p>
        </div>
      {/if}

      <button type="submit" disabled={submitting || !hasFingerprintData}
        class="w-full py-2.5 rounded-lg bg-gradient-to-r from-[var(--color-accent-blue)] to-[var(--color-accent-cyan)] text-white font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed">
        {#if submitting}
          <span class="inline-flex items-center gap-2">
            <span class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            Submitting...
          </span>
        {:else if !hasFingerprintData}
          ⏳ Waiting for fingerprint capture...
        {:else}
          🤝 Contribute Fingerprint
        {/if}
      </button>
    </div>
  </form>
{/if}

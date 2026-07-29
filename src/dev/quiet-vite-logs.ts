/**
 * Drops Vite's HMR client chatter ("[vite] connecting...", "[vite] connected.",
 * "[vite] hot updated: ...") from the browser console, so app logs aren't buried
 * in it.
 *
 * Vite emits these from its injected client and exposes no config switch for
 * them — `logLevel` in vite.config only governs terminal output. Patching
 * console.log is the available lever.
 *
 * Dev only, and narrow: it filters a single-argument call whose string starts
 * with "[vite]" and nothing else. Warnings and errors are untouched, so a real
 * HMR problem still surfaces.
 */
if (import.meta.env.DEV) {
  const original = console.log.bind(console);
  console.log = (...args: unknown[]) => {
    if (args.length === 1 && typeof args[0] === 'string' && args[0].startsWith('[vite]')) return;
    original(...args);
  };
}

export {};

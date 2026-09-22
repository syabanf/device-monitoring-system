import * as React from 'react';

/**
 * Catches a crash anywhere under the providers. Without it React unmounts the whole tree and the
 * visitor sees an empty page with no way out; with it they get the error and a reset that clears
 * what the app stored in this browser.
 */
export class AppErrorBoundary extends React.Component<{ onReset: () => void; children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('The app crashed while rendering', error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="flex min-h-dvh items-center justify-center bg-surface p-6">
        <div className="w-full max-w-sm rounded-[24px] bg-white p-6 text-center shadow-card">
          <p className="text-lg font-bold">Something went wrong</p>
          <p className="mt-2 text-sm text-muted">The page stopped while loading. Signing out clears what this browser stored and usually fixes it.</p>
          <pre className="mt-4 max-h-24 overflow-auto rounded-xl bg-surface p-3 text-left text-[11px] text-muted">{this.state.error.message}</pre>
          <button type="button" onClick={this.props.onReset} className="mt-5 h-11 w-full rounded-full bg-ink text-sm font-semibold text-white">Sign out and reload</button>
        </div>
      </div>
    );
  }
}

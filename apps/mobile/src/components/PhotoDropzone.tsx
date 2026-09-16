import * as React from 'react';
import { Camera, Check, ImagePlus, LoaderCircle, X } from 'lucide-react';
import { cn } from '@monitoring/ui';
import { ApiError } from '@monitoring/api-client';
import { apiClient } from '../state/client';

/**
 * Uploads each picture to the API and keeps the paths it answers with, which is what an alert
 * response and a finished ticket store. The previews read the same paths back.
 */
export function PhotoDropzone({ urls, onChange, onBusyChange }: { urls: string[]; onChange: (urls: string[]) => void; onBusyChange?: (busy: boolean) => void }) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const cameraRef = React.useRef<HTMLInputElement>(null);
  const [progress, setProgress] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const add = async (files: FileList | null) => {
    if (!files) return;
    const accepted = Array.from(files).filter((f) => f.type.startsWith('image/')).slice(0, Math.max(0, 4 - urls.length));
    if (!accepted.length) return;
    setError(null);
    setProgress(0);
    onBusyChange?.(true);
    try {
      const next = [...urls];
      for (let i = 0; i < accepted.length; i++) {
        const uploaded = await apiClient.upload(accepted[i]!);
        next.push(uploaded.url);
        setProgress(Math.round(((i + 1) / accepted.length) * 100));
      }
      onChange(next);
      window.setTimeout(() => setProgress(null), 800);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'A photo could not be uploaded. Please try another image.');
      setProgress(null);
    } finally {
      onBusyChange?.(false);
    }
  };
  const remove = (u: string) => onChange(urls.filter((x) => x !== u));
  const busy = progress != null && progress < 100;

  return (
    <div>
      <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={(e) => { void add(e.target.files); e.target.value = ''; }} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { void add(e.target.files); e.target.value = ''; }} />
      {urls.length ? <div className="mb-3 grid grid-cols-3 gap-2">{urls.map((u) => <div key={u} className="relative aspect-square overflow-hidden rounded-2xl bg-surface">
        <img src={apiClient.url(u)} alt="Response evidence" className="size-full object-cover" />
        <span className="absolute bottom-1.5 left-1.5 flex size-6 items-center justify-center rounded-full bg-emerald-500 text-white" aria-label="Photo uploaded"><Check className="size-3.5" /></span>
        <button type="button" onClick={() => remove(u)} className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-ink/80 text-white" aria-label="Remove photo"><X className="size-3.5" /></button>
      </div>)}</div> : null}
      <div className={cn('flex flex-col items-center justify-center gap-3 rounded-[22px] border-2 border-dashed border-silver/70 bg-surface p-6 text-center', (urls.length >= 4 || busy) && 'opacity-60')}>
        <span className="flex size-12 items-center justify-center rounded-full bg-white text-muted shadow-card">{busy ? <LoaderCircle className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}</span>
        <div><p className="text-xs font-semibold text-body" aria-live="polite">{busy ? `Uploading photos · ${progress}%` : urls.length ? `${urls.length} of 4 photos uploaded` : 'Add a photo of the triggered sensor'}</p><p className="mt-1 text-[11px] text-muted">Photos upload now and attach when you submit.</p></div>
        {progress != null ? <div className="h-1.5 w-full max-w-48 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-emerald-500 transition-[width]" style={{ width: `${progress}%` }} /></div> : null}
        <div className="flex gap-2">
          <button type="button" disabled={urls.length >= 4 || busy} onClick={() => cameraRef.current?.click()} className="inline-flex h-10 items-center gap-2 rounded-full bg-ink px-4 text-xs font-semibold text-white disabled:cursor-not-allowed"><Camera className="size-4" />Camera</button>
          <button type="button" disabled={urls.length >= 4 || busy} onClick={() => inputRef.current?.click()} className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-xs font-semibold text-body shadow-card disabled:cursor-not-allowed">Browse Photo</button>
        </div>
      </div>
      {error ? <p role="alert" className="mt-2 text-xs font-medium text-brand-600">{error}</p> : null}
    </div>
  );
}

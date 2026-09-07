import * as React from 'react';
import { Camera, ImagePlus, X } from 'lucide-react';
import { cn } from '@monitoring/ui';

export function PhotoDropzone({ urls, onChange }: { urls: string[]; onChange: (urls: string[]) => void }) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const cameraRef = React.useRef<HTMLInputElement>(null);
  const urlsRef = React.useRef(urls);
  urlsRef.current = urls;
  React.useEffect(() => () => { for (const u of urlsRef.current) if (u.startsWith('blob:')) URL.revokeObjectURL(u); }, []);

  const add = (files: FileList | null) => {
    if (!files) return;
    const next = [...urls];
    for (const f of Array.from(files)) if (f.type.startsWith('image/')) next.push(URL.createObjectURL(f));
    onChange(next.slice(0, 4));
  };
  const remove = (u: string) => { if (u.startsWith('blob:')) URL.revokeObjectURL(u); onChange(urls.filter((x) => x !== u)); };

  return (
    <div>
      <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
      {urls.length ? (
        <div className="mb-3 grid grid-cols-3 gap-2">
          {urls.map((u) => (
            <div key={u} className="relative aspect-square overflow-hidden rounded-2xl bg-surface">
              <img src={u} alt="Proof" className="size-full object-cover" />
              <button type="button" onClick={() => remove(u)} className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-ink/80 text-white" aria-label="Remove photo"><X className="size-3.5" /></button>
            </div>
          ))}
        </div>
      ) : null}
      <div className={cn('flex flex-col items-center justify-center gap-3 rounded-[22px] border-2 border-dashed border-silver/70 bg-surface p-6 text-center', urls.length >= 4 && 'opacity-50')}>
        <span className="flex size-12 items-center justify-center rounded-full bg-white text-muted shadow-card"><ImagePlus className="size-5" /></span>
        <p className="text-xs text-muted">Take a picture at the triggered sensor</p>
        <div className="flex gap-2">
          <button type="button" disabled={urls.length >= 4} onClick={() => cameraRef.current?.click()} className="inline-flex h-10 items-center gap-2 rounded-full bg-ink px-4 text-xs font-semibold text-white"><Camera className="size-4" />Camera</button>
          <button type="button" disabled={urls.length >= 4} onClick={() => inputRef.current?.click()} className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-xs font-semibold text-body shadow-card">Browse Photo</button>
        </div>
      </div>
    </div>
  );
}

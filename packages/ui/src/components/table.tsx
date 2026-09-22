import * as React from 'react';
import { ChevronLeft, ChevronRight, ChevronsUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '../lib/cn';
import { Button } from './button';
import { EmptyState } from './misc';

export const Table = ({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) => (
  <div className="w-full overflow-x-auto" tabIndex={0} role="region" aria-label="Data table. Scroll horizontally to see more columns.">
    <table className={cn('w-full caption-bottom text-sm', className)} {...props} />
  </div>
);
export const THead = ({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <thead className={cn('[&_tr]:border-b', className)} {...props} />
);
export const TBody = ({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <tbody className={cn('[&_tr:last-child]:border-0', className)} {...props} />
);
export const TR = ({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) => (
  <tr className={cn('border-b border-border transition-colors data-[clickable=true]:cursor-pointer data-[clickable=true]:hover:bg-surface-2 data-[clickable=true]:focus-visible:bg-brand-50 data-[clickable=true]:focus-visible:outline data-[clickable=true]:focus-visible:outline-2 data-[clickable=true]:focus-visible:outline-offset-[-2px] data-[clickable=true]:focus-visible:outline-brand-600', className)} {...props} />
);
export const TH = ({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
  <th className={cn('h-10 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted', className)} {...props} />
);
export const TD = ({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
  <td className={cn('px-4 py-3 align-middle', className)} {...props} />
);

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  sortValue?: (row: T) => string | number;
  className?: string;
  headerClassName?: string;
}
export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  onRowClick?: (row: T) => void;
  pageSize?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
  initialSort?: { key: string; dir: 'asc' | 'desc' };
}
export function DataTable<T>({ columns, rows, rowKey, onRowClick, pageSize = 10, emptyTitle = 'No data', emptyDescription, className, initialSort }: DataTableProps<T>) {
  const [page, setPage] = React.useState(0);
  const [sort, setSort] = React.useState<{ key: string; dir: 'asc' | 'desc' } | null>(initialSort ?? null);
  React.useEffect(() => setPage(0), [rows.length]);

  const sorted = React.useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    const sv = col.sortValue;
    return [...rows].sort((a, b) => {
      const va = sv(a), vb = sv(b);
      const r = va < vb ? -1 : va > vb ? 1 : 0;
      return sort.dir === 'asc' ? r : -r;
    });
  }, [rows, sort, columns]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const slice = sorted.slice(safePage * pageSize, safePage * pageSize + pageSize);

  const toggleSort = (key: string) =>
    setSort((s) => (s?.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));

  return (
    <div className={cn('flex flex-col', className)}>
      <Table>
        <THead>
          <tr>
            {columns.map((c) => (
              <TH key={c.key} className={c.headerClassName}>
                {c.sortValue ? (
                  <button type="button" onClick={() => toggleSort(c.key)} className="inline-flex items-center gap-1 rounded-md hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40" aria-label={`Sort by ${typeof c.header === 'string' ? c.header : c.key}`}>
                    {c.header}
                    {sort?.key === c.key ? (sort.dir === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />) : <ChevronsUpDown className="size-3 opacity-50" />}
                  </button>
                ) : (
                  c.header
                )}
              </TH>
            ))}
          </tr>
        </THead>
        <TBody>
          {slice.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>
                <EmptyState title={emptyTitle} description={emptyDescription} />
              </td>
            </tr>
          ) : (
            slice.map((row) => (
              <TR
                key={rowKey(row)}
                data-clickable={!!onRowClick}
                tabIndex={onRowClick ? 0 : undefined}
                aria-label={onRowClick ? `Open row ${rowKey(row)}` : undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={onRowClick ? (event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onRowClick(row);
                  }
                } : undefined}
              >
                {columns.map((c) => (
                  <TD key={c.key} className={c.className}>{c.cell(row)}</TD>
                ))}
              </TR>
            ))
          )}
        </TBody>
      </Table>
      {sorted.length > pageSize ? (
        <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-muted">
          <span>
            {safePage * pageSize + 1}–{Math.min(sorted.length, (safePage + 1) * pageSize)} of {sorted.length}
          </span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="size-8" disabled={safePage === 0} onClick={() => setPage(safePage - 1)} aria-label="Previous page">
              <ChevronLeft />
            </Button>
            <span className="px-2 text-xs">Page {safePage + 1} / {pageCount}</span>
            <Button variant="outline" size="icon" className="size-8" disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)} aria-label="Next page">
              <ChevronRight />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

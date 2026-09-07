import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '../lib/cn';

export const Tabs = TabsPrimitive.Root;

type Variant = 'underline' | 'pill';
const VariantCtx = React.createContext<Variant>('underline');

export const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> & { variant?: Variant }
>(({ className, variant = 'underline', ...props }, ref) => (
  <VariantCtx.Provider value={variant}>
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        'flex items-center',
        variant === 'underline' ? 'w-full overflow-x-auto border-b border-border' : 'w-fit gap-1 rounded-full bg-white p-1 shadow-card',
        className,
      )}
      {...props}
    />
  </VariantCtx.Provider>
));
TabsList.displayName = 'TabsList';

export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => {
  const variant = React.useContext(VariantCtx);
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none disabled:opacity-50',
        variant === 'underline'
          ? '-mb-px border-b-2 border-transparent px-4 py-2.5 text-muted hover:text-foreground data-[state=active]:border-brand-600 data-[state=active]:text-foreground'
          : 'rounded-full px-4 py-1.5 text-muted hover:text-foreground data-[state=active]:bg-ink data-[state=active]:text-white',
        className,
      )}
      {...props}
    />
  );
});
TabsTrigger.displayName = 'TabsTrigger';

export const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content ref={ref} className={cn('mt-4 focus-visible:outline-none', className)} {...props} />
));
TabsContent.displayName = 'TabsContent';

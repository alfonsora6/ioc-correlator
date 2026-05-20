import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
<<<<<<< HEAD
        "flex h-10 w-full rounded-lg border border-subtle px-3 py-2 text-sm text-primary shadow-sm transition placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
        "bg-[rgb(var(--input-bg))]",
=======
        "flex h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
>>>>>>> 8c5e468ad80beef5ded8e7541e371e40ff3162ca
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Input.displayName = "Input";

import * as React from "react";
import { cn } from "@/lib/utils";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
<<<<<<< HEAD
  return <label className={cn("text-sm font-medium text-primary", className)} {...props} />;
=======
  return <label className={cn("text-sm font-medium text-slate-200", className)} {...props} />;
>>>>>>> 8c5e468ad80beef5ded8e7541e371e40ff3162ca
}

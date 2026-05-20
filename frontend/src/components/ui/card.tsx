import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
<<<<<<< HEAD
  return <div className={cn("glass p-5", className)} {...props} />;
=======
  return <div className={cn("glass rounded-xl p-5", className)} {...props} />;
>>>>>>> 8c5e468ad80beef5ded8e7541e371e40ff3162ca
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-3", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
<<<<<<< HEAD
  return <h3 className={cn("text-lg font-semibold tracking-tight text-primary", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("text-sm text-secondary", className)} {...props} />;
=======
  return <h3 className={cn("text-lg font-semibold tracking-tight", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("text-sm text-slate-200", className)} {...props} />;
>>>>>>> 8c5e468ad80beef5ded8e7541e371e40ff3162ca
}

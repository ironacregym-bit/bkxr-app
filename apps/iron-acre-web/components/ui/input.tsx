import * as React from "react";
import { cn } from "../../lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

export function Input({
  className,
  ...props
}: InputProps) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-orange-700",
        className
      )}
      {...props}
    />
  );
}

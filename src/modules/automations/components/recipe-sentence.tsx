import { cn } from "@/lib/utils";

/** A recipe sentence with its `**trigger**` and `**actions**` drawn as Monday-style chips. */
export function RecipeSentence({ text, muted = false, className }: { text: string; muted?: boolean; className?: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return <p className={cn("text-sm leading-7", muted && "text-muted-foreground", className)}>
    {parts.map((part, index) => index % 2
      ? <strong key={index} className={cn("mx-0.5 inline rounded-md px-1.5 py-0.5 font-semibold [box-decoration-break:clone]",
        index === 1 ? "bg-brand-soft text-foreground" : "bg-muted text-foreground")}>{part}</strong>
      : <span key={index}>{part}</span>)}
  </p>;
}

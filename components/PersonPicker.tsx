"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Person } from "@/lib/types";
import { useState } from "react";

type Props = {
  people: Person[];
  selected: string[];
  onChange: (ids: string[]) => void;
  onToggleFavorite: (id: string, favorite: boolean) => void;
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export default function PersonPicker({
  people,
  selected,
  onChange,
  onToggleFavorite,
}: Props) {
  const [query, setQuery] = useState("");

  if (people.length === 0) {
    return (
      <div className="rounded-2xl border border-nexus-border bg-nexus-card p-6 text-center text-sm text-white/50">
        No other accounts yet. The administrator adds people.
      </div>
    );
  }

  const filtered = people.filter((p) =>
    p.displayName.toLowerCase().includes(query.toLowerCase())
  );

  function toggle(id: string) {
    onChange(
      selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]
    );
  }

  return (
    <div>
      {people.length > 6 && (
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search people"
          className="w-full mb-3 bg-nexus-card border border-nexus-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-nexus-green"
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {filtered.map((person) => {
          const active = selected.includes(person.id);
          return (
            <div
              key={person.id}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors",
                active
                  ? "border-nexus-green bg-nexus-green/10"
                  : "border-nexus-border bg-nexus-card hover:border-white/20"
              )}
            >
              <button
                type="button"
                onClick={() => toggle(person.id)}
                className="flex items-center gap-3 flex-1 min-w-0 text-left"
              >
                <span className="relative shrink-0">
                  <span
                    className={cn(
                      "w-9 h-9 rounded-full grid place-items-center text-xs font-bold",
                      active ? "bg-nexus-green text-black" : "bg-white/10 text-white"
                    )}
                  >
                    {initials(person.displayName)}
                  </span>
                  <span
                    className={cn(
                      "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-nexus-card",
                      person.online ? "bg-nexus-green" : "bg-white/25"
                    )}
                  />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium truncate">
                    {person.displayName}
                  </span>
                  <span className="block text-[11px] text-white/40">
                    {person.online ? "Online" : "Offline"}
                    {person.isAdmin ? " · Admin" : ""}
                  </span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => onToggleFavorite(person.id, !person.favorite)}
                aria-label={person.favorite ? "Remove favorite" : "Add favorite"}
                className="p-1.5 rounded-lg hover:bg-white/10"
              >
                <Star
                  className={cn(
                    "w-4 h-4",
                    person.favorite ? "text-nexus-green fill-nexus-green" : "text-white/30"
                  )}
                />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Person } from "@/lib/types";
import { useState } from "react";
import Avatar from "./Avatar";

type Props = {
  people: Person[];
  selected: string[];
  onChange: (ids: string[]) => void;
  onToggleFavorite: (id: string, favorite: boolean) => void;
};

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
        No other accounts yet.
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
      {/* Mobile: avatar rail, like LocalSend */}
      <div className="md:hidden">
        <div className="-mx-4 px-4 flex gap-4 overflow-x-auto pb-1 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {filtered.map((person) => {
            const active = selected.includes(person.id);
            return (
              <div key={person.id} className="flex flex-col items-center gap-1.5 shrink-0 w-[62px]">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => toggle(person.id)}
                    aria-pressed={active}
                    className={cn(
                      "relative w-14 h-14 rounded-full overflow-hidden grid place-items-center text-sm font-bold",
                      "transition-all duration-200 press",
                      active
                        ? "ring-2 ring-nexus-green ring-offset-2 ring-offset-black scale-105"
                        : ""
                    )}
                  >
                    <Avatar
                      name={person.displayName}
                      userId={person.id}
                      updatedAt={person.avatarUpdatedAt}
                      size={56}
                      textClassName="text-white/90"
                    />
                    <span
                      className={cn(
                        "absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-black",
                        person.online ? "bg-nexus-green" : "bg-white/25"
                      )}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleFavorite(person.id, !person.favorite)}
                    aria-label={person.favorite ? "Remove favorite" : "Add favorite"}
                    className="absolute -top-1 -right-1 w-6 h-6 grid place-items-center rounded-full bg-black"
                  >
                    <Star
                      className={cn(
                        "w-3.5 h-3.5",
                        person.favorite
                          ? "text-nexus-green fill-nexus-green"
                          : "text-white/30"
                      )}
                    />
                  </button>
                </div>
                <span
                  className={cn(
                    "text-[11px] leading-tight text-center truncate w-full",
                    active ? "text-nexus-green font-semibold" : "text-white/60"
                  )}
                >
                  {person.displayName.split(" ")[0]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Desktop: list */}
      <div className="hidden md:block">
        {people.length > 6 && (
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people"
            className="w-full mb-3 bg-nexus-card border border-nexus-border rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-nexus-green transition-colors"
          />
        )}

        <div className="grid grid-cols-2 gap-2 stagger">
          {filtered.map((person) => {
            const active = selected.includes(person.id);
            return (
              <div
                key={person.id}
                className={cn(
                  "lift flex items-center gap-3 rounded-xl border px-3 py-2.5",
                  active
                    ? "border-nexus-green bg-nexus-green/10 glow-green"
                    : "border-nexus-border bg-nexus-card"
                )}
              >
                <button
                  type="button"
                  onClick={() => toggle(person.id)}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left"
                >
                  <span className="relative shrink-0">
                    <Avatar
                      name={person.displayName}
                      userId={person.id}
                      updatedAt={person.avatarUpdatedAt}
                      size={36}
                      className={cn(
                        "transition-all duration-200",
                        active && "ring-2 ring-nexus-green"
                      )}
                    />
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
                  className="p-1.5 rounded-lg hover:bg-white/10 press"
                >
                  <Star
                    className={cn(
                      "w-4 h-4 transition-transform duration-200 hover:scale-125",
                      person.favorite
                        ? "text-nexus-green fill-nexus-green"
                        : "text-white/30"
                    )}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

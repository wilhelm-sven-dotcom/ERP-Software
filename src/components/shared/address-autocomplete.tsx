"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface AddressParts {
  street: string;
  zip: string;
  city: string;
}

interface NominatimResult {
  display_name: string;
  address: {
    road?: string;
    house_number?: string;
    postcode?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    suburb?: string;
  };
}

/**
 * Straßen-Eingabe mit Adress-Vorschlägen über OpenStreetMap/Nominatim (kostenlos).
 * Bei Auswahl eines Vorschlags werden Straße+Hausnr, PLZ und Ort über onSelect
 * an das Formular zurückgegeben. Die Felder bleiben frei editierbar.
 *
 * Nominatim-Nutzungsregeln: max. 1 Request/Sekunde → hier per Debounce (450 ms)
 * und nur ab 3 Zeichen. Quelle ist hier gekapselt (spaeter austauschbar).
 */
export function AddressAutocomplete({
  id,
  name,
  value,
  onChange,
  onSelect,
  placeholder,
}: {
  id?: string;
  name?: string;
  value: string;
  onChange: (street: string) => void;
  onSelect: (parts: AddressParts) => void;
  placeholder?: string;
}) {
  const [results, setResults] = React.useState<NominatimResult[]>([]);
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const boxRef = React.useRef<HTMLDivElement>(null);
  const skipNextSearch = React.useRef(false);

  // Debounced Suche
  React.useEffect(() => {
    if (skipNextSearch.current) {
      skipNextSearch.current = false;
      return;
    }
    const q = value.trim();
    if (q.length < 3) {
      setResults([]);
      setOpen(false);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const url =
          "https://nominatim.openstreetmap.org/search?format=jsonv2" +
          "&addressdetails=1&countrycodes=de&limit=5&q=" +
          encodeURIComponent(q);
        const res = await fetch(url, {
          signal: ctrl.signal,
          headers: { "Accept-Language": "de" },
        });
        if (res.ok) {
          const data = (await res.json()) as NominatimResult[];
          setResults(data);
          setOpen(data.length > 0);
          setActiveIndex(-1);
        }
      } catch {
        /* abgebrochen oder offline – still ignorieren */
      } finally {
        setLoading(false);
      }
    }, 450);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [value]);

  // Klick außerhalb schließt die Liste
  React.useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function choose(r: NominatimResult) {
    const a = r.address;
    const street = [a.road, a.house_number].filter(Boolean).join(" ");
    const city = a.city || a.town || a.village || a.municipality || a.suburb || "";
    skipNextSearch.current = true;
    onSelect({ street: street || value, zip: a.postcode ?? "", city });
    setOpen(false);
    setResults([]);
  }

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <Input
          id={id}
          name={name}
          value={value}
          autoComplete="off"
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (!open || results.length === 0) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveIndex((i) => Math.min(i + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIndex((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter" && activeIndex >= 0) {
              e.preventDefault();
              choose(results[activeIndex]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
        />
        {loading ? (
          <Loader2 className="text-muted-foreground absolute top-1/2 right-2 size-4 -translate-y-1/2 animate-spin" />
        ) : null}
      </div>

      {open && results.length > 0 ? (
        <ul className="bg-popover absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border shadow-md">
          {results.map((r, i) => (
            <li key={r.display_name + i}>
              <button
                type="button"
                onClick={() => choose(r)}
                onMouseEnter={() => setActiveIndex(i)}
                className={cn(
                  "block w-full px-3 py-2 text-left text-sm",
                  i === activeIndex
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-accent/50",
                )}
              >
                {r.display_name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

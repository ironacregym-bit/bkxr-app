import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface AccordionItemProps {
  title: string;
  children: React.ReactNode;
}

export function AccordionItem({
  title,
  children,
}: AccordionItemProps) {
  const [open, setOpen] =
    useState(false);

  return (
    <div
      className="
        border-b
        border-[#2e3a2f]
        py-4
      "
    >
      <button
        type="button"
        onClick={() =>
          setOpen(!open)
        }
        className="
          flex
          w-full
          items-center
          justify-between
          text-left
          font-semibold
          text-white
        "
      >
        {title}

        <ChevronDown
          className={`
            h-5
            w-5
            transition-transform
            ${
              open
                ? "rotate-180"
                : ""
            }
          `}
        />
      </button>

      {open && (
        <div
          className="
            mt-4
            text-[#a3ad9f]
          "
        >
          {children}
        </div>
      )}
    </div>
  );
}

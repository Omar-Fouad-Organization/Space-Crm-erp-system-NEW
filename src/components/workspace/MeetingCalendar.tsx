import { useState } from "react";
import { Button } from "@/components/ui/button";
export function MeetingCalendar({
  meetings,
  onOpen,
}: {
  meetings: any[];
  onOpen: (meeting: any) => void;
}) {
  const [month, setMonth] = useState(() =>
    new Date().toISOString().slice(0, 7),
  );
  const first = new Date(month + "-01T12:00:00");
  const count = new Date(
    first.getFullYear(),
    first.getMonth() + 1,
    0,
  ).getDate();
  const shift = (n: number) => {
    const d = new Date(first.getFullYear(), first.getMonth() + n, 1, 12);
    setMonth(d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"));
  };
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => shift(-1)}>
          Previous Month
        </Button>
        <input
          aria-label="Calendar month"
          onInput={(e) => {
            if (e.currentTarget.value) setMonth(e.currentTarget.value);
          }}
          type="month"
          value={month}
          onChange={(e) => {
            if (e.target.value) setMonth(e.target.value);
          }}
        />
        <Button variant="outline" onClick={() => shift(1)}>
          Next Month
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((x) => (
          <div key={x} className="font-medium">
            {x}
          </div>
        ))}
        {Array.from({ length: first.getDay() }, (_, i) => (
          <div key={"pad" + i} />
        ))}
        {Array.from({ length: count }, (_, i) => {
          const day = month + "-" + String(i + 1).padStart(2, "0");
          return (
            <div key={day} className="min-h-24 border rounded p-2">
              <span>{i + 1}</span>
              {meetings
                .filter((m) => (m.date || m.meeting_date) === day)
                .map((m) => (
                  <Button
                    key={m.id}
                    variant="ghost"
                    className="w-full h-auto whitespace-normal justify-start text-left text-xs"
                    onClick={() => onOpen(m)}
                  >
                    {m.time} {m.title}
                  </Button>
                ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

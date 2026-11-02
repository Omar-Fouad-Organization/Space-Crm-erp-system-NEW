import { Button } from "@/components/ui/button";
export function PageControls({
  page,
  total,
  last,
  onPage,
}: {
  page: number;
  total: number;
  last: number;
  onPage: (page: number) => void;
}) {
  if (last <= 1) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
      <p className="text-sm text-muted-foreground">
        Page {page} of {last} · {total} matching records. Metrics, pipeline, and
        exports reflect the current page.
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          Previous Page
        </Button>
        <Button
          variant="outline"
          disabled={page >= last}
          onClick={() => onPage(page + 1)}
        >
          Next Page
        </Button>
      </div>
    </div>
  );
}

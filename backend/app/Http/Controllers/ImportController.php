<?php
namespace App\Http\Controllers;
use App\Services\CrmService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
class ImportController extends Controller
{
    public function __construct(private CrmService $crm) {}
    public function clients(Request $r)
    {
        $this->crm->authorize("clients", $r->user(), true);
        $v = $r->validate([
            "csv" => "required|string|max:200000",
            "commit" => "nullable|boolean",
        ]);
        $stream = fopen("php://temp", "r+");
        fwrite($stream, preg_replace('/^\xEF\xBB\xBF/', "", $v["csv"]));
        rewind($stream);
        $header = fgetcsv($stream, 0, ",", '"', "");
        $required = ["name", "contact_person", "email"];
        abort_unless(
            $header &&
                count($header) === count(array_unique($header)) &&
                !array_diff($required, $header),
            422,
            "CSV requires unique name, contact_person, email headers.",
        );
        $allowed = [
            "name",
            "contact_person",
            "email",
            "phone",
            "industry",
            "address",
            "notes",
            "type",
            "status",
        ];
        abort_if(
            array_diff($header, $allowed),
            422,
            "CSV contains unsupported columns.",
        );
        $rows = [];
        $seen = [];
        $line = 1;
        while (($cells = fgetcsv($stream, 0, ",", '"', "")) !== false) {
            $line++;
            if ($cells === [null]) {
                continue;
            }
            abort_if(
                count($rows) >= 500,
                422,
                "Import at most 500 clients per batch.",
            );
            $errors = [];
            $data = [];
            if (count($cells) !== count($header)) {
                $errors[] = "Column count differs from header.";
            } else {
                $data = array_combine($header, array_map("trim", $cells));
                $data["email"] = strtolower($data["email"]);
                $data["type"] = $data["type"] ?? "exhibitor";
                $data["status"] = $data["status"] ?? "prospect";
                $validator = Validator::make($data, [
                    "name" => "required|string|max:255",
                    "contact_person" => "required|string|max:255",
                    "email" => "required|email|max:255",
                    "phone" => "nullable|string|max:255",
                    "industry" => "nullable|string|max:255",
                    "address" => "nullable|string|max:50000",
                    "notes" => "nullable|string|max:50000",
                    "type" => "required|in:exhibitor,sponsor,sector_sponsor",
                    "status" =>
                        "required|in:active,inactive,prospect,interested,not_interested",
                ]);
                $errors = $validator->errors()->all();
                $key = strtolower($data["email"]);
                if (isset($seen[$key])) {
                    $errors[] = "Duplicate email in this batch.";
                }
                $seen[$key] = true;
                if (
                    DB::table("clients")
                        ->whereRaw("LOWER(email)=?", [$key])
                        ->orWhereRaw("LOWER(name)=?", [
                            strtolower($data["name"]),
                        ])
                        ->exists()
                ) {
                    $errors[] =
                        "An existing client matches this email or company name.";
                }
            }
            $rows[] = ["line" => $line, "data" => $data, "errors" => $errors];
        }
        fclose($stream);
        abort_unless(count($rows), 422, "CSV contains no client rows.");
        $valid = !collect($rows)->contains(
            fn($row) => count($row["errors"]) > 0,
        );
        if (!empty($v["commit"])) {
            abort_unless(
                $valid,
                422,
                "Resolve all preview errors before importing.",
            );
            return DB::transaction(function () use ($rows, $r) {
                $ids = [];
                foreach ($rows as $row) {
                    $ids[] = $this->crm->save(
                        "clients",
                        $row["data"],
                        $r->user(),
                    )["id"];
                }
                return ["imported" => count($ids), "ids" => $ids];
            });
        }
        return ["valid" => $valid, "rows" => $rows];
    }
}

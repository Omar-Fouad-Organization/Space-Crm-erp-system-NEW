<?php
namespace App\Console\Commands;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Symfony\Component\Process\Process;
class CrmBackup extends Command
{
    protected $signature = "crm:backup {--verify= : Restore an existing backup into space_crm_restore_check only}";
    protected $description = "Back up MySQL and private files, or verify a backup in an isolated recovery database";
    public function handle(): int
    {
        $db = config("database.connections.mysql");
        if ($this->option("verify") && env("CRM_RESTORE_USERNAME")) {
            $db["username"] = env("CRM_RESTORE_USERNAME");
            $db["password"] = env("CRM_RESTORE_PASSWORD");
            config(["database.connections.mysql" => $db]);
            DB::purge("mysql");
        }
        $dir = storage_path("app/crm-backups");
        if (!is_dir($dir)) {
            mkdir($dir, 0700, true);
        }
        $args = [
            "--host=" . $db["host"],
            "--port=" . $db["port"],
            "--user=" . $db["username"],
            "--default-character-set=utf8mb4",
        ];
        $env = ["MYSQL_PWD" => $db["password"]];
        if ($file = $this->option("verify")) {
            $file = realpath($file);
            if (
                !$file ||
                !str_starts_with($file, realpath($dir) . DIRECTORY_SEPARATOR)
            ) {
                $this->error(
                    "Choose an existing backup inside the private backup directory.",
                );
                return 1;
            }
            $zip = new \ZipArchive();
            if ($zip->open($file) !== true) {
                $this->error("Cannot read backup.");
                return 1;
            }
            $sql = $zip->getFromName("database.sql");
            $manifest = json_decode($zip->getFromName("manifest.json"), true);
            if (
                !$sql ||
                !$manifest ||
                hash("sha256", $sql) !== $manifest["sha256"]
            ) {
                $zip->close();
                $this->error("Backup checksum failed.");
                return 1;
            }
            // Never accept an arbitrary destination or import USE/CREATE/DROP DATABASE statements.
            if (
                preg_match(
                    "/^\s*(?:USE\s|(?:CREATE|DROP)\s+DATABASE\s)/mi",
                    $sql,
                )
            ) {
                throw new \RuntimeException("Unsafe database-switching SQL.");
            }
            $target = "space_crm_restore_check";
            abort_if($db["database"] === $target, 422);
            DB::statement(
                "CREATE DATABASE IF NOT EXISTS `" .
                    $target .
                    "` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
            );
            $p = new Process(
                [env("MYSQL_BINARY", "mysql"), ...$args, $target],
                null,
                $env,
                $sql,
                300,
            );
            $p->mustRun();
            $counts = [];
            foreach ($manifest["counts"] as $table => $count) {
                if (!preg_match('/^[a-zA-Z0-9_]+$/', $table)) {
                    throw new \RuntimeException("Invalid manifest.");
                }
                $actual = DB::selectOne(
                    "SELECT COUNT(*) AS n FROM `" .
                        $target .
                        "`.`" .
                        $table .
                        "`",
                )->n;
                if ((int) $actual !== (int) $count) {
                    throw new \RuntimeException(
                        "Recovery row count mismatch: " . $table,
                    );
                }
                $counts[$table] = (int) $actual;
            }
            $keys = DB::table("information_schema.KEY_COLUMN_USAGE")
                ->where("CONSTRAINT_SCHEMA", $target)
                ->whereNotNull("REFERENCED_TABLE_NAME")
                ->get();
            foreach ($keys as $k) {
                $bad = DB::selectOne(
                    "SELECT COUNT(*) n FROM `$target`.`$k->TABLE_NAME` c LEFT JOIN `$target`.`$k->REFERENCED_TABLE_NAME` p ON c.`$k->COLUMN_NAME`=p.`$k->REFERENCED_COLUMN_NAME` WHERE c.`$k->COLUMN_NAME` IS NOT NULL AND p.`$k->REFERENCED_COLUMN_NAME` IS NULL",
                )->n;
                if ($bad) {
                    throw new \RuntimeException(
                        "Recovered foreign key check failed.",
                    );
                }
            }
            $restore = $dir . DIRECTORY_SEPARATOR . "restore-check";
            if (!is_dir($restore)) {
                mkdir($restore, 0700, true);
            }
            $verified = 0;
            foreach ($manifest["files"] as $name => $hash) {
                if (
                    str_contains($name, "..") ||
                    str_starts_with($name, "/") ||
                    str_contains($name, ":")
                ) {
                    throw new \RuntimeException("Unsafe archive path.");
                }
                $bytes = $zip->getFromName("files/" . $name);
                if ($bytes === false || hash("sha256", $bytes) !== $hash) {
                    throw new \RuntimeException("Attachment checksum failed.");
                }
                $path = $restore . DIRECTORY_SEPARATOR . $name;
                if (!is_dir(dirname($path))) {
                    mkdir(dirname($path), 0700, true);
                }
                file_put_contents($path, $bytes);
                $verified++;
            }
            $zip->close();
            $this->line(
                json_encode([
                    "database" => $target,
                    "tables" => count($counts),
                    "foreign_keys" => $keys->count(),
                    "files" => $verified,
                    "verified" => true,
                ]),
            );
            return 0;
        }
        $p = new Process(
            [
                env("MYSQLDUMP_BINARY", "mysqldump"),
                ...$args,
                "--single-transaction",
                "--skip-lock-tables",
                "--no-tablespaces",
                "--set-gtid-purged=OFF",
                "--hex-blob",
                "--skip-extended-insert",
                $db["database"],
            ],
            null,
            $env,
            null,
            300,
        );
        $p->mustRun();
        $sql = $p->getOutput();
        $counts = [];
        foreach (DB::select("SHOW TABLES") as $row) {
            $table = array_values((array) $row)[0];
            $counts[$table] = preg_match_all(
                "/^INSERT INTO `" . preg_quote($table, "/") . "` VALUES /m",
                $sql,
            );
        }
        $path =
            $dir .
            DIRECTORY_SEPARATOR .
            "crm-" .
            now()->format("Ymd-His") .
            "-" .
            bin2hex(random_bytes(3)) .
            ".zip";
        $zip = new \ZipArchive();
        if (
            $zip->open($path, \ZipArchive::CREATE | \ZipArchive::EXCL) !== true
        ) {
            throw new \RuntimeException("Cannot create backup.");
        }
        $zip->addFromString("database.sql", $sql);
        $files = [];
        $root = storage_path("app/private");
        if (is_dir($root)) {
            foreach (
                new \RecursiveIteratorIterator(
                    new \RecursiveDirectoryIterator(
                        $root,
                        \FilesystemIterator::SKIP_DOTS,
                    ),
                )
                as $file
            ) {
                if (!$file->isFile() || $file->isLink()) {
                    continue;
                }
                $name = str_replace(
                    "\\",
                    "/",
                    substr($file->getPathname(), strlen($root) + 1),
                );
                $bytes = file_get_contents($file->getPathname());
                $files[$name] = hash("sha256", $bytes);
                $zip->addFromString("files/" . $name, $bytes);
            }
        }
        $zip->addFromString(
            "manifest.json",
            json_encode(
                [
                    "database" => $db["database"],
                    "created_at" => now()->toIso8601String(),
                    "sha256" => hash("sha256", $sql),
                    "counts" => $counts,
                    "files" => $files,
                ],
                JSON_PRETTY_PRINT,
            ),
        );
        $zip->close();
        @chmod($path, 0600);
        $this->line($path);
        return 0;
    }
}

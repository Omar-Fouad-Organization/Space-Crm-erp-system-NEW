<?php
namespace Database\Seeders;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
class DatabaseSeeder extends Seeder {
    public function run(): void {
        if (!DB::table('users')->exists()) {
            $password=env('CRM_ADMIN_PASSWORD');
            if (!$password || strlen($password)<12) throw new \RuntimeException('Set CRM_ADMIN_PASSWORD (at least 12 characters) before seeding.');
            DB::table('users')->insert(['name'=>'SPACE Administrator','email'=>env('CRM_ADMIN_EMAIL','admin@space.test'),'password'=>Hash::make($password),'role'=>'super_admin','status'=>'active','created_at'=>now(),'updated_at'=>now()]);
        }
        DB::table('settings')->insertOrIgnore(['id'=>1,'company_name'=>'SPACE Organizing','currency'=>'EGP','created_at'=>now(),'updated_at'=>now()]);
    }
}

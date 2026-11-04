<?php
use App\Http\Controllers\CrmController;
use App\Http\Controllers\SessionController;
use App\Http\Middleware\CrmAuthenticated;
use Illuminate\Support\Facades\Route;
Route::prefix('api')->group(function () {
    Route::post('password/forgot',[\App\Http\Controllers\SecurityController::class,'forgot'])->middleware('throttle:3,1,crm-recovery');
    Route::post('password/reset',[\App\Http\Controllers\SecurityController::class,'reset'])->middleware('throttle:5,1,crm-reset');
    Route::get('session',[SessionController::class,'show']);
    Route::post('login',[SessionController::class,'login'])->middleware('throttle:5,1');
    Route::post('logout',[SessionController::class,'logout'])->middleware(CrmAuthenticated::class);
    Route::middleware([CrmAuthenticated::class,\App\Http\Middleware\AuthorizeOperation::class,'throttle:300,1,crm-api'])->group(function () {
        $authorization=\App\Http\Controllers\AuthorizationController::class;
        Route::get('authorization/me',[$authorization,'me']);
        Route::get('authorization/registry',[$authorization,'catalog']);
        Route::get('authorization/users/{id}',[$authorization,'show']);
        Route::put('authorization/users/{id}',[$authorization,'update'])->middleware('throttle:10,1,authorization-change');
        Route::post('exports/records/{resource}',[\App\Http\Controllers\ExportController::class,'records'])->middleware('throttle:10,1,crm-export');
        Route::post('exports/report',[\App\Http\Controllers\ExportController::class,'report'])->middleware('throttle:10,1,crm-export');
        $cms=\App\Http\Controllers\WebsiteCmsController::class;
        Route::get('website-cms/sites',[$cms,'sites']);
        Route::post('website-cms/{site}/resources/{resource}',[$cms,'query'])->middleware('throttle:240,1,website-cms');
        Route::post('website-cms/{site}/uploads',[$cms,'upload'])->middleware('throttle:20,1,website-cms-upload');
        $workspace=\App\Http\Controllers\WorkspaceController::class;
        Route::get('workspace/search',[$workspace,'search']);
        Route::get('workspace/cash-movements',[$workspace,'cashMovements']);Route::get('workspace/backup-status',[$workspace,'backupStatus']);Route::post('workspace/backup',[$workspace,'backup'])->middleware('throttle:2,1,crm-backup');
        Route::get('workspace/floorplan',[$workspace,'floorplan']);Route::put('workspace/floorplan',[$workspace,'layout']);
        Route::get('workspace/finance',[$workspace,'finance']);
        Route::get('workspace/requests',[$workspace,'requests']);Route::post('workspace/requests',[$workspace,'request']);Route::post('workspace/requests/{id}/review',[$workspace,'review']);
        Route::get('workspace/collections',[$workspace,'collections']);Route::post('workspace/collection-notes',[$workspace,'collectionNote']);
        Route::get('workspace/timeline/{resource}/{id}',[$workspace,'timeline']);Route::get('workspace/audit',[$workspace,'audit']);
        Route::get('workspace/expenses',[$workspace,'expenses']);Route::post('workspace/expenses',[$workspace,'expense']);Route::get('workspace/profitability',[$workspace,'profitability']);
        Route::get('workspace/reminders',[$workspace,'reminders']);Route::post('workspace/reminders',[$workspace,'reminder']);Route::post('workspace/reminders/{id}/cancel',[$workspace,'cancelReminder']);Route::post('workspace/reminders/run',[$workspace,'runReminders']);
        Route::post('workspace/reservations/{id}',[$workspace,'reservation']);Route::get('workspace/access',[$workspace,'accessSettings']);Route::put('workspace/access/{id}',[$workspace,'setAccess']);Route::post('workspace/teams',[$workspace,'team']);
        Route::post('workspace/import/clients',[\App\Http\Controllers\ImportController::class,'clients']);
        $security=\App\Http\Controllers\SecurityController::class;Route::get('security',[$security,'show']);Route::post('security/enroll',[$security,'enroll'])->middleware('throttle:5,1,security-enroll');Route::post('security/confirm',[$security,'confirm'])->middleware('throttle:5,1,security-confirm');Route::post('security/disable',[$security,'disable'])->middleware('throttle:5,1,security-disable');Route::post('security/revoke',[$security,'revoke'])->middleware('throttle:5,1,security-revoke');
        Route::get('metadata',[CrmController::class,'metadata']);
        Route::get('dashboard',[CrmController::class,'dashboard']);
        Route::get('diagnostics',[CrmController::class,'diagnostics']);
        Route::get('exhibitors',[CrmController::class,'exhibitors']);
        Route::get('audit',[CrmController::class,'audit']);
        Route::get('notifications',[CrmController::class,'notifications']);
        Route::patch('notifications/read-all',[CrmController::class,'readAllNotifications']);
        Route::patch('notifications/{id}',[CrmController::class,'readNotification']);
        Route::put('settings',[CrmController::class,'settings']);
        Route::post('documents/{document}/attachments',[CrmController::class,'upload']);
        Route::get('attachments/{id}',[CrmController::class,'download']);
        Route::delete('attachments/{id}',[CrmController::class,'deleteAttachment']);
        Route::get('records/{resource}',[CrmController::class,'index']);
        Route::get('records/{resource}/{id}',[CrmController::class,'show']);
        Route::post('records/{resource}',[CrmController::class,'store']);
        Route::put('records/{resource}/{id}',[CrmController::class,'update']);
        Route::delete('records/{resource}/{id}',[CrmController::class,'destroy']);
    });
});

// Dedicated controller enforces module + action + exhibition + record scope.
Route::prefix('api/intake')->middleware([CrmAuthenticated::class,'throttle:120,1,intake-staff'])->group(function(){
    $c=\App\Http\Controllers\IntakeController::class;
    Route::get('submissions',[$c,'index']);Route::get('submissions/{id}',[$c,'show'])->whereNumber('id');
    Route::get('submissions/{id}/staff',[$c,'staff'])->whereNumber('id');Route::post('submissions/{id}',[$c,'update'])->whereNumber('id');
    Route::get('organizations',[$c,'organizations']);Route::post('export',[$c,'export'])->middleware('throttle:5,1,intake-export');
    Route::get('controls',[$c,'controls']);Route::put('controls',[$c,'saveControls']);
    Route::get('deliveries',[$c,'deliveries']);Route::post('replay',[$c,'replay']);Route::post('reconcile',[$c,'reconcile']);
});

<?php
use App\Http\Controllers\CrmController;
use App\Http\Controllers\SessionController;
use App\Http\Middleware\CrmAuthenticated;
use Illuminate\Support\Facades\Route;
Route::prefix('api')->group(function () {
    Route::get('session',[SessionController::class,'show']);
    Route::post('login',[SessionController::class,'login'])->middleware('throttle:5,1');
    Route::post('logout',[SessionController::class,'logout'])->middleware(CrmAuthenticated::class);
    Route::middleware([CrmAuthenticated::class,'throttle:300,1'])->group(function () {
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

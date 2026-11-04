<?php
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\IntakeReceiverController;
Route::prefix('internal/intake')->middleware([\App\Http\Middleware\AuthenticateIntake::class,'throttle:180,1,intake-service'])->group(function(){
    Route::post('accept',[IntakeReceiverController::class,'accept']);
    Route::post('controls',[IntakeReceiverController::class,'controls']);
    Route::post('status',[IntakeReceiverController::class,'status']);
});

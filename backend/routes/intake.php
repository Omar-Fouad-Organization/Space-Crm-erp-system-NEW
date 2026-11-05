<?php
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\IntakeReceiverController;
Route::prefix('internal/intake')->middleware([\App\Http\Middleware\AuthenticateIntake::class,'throttle:180,1,intake-service'])->group(function(){
    Route::post('accept',[IntakeReceiverController::class,'accept']);
    Route::post('controls',[IntakeReceiverController::class,'controls']);
    Route::post('status',[IntakeReceiverController::class,'status']);
});

// Separate purpose, key ring and nonce namespace; never employee authentication.
Route::prefix('internal/participant-portal')->middleware([\App\Http\Middleware\AuthenticateParticipantGateway::class,'throttle:120,1,participant-gateway'])->group(function(){
    Route::post('activate',[\App\Http\Controllers\ParticipantGatewayController::class,'activate']);
    Route::post('activation-preflight',[\App\Http\Controllers\ParticipantGatewayController::class,'preflight']);
    Route::post('identity-status',[\App\Http\Controllers\ParticipantGatewayController::class,'identityStatus']);
    Route::post('contexts',[\App\Http\Controllers\ParticipantGatewayController::class,'contexts']);
    Route::post('command',[\App\Http\Controllers\ParticipantGatewayController::class,'command']);
});

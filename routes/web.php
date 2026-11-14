<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\CandidatePortalController;

Route::get('/', [CandidatePortalController::class, 'index'])->name('portal.index');
Route::get('/jobs/{id}', [CandidatePortalController::class, 'show'])->name('portal.show');
Route::post('/jobs/{id}/apply', [CandidatePortalController::class, 'apply'])->name('portal.apply');
Route::get('/track-status', [CandidatePortalController::class, 'track'])->name('portal.track');
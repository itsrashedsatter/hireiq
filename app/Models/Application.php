<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Application extends Model
{
    protected $fillable = [
        'job_posting_id', 'candidate_name', 'email', 'phone', 'resume_path', 'cover_letter', 'status'
    ];

    public function jobPosting()
    {
        return $this->belongsTo(JobPosting::class);
    }
}
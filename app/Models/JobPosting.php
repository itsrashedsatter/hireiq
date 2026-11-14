<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class JobPosting extends Model
{
    protected $fillable = [
        'title', 'department', 'location', 'type', 'salary_range', 'description', 'status', 'deadline'
    ];

    public function applications()
    {
        return $this->hasMany(Application::class);
    }
}
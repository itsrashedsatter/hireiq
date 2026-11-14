<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\JobPosting;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        JobPosting::create([
            'title' => 'Junior Backend Engineer (Java/PHP)',
            'department' => 'Engineering',
            'location' => 'Dhaka',
            'type' => 'Full-Time',
            'salary_range' => '45,000 - 65,000 BDT',
            'description' => 'Build scalable backend APIs, manage MySQL databases, and optimize core services.',
            'status' => 'Published',
            'deadline' => '2026-12-15',
        ]);

        JobPosting::create([
            'title' => 'AI / NLP Engineer',
            'department' => 'AI & Data',
            'location' => 'Remote',
            'type' => 'Full-Time',
            'salary_range' => '70,000 - 100,000 BDT',
            'description' => 'Develop resume parsing pipelines using spaCy and TF-IDF matching models.',
            'status' => 'Published',
            'deadline' => '2026-12-20',
        ]);

        JobPosting::create([
            'title' => 'Creative Video Editor',
            'department' => 'Media & Marketing',
            'location' => 'Dhaka',
            'type' => 'Part-Time',
            'salary_range' => '20,000 - 30,000 BDT',
            'description' => 'Edit engaging promotional reels and product demos using Premiere Pro.',
            'status' => 'Published',
            'deadline' => '2026-11-30',
        ]);

        JobPosting::create([
            'title' => 'QA & Game Systems Tester',
            'department' => 'Quality Assurance',
            'location' => 'Chattogram',
            'type' => 'Contract',
            'salary_range' => '35,000 - 50,000 BDT',
            'description' => 'Execute test plans, track edge-case bugs, and verify system stability.',
            'status' => 'Published',
            'deadline' => '2026-12-10',
        ]);
    }
}
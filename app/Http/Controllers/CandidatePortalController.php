<?php

namespace App\Http\Controllers;

use App\Models\JobPosting;
use App\Models\Application;
use Illuminate\Http\Request;

class CandidatePortalController extends Controller
{
    // 1. Browse & Filter Open Jobs
    public function index(Request $request)
    {
        $query = JobPosting::where('status', 'Published')
            ->whereDate('deadline', '>=', now());

        if ($request->filled('search')) {
            $query->where('title', 'like', '%' . $request->search . '%');
        }
        if ($request->filled('department')) {
            $query->where('department', $request->department);
        }
        if ($request->filled('location')) {
            $query->where('location', $request->location);
        }
        if ($request->filled('type')) {
            $query->where('type', $request->type);
        }

        $jobs = $query->latest()->get();

        // Populate filter dropdowns dynamically
        $departments = JobPosting::select('department')->distinct()->pluck('department');
        $locations = JobPosting::select('location')->distinct()->pluck('location');
        $types = JobPosting::select('type')->distinct()->pluck('type');

        return view('portal.index', compact('jobs', 'departments', 'locations', 'types'));
    }

    // 2. Show Job Details & Application Form
    public function show($id)
    {
        $job = JobPosting::findOrFail($id);
        return view('portal.show', compact('job'));
    }

    // 3. Submit Application (Resume Upload + Duplicate Check)
    public function apply(Request $request, $id)
    {
        $job = JobPosting::findOrFail($id);

        $request->validate([
            'candidate_name' => 'required|string|max:255',
            'email'          => 'required|email|max:255',
            'phone'          => 'required|string|max:30',
            'resume'         => 'required|file|mimes:pdf,doc,docx|max:5120', // 5MB limit
            'cover_letter'   => 'nullable|string',
        ]);

        // Duplicate detection by email OR phone for the same job
        $duplicate = Application::where('job_posting_id', $job->id)
            ->where(function ($q) use ($request) {
                $q->where('email', $request->email)
                  ->orWhere('phone', $request->phone);
            })->exists();

        if ($duplicate) {
            return back()->withInput()->withErrors([
                'duplicate' => 'Duplicate Application Detected: An application with this email or phone number has already been submitted for this position.'
            ]);
        }

        // Save PDF/DOCX file to storage/app/public/resumes
        $resumePath = $request->file('resume')->store('resumes', 'public');

        $application = Application::create([
            'job_posting_id' => $job->id,
            'candidate_name' => $request->candidate_name,
            'email'          => $request->email,
            'phone'          => $request->phone,
            'resume_path'    => $resumePath,
            'cover_letter'   => $request->cover_letter,
            'status'         => 'Applied',
        ]);

        return redirect()->route('portal.track', [
            'email' => $application->email,
            'phone' => $application->phone
        ])->with('success', 'Application submitted! Your Application ID is #' . $application->id);
    }

    // 4. Real-Time Application Status Tracker
    public function track(Request $request)
    {
        $applications = collect();

        if ($request->filled('email') || $request->filled('phone')) {
            $applications = Application::with('jobPosting')
                ->where(function ($q) use ($request) {
                    if ($request->filled('email')) {
                        $q->where('email', $request->email);
                    }
                    if ($request->filled('phone')) {
                        $q->orWhere('phone', $request->phone);
                    }
                })
                ->latest()
                ->get();
        }

        return view('portal.track', compact('applications'));
    }
}
@extends('portal.layout')

@section('content')
<div class="card">
    <h2 style="margin-top:0;">{{ $job->title }}</h2>
    <span class="badge">{{ $job->department }}</span>
    <span class="badge">{{ $job->location }}</span>
    <span class="badge">{{ $job->type }}</span>
    <p>{{ $job->description }}</p>
    <p><strong>Salary Range:</strong> {{ $job->salary_range }} | <strong>Closing Date:</strong> {{ $job->deadline }}</p>
</div>

<div class="card">
    <h3 style="margin-top:0;">Submit Your Application</h3>

    @if($errors->any())
        <div class="alert-error">
            <ul style="margin:0; padding-left:1.2rem;">
                @foreach($errors->all() as $error)
                    <li>{{ $error }}</li>
                @endforeach
            </ul>
        </div>
    @endif

    <form method="POST" action="{{ route('portal.apply', $job->id) }}" enctype="multipart/form-data">
        @csrf
        <label><strong>Full Name *</strong></label>
        <input type="text" name="candidate_name" value="{{ old('candidate_name') }}" required>

        <label><strong>Email Address *</strong></label>
        <input type="email" name="email" value="{{ old('email') }}" required>

        <label><strong>Phone Number *</strong></label>
        <input type="text" name="phone" value="{{ old('phone') }}" placeholder="e.g., 017XXXXXXXX" required>

        <label><strong>Upload Resume (PDF or DOCX, Max 5MB) *</strong></label>
        <input type="file" name="resume" accept=".pdf,.doc,.docx" required>

        <label><strong>Cover Letter</strong></label>
        <textarea name="cover_letter" rows="4" placeholder="Briefly explain why you are a great fit...">{{ old('cover_letter') }}</textarea>

        <button type="submit" class="btn">Submit Application</button>
    </form>
</div>
@endsection
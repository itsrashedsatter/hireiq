@extends('portal.layout')

@section('content')
<div class="card">
    <h2 style="margin-top:0;">Real-Time Application Status Tracker</h2>
    <p style="color:#4b5563;">Enter your email or phone number to check the live stage of your submitted applications.</p>
    <form method="GET" action="{{ route('portal.track') }}">
        <div class="grid-filters">
            <input type="email" name="email" placeholder="Your Email Address" value="{{ request('email') }}">
            <input type="text" name="phone" placeholder="Your Phone Number" value="{{ request('phone') }}">
        </div>
        <button type="submit" class="btn">Check Status</button>
    </form>
</div>

@if(request()->filled('email') || request()->filled('phone'))
    @forelse($applications as $app)
        <div class="card">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <h3 style="margin:0;">{{ $app->jobPosting->title }}</h3>
                    <small style="color:#6b7280;">
                        Applicant: {{ $app->candidate_name }} | Applied on: {{ $app->created_at->format('M d, Y h:i A') }}
                    </small>
                </div>
                <span class="badge" style="font-size:1rem;">Current Stage: {{ $app->status }}</span>
            </div>

            <div class="pipeline">
                @foreach(['Applied', 'Screening', 'Interview', 'Offer', 'Hired'] as $stage)
                    <span class="step {{ $app->status === $stage ? 'active' : '' }}">
                        {{ $loop->iteration }}. {{ $stage }}
                    </span>
                @endforeach
            </div>

            <div style="margin-top:1rem;">
                <a href="{{ asset('storage/' . $app->resume_path) }}" target="_blank" style="color:#2563eb; font-size:0.9rem;">
                    View Uploaded Resume
                </a>
            </div>
        </div>
    @empty
        <div class="card">No applications found matching that email or phone number.</div>
    @endforelse
@endif
@endsection
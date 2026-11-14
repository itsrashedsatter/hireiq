@extends('portal.layout')

@section('content')
<div class="card">
    <h2 style="margin-top:0;">Filter Open Positions</h2>
    <form method="GET" action="{{ route('portal.index') }}">
        <div class="grid-filters">
            <input type="text" name="search" placeholder="Search job title..." value="{{ request('search') }}">
            <select name="department">
                <option value="">All Departments</option>
                @foreach($departments as $dept)
                    <option value="{{ $dept }}" {{ request('department') == $dept ? 'selected' : '' }}>{{ $dept }}</option>
                @endforeach
            </select>
            <select name="location">
                <option value="">All Locations</option>
                @foreach($locations as $loc)
                    <option value="{{ $loc }}" {{ request('location') == $loc ? 'selected' : '' }}>{{ $loc }}</option>
                @endforeach
            </select>
            <select name="type">
                <option value="">All Job Types</option>
                @foreach($types as $type)
                    <option value="{{ $type }}" {{ request('type') == $type ? 'selected' : '' }}>{{ $type }}</option>
                @endforeach
            </select>
        </div>
        <button type="submit" class="btn">Apply Filters</button>
        <a href="{{ route('portal.index') }}" class="btn btn-secondary">Reset</a>
    </form>
</div>

@forelse($jobs as $job)
    <div class="card" style="display:flex; justify-content:space-between; align-items:center;">
        <div>
            <h3 style="margin:0 0 0.5rem 0;">{{ $job->title }}</h3>
            <span class="badge">{{ $job->department }}</span>
            <span class="badge">{{ $job->location }}</span>
            <span class="badge">{{ $job->type }}</span>
            <p style="margin:0.75rem 0 0.25rem 0; color:#4b5563;">{{ $job->description }}</p>
            <small style="color:#6b7280;">Salary: {{ $job->salary_range }} | Deadline: {{ $job->deadline }}</small>
        </div>
        <div>
            <a href="{{ route('portal.show', $job->id) }}" class="btn">Apply Now</a>
        </div>
    </div>
@empty
    <div class="card">No open job postings match your filter criteria.</div>
@endforelse
@endsection
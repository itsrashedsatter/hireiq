<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>HireIQ - Candidate Application Portal</title>
    <style>
        * { box-sizing: border-box; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
        body { margin: 0; background: #f3f4f6; color: #1f2937; }
        nav { background: #1e3a8a; color: #fff; padding: 1rem 2rem; display: flex; justify-content: space-between; align-items: center; }
        nav a { color: #fff; text-decoration: none; margin-left: 1.5rem; font-weight: 600; }
        .container { max-width: 1050px; margin: 2rem auto; padding: 0 1rem; }
        .card { background: #fff; border-radius: 8px; padding: 1.5rem; margin-bottom: 1.25rem; box-shadow: 0 2px 6px rgba(0,0,0,0.06); }
        .btn { background: #2563eb; color: #fff; padding: 0.6rem 1.2rem; border-radius: 6px; text-decoration: none; border: none; cursor: pointer; font-weight: 600; display: inline-block; }
        .btn:hover { background: #1d4ed8; }
        .btn-secondary { background: #6b7280; }
        .badge { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 999px; font-size: 0.85rem; font-weight: 600; background: #dbeafe; color: #1e40af; margin-right: 0.5rem; }
        .grid-filters { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.75rem; }
        input, select, textarea { width: 100%; padding: 0.65rem; border: 1px solid #d1d5db; border-radius: 6px; margin-top: 0.35rem; margin-bottom: 1rem; }
        .alert-error { background: #fee2e2; color: #991b1b; padding: 1rem; border-radius: 6px; margin-bottom: 1rem; border-left: 4px solid #dc2626; }
        .alert-success { background: #dcfce7; color: #166534; padding: 1rem; border-radius: 6px; margin-bottom: 1rem; border-left: 4px solid #16a34a; }
        .pipeline { display: flex; justify-content: space-between; margin-top: 1.25rem; border-top: 2px solid #e5e7eb; padding-top: 1rem; }
        .step { font-size: 0.85rem; color: #9ca3af; font-weight: 600; }
        .step.active { color: #2563eb; font-weight: 700; text-decoration: underline; }
    </style>
</head>
<body>
    <nav>
        <div><strong>HireIQ</strong> | Candidate Application Portal</div>
        <div>
            <a href="{{ route('portal.index') }}">Browse Open Jobs</a>
            <a href="{{ route('portal.track') }}">Track Application Status</a>
        </div>
    </nav>
    <div class="container">
        @if(session('success'))
            <div class="alert-success">{{ session('success') }}</div>
        @endif
        @yield('content')
    </div>
</body>
</html>
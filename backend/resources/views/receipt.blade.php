<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Jali receipt {{ $r['number'] }}</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#F2F4F8;color:#0D1117;margin:0;padding:16px}
  .card{max-width:520px;margin:0 auto;background:#fff;border-radius:16px;padding:24px;border:1px solid #DDE2EC}
  h1{color:#0055CC;margin:0 0 4px;font-size:22px} .muted{color:#4A5568;font-size:13px}
  table{width:100%;border-collapse:collapse;margin-top:14px} td{padding:6px 0;border-bottom:1px solid #F2F4F8}
  td.r{text-align:right;font-weight:600} tr.total td{font-weight:900;font-size:17px;border-bottom:none}
  .print{display:block;margin:16px auto 0;max-width:520px;text-align:center}
  @media print{.print{display:none} body{background:#fff}}
</style>
</head>
<body>
<div class="card">
  <h1>Jali · {{ $r['kind'] }} receipt</h1>
  <div class="muted">{{ $r['number'] }} · {{ $r['date'] }}</div>
  <table>
    <tr><td>Customer</td><td class="r">{{ $r['customer'] }}</td></tr>
    @if($r['from'])<tr><td>From</td><td class="r">{{ $r['from'] }}</td></tr>@endif
    @if($r['to'])<tr><td>{{ $r['kind'] === 'Ride' ? 'To' : 'Car' }}</td><td class="r">{{ $r['to'] }}</td></tr>@endif
    @if($r['distance'])<tr><td>Distance</td><td class="r">{{ $r['distance'] }}</td></tr>@endif
    <tr><td>Duration</td><td class="r">{{ $r['duration'] }}</td></tr>
    <tr><td>Driver</td><td class="r">{{ $r['driver'] }}@if($r['plate']) · {{ $r['plate'] }}@endif</td></tr>
  </table>
  <table>
    @foreach($r['lines'] as $line)
      <tr><td>{{ $line[0] }}</td><td class="r">{{ number_format($line[1]) }} RWF</td></tr>
    @endforeach
    <tr class="total"><td>Total</td><td class="r">{{ number_format($r['total']) }} RWF</td></tr>
  </table>
  <p class="muted">Paid to the driver by {{ $r['payment'] }}.</p>
  <p class="muted">{{ $r['company']['name'] }} · {{ $r['company']['address'] }} · {{ $r['company']['email'] }} · {{ $r['company']['web'] }}</p>
  @if(!empty($email))<p><a href="{{ $link }}">Open or print this receipt</a></p>@endif
</div>
@if(empty($email))<a class="print" href="javascript:window.print()">Print / save as PDF</a>@endif
</body>
</html>

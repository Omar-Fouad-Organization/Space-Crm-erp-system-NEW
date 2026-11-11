{{ $invitation['event'] }}
{{ $invitation['organization'] }}
{{ $invitation['recipient'] }}
{{ $invitation['role'] }}
@if($invitation['locale'] === 'ar')
لتأكيد الدعوة وتفعيل حسابك، افتح الرابط الخاص التالي. لا تشاركه مع الآخرين.
@else
Confirm your invitation using this private link. Do not share it.
@endif
{{ $invitation['url'] }}
{{ $invitation['expires_at'] }} UTC
@if($invitation['support']){{ $invitation['support'] }}@endif

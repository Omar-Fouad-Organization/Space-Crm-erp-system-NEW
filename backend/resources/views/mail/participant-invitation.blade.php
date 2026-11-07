<!doctype html>
<html lang="{{ $invitation['locale'] }}" dir="{{ $invitation['locale'] === 'ar' ? 'rtl' : 'ltr' }}">
<body style="background:#faf9f6;color:#25322a;font-family:Arial,sans-serif;padding:24px">
<main style="max-width:620px;margin:auto;background:white;padding:32px;border-radius:12px">
<h1 style="color:#2a713a">{{ $invitation['event'] }}</h1>
@if($invitation['locale'] === 'ar')
<h2>دعوتك إلى بوابة المشاركين</h2>
<p>وافق المنظم على دعوة ممثل المؤسسة {{ $invitation['organization'] }}.</p>
<p>البريد المدعو: {{ $invitation['recipient'] }} · الدور: {{ ['owner'=>'مالك المؤسسة','editor'=>'محرر الملف','coordinator'=>'منسق الاجتماعات','reader'=>'ممثل للقراءة فقط'][$invitation['role']] }}</p>
<p><a href="{{ $invitation['url'] }}" style="color:#2a713a">تأكيد الدعوة وتفعيل الحساب</a></p>
<p>تنتهي الدعوة في {{ $invitation['expires_at'] }} UTC. لا تفتح معاينة الرابط عضوية ولا تؤكد اجتماعًا.</p>
<p>لا تشارك رابط الدعوة. لم نطلب منك الدفع أو إرسال كلمة مرور بالبريد. إذا لم تتوقع هذه الدعوة، تجاهلها وتواصل مع المنظم.</p>
@else
<h2>Your participant portal invitation</h2>
<p>The organizer approved an invitation for {{ $invitation['organization'] }}.</p>
<p>Invited email: {{ $invitation['recipient'] }} · Role: {{ ['owner'=>'Organization owner','editor'=>'Profile editor','coordinator'=>'Meeting coordinator','reader'=>'Read-only representative'][$invitation['role']] }}</p>
<p><a href="{{ $invitation['url'] }}" style="color:#2a713a">Confirm invitation and activate account</a></p>
<p>This invitation expires at {{ $invitation['expires_at'] }} UTC. Previewing the link does not create access or confirm a meeting.</p>
<p>Keep this link private. We do not request payment or passwords by email. If this invitation was unexpected, ignore it and contact the organizer.</p>
@endif
@if($invitation['support'])<p>{{ $invitation['support'] }}</p>@endif
</main></body></html>

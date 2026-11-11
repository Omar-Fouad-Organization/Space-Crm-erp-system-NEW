<?php
namespace App\Http\Controllers;

use App\Services\{B2BAccess, B2BProfiles, ParticipantAuthority, ParticipantInvitations, ParticipantOnboardingGate};
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

class ParticipantGatewayController extends Controller
{
    public function __construct(private ParticipantOnboardingGate $gate, private ParticipantInvitations $invitations) {}

    private function validInvitation(#[\SensitiveParameter] array $input): object
    {
        $invitation = DB::table('portal_access_invitations')->where('token_hash', hash('sha256', $input['token']))->first();
        $this->assertValid($invitation, $input['email']);
        return $invitation;
    }

    private function assertValid(?object $invitation, string $email): void
    {
        abort_unless($invitation && !$invitation->revoked_at && strtolower($invitation->email) === strtolower($email)
            && now()->lt($invitation->expires_at) && in_array($invitation->role, array_keys(ParticipantAuthority::ROLES), true), 403, 'Invitation is invalid or expired.');
        $this->gate->assertProof($invitation);
    }

    public function preflight(Request $request): JsonResponse
    {
        $input = Validator::make($request->json()->all(), ['email'=>'required|email|max:255','token'=>'required|string|min:40|max:255'])->validate();
        $invitation = $this->validInvitation($input);
        $participant = DB::table('b2b_participants')->where('id', $invitation->participant_id)->first();
        abort_unless($participant && app(B2BAccess::class)->eligible($participant, false), 403);
        if ($invitation->redeemed_identity_id) {
            $this->assertRedeemedBinding($invitation);
        }
        $profile = B2BProfiles::open($participant->profile);
        return response()->json([
            'valid'=>true, 'identity_id'=>$invitation->redeemed_identity_id,
            'proof_channel'=>$invitation->proof_channel ?? 'synthetic',
            'organization'=>['en'=>$profile['name_en'],'ar'=>$profile['name_ar']],
            'exhibition'=>DB::table('exhibitions')->where('id', $participant->exhibition_id)->value('name'),
            'role'=>$invitation->role, 'expires_at'=>$invitation->expires_at,
        ])->header('Cache-Control', 'no-store');
    }

    private function assertRedeemedBinding(object $invitation): object
    {
        abort_unless(DB::table('portal_identity_controls')->where('identity_id', $invitation->redeemed_identity_id)->whereNull('disabled_at')->exists(), 403);
        $membership = DB::table('portal_memberships')->where('id', $invitation->membership_id)->where('identity_id', $invitation->redeemed_identity_id)
            ->where('participant_id', $invitation->participant_id)->where('status', 'active')->whereNull('revoked_at')->first();
        abort_unless($membership, 403, 'The invitation membership is no longer active.');
        return $membership;
    }

    public function activate(Request $request): array
    {
        $input = Validator::make($request->json()->all(), ['identity_id'=>'required|uuid','email'=>'required|email|max:255','token'=>'required|string|min:40|max:255'])->validate();
        $seed = $this->validInvitation($input);
        try {
            return DB::transaction(function () use ($input, $seed): array {
                DB::table('portal_identity_controls')->insertOrIgnore(['identity_id'=>$input['identity_id'],'reviewed_by'=>$seed->invited_by,'created_at'=>now(),'updated_at'=>now()]);
                $control = DB::table('portal_identity_controls')->where('identity_id', $input['identity_id'])->lockForUpdate()->first();
                abort_unless($control && !$control->disabled_at, 403, 'Participant account access is revoked.');
                $participant = DB::table('b2b_participants')->where('id', $seed->participant_id)->lockForUpdate()->first();
                abort_unless($participant && app(B2BAccess::class)->eligible($participant, false, true), 403);
                $invitation = DB::table('portal_access_invitations')->where('id', $seed->id)->where('token_hash', hash('sha256', $input['token']))->lockForUpdate()->first();
                $this->assertValid($invitation, $input['email']);
                if ($invitation->redeemed_identity_id) {
                    abort_unless($invitation->redeemed_identity_id === $input['identity_id'], 409, 'Invitation already used.');
                    $this->assertRedeemedBinding($invitation);
                    return ['membership_id'=>$invitation->membership_id,'proof_channel'=>$invitation->proof_channel ?? 'synthetic'];
                }
                $existing = DB::table('portal_memberships')->where('identity_id', $input['identity_id'])->where('participant_id', $participant->id)
                    ->where('exhibition_id', $participant->exhibition_id)->lockForUpdate()->first();
                if ($existing && ($existing->status !== 'active' || $existing->revoked_at)) {
                    abort_unless($invitation->regrant_membership_id === $existing->id && is_string($invitation->regrant_revocation_hash)
                        && hash_equals($invitation->regrant_revocation_hash, ParticipantInvitations::revocationHash($existing)), 403, 'Revoked membership requires a fresh explicit staff regrant review.');
                }
                $id = $existing?->id ?? (string) Str::uuid();
                DB::table('portal_memberships')->updateOrInsert(['id'=>$id], [
                    'identity_id'=>$input['identity_id'],'participant_id'=>$participant->id,'exhibition_id'=>$participant->exhibition_id,
                    'role'=>$invitation->role,'capabilities'=>json_encode(ParticipantAuthority::ROLES[$invitation->role]),
                    'status'=>'active','revoked_at'=>null,'approval_evidence'=>$invitation->evidence,'reviewed_by'=>$invitation->invited_by,
                    'created_at'=>$existing?->created_at ?? now(),'updated_at'=>now(),
                ]);
                DB::table('portal_access_invitations')->where('id', $invitation->id)->update([
                    'redeemed_identity_id'=>$input['identity_id'],'membership_id'=>$id,'status'=>'redeemed','redeemed_at'=>now(),'updated_at'=>now(),
                ]);
                DB::table('portal_invitation_deliveries')->where('invitation_id', $invitation->id)->update(['secret_payload'=>null,'updated_at'=>now()]);
                DB::table('portal_activity')->insert([
                    'membership_id'=>$id,'identity_id'=>$input['identity_id'],'exhibition_id'=>$participant->exhibition_id,'operation'=>'account.activate',
                    'details'=>B2BProfiles::seal(['invitation_id'=>$invitation->id,'proof_channel'=>$invitation->proof_channel ?? 'synthetic',
                        'before'=>$existing ? ['role'=>$existing->role,'status'=>$existing->status,'capabilities'=>json_decode($existing->capabilities, true),'approval_evidence'=>$existing->approval_evidence] : null,
                        'after'=>['role'=>$invitation->role,'capabilities'=>ParticipantAuthority::ROLES[$invitation->role]]]),'created_at'=>now(),
                ]);
                $this->invitations->event($invitation->id, 'redeemed', null, ['identity_id'=>$input['identity_id'],'membership_id'=>$id]);
                return ['membership_id'=>$id,'proof_channel'=>$invitation->proof_channel ?? 'synthetic'];
            }, 3);
        } catch (HttpExceptionInterface $exception) {
            $this->invitations->event($seed->id, 'redemption_rejected', null, ['identity_id'=>$input['identity_id'],'http_status'=>$exception->getStatusCode()]);
            throw $exception;
        }
    }

    public function command(Request $request, ParticipantAuthority $authority): JsonResponse
    {
        return response()->json($authority->execute($request->json()->all()))->header('Cache-Control', 'no-store');
    }

    public function contexts(Request $request, ParticipantAuthority $authority): JsonResponse
    {
        $input = Validator::make($request->json()->all(), ['identity_id'=>'required|uuid'])->validate();
        return response()->json(['items'=>$authority->contexts($input['identity_id']),'authoritative_at'=>now()->toIso8601String()])->header('Cache-Control', 'no-store');
    }

    public function identityStatus(Request $request): JsonResponse
    {
        $input = Validator::make($request->json()->all(), ['identity_id'=>'required|uuid'])->validate();
        return response()->json(['active'=>DB::table('portal_identity_controls')->where('identity_id', $input['identity_id'])->whereNull('disabled_at')->exists()])->header('Cache-Control', 'no-store');
    }
}

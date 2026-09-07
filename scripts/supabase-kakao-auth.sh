#!/bin/zsh
# ============================================================================
# Supabase 카카오 로그인 설정
#
# Dashboard 에서 Authentication → Providers → Kakao 를 켜고 Redirect URL 을
# 등록하는 일을 대신한다. 웹에서 클릭할 필요가 없다.
#
# ⚠️ 이건 DB 가 아니라 **프로젝트 Auth 설정**이다. 마이그레이션이 아니므로
#    DB 담당자만 할 수 있는 일이 아니다. 카카오 로그인을 구현하는 사람이
#    직접 돌리면 된다.
#
# 필요한 것
#   1. Supabase Personal Access Token
#      https://supabase.com/dashboard/account/tokens → Generate new token
#      ⚠️ 만들 때 한 번만 보인다. 복사해 두고 바로 이 스크립트를 실행할 것.
#      ⚠️ 다 쓰고 나면 같은 화면에서 Delete 로 지운다. 계정 전체 권한이다.
#   2. Kakao REST API Key   (Native App Key 가 아니다)
#   3. Kakao Login Client Secret
#
# 세 값 모두 실행할 때만 입력받는다. 파일·git·프로세스 목록 어디에도 남지 않는다.
# 팀 채팅이나 AI 에 붙여넣지 말 것.
#
# 실행
#   zsh scripts/supabase-kakao-auth.sh
# ============================================================================

REF=pzwabphxitubsioyhgkk

printf 'Supabase Personal Access Token: '; read -rs PAT;     echo
printf 'Kakao REST API Key: ';            read -rs KID;     echo
printf 'Kakao Client Secret: ';           read -rs KSECRET; echo

# 앱이 supabase.auth.signInWithOAuth({ options: { redirectTo } }) 에 넘기는 값과
# 글자 하나까지 같아야 한다. Supabase 는 allow list 를 정확히 대조한다.
printf 'Redirect URL [기본 trippot://]: '; read -r REDIRECT
: "${REDIRECT:=trippot://}"

REF="$REF" PAT="$PAT" KID="$KID" KSECRET="$KSECRET" REDIRECT="$REDIRECT" python3 - <<'PY'
import json, os, sys, urllib.error, urllib.request

ref, pat = os.environ["REF"], os.environ["PAT"].strip()

if not pat:
    sys.exit("토큰이 비어 있습니다. 붙여넣기가 안 된 것 같아요.")
if not pat.startswith("sbp_"):
    sys.exit(f"토큰 형식이 이상합니다. sbp_ 로 시작해야 합니다. (지금: {pat[:4]}…)")

url = f"https://api.supabase.com/v1/projects/{ref}/config/auth"
hdr = {
    "Authorization": f"Bearer {pat}",
    "Content-Type": "application/json",
    # ⚠️ 반드시 넣는다. api.supabase.com 앞의 Cloudflare 가 파이썬 기본
    #    User-Agent(Python-urllib/3.x)를 봇으로 보고 403 error code: 1010 로
    #    막는다. 토큰이 멀쩡해도 요청이 서버에 닿지 못한다.
    "User-Agent": "trippot-setup/1.0",
}


def call(method, body=None):
    """실패하면 서버가 준 이유를 그대로 보여준다. 상태 코드만으로는 원인을 못 찾는다."""
    req = urllib.request.Request(url, data=body, headers=hdr, method=method)
    try:
        return json.load(urllib.request.urlopen(req))
    except urllib.error.HTTPError as e:
        print(f"\n  요청 실패 · HTTP {e.code}\n  {e.read().decode(errors='replace')[:500]}\n")
        if e.code == 401:
            print("  토큰 문제입니다. 만료됐거나 복사가 잘렸을 수 있어요. 새로 발급해 보세요.")
        elif e.code == 403:
            print(f"  권한 문제입니다. 이 계정이 {ref} 프로젝트 멤버인지 확인해 주세요.")
        sys.exit(1)


redirect = os.environ["REDIRECT"].strip()

# 이미 등록된 Redirect URL 을 지우지 않는다. uri_allow_list 는 통째로 덮어쓰는
# 필드라, 그냥 새 값만 넣으면 남이 등록해 둔 주소가 날아간다.
urls = [u.strip() for u in (call("GET").get("uri_allow_list") or "").split(",") if u.strip()]
if redirect not in urls:
    urls.append(redirect)

r = call("PATCH", json.dumps({
    "external_kakao_enabled": True,
    "external_kakao_client_id": os.environ["KID"].strip(),
    "external_kakao_secret": os.environ["KSECRET"].strip(),
    # 카카오 동의항목에서 이메일을 받지 않기로 했다. 이걸 켜지 않으면
    # 이메일 없는 카카오 사용자가 Supabase Auth 에 가입되지 않는다.
    "external_kakao_email_optional": True,
    "uri_allow_list": ",".join(urls),
}).encode())

print()
print("  카카오 로그인      ", "ON" if r["external_kakao_enabled"] else "OFF")
print("  Client ID         ", "입력됨" if r["external_kakao_client_id"] else "비어 있음")
print("  Client Secret     ", "입력됨" if r["external_kakao_secret"] else "비어 있음")
print("  이메일 없어도 가입 ", "ON" if r["external_kakao_email_optional"] else "OFF")
print("  Redirect URLs     ", r["uri_allow_list"])
print()
print("  앱 코드의 redirectTo 가 위 주소와 글자까지 같아야 합니다.")
PY

unset PAT KID KSECRET REDIRECT

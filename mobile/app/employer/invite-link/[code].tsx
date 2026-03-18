import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";

// Deep link handler: elemetric://employer/invite-link/:code
// Redirects to the join-team screen with the invite code pre-filled via params
export default function EmployerInviteDeepLink() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();

  useEffect(() => {
    router.replace({
      pathname: "/employer/join-team",
      params: { inviteCode: code ?? "" },
    });
  }, [code, router]);

  return null;
}

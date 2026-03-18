import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";

// Deep link handler: elemetric://employer/job/:id
// Redirects to the employer dashboard (job details viewed in dashboard)
export default function EmployerJobDeepLink() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  useEffect(() => {
    // Navigate to employer dashboard — the dashboard shows all jobs
    // Future: add a job detail view and navigate directly to it
    router.replace("/employer/dashboard");
  }, [id, router]);

  return null;
}

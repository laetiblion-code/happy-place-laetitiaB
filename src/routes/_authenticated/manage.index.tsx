import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/manage/")({
  component: () => <Navigate to="/actualites" replace />,
});

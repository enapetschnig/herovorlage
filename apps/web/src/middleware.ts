export { auth as middleware } from "@heatflow/auth";

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public/|.*\\.(?:png|svg|jpg|jpeg|webp|ico)$).*)"],
};

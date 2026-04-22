"use client";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { loginSchema, type LoginInput } from "@heatflow/schemas";
import { Button, Input, Field } from "@heatflow/ui";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, formState } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "admin@demo.heatflow.local", password: "" },
  });

  const onSubmit = handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const res = await signIn("credentials", { ...values, redirect: false });
      if (!res || res.error) {
        setError("E-Mail oder Passwort falsch.");
        toast.error("Anmeldung fehlgeschlagen");
        return;
      }
      const next = params.get("callbackUrl") ?? "/dashboard";
      toast.success("Willkommen zurück!");
      router.push(next);
      router.refresh();
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="E-Mail" htmlFor="email" error={formState.errors.email?.message}>
        <Input id="email" type="email" autoComplete="email" autoFocus {...register("email")} />
      </Field>
      <Field label="Passwort" htmlFor="password" error={formState.errors.password?.message}>
        <Input id="password" type="password" autoComplete="current-password" {...register("password")} />
      </Field>

      {error && (
        <div role="alert" className="text-sm text-danger bg-danger/10 border border-danger/20 rounded p-2.5">
          {error}
        </div>
      )}

      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending ? <><Loader2 className="size-4 animate-spin" /> Anmelden…</> : "Anmelden"}
      </Button>
    </form>
  );
}

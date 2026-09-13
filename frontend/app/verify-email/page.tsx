//app/verify-email/page.tsx

"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { authAPI } from "@/lib/api/auth.api";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/context/language-context";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Building2, Loader2, CheckCircle2, XCircle } from "lucide-react";

type Status = "checking" | "success" | "error";

function VerifyEmailContent() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<Status>("checking");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage(t("verifyEmail.invalidLinkDesc"));
      return;
    }
    authAPI
      .verifyEmail(token)
      .then((res) => {
        setStatus("success");
        setMessage(res.message || t("verifyEmail.success"));
      })
      .catch((err: unknown) => {
        setStatus("error");
        const errorMessage = (
          err as { response?: { data?: { message?: string } } }
        )?.response?.data?.message;
        setMessage(errorMessage || t("verifyEmail.invalidLinkDesc"));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (status === "checking") {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <div className="p-3 rounded-full bg-destructive/10">
          <XCircle className="h-8 w-8 text-destructive" />
        </div>
        <p className="font-medium">{t("verifyEmail.invalidLink")}</p>
        <p className="text-sm text-muted-foreground">{message}</p>
        <Button asChild className="mt-2 w-full">
          <Link href="/login">{t("verifyEmail.backToLogin")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 py-4 text-center">
      <div className="p-3 rounded-full bg-success/20">
        <CheckCircle2 className="h-8 w-8 text-success" />
      </div>
      <p className="font-medium">{t("verifyEmail.success")}</p>
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button asChild className="mt-2 w-full">
        <Link href="/login">{t("verifyEmail.loginNow")}</Link>
      </Button>
    </div>
  );
}

export default function VerifyEmailPage() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-primary/10">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">{t("verifyEmail.title")}</CardTitle>
          <CardDescription>{t("verifyEmail.subtitle")}</CardDescription>
        </CardHeader>

        <CardContent>
          <Suspense
            fallback={
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            }
          >
            <VerifyEmailContent />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}

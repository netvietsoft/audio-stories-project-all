"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";

import { apiClient } from "@/lib/api/api-client";
import { setAuthCookies } from "@/lib/auth/cookies";
import { useUserStore, type UserProfile } from "@/stores/user-store";
import { Mail, AlertCircle, CheckCircle2, Loader2, RefreshCw, Headphones } from "lucide-react";

type VerifyCodeResponse = {
    ok: boolean;
    access_token: string;
    refresh_token: string;
};

type BackendMeResponse = {
    sub: string;
    email: string;
    name?: string | null;
    avatar_url?: string | null;
    roles?: string[];
    vip_tier?: number;
    credits?: number;
    premium_expires_at?: string | null;
};

const normalizeUserProfile = (profile: BackendMeResponse): UserProfile => ({
    id: profile.sub,
    email: profile.email,
    name: profile.name ?? undefined,
    avatarUrl: profile.avatar_url ?? undefined,
    roles: profile.roles ?? [],
    vipTier: profile.vip_tier,
    vipExpirationDate: profile.premium_expires_at,
    credits: profile.credits ?? 0,
});

const OTP_LENGTH = 6;

export default function VerifyEmailForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const emailFromQuery = useMemo(() => searchParams.get("email") || "", [searchParams]);

    const setAuth = useUserStore((state) => state.setAuth);

    const [email, setEmail] = useState(emailFromQuery);
    const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""));
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
    const [resendMessage, setResendMessage] = useState<string | null>(null);
    const [resendError, setResendError] = useState<string | null>(null);
    const [isResending, setIsResending] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    const code = otp.join("");

    const focusBox = useCallback((index: number) => {
        const el = inputRefs.current[index];
        if (el) {
            el.focus();
            el.select();
        }
    }, []);

    const handleOtpChange = (index: number, value: string) => {
        // Accept only digits
        const digit = value.replace(/\D/g, "").slice(-1);

        const next = [...otp];
        next[index] = digit;
        setOtp(next);

        // Auto-advance
        if (digit && index < OTP_LENGTH - 1) {
            focusBox(index + 1);
        }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Backspace") {
            if (otp[index]) {
                // Clear current cell
                const next = [...otp];
                next[index] = "";
                setOtp(next);
            } else if (index > 0) {
                // Move back and clear
                focusBox(index - 1);
                const next = [...otp];
                next[index - 1] = "";
                setOtp(next);
            }
        } else if (e.key === "ArrowLeft" && index > 0) {
            focusBox(index - 1);
        } else if (e.key === "ArrowRight" && index < OTP_LENGTH - 1) {
            focusBox(index + 1);
        }
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
        if (!pasted) return;

        const next = [...otp];
        pasted.split("").forEach((char, i) => {
            next[i] = char;
        });
        setOtp(next);

        const nextFocus = Math.min(pasted.length, OTP_LENGTH - 1);
        focusBox(nextFocus);
    };

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (code.length < OTP_LENGTH) {
            setSubmitError("Vui lòng nhập đủ 6 chữ số mã xác thực.");
            return;
        }

        try {
            setIsSubmitting(true);
            setSubmitError(null);
            setSubmitSuccess(null);

            const verifyResponse = await apiClient.post<VerifyCodeResponse>("/auth/verify-code", {
                email,
                code,
            });

            const { access_token, refresh_token } = verifyResponse.data;
            const profileResponse = await apiClient.get<BackendMeResponse>("/auth/me", {
                headers: { Authorization: `Bearer ${access_token}` },
            });

            setAuth({
                user: normalizeUserProfile(profileResponse.data),
                accessToken: access_token,
                refreshToken: refresh_token,
            });
            setAuthCookies(access_token, refresh_token);

            setSubmitSuccess("Xác minh email thành công. Đang chuyển trang...");
            router.replace("/");
        } catch (error) {
            const message =
                typeof error === "object" &&
                error !== null &&
                "response" in error &&
                typeof (error as any).response?.data?.message === "string"
                    ? (error as any).response.data.message
                    : "Xác minh thất bại. Vui lòng kiểm tra lại mã và thử lại.";
            setSubmitError(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const onResendCode = async () => {
        try {
            setResendError(null);
            setResendMessage(null);
            setIsResending(true);

            await apiClient.post("/auth/resend-code", { email });
            setResendMessage("Đã gửi lại mã xác thực. Vui lòng kiểm tra email.");
        } catch (error) {
            const message =
                typeof error === "object" &&
                error !== null &&
                "response" in error &&
                typeof (error as any).response?.data?.message === "string"
                    ? (error as any).response.data.message
                    : "Không thể gửi lại mã. Vui lòng thử lại.";
            setResendError(message);
        } finally {
            setIsResending(false);
        }
    };

    return (
        <div className="w-full max-w-md mx-auto">
            <div className="bg-white rounded-[32px] shadow-xl shadow-slate-200/50 border border-slate-200 p-8 md:p-10">
                {/* Header */}
                <div className="flex flex-col items-center mb-8">
                    <div className="w-16 h-16 bg-violet-50 rounded-2xl flex items-center justify-center text-violet-600 mb-4">
                        <Headphones className="w-8 h-8" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900">Xác minh email</h1>
                    <p className="text-slate-500 text-sm mt-1 text-center">
                        Nhập mã xác thực 6 số đã được gửi về email của bạn
                    </p>
                </div>

                <form onSubmit={onSubmit} className="space-y-5">
                    {/* Alerts */}
                    {submitError && (
                        <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl flex items-center gap-3 text-sm animate-in fade-in zoom-in duration-200">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <p>{submitError}</p>
                        </div>
                    )}
                    {submitSuccess && (
                        <div className="bg-green-50 border border-green-100 text-green-700 px-4 py-3 rounded-xl flex items-center gap-3 text-sm animate-in fade-in zoom-in duration-200">
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            <p>{submitSuccess}</p>
                        </div>
                    )}
                    {resendMessage && (
                        <div className="bg-green-50 border border-green-100 text-green-700 px-4 py-3 rounded-xl flex items-center gap-3 text-sm animate-in fade-in zoom-in duration-200">
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            <p>{resendMessage}</p>
                        </div>
                    )}
                    {resendError && (
                        <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl flex items-center gap-3 text-sm animate-in fade-in zoom-in duration-200">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <p>{resendError}</p>
                        </div>
                    )}

                    {/* Email */}
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700 ml-1">Email</label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-violet-500 transition-colors">
                                <Mail className="w-5 h-5" />
                            </div>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all text-slate-900 placeholder:text-slate-400"
                                placeholder="nhap@email.com"
                            />
                        </div>
                    </div>

                    {/* OTP — 6 individual boxes */}
                    <div className="space-y-3">
                        <label className="text-sm font-semibold text-slate-700 ml-1">Mã xác thực 6 số</label>
                        <div className="flex items-center justify-between gap-2">
                            {Array.from({ length: OTP_LENGTH }).map((_, i) => (
                                <input
                                    key={i}
                                    ref={(el) => { inputRefs.current[i] = el; }}
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={1}
                                    value={otp[i]}
                                    onChange={(e) => handleOtpChange(i, e.target.value)}
                                    onKeyDown={(e) => handleKeyDown(i, e)}
                                    onPaste={handlePaste}
                                    onFocus={(e) => e.target.select()}
                                    className={`
                                        w-12 h-14 text-center text-xl font-bold rounded-2xl border transition-all
                                        bg-slate-50 text-slate-900
                                        focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500
                                        ${otp[i]
                                            ? "border-violet-400 bg-violet-50 text-violet-700 shadow-sm shadow-violet-100"
                                            : "border-slate-200"
                                        }
                                    `}
                                    aria-label={`Chữ số thứ ${i + 1}`}
                                />
                            ))}
                        </div>
                        <p className="text-xs text-slate-400 ml-1">{code.length}/6 chữ số đã nhập</p>
                    </div>

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={isSubmitting || code.length < OTP_LENGTH}
                        className="w-full py-3.5 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-2xl shadow-lg shadow-violet-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                        {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Xác minh email"}
                    </button>
                </form>

                {/* Resend */}
                <div className="mt-6 pt-6 border-t border-slate-100 flex items-center justify-center gap-2">
                    <span className="text-sm text-slate-500">Không nhận được mã?</span>
                    <button
                        type="button"
                        onClick={onResendCode}
                        disabled={isResending || !email}
                        className="flex items-center gap-1.5 text-sm text-violet-600 hover:text-violet-700 font-semibold transition-colors disabled:opacity-50"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isResending ? "animate-spin" : ""}`} />
                        {isResending ? "Đang gửi..." : "Gửi lại mã"}
                    </button>
                </div>

                <p className="mt-4 text-center text-sm text-slate-500">
                    Quay lại{" "}
                    <Link href="/login" className="text-violet-600 hover:text-violet-700 font-semibold transition-colors">
                        Đăng nhập
                    </Link>
                </p>
            </div>
        </div>
    );
}

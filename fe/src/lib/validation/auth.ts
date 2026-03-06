import * as z from "zod";

export const loginSchenma = z.object({
    email: z.string().min(1, "Email không được để trống").email("Email không hợp lệ"),
    password: z.string().min(6, "Mật khẩu phải có ít nhất 6 ký tự"),
    rememberMe: z.boolean().default(false).optional(),
});

export const registerSchema = z.object({
    displayName: z.string().min(2, "Tên hiển thị phải có ít nhất 2 ký tự"),
    email: z.string().email("Email không hợp lệ"),
    password: z.string().min(6, "Mật khẩu phải có ít nhất 6 ký tự"),
    confirmPassword: z.string(),
    acceptTerms: z.literal(true,"Bạn phải chấp nhận điều khoản sử dụng"),
}).refine((data) => data.password === data.confirmPassword, {
    message: "Mật khẩu xác nhận không khớp",
    path: ["confirmPassword"],
});

export const forgotShema = z.object({
    email: z.string().email("Email không hợp lệ"),
});

export const resetSchema = z.object({
    password: z.string().min(6, "Mật khẩu phải có ít nhất 6 ký tự"),
    confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
    message: "Mật khẩu xác nhận không khớp",
});

export const resetByCodeSchema = z.object({
    email: z.string().email("Email không hợp lệ"),
    code: z.string().regex(/^\d{6}$/, "Mã đặt lại phải gồm đúng 6 chữ số"),
    password: z.string().min(6, "Mật khẩu phải có ít nhất 6 ký tự"),
    confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
    message: "Mật khẩu xác nhận không khớp",
    path: ["confirmPassword"],
});

export const verifyEmailSchema = z.object({
    email: z.string().email("Email không hợp lệ"),
    code: z.string().regex(/^\d{6}$/, "Mã xác thực phải gồm đúng 6 chữ số"),
});
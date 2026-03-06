"use client";

import { useState } from "react";
import { Edit2, Loader2 } from "lucide-react";
import { UploadButton } from "@/lib/uploadthing";
import { useUserStore } from "@/stores/user-store";
import { apiClient } from "@/lib/api/api-client";

export default function AvatarUpload() {
    const { user, setUser } = useUserStore();
    const [isUploading, setIsUploading] = useState(false);

    if (!user) return null;

    return (
        <div className="absolute bottom-2 right-2 z-20">
            <UploadButton
                endpoint="imageUploader"
                onUploadProgress={() => setIsUploading(true)}
                onClientUploadComplete={async (res) => {
                    setIsUploading(false);
                    if (!res || res.length === 0) return;

                    const newAvatarUrl = res[0]?.url;
                    if (!newAvatarUrl) return;

                    try {
                        // Update Backend
                        await apiClient.patch("/auth/me", {
                            avatar_url: newAvatarUrl
                        });

                        // Update Local Store
                        setUser({
                            ...user,
                            avatarUrl: newAvatarUrl
                        });

                        alert("Cập nhật ảnh đại diện thành công!");
                    } catch (error) {
                        console.error("Failed to sync avatar with backend", error);
                        alert("Lỗi khi đồng bộ ảnh đại diện với máy chủ.");
                    }
                }}
                onUploadError={(error: Error) => {
                    setIsUploading(false);
                    alert(`Lỗi khi tải ảnh: ${error.message}`);
                }}
                appearance={{
                    button({ ready, isUploading }) {
                        return {
                            padding: 0,
                            width: "40px",
                            height: "40px",
                            minWidth: "40px",
                            borderRadius: "12px",
                            backgroundColor: "#2563eb",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            border: "2px solid white",
                            transition: "all 0.2s ease-in-out",
                            fontSize: "0px", // Hide any residual text
                            cursor: "pointer",
                            ...(isUploading ? { opacity: 0.7, cursor: "not-allowed" } : {}),
                        };
                    },
                    allowedContent: {
                        display: "none"
                    }
                }}
                content={{
                    button({ isUploading }) {
                        if (isUploading) return <Loader2 className="w-5 h-5 animate-spin text-white" />;
                        return <Edit2 className="w-4 h-4 text-white" />;
                    }
                }}
            />
        </div>
    );
}

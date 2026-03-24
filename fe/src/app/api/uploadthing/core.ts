import { createUploadthing, type FileRouter } from "uploadthing/next";

const f = createUploadthing();

export const ourFileRouter = {
    imageUploader: f({
        "image/jpeg": { maxFileSize: "4MB", maxFileCount: 1 },
        "image/png": { maxFileSize: "4MB", maxFileCount: 1 },
        "image/webp": { maxFileSize: "4MB", maxFileCount: 1 },
        "image/gif": { maxFileSize: "4MB", maxFileCount: 1 },
    })
        .middleware(async () => {
            return { userId: "user_test" };
        })
        .onUploadComplete(async ({ metadata, file }) => {
            console.log("Upload complete for userId:", metadata.userId);
            console.log("File URL", file.url);
            return { uploadedBy: metadata.userId };
        }),
    audioUploader: f({
        audio: {
            maxFileSize: "64MB",
            maxFileCount: 1,
        },
    })
        .middleware(async () => {
            return { userId: "user_test" };
        })
        .onUploadComplete(async ({ metadata, file }) => {
            console.log("Audio upload complete for userId:", metadata.userId);
            console.log("Audio File URL", file.url);
            return { uploadedBy: metadata.userId };
        }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;

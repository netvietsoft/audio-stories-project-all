import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";

const f = createUploadthing();

// FileRouter for our app, can contain multiple FileRoutes
export const ourFileRouter = {
    // Define as many FileRoutes as you like, each with a unique routeSlug
    imageUploader: f({
        image: {
            maxFileSize: "4MB",
            maxFileCount: 1,
        },
    })
        .middleware(async ({ req }) => {
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
        .middleware(async ({ req }) => {
            return { userId: "user_test" };
        })
        .onUploadComplete(async ({ metadata, file }) => {
            console.log("Audio Upload complete for userId:", metadata.userId);
            console.log("File URL", file.url);
            return { uploadedBy: metadata.userId };
        }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;

import { UTApi } from "uploadthing/server";
import { NextResponse } from "next/server";

const utapi = new UTApi();

export async function POST(req: Request) {
    try {
        const { fileKey } = await req.json();

        if (!fileKey) {
            return NextResponse.json({ error: "File key is required" }, { status: 400 });
        }

        console.log("Deleting file from UploadThing:", fileKey);
        await utapi.deleteFiles(fileKey);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to delete file from UploadThing:", error);
        return NextResponse.json({ error: "Failed to delete file" }, { status: 500 });
    }
}

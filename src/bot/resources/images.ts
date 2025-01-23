import dotenv from "dotenv";
import path from "node:path";

dotenv.config({path: path.resolve(__dirname, "../../../.env.secret")});


export const Images = {
    APE_LOGO_WIDE: process.env.IMAGE_LOGO_WIDE,
} as const;
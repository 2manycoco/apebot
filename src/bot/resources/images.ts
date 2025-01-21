import dotenv from "dotenv";
import path from "node:path";

dotenv.config({path: path.resolve(__dirname, "../../../.env.secret")});


export const Images = {
    APE_LOGO: process.env.IMAGE_LOGO_APE_LOGO,
} as const;
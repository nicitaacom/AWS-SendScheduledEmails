"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabaseAdmin = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
// Validate environment variables
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error("Environment variable NEXT_PUBLIC_SUPABASE_URL is not defined");
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Environment variable SUPABASE_SERVICE_ROLE_KEY is not defined");
}
exports.supabaseAdmin = (0, supabase_js_1.createClient)(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
exports.default = exports.supabaseAdmin;

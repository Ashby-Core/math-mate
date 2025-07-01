import { UUID } from "crypto";
import { Timestamp } from "next/dist/server/lib/cache-handlers/types";

export type Profile = {
    first_name: string,
    last_name: string,
    username: string,
}

export type Course = {
    id: UUID,
    createdAt: Timestamp,
    teacher: UUID,
    name: string,
    code: string,
}
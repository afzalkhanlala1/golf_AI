import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireUser } from "@/lib/auth/current-user";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { SUPPORTED_LOCALES } from "@/lib/i18n/locales";
import { SPEED_UNITS } from "@/lib/i18n/units";

export const runtime = "nodejs";

const ProfilePatch = z.object({
  // Bounds are sanity rails, not gatekeeping: they exist so a typo like
  // 18 (metres) instead of 180 (cm) cannot silently produce a confident
  // and completely wrong club length.
  heightCm: z.number().min(120).max(230).nullable().optional(),
  wristToFloorCm: z.number().min(50).max(120).nullable().optional(),
  handicap: z.number().min(-10).max(54).nullable().optional(),
  locale: z.enum(SUPPORTED_LOCALES).optional(),
  speedUnit: z.enum(SPEED_UNITS).optional(),
});

export async function GET() {
  const userId = await requireUser();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const [row] = await db
    .select({
      heightCm: users.heightCm,
      wristToFloorCm: users.wristToFloorCm,
      handicap: users.handicap,
      locale: users.locale,
      speedUnit: users.speedUnit,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return NextResponse.json({
    profile: row ?? {
      heightCm: null,
      wristToFloorCm: null,
      handicap: null,
      locale: "en",
      speedUnit: "mph",
    },
  });
}

export async function PATCH(request: Request) {
  const userId = await requireUser();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let patch: z.infer<typeof ProfilePatch>;
  try {
    patch = ProfilePatch.parse(await request.json());
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof z.ZodError
            ? err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
            : "Invalid profile update",
      },
      { status: 400 },
    );
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: true });
  }

  const db = getDb();
  await db.update(users).set(patch).where(eq(users.id, userId));
  return NextResponse.json({ ok: true });
}

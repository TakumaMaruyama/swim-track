import { hashPassword } from "../server/auth";
import { db } from "../db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";

async function updateAdminPassword() {
  try {
    const hashedPassword = await hashPassword("dpjm3756");
    
    const [admin] = await db
      .update(users)
      .set({
        password: hashedPassword,
        role: "admin"
      })
      .where(eq(users.username, "丸山拓真"))
      .returning();
    
    console.log("Admin user updated successfully:", admin);
  } catch (error) {
    console.error("Failed to update admin user:", error);
  }
}

updateAdminPassword();

import { hashPassword } from "../server/auth";
import { db } from "../db";
import { users } from "../db/schema";

async function createAdminUser() {
  try {
    const hashedPassword = await hashPassword("dpjm3756");
    
    const [admin] = await db
      .insert(users)
      .values({
        username: "丸山拓真",
        password: hashedPassword,
        role: "admin",
        isActive: true,
      })
      .returning();
    
    console.log("Admin user created successfully:", admin);
  } catch (error) {
    console.error("Failed to create admin user:", error);
  }
}

createAdminUser();

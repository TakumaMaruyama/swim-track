
import { db } from "../db";
import { users } from "../db/schema";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

async function createStudent() {
  try {
    const username = "寺園弥広";
    const password = "password"; // 初期パスワード
    
    // パスワードのハッシュ化
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // ユーザーの存在チェック
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);
    
    if (existingUser.length > 0) {
      console.log(`ユーザー "${username}" は既に存在します`);
      process.exit(0);
    }
    
    // 新しい選手の作成
    const [newUser] = await db
      .insert(users)
      .values({
        username,
        password: hashedPassword,
        role: "student",
        isActive: true
      })
      .returning();
    
    console.log(`選手 "${username}" を作成しました。ID: ${newUser.id}`);
  } catch (error) {
    console.error("選手の作成に失敗しました:", error);
  } finally {
    process.exit(0);
  }
}

createStudent();

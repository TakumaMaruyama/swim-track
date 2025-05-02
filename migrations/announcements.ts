import { db } from "../db";
import { sql } from "drizzle-orm";

async function createAnnouncementsTable() {
  try {
    // Check if the table exists
    const tableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_name = 'announcements'
      );
    `);
    
    const exists = tableExists.rows[0].exists;
    
    if (!exists) {
      console.log('Creating announcements table...');
      
      await db.execute(sql`
        CREATE TABLE announcements (
          id SERIAL PRIMARY KEY,
          content TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          created_by INTEGER REFERENCES users(id)
        );
      `);
      
      console.log('Announcements table created successfully.');
    } else {
      console.log('Announcements table already exists.');
    }
  } catch (error) {
    console.error('Error creating announcements table:', error);
  }
}

createAnnouncementsTable().catch(console.error);
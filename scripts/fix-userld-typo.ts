/**
 * Fix userld typo in followup_mappings table
 * This script checks if the column is named 'userld' and renames it to 'userId'
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixUserldTypo() {
  try {
    console.log('Checking for userld typo in followup_mappings table...')

    // Check if column 'userld' exists using raw query
    const columnCheck = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'followup_mappings' 
      AND column_name IN ('userld', 'userId', 'user_id')
    `

    console.log('Found columns:', columnCheck)

    const hasUserld = columnCheck.some(col => col.column_name === 'userld')
    const hasUserId = columnCheck.some(col => col.column_name === 'userId')

    if (hasUserld && !hasUserId) {
      console.log('Found "userld" column - renaming to "userId"...')
      
      // Rename the column
      await prisma.$executeRaw`
        ALTER TABLE "public"."followup_mappings" 
        RENAME COLUMN "userld" TO "userId"
      `
      
      console.log('✅ Successfully renamed "userld" to "userId"')
    } else if (hasUserld && hasUserId) {
      console.log('⚠️  Both "userld" and "userId" exist - migrating data and dropping "userld"...')
      
      // Copy data from userld to userId if userId is null
      await prisma.$executeRaw`
        UPDATE "public"."followup_mappings" 
        SET "userId" = "userld" 
        WHERE "userId" IS NULL AND "userld" IS NOT NULL
      `
      
      // Drop the userld column
      await prisma.$executeRaw`
        ALTER TABLE "public"."followup_mappings" 
        DROP COLUMN "userld"
      `
      
      console.log('✅ Successfully migrated data and dropped "userld" column')
    } else if (hasUserId) {
      console.log('✅ Column "userId" already exists correctly')
    } else {
      console.log('⚠️  Neither "userld" nor "userId" found - column may need to be created')
      console.log('   Run the migration to add userId column')
    }

    // Also check followup_rules table
    console.log('\nChecking followup_rules table...')
    const rulesCheck = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'followup_rules' 
      AND column_name IN ('userld', 'userId', 'user_id')
    `

    console.log('Found columns:', rulesCheck)

    const rulesHasUserld = rulesCheck.some(col => col.column_name === 'userld')
    const rulesHasUserId = rulesCheck.some(col => col.column_name === 'userId')

    if (rulesHasUserld && !rulesHasUserId) {
      console.log('Found "userld" column in followup_rules - renaming to "userId"...')
      
      await prisma.$executeRaw`
        ALTER TABLE "public"."followup_rules" 
        RENAME COLUMN "userld" TO "userId"
      `
      
      console.log('✅ Successfully renamed "userld" to "userId" in followup_rules')
    } else if (rulesHasUserld && rulesHasUserId) {
      console.log('⚠️  Both "userld" and "userId" exist in followup_rules - migrating data...')
      
      await prisma.$executeRaw`
        UPDATE "public"."followup_rules" 
        SET "userId" = "userld" 
        WHERE "userId" IS NULL AND "userld" IS NOT NULL
      `
      
      await prisma.$executeRaw`
        ALTER TABLE "public"."followup_rules" 
        DROP COLUMN "userld"
      `
      
      console.log('✅ Successfully migrated data and dropped "userld" column from followup_rules')
    } else if (rulesHasUserId) {
      console.log('✅ Column "userId" already exists correctly in followup_rules')
    }

    console.log('\n✅ Fix completed successfully!')
    console.log('   Please regenerate Prisma Client: npx prisma generate')

  } catch (error) {
    console.error('❌ Error fixing typo:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

fixUserldTypo()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })




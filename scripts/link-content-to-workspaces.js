/**
 * Link Existing Content to Workspaces
 * 
 * This script links existing sally_sales_content to their corresponding workspaces
 * based on companyId matching. Useful for migrating existing content.
 * 
 * Usage: node scripts/link-content-to-workspaces.js
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function linkContentToWorkspaces() {
  try {
    console.log('🔗 Linking content to workspaces...\n');
    
    // Find all content without workspaceId
    const unlinkedContent = await prisma.sally_sales_content.findMany({
      where: {
        workspaceId: null,
      },
      select: {
        id: true,
        userId: true,
        companyId: true,
        updatedAt: true,
      },
    });
    
    console.log(`📊 Found ${unlinkedContent.length} unlinked content entries\n`);
    
    if (unlinkedContent.length === 0) {
      console.log('✅ All content is already linked to workspaces!');
      return;
    }
    
    let linkedCount = 0;
    let skippedCount = 0;
    
    for (const content of unlinkedContent) {
      try {
        // Find the most recent workspace for this company and user
        const workspace = await prisma.sales_workspaces.findFirst({
          where: {
            userId: content.userId,
            companyId: content.companyId,
          },
          orderBy: {
            updatedAt: 'desc',
          },
        });
        
        if (workspace) {
          // Link content to workspace
          await prisma.sally_sales_content.update({
            where: { id: content.id },
            data: { workspaceId: workspace.id },
          });
          
          console.log(`✅ Linked content ${content.id} to workspace ${workspace.id} (${workspace.title})`);
          linkedCount++;
        } else {
          // No workspace exists for this company - create one
          const company = await prisma.sally_companies.findFirst({
            where: { id: content.companyId },
          });
          
          if (company) {
            const workspaceTitle = `${company.name} - sales effort`;
            const newWorkspace = await prisma.sales_workspaces.create({
              data: {
                id: require('uuid').v4(),
                userId: content.userId,
                companyId: content.companyId,
                title: workspaceTitle,
                goalType: 'sales_effort',
                metadata: {},
              },
            });
            
            // Link content to new workspace
            await prisma.sally_sales_content.update({
              where: { id: content.id },
              data: { workspaceId: newWorkspace.id },
            });
            
            console.log(`✅ Created workspace ${newWorkspace.id} and linked content ${content.id}`);
            linkedCount++;
          } else {
            console.log(`⚠️  Skipped content ${content.id} - company not found`);
            skippedCount++;
          }
        }
      } catch (error) {
        console.error(`❌ Error processing content ${content.id}:`, error.message);
        skippedCount++;
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Linked: ${linkedCount}`);
    console.log(`   ⚠️  Skipped: ${skippedCount}`);
    console.log(`   📝 Total: ${unlinkedContent.length}`);
    
    // Also handle content that might be linked to wrong workspace
    console.log('\n🔍 Checking for content linked to wrong workspaces...\n');
    
    const allContent = await prisma.sally_sales_content.findMany({
      where: {
        workspaceId: { not: null },
      },
      select: {
        id: true,
        userId: true,
        companyId: true,
        workspaceId: true,
      },
    });
    
    let fixedCount = 0;
    
    for (const content of allContent) {
      try {
        // Verify workspace belongs to same company
        const workspace = await prisma.sales_workspaces.findFirst({
          where: {
            id: content.workspaceId,
            userId: content.userId,
            companyId: content.companyId,
          },
        });
        
        if (!workspace) {
          // Workspace doesn't match - find correct one
          const correctWorkspace = await prisma.sales_workspaces.findFirst({
            where: {
              userId: content.userId,
              companyId: content.companyId,
            },
            orderBy: {
              updatedAt: 'desc',
            },
          });
          
          if (correctWorkspace) {
            await prisma.sally_sales_content.update({
              where: { id: content.id },
              data: { workspaceId: correctWorkspace.id },
            });
            console.log(`✅ Fixed content ${content.id} - moved to correct workspace ${correctWorkspace.id}`);
            fixedCount++;
          }
        }
      } catch (error) {
        console.error(`❌ Error checking content ${content.id}:`, error.message);
      }
    }
    
    if (fixedCount > 0) {
      console.log(`\n✅ Fixed ${fixedCount} content entries with incorrect workspace links`);
    } else {
      console.log(`\n✅ All content is linked to correct workspaces`);
    }
    
    console.log('\n✅ Linking complete!');
    
  } catch (error) {
    console.error('❌ Error linking content:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

linkContentToWorkspaces();

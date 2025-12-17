import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function seedFollowupLeads() {
  console.log('🌱 Seeding Followup Agent Lead data...')

  // Clear existing leads
  await prisma.lead.deleteMany({})
  console.log('✅ Cleared existing leads')

  // Create realistic lead data
  const leads = [
    {
      name: 'Sarah Johnson',
      email: 'sarah.johnson@email.com',
      replyStatus: 'NoReply' as const,
      lastEmailSent: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    },
    {
      name: 'Mike Chen',
      email: 'mike.chen@company.com',
      replyStatus: 'Replied' as const,
      lastEmailSent: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
    },
    {
      name: 'Emily Rodriguez',
      email: 'emily.rodriguez@business.org',
      replyStatus: 'NoReply' as const,
      lastEmailSent: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
    },
    {
      name: 'David Kim',
      email: 'david.kim@startup.io',
      replyStatus: 'Bounced' as const,
      lastEmailSent: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    },
    {
      name: 'Lisa Thompson',
      email: 'lisa.thompson@corp.net',
      replyStatus: 'NoReply' as const,
      lastEmailSent: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
    },
    {
      name: 'James Wilson',
      email: 'james.wilson@enterprise.com',
      replyStatus: 'Replied' as const,
      lastEmailSent: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
    },
    {
      name: 'Maria Garcia',
      email: 'maria.garcia@consulting.biz',
      replyStatus: 'NoReply' as const,
      lastEmailSent: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), // 4 days ago
    },
    {
      name: 'Robert Brown',
      email: 'robert.brown@tech.co',
      replyStatus: 'Bounced' as const,
      lastEmailSent: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), // 6 days ago
    },
    {
      name: 'Jennifer Davis',
      email: 'jennifer.davis@agency.com',
      replyStatus: 'NoReply' as const,
      lastEmailSent: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), // 8 days ago
    },
    {
      name: 'Michael Taylor',
      email: 'michael.taylor@firm.org',
      replyStatus: 'Replied' as const,
      lastEmailSent: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    }
  ]

  // Insert leads
  for (const lead of leads) {
    await prisma.lead.create({
      data: lead
    })
  }

  console.log(`✅ Created ${leads.length} realistic leads`)
  console.log('📊 Lead distribution:')
  console.log(`   - NoReply: ${leads.filter(l => l.replyStatus === 'NoReply').length}`)
  console.log(`   - Replied: ${leads.filter(l => l.replyStatus === 'Replied').length}`)
  console.log(`   - Bounced: ${leads.filter(l => l.replyStatus === 'Bounced').length}`)
  
  console.log('🎉 Followup Agent Lead seeding completed!')
}

async function main() {
  try {
    await seedFollowupLeads()
  } catch (error) {
    console.error('❌ Error seeding followup leads:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()

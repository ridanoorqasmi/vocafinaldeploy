const { PrismaClient, BusinessStatus, UserRole, UsageType, ApiKeyStatus, SubscriptionStatus } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// ===== SIMPLE DATA GENERATORS =====

const companies = ['Pizza Palace', 'Burger King', 'Taco Bell', 'Subway', 'KFC', 'McDonald\'s', 'Starbucks', 'Dunkin\' Donuts'];
const firstNames = ['John', 'Jane', 'Mike', 'Sarah', 'David', 'Lisa', 'Chris', 'Amy', 'Tom', 'Emma'];
const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];
const cities = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego'];
const states = ['NY', 'CA', 'IL', 'TX', 'AZ', 'PA', 'TX', 'CA'];
const categories = ['Appetizers', 'Main Courses', 'Desserts', 'Beverages', 'Specials'];
const policyTypes = ['delivery', 'refund', 'privacy', 'terms', 'cancellation'];
const kbCategories = ['FAQ', 'Policies', 'Procedures', 'Training'];
const allergens = ['gluten', 'dairy', 'nuts', 'soy', 'eggs'];
const orderStatuses = ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED'];
const queryStatuses = ['SUCCESS', 'ERROR', 'TIMEOUT', 'RATE_LIMITED'];

function randomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function randomElements<T>(array: T[], min: number, max: number): T[] {
  const count = Math.floor(Math.random() * (max - min + 1)) + min;
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number, decimals: number = 2): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function randomDate(daysAgo: number = 30): Date {
  const now = new Date();
  const past = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
  return new Date(past.getTime() + Math.random() * (now.getTime() - past.getTime()));
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// ===== FACTORY FUNCTIONS =====

class DataFactory {
  static async createBusiness(overrides: any = {}) {
    const name = randomElement(companies) + ' ' + randomInt(1, 999);
    const slug = slugify(name);
    const email = `admin@${slug}.com`;
    const password = 'password123';
    const passwordHash = await bcrypt.hash(password, 10);

    return {
      name,
      slug,
      email,
      passwordHash,
      status: randomElement(Object.values(BusinessStatus)),
      phone: `+1-${randomInt(200, 999)}-${randomInt(200, 999)}-${randomInt(1000, 9999)}`,
      website: `https://${slug}.com`,
      description: `Delicious food and great service at ${name}`,
      timezone: randomElement(['UTC', 'America/New_York', 'America/Los_Angeles', 'Europe/London']),
      currency: randomElement(['USD', 'EUR', 'GBP', 'CAD']),
      language: randomElement(['en', 'es', 'fr', 'de']),
      ...overrides
    };
  }

  static async createUser(businessId: string, overrides: any = {}) {
    const firstName = randomElement(firstNames);
    const lastName = randomElement(lastNames);
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@business.com`;
    const password = 'password123';
    const passwordHash = await bcrypt.hash(password, 10);

    return {
      businessId,
      email,
      passwordHash,
      firstName,
      lastName,
      role: randomElement(Object.values(UserRole)),
      isActive: Math.random() > 0.1, // 90% active
      lastLoginAt: randomDate(7),
      ...overrides
    };
  }

  static createLocation(businessId: string, overrides: any = {}) {
    const city = randomElement(cities);
    const state = randomElement(states);
    return {
      businessId,
      name: randomElement(companies) + ' Location',
      address: `${randomInt(100, 9999)} Main St`,
      city,
      state,
      zipCode: `${randomInt(10000, 99999)}`,
      country: 'US',
      phone: `+1-${randomInt(200, 999)}-${randomInt(200, 999)}-${randomInt(1000, 9999)}`,
      isActive: Math.random() > 0.1,
      ...overrides
    };
  }

  static createOperatingHour(locationId: string, dayOfWeek: number, overrides: any = {}) {
    return {
      locationId,
      dayOfWeek,
      openTime: randomElement(['08:00', '09:00', '10:00']),
      closeTime: randomElement(['20:00', '21:00', '22:00']),
      isClosed: Math.random() < 0.1, // 10% closed
      ...overrides
    };
  }

  static createCategory(businessId: string, overrides: any = {}) {
    return {
      businessId,
      name: randomElement(categories),
      description: `Delicious ${randomElement(categories).toLowerCase()} for your enjoyment`,
      sortOrder: randomInt(0, 100),
      isActive: Math.random() > 0.1,
      ...overrides
    };
  }

  static createMenuItem(businessId: string, categoryId?: string, overrides: any = {}) {
    const itemNames = ['Pizza', 'Burger', 'Pasta', 'Salad', 'Sandwich', 'Soup', 'Fries', 'Drink'];
    const name = randomElement(itemNames) + ' ' + randomInt(1, 99);
    return {
      businessId,
      categoryId,
      name,
      description: `Delicious ${name.toLowerCase()} made with fresh ingredients`,
      price: randomFloat(5, 50),
      image: `https://example.com/images/${slugify(name)}.jpg`,
      isAvailable: Math.random() > 0.1,
      sortOrder: randomInt(0, 100),
      allergens: randomElements(allergens, 0, 3),
      calories: randomInt(100, 1000),
      prepTime: randomInt(5, 60),
      ...overrides
    };
  }

  static createPolicy(businessId: string, overrides: any = {}) {
    const type = randomElement(policyTypes);
    return {
      businessId,
      type,
      title: `${type.charAt(0).toUpperCase() + type.slice(1)} Policy`,
      content: `This is our ${type} policy. Please read carefully and follow all guidelines.`,
      isActive: Math.random() > 0.1,
      effectiveDate: randomDate(30),
      ...overrides
    };
  }

  static createKnowledgeBase(businessId: string, overrides: any = {}) {
    const category = randomElement(kbCategories);
    return {
      businessId,
      title: `${category} - Important Information`,
      content: `This is important ${category.toLowerCase()} information that you should know.`,
      category,
      tags: randomElements(['important', 'urgent', 'general', 'specific'], 1, 3),
      isActive: Math.random() > 0.1,
      viewCount: randomInt(0, 1000),
      ...overrides
    };
  }

  static createApiKey(businessId: string, overrides: any = {}) {
    return {
      businessId,
      name: `API Key ${randomInt(1, 99)}`,
      keyHash: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
      status: randomElement(Object.values(ApiKeyStatus)),
      permissions: randomElements(['read', 'write', 'admin'], 1, 3),
      lastUsedAt: randomDate(7),
      expiresAt: new Date(Date.now() + (365 * 24 * 60 * 60 * 1000)), // 1 year from now
      ...overrides
    };
  }

  static createSubscription(businessId: string, overrides: any = {}) {
    const startDate = randomDate(30);
    const endDate = new Date(startDate.getTime() + (365 * 24 * 60 * 60 * 1000)); // 1 year later
    
    return {
      businessId,
      planId: randomElement(['basic', 'pro', 'enterprise']),
      status: randomElement(Object.values(SubscriptionStatus)),
      currentPeriodStart: startDate,
      currentPeriodEnd: endDate,
      cancelAtPeriodEnd: Math.random() < 0.1,
      trialStart: Math.random() < 0.3 ? randomDate(60) : null,
      trialEnd: Math.random() < 0.3 ? new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)) : null,
      ...overrides
    };
  }

  static createUsageMetric(businessId: string, overrides: any = {}) {
    return {
      businessId,
      type: randomElement(Object.values(UsageType)),
      count: randomInt(1, 1000),
      metadata: {
        source: randomElement(['web', 'api', 'mobile']),
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        ipAddress: `${randomInt(1, 255)}.${randomInt(1, 255)}.${randomInt(1, 255)}.${randomInt(1, 255)}`
      },
      date: randomDate(30),
      ...overrides
    };
  }

  static createQueryLog(businessId: string, overrides: any = {}) {
    return {
      businessId,
      query: 'What are your menu items?',
      response: 'Here are our available menu items...',
      status: randomElement(queryStatuses),
      responseTime: randomInt(50, 5000),
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      ipAddress: `${randomInt(1, 255)}.${randomInt(1, 255)}.${randomInt(1, 255)}.${randomInt(1, 255)}`,
      metadata: {
        endpoint: 'https://api.example.com/query',
        method: randomElement(['GET', 'POST', 'PUT', 'DELETE'])
      },
      ...overrides
    };
  }

  static createOrder(businessId: string, overrides: any = {}) {
    const firstName = randomElement(firstNames);
    const lastName = randomElement(lastNames);
    return {
      businessId,
      customerName: `${firstName} ${lastName}`,
      customerContact: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@email.com`,
      status: randomElement(orderStatuses),
      totalPrice: randomFloat(10, 200),
      ...overrides
    };
  }
}

// ===== SEEDING FUNCTIONS =====

async function seedBusinesses() {
  console.log('🌱 Seeding businesses...');
  
  const businesses = [];
  
  // Create 5 sample businesses
  for (let i = 0; i < 5; i++) {
    const businessData = await DataFactory.createBusiness({
      status: BusinessStatus.ACTIVE
    });
    
    const business = await prisma.business.create({
      data: businessData
    });
    
    businesses.push(business);
  }
  
  console.log(`✅ Created ${businesses.length} businesses`);
  return businesses;
}

async function seedUsers(businesses: any[]) {
  console.log('👥 Seeding users...');
  
  const users = [];
  
  for (const business of businesses) {
    // Create 1-3 users per business
    const userCount = randomInt(1, 3);
    
    for (let i = 0; i < userCount; i++) {
      const userData = await DataFactory.createUser(business.id, {
        role: i === 0 ? UserRole.OWNER : randomElement([UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF])
      });
      
      const user = await prisma.user.create({
        data: userData
      });
      
      users.push(user);
    }
  }
  
  console.log(`✅ Created ${users.length} users`);
  return users;
}

async function seedLocations(businesses: any[]) {
  console.log('📍 Seeding locations...');
  
  const locations = [];
  
  for (const business of businesses) {
    // Create 1-2 locations per business
    const locationCount = randomInt(1, 2);
    
    for (let i = 0; i < locationCount; i++) {
      const locationData = DataFactory.createLocation(business.id);
      const location = await prisma.location.create({
        data: locationData
      });
      
      locations.push(location);
      
      // Create operating hours for each location
      for (let day = 0; day < 7; day++) {
        const hourData = DataFactory.createOperatingHour(location.id, day);
        await prisma.operatingHour.create({
          data: hourData
        });
      }
    }
  }
  
  console.log(`✅ Created ${locations.length} locations with operating hours`);
  return locations;
}

async function seedMenuItems(businesses: any[]) {
  console.log('🍕 Seeding menu items...');
  
  const menuItems = [];
  
  for (const business of businesses) {
    // Create categories first
    const categories = [];
    const categoryCount = randomInt(3, 6);
    
    for (let i = 0; i < categoryCount; i++) {
      const categoryData = DataFactory.createCategory(business.id, { sortOrder: i });
      const category = await prisma.category.create({
        data: categoryData
      });
      categories.push(category);
    }
    
    // Create menu items
    const itemCount = randomInt(10, 25);
    
    for (let i = 0; i < itemCount; i++) {
      const categoryId = randomElement(categories).id;
      const itemData = DataFactory.createMenuItem(business.id, categoryId, { sortOrder: i });
      const item = await prisma.menuItem.create({
        data: itemData
      });
      menuItems.push(item);
    }
  }
  
  console.log(`✅ Created ${menuItems.length} menu items`);
  return menuItems;
}

async function seedPolicies(businesses: any[]) {
  console.log('📋 Seeding policies...');
  
  const policies = [];
  
  for (const business of businesses) {
    const policyCount = randomInt(2, 5);
    
    for (let i = 0; i < policyCount; i++) {
      const policyData = DataFactory.createPolicy(business.id);
      const policy = await prisma.policy.create({
        data: policyData
      });
      policies.push(policy);
    }
  }
  
  console.log(`✅ Created ${policies.length} policies`);
  return policies;
}

async function seedKnowledgeBase(businesses: any[]) {
  console.log('📚 Seeding knowledge base...');
  
  const knowledgeBase = [];
  
  for (const business of businesses) {
    const kbCount = randomInt(5, 15);
    
    for (let i = 0; i < kbCount; i++) {
      const kbData = DataFactory.createKnowledgeBase(business.id);
      const kb = await prisma.knowledgeBase.create({
        data: kbData
      });
      knowledgeBase.push(kb);
    }
  }
  
  console.log(`✅ Created ${knowledgeBase.length} knowledge base entries`);
  return knowledgeBase;
}

async function seedApiKeys(businesses: any[]) {
  console.log('🔑 Seeding API keys...');
  
  const apiKeys = [];
  
  for (const business of businesses) {
    const keyCount = randomInt(1, 3);
    
    for (let i = 0; i < keyCount; i++) {
      const keyData = DataFactory.createApiKey(business.id);
      const key = await prisma.apiKey.create({
        data: keyData
      });
      apiKeys.push(key);
    }
  }
  
  console.log(`✅ Created ${apiKeys.length} API keys`);
  return apiKeys;
}

async function seedSubscriptions(businesses: any[]) {
  console.log('💳 Seeding subscriptions...');
  
  const subscriptions = [];
  
  for (const business of businesses) {
    const subData = DataFactory.createSubscription(business.id, {
      status: SubscriptionStatus.ACTIVE
    });
    const subscription = await prisma.subscription.create({
      data: subData
    });
    subscriptions.push(subscription);
  }
  
  console.log(`✅ Created ${subscriptions.length} subscriptions`);
  return subscriptions;
}

async function seedUsageMetrics(businesses: any[]) {
  console.log('📊 Seeding usage metrics...');
  
  const metrics = [];
  
  for (const business of businesses) {
    const metricCount = randomInt(10, 50);
    
    for (let i = 0; i < metricCount; i++) {
      const metricData = DataFactory.createUsageMetric(business.id);
      const metric = await prisma.usageMetric.create({
        data: metricData
      });
      metrics.push(metric);
    }
  }
  
  console.log(`✅ Created ${metrics.length} usage metrics`);
  return metrics;
}

async function seedQueryLogs(businesses: any[]) {
  console.log('📝 Seeding query logs...');
  
  const logs = [];
  
  for (const business of businesses) {
    const logCount = randomInt(20, 100);
    
    for (let i = 0; i < logCount; i++) {
      const logData = DataFactory.createQueryLog(business.id);
      const log = await prisma.queryLog.create({
        data: logData
      });
      logs.push(log);
    }
  }
  
  console.log(`✅ Created ${logs.length} query logs`);
  return logs;
}

async function seedOrders(businesses: any[]) {
  console.log('🛒 Seeding orders...');
  
  const orders = [];
  
  for (const business of businesses) {
    const orderCount = randomInt(5, 20);
    
    for (let i = 0; i < orderCount; i++) {
      const orderData = DataFactory.createOrder(business.id);
      const order = await prisma.order.create({
        data: orderData
      });
      orders.push(order);
    }
  }
  
  console.log(`✅ Created ${orders.length} orders`);
  return orders;
}

// ===== MAIN SEEDING FUNCTION =====

async function main() {
  console.log('🚀 Starting database seeding...\n');
  
  try {
    // Clear existing data
    console.log('🧹 Clearing existing data...');
    await prisma.queryLog.deleteMany();
    await prisma.usageMetric.deleteMany();
    await prisma.subscription.deleteMany();
    await prisma.apiKey.deleteMany();
    await prisma.knowledgeBase.deleteMany();
    await prisma.policy.deleteMany();
    await prisma.menuItem.deleteMany();
    await prisma.category.deleteMany();
    await prisma.operatingHour.deleteMany();
    await prisma.location.deleteMany();
    await prisma.user.deleteMany();
    await prisma.business.deleteMany();
    console.log('✅ Existing data cleared\n');
    
    // Seed data
    const businesses = await seedBusinesses();
    const users = await seedUsers(businesses);
    const locations = await seedLocations(businesses);
    const menuItems = await seedMenuItems(businesses);
    const policies = await seedPolicies(businesses);
    const knowledgeBase = await seedKnowledgeBase(businesses);
    const apiKeys = await seedApiKeys(businesses);
    const subscriptions = await seedSubscriptions(businesses);
    const usageMetrics = await seedUsageMetrics(businesses);
    const queryLogs = await seedQueryLogs(businesses);
    const orders = await seedOrders(businesses);
    
    console.log('\n🎉 Seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   Businesses: ${businesses.length}`);
    console.log(`   Users: ${users.length}`);
    console.log(`   Locations: ${locations.length}`);
    console.log(`   Menu Items: ${menuItems.length}`);
    console.log(`   Policies: ${policies.length}`);
    console.log(`   Knowledge Base: ${knowledgeBase.length}`);
    console.log(`   API Keys: ${apiKeys.length}`);
    console.log(`   Subscriptions: ${subscriptions.length}`);
    console.log(`   Usage Metrics: ${usageMetrics.length}`);
    console.log(`   Query Logs: ${queryLogs.length}`);
    console.log(`   Orders: ${orders.length}`);
    
    // Show sample business for API team
    const sampleBusiness = businesses[0];
    console.log('\n🔑 Sample Business for API Testing:');
    console.log(`   ID: ${sampleBusiness.id}`);
    console.log(`   Name: ${sampleBusiness.name}`);
    console.log(`   Email: ${sampleBusiness.email}`);
    console.log(`   Slug: ${sampleBusiness.slug}`);
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

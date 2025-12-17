import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { setBusinessContextFromToken, validateBusinessAccess } from '@/lib/auth'

const prisma = new PrismaClient()

// GET /api/business/[id]/menu - Get menu items for a business
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Extract and verify JWT token
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    
    // Set business context for RLS
    await setBusinessContextFromToken(token)
    
    // Validate business access
    const hasAccess = await validateBusinessAccess(params.id)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Business not found or access denied' }, { status: 404 })
    }

    // Fetch menu items - RLS will automatically filter by business_id
    const menuItems = await prisma.menuItem.findMany({
      where: {
        isAvailable: true,
        deletedAt: null
      },
      include: {
        category: true
      },
      orderBy: {
        sortOrder: 'asc'
      }
    })

    return NextResponse.json({ menuItems })

  } catch (error) {
    console.error('Error fetching menu items:', error)
    return NextResponse.json(
      { error: 'Failed to fetch menu items' },
      { status: 500 }
    )
  }
}

// POST /api/business/[id]/menu - Create new menu item
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Extract and verify JWT token
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    
    // Set business context for RLS
    await setBusinessContextFromToken(token)
    
    // Validate business access
    const hasAccess = await validateBusinessAccess(params.id)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Business not found or access denied' }, { status: 404 })
    }

    const body = await request.json()
    const { name, description, price, categoryId, image, allergens, calories, prepTime } = body

    // Create menu item - businessId will be automatically set by RLS context
    const menuItem = await prisma.menuItem.create({
      data: {
        businessId: params.id, // Explicitly set for clarity
        name,
        description,
        price: parseFloat(price),
        categoryId: categoryId || null,
        image: image || null,
        allergens: allergens || [],
        calories: calories ? parseInt(calories) : null,
        prepTime: prepTime ? parseInt(prepTime) : null,
        isAvailable: true,
        sortOrder: 0
      },
      include: {
        category: true
      }
    })

    return NextResponse.json({ menuItem }, { status: 201 })

  } catch (error) {
    console.error('Error creating menu item:', error)
    return NextResponse.json(
      { error: 'Failed to create menu item' },
      { status: 500 }
    )
  }
}


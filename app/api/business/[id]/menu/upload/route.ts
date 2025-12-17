import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'

const prisma = new PrismaClient()

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify JWT token
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as any

    if (payload.business_id !== params.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { items, categories } = await request.json()

    // Delete existing menu items for this business
    await prisma.menu.deleteMany({
      where: { businessId: params.id }
    })

    // Create new menu items
    const menuItems = await prisma.menu.createMany({
      data: items.map((item: any) => ({
        businessId: params.id,
        itemName: item.item_name,
        description: item.description,
        price: item.price,
        available: item.available,
        category: item.category,
        aiSuggested: item.ai_suggested || false
      }))
    })

    return NextResponse.json({
      success: true,
      message: 'Menu items saved successfully',
      count: menuItems.count
    })

  } catch (error) {
    console.error('Error saving menu items:', error)
    return NextResponse.json(
      { error: 'Failed to save menu items' },
      { status: 500 }
    )
  }
}


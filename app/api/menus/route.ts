import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getBusinessIdFromRequest } from '@/lib/auth'
import { menuItemSchema } from '@/lib/validation'

export async function GET(request: NextRequest) {
  try {
    const businessId = getBusinessIdFromRequest(request)
    
    if (!businessId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const menus = await prisma.menu.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' }
    })
    
    return NextResponse.json({
      success: true,
      data: menus
    })
    
  } catch (error) {
    console.error('Get menus error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch menus' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const businessId = getBusinessIdFromRequest(request)
    
    if (!businessId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const body = await request.json()
    const validatedData = menuItemSchema.parse(body)
    
    const menuItem = await prisma.menu.create({
      data: {
        businessId,
        itemName: validatedData.itemName,
        description: validatedData.description,
        price: validatedData.price,
        available: validatedData.available
      }
    })
    
    return NextResponse.json({
      success: true,
      data: menuItem
    })
    
  } catch (error) {
    console.error('Create menu error:', error)
    
    if (error instanceof Error && error.message.includes('Validation')) {
      return NextResponse.json(
        { error: 'Invalid input data' },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to create menu item' },
      { status: 500 }
    )
  }
}

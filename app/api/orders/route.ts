import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'

const prisma = new PrismaClient()

// Order validation schema
const orderSchema = z.object({
  items: z.array(z.object({
    name: z.string().min(1, 'Item name is required'),
    quantity: z.number().int().min(1, 'Quantity must be at least 1'),
    price: z.number().positive('Price must be positive').optional()
  })),
  customer: z.object({
    name: z.string().min(1, 'Customer name is required').max(100, 'Customer name too long'),
    phone: z.string().min(1, 'Customer phone is required').max(20, 'Phone number too long')
  }),
  status: z.enum(['pending', 'confirmed', 'cancelled', 'completed']).optional()
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')
    
    if (!businessId) {
      return NextResponse.json(
        { error: 'Business ID is required' },
        { status: 400 }
      )
    }
    
    const orders = await prisma.order.findMany({
      where: { businessId },
      include: {
        items: true
      },
      orderBy: { createdAt: 'desc' }
    })
    
    return NextResponse.json({
      success: true,
      data: orders
    })
    
  } catch (error) {
    console.error('Get orders error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { businessId, items, customer, status = 'pending' } = body
    
    if (!businessId) {
      return NextResponse.json(
        { error: 'Business ID is required' },
        { status: 400 }
      )
    }
    
    // Validate the request data
    const validatedData = orderSchema.parse({ items, customer, status })
    
    // Calculate total price with overflow protection
    const totalPrice = validatedData.items.reduce((sum, item) => {
      const itemPrice = Math.min(item.price || 0, 999999); // Cap price at 999,999
      const itemQuantity = Math.min(item.quantity, 100); // Cap quantity at 100
      return sum + (itemPrice * itemQuantity);
    }, 0);
    
    // Create the order with items
    const order = await prisma.order.create({
      data: {
        businessId,
        customerName: validatedData.customer.name,
        customerContact: validatedData.customer.phone,
        totalPrice,
        status: validatedData.status.toUpperCase() as any,
        items: {
          create: validatedData.items.map(item => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price || 0
          }))
        }
      },
      include: {
        items: true
      }
    })
    
    return NextResponse.json({
      success: true,
      data: {
        orderId: order.id,
        message: 'Order placed successfully!',
        order
      }
    })
    
  } catch (error) {
    console.error('Create order error:', error)
    
    if (error instanceof Error && error.message.includes('Validation')) {
      return NextResponse.json(
        { error: 'Invalid input data' },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to create order' },
      { status: 500 }
    )
  }
}

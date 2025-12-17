import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'

const prisma = new PrismaClient()

// Update order schema
const updateOrderSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED'])
})

// GET /api/orders/[orderId] - Get order by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const { orderId } = params
    
    // Get order with items
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        business: {
          select: {
            name: true,
            email: true
          }
        }
      }
    })
    
    if (!order) {
      return NextResponse.json({
        success: false,
        error: 'Order not found'
      }, { status: 404 })
    }
    
    return NextResponse.json({
      success: true,
      data: order
    })
    
  } catch (error) {
    console.error('Get order error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch order'
    }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const { orderId } = params
    const body = await request.json()
    
    // Validate the request data
    const validatedData = updateOrderSchema.parse(body)
    
    // Update the order
    const order = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: validatedData.status,
        updatedAt: new Date()
      }
    })
    
    return NextResponse.json({
      success: true,
      data: order
    })
    
  } catch (error) {
    console.error('Update order error:', error)
    
    if (error instanceof Error && error.message.includes('Validation')) {
      return NextResponse.json(
        { error: 'Invalid input data' },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to update order' },
      { status: 500 }
    )
  }
}


'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

interface OrderItem {
  id: string
  name: string
  quantity: number
  price: number
}

interface Order {
  id: string
  customerName: string
  customerContact: string
  totalPrice: number
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED'
  createdAt: string
  updatedAt: string
  items?: OrderItem[]
}

interface Business {
  id: string
  name: string
  email: string
}

export default function OrdersPage() {
  const [business, setBusiness] = useState<Business | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingOrder, setUpdatingOrder] = useState<string | null>(null)

  // Load business from localStorage
  useEffect(() => {
    const loadBusiness = () => {
      try {
        const storedBusiness = localStorage.getItem('voca_business')
        if (storedBusiness) {
          const businessData = JSON.parse(storedBusiness)
          setBusiness(businessData)
        }
      } catch (error) {
        console.error('Error loading business:', error)
        setError('Failed to load business information')
      }
    }

    loadBusiness()
  }, [])

  // Fetch orders
  const fetchOrders = async () => {
    if (!business?.id) return

    try {
      setLoading(true)
      const response = await fetch(`/api/orders?businessId=${business.id}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch orders')
      }

      const result = await response.json()
      if (result.success) {
        setOrders(result.data)
      } else {
        setError(result.error || 'Failed to fetch orders')
      }
    } catch (error) {
      console.error('Error fetching orders:', error)
      setError('Failed to fetch orders')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (business?.id) {
      fetchOrders()
    }
  }, [business?.id])

  // Update order status
  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      setUpdatingOrder(orderId)
      
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: newStatus
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update order status')
      }

      // Refresh orders
      await fetchOrders()
    } catch (error) {
      console.error('Error updating order status:', error)
      setError('Failed to update order status')
    } finally {
      setUpdatingOrder(null)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800'
      case 'CONFIRMED':
        return 'bg-blue-100 text-blue-800'
      case 'COMPLETED':
        return 'bg-green-100 text-green-800'
      case 'CANCELLED':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price)
  }

  if (!business) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading business information...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Orders</h1>
              <p className="text-gray-600 mt-1">Manage your customer orders</p>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={fetchOrders}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading orders...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-600">{error}</p>
            <button
              onClick={fetchOrders}
              className="mt-4 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No orders yet</h3>
            <p className="text-gray-600 mb-6">Orders will appear here when customers place them through your chatbot.</p>
            <a
              href="/agents/order-taking/chat"
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center"
            >
              Test Chat Interface
            </a>
          </div>
        ) : (
          <div className="bg-white shadow-sm rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                All Orders ({orders.length})
              </h2>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Order ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Items
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {orders.map((order) => (
                    <motion.tr
                      key={order.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="hover:bg-gray-50"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                        {order.id.slice(-8)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {order.customerName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {order.customerContact}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div className="max-w-xs">
                          {order.items && order.items.length > 0 ? (
                            <div className="space-y-1">
                              {order.items.map((item, index) => (
                                <div key={index} className="flex justify-between items-center bg-gray-50 px-2 py-1 rounded text-xs">
                                  <span className="font-medium">{item.name}</span>
                                  <span className="text-gray-600">x{item.quantity}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-400 italic">No items</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                        {formatPrice(order.totalPrice)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(order.status)}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {formatDate(order.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        <div className="flex space-x-2">
                          {order.status === 'PENDING' && (
                            <>
                              <button
                                onClick={() => updateOrderStatus(order.id, 'CONFIRMED')}
                                disabled={updatingOrder === order.id}
                                className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700 disabled:opacity-50"
                              >
                                {updatingOrder === order.id ? 'Updating...' : 'Confirm'}
                              </button>
                              <button
                                onClick={() => updateOrderStatus(order.id, 'CANCELLED')}
                                disabled={updatingOrder === order.id}
                                className="bg-red-600 text-white px-3 py-1 rounded text-xs hover:bg-red-700 disabled:opacity-50"
                              >
                                Cancel
                              </button>
                            </>
                          )}
                          {order.status === 'CONFIRMED' && (
                            <button
                              onClick={() => updateOrderStatus(order.id, 'COMPLETED')}
                              disabled={updatingOrder === order.id}
                              className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700 disabled:opacity-50"
                            >
                              {updatingOrder === order.id ? 'Updating...' : 'Complete'}
                            </button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}


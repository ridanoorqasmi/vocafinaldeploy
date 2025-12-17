'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { 
  Building2, 
  ShoppingCart, 
  Menu, 
  Clock, 
  MapPin, 
  Shield, 
  CheckCircle,
  ArrowLeft,
  ArrowRight,
  Save,
  Play,
  AlertCircle,
  Loader2
} from 'lucide-react'

interface Business {
  id: string
  name: string
  slug: string
  status: string
}

interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
  isActive: boolean
  businessId: string
}

interface AgentConfig {
  id?: string
  name: string
  description: string
  isActive: boolean
  menuItems: any[]
  operatingHours: any[]
  policies: any[]
  locations: any[]
}

export default function OrderTakingSetupPage() {
  const [user, setUser] = useState<User | null>(null)
  const [business, setBusiness] = useState<Business | null>(null)
  const [agentConfig, setAgentConfig] = useState<AgentConfig>({
    name: '',
    description: '',
    isActive: false,
    menuItems: [],
    operatingHours: [],
    policies: [],
    locations: []
  })

  // Debug logging for agentConfig changes
  useEffect(() => {
    console.log('Agent config updated:', agentConfig)
  }, [agentConfig])
  
  // Form state for inline configuration
  const [newMenuItem, setNewMenuItem] = useState({
    name: '',
    description: '',
    price: '',
    isAvailable: true
  })
  
  const [newPolicy, setNewPolicy] = useState({
    title: '',
    type: 'delivery',
    content: ''
  })
  
  const [newLocation, setNewLocation] = useState({
    name: '',
    address: '',
    phone: ''
  })
  
  const [operatingHours, setOperatingHours] = useState(
    Array.from({ length: 7 }, (_, index) => ({
      dayOfWeek: index,
      openTime: '09:00',
      closeTime: '17:00',
      isClosed: false
    }))
  )
  const [currentStep, setCurrentStep] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [notification, setNotification] = useState<string | null>(null)
  const router = useRouter()

  const totalSteps = 5

  // Validation helpers for enabling/disabling Next button
  const isStepValid = (step: number): boolean => {
    switch (step) {
      case 1: {
        // Require agent name
        return agentConfig.name.trim().length > 0
      }
      case 2: {
        // Require at least one menu item
        return agentConfig.menuItems.length > 0
      }
      case 3: {
        // Require at least one open day and valid open/close times when not closed
        const hasAnyOpenDay = operatingHours.some((d) => !d.isClosed)
        const timesValid = operatingHours.every((d) => {
          if (d.isClosed) return true
          if (!d.openTime || !d.closeTime) return false
          return d.openTime < d.closeTime
        })
        return hasAnyOpenDay && timesValid
      }
      case 4: {
        // Require at least one policy and one location
        return agentConfig.policies.length > 0 && agentConfig.locations.length > 0
      }
      default:
        return true
    }
  }

  useEffect(() => {
    checkAuthentication()
  }, [])

  // Fetch configuration only after business is available
  useEffect(() => {
    if (business?.id) {
      fetchAgentConfiguration()
    }
  }, [business])

  const checkAuthentication = () => {
    const userData = localStorage.getItem('voca_user')
    const businessData = localStorage.getItem('voca_business')
    
    if (!userData || !businessData) {
      router.push('/auth/login')
      return
    }

    try {
      const user = JSON.parse(userData)
      const business = JSON.parse(businessData)
      
      setUser(user)
      setBusiness(business)
    } catch (error) {
      console.error('Invalid user data:', error)
      localStorage.removeItem('voca_user')
      localStorage.removeItem('voca_business')
      router.push('/auth/login')
      return
    }
  }

  const fetchAgentConfiguration = async () => {
    try {
      setIsLoading(true)
      setError(null)

      if (!business?.id) {
        // Business not ready yet; defer until effect runs when business is set
        return
      }

      // Fetch existing agent configuration
      const response = await fetch(`/api/agents/order-taking?businessId=${business.id}`)
      
      if (response.ok) {
        const data = await response.json()
        console.log('Fetched agent configuration:', data)
        if (data.success && data.data) {
          // Set the complete agent configuration with all nested data
          const configData = {
            id: data.data.id,
            name: data.data.name || '',
            description: data.data.description || '',
            isActive: data.data.isActive || false,
            menuItems: data.data.menuItems || [],
            operatingHours: data.data.operatingHours || [],
            policies: data.data.policies || [],
            locations: data.data.locations || []
          }
          console.log('Setting agent config:', configData)
          setAgentConfig(configData)
        } else {
          // No existing agent, fetch business data for new setup
          await Promise.all([
            fetchMenuItems(),
            fetchOperatingHours(),
            fetchPolicies(),
            fetchLocations()
          ])
        }
      } else {
        // No existing agent, fetch business data for new setup
        await Promise.all([
          fetchMenuItems(),
          fetchOperatingHours(),
          fetchPolicies(),
          fetchLocations()
        ])
      }

    } catch (err) {
      console.error('Failed to fetch agent configuration:', err)
      setError('Failed to load agent configuration')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchMenuItems = async () => {
    try {
      const response = await fetch(`/api/businesses/${business?.id}/menu-items`)
      if (response.ok) {
        const data = await response.json()
        setAgentConfig(prev => ({ ...prev, menuItems: data.data || [] }))
      }
    } catch (error) {
      console.error('Failed to fetch menu items:', error)
    }
  }

  const fetchOperatingHours = async () => {
    try {
      const response = await fetch(`/api/businesses/${business?.id}/operating-hours`)
      if (response.ok) {
        const data = await response.json()
        setAgentConfig(prev => ({ ...prev, operatingHours: data.data || [] }))
      }
    } catch (error) {
      console.error('Failed to fetch operating hours:', error)
    }
  }

  const fetchPolicies = async () => {
    try {
      const response = await fetch(`/api/businesses/${business?.id}/policies`)
      if (response.ok) {
        const data = await response.json()
        setAgentConfig(prev => ({ ...prev, policies: data.data || [] }))
      }
    } catch (error) {
      console.error('Failed to fetch policies:', error)
    }
  }

  const fetchLocations = async () => {
    try {
      const response = await fetch(`/api/businesses/${business?.id}/locations`)
      if (response.ok) {
        const data = await response.json()
        setAgentConfig(prev => ({ ...prev, locations: data.data || [] }))
      }
    } catch (error) {
      console.error('Failed to fetch locations:', error)
    }
  }

  const handleSave = async (): Promise<string | null> => {
    try {
      setIsSaving(true)
      setError(null)
      setSuccess(null)

      // Ensure latest operating hours are saved from local state
      const configToSave = {
        ...agentConfig,
        operatingHours: operatingHours
      }

      const method = agentConfig.id ? 'PUT' : 'POST'
      const url = agentConfig.id 
        ? `/api/agents/order-taking/${agentConfig.id}`
        : '/api/agents/order-taking'

      console.log('Saving agent with data:', {
        businessId: business?.id,
        name: configToSave.name,
        description: configToSave.description,
        menuItems: configToSave.menuItems,
        operatingHours: configToSave.operatingHours,
        policies: configToSave.policies,
        locations: configToSave.locations
      })

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          businessId: business?.id,
          ...configToSave
        }),
      })

      const data = await response.json()
      console.log('Save response:', response.status, data)

      if (response.ok && data.success) {
        setSuccess('Agent configuration saved successfully!')
        if (data.data.id) {
          setAgentConfig(prev => ({ ...prev, id: data.data.id }))
        }
        return data.data.id || agentConfig.id || null
      } else {
        console.error('Save failed:', data)
        setError(data.error || 'Failed to save agent configuration')
        return null
      }
    } catch (err) {
      console.error('Failed to save agent configuration:', err)
      setError('Failed to save agent configuration')
      return null
    } finally {
      setIsSaving(false)
    }
  }

  const handleLaunchAgent = async () => {
    try {
      setIsSaving(true)
      setError(null)
      setSuccess(null)

      // Smart approach: Launch directly with all data, no agent ID dependency
      const response = await fetch(`/api/agents/order-taking/launch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          businessId: business?.id,
          name: agentConfig.name,
          description: agentConfig.description,
          menuItems: agentConfig.menuItems,
          operatingHours: operatingHours,
          policies: agentConfig.policies,
          locations: agentConfig.locations
        }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setSuccess('Order-taking agent launched successfully!')
        setAgentConfig(prev => ({ ...prev, isActive: true }))
        // Show launch notification with business info
        if (business?.id && business?.name) {
          setNotification(`Business ${business.name} (${business.id}) configured and agent launched.`)
        } else if (business?.id) {
          setNotification(`Business ${business.id} configured and agent launched.`)
        } else {
          setNotification('Agent launched successfully.')
        }
        // Redirect after a brief delay to let user see the popup
        setTimeout(() => {
          router.push('/dashboard')
        }, 1800)
      } else {
        setError(data.error || 'Failed to launch agent')
      }
    } catch (err) {
      console.error('Failed to launch agent:', err)
      setError('Failed to launch agent')
    } finally {
      setIsSaving(false)
    }
  }

  // Form handlers
  const handleAddMenuItem = () => {
    if (!newMenuItem.name || !newMenuItem.price) {
      setError('Please fill in all required fields')
      return
    }

    const menuItem = {
      ...newMenuItem,
      price: parseFloat(newMenuItem.price)
    }

    setAgentConfig(prev => ({
      ...prev,
      menuItems: [...prev.menuItems, menuItem]
    }))

    setNewMenuItem({
      name: '',
      description: '',
      price: '',
      isAvailable: true
    })

    setSuccess('Menu item added successfully!')
  }

  const handleAddPolicy = () => {
    if (!newPolicy.title || !newPolicy.content) {
      setError('Please fill in all required fields')
      return
    }

    setAgentConfig(prev => ({
      ...prev,
      policies: [...prev.policies, newPolicy]
    }))

    setNewPolicy({
      title: '',
      type: 'delivery',
      content: ''
    })

    setSuccess('Policy added successfully!')
  }

  const handleAddLocation = () => {
    if (!newLocation.name || !newLocation.address) {
      setError('Please fill in all required fields')
      return
    }

    setAgentConfig(prev => ({
      ...prev,
      locations: [...prev.locations, newLocation]
    }))

    setNewLocation({
      name: '',
      address: '',
      phone: ''
    })

    setSuccess('Location added successfully!')
  }

  const handleRemoveMenuItem = (index: number) => {
    setAgentConfig(prev => ({
      ...prev,
      menuItems: prev.menuItems.filter((_, i) => i !== index)
    }))
  }

  const handleRemovePolicy = (index: number) => {
    setAgentConfig(prev => ({
      ...prev,
      policies: prev.policies.filter((_, i) => i !== index)
    }))
  }

  const handleRemoveLocation = (index: number) => {
    setAgentConfig(prev => ({
      ...prev,
      locations: prev.locations.filter((_, i) => i !== index)
    }))
  }

  const handleOperatingHoursChange = (dayIndex: number, field: string, value: any) => {
    setOperatingHours(prev => prev.map((day, index) => 
      index === dayIndex ? { ...day, [field]: value } : day
    ))
  }

  const applyQuickSetup = (type: string) => {
    const quickSetups = {
      'mon-fri-9-5': {
        hours: Array.from({ length: 7 }, (_, index) => ({
          dayOfWeek: index,
          openTime: index >= 1 && index <= 5 ? '09:00' : '00:00',
          closeTime: index >= 1 && index <= 5 ? '17:00' : '00:00',
          isClosed: index === 0 || index === 6
        }))
      },
      'mon-sat-8-8': {
        hours: Array.from({ length: 7 }, (_, index) => ({
          dayOfWeek: index,
          openTime: index >= 1 && index <= 6 ? '08:00' : '00:00',
          closeTime: index >= 1 && index <= 6 ? '20:00' : '00:00',
          isClosed: index === 0
        }))
      },
      '24-7': {
        hours: Array.from({ length: 7 }, (_, index) => ({
          dayOfWeek: index,
          openTime: '00:00',
          closeTime: '23:59',
          isClosed: false
        }))
      }
    }

    if (quickSetups[type as keyof typeof quickSetups]) {
      setOperatingHours(quickSetups[type as keyof typeof quickSetups].hours)
      setSuccess('Operating hours applied successfully!')
    }
  }

  const nextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1)
    }
  }

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-red-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading agent configuration...</p>
        </div>
      </div>
    )
  }

  if (!business || !user) {
    return null
  }

  return (
    <div className="min-h-screen bg-neutral-900">
      {/* Header */}
      <header className="bg-black/50 border-b border-red-500/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => router.push('/dashboard')}
                className="p-2 rounded-full bg-red-500/10 hover:bg-red-500/20 transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-red-400" />
            </motion.button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center">
                  <ShoppingCart className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">Order Taking Agent Setup</h1>
                  <p className="text-gray-400 text-sm">Configure your AI order-taking agent</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">Step {currentStep} of {totalSteps}</span>
              <div className="w-32 bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-red-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(currentStep / totalSteps) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Progress Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {[1, 2, 3, 4, 5].map((step) => (
              <div key={step} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step <= currentStep 
                    ? 'bg-red-500 text-white' 
                    : 'bg-gray-700 text-gray-400'
                }`}>
                  {step < currentStep ? <CheckCircle className="w-4 h-4" /> : step}
                </div>
                {step < 5 && (
                  <div className={`w-16 h-1 mx-2 ${
                    step < currentStep ? 'bg-red-500' : 'bg-gray-700'
                  }`} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-400">
            <span>Basic Info</span>
            <span>Menu Setup</span>
            <span>Hours</span>
            <span>Policies</span>
            <span>Launch</span>
          </div>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 bg-red-500/10 border border-red-500/20 rounded-lg p-4"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <span className="text-red-400">{error}</span>
      </div>
          </motion.div>
        )}

        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 bg-green-500/10 border border-green-500/20 rounded-lg p-4"
          >
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span className="text-green-400">{success}</span>
          </div>
          </motion.div>
        )}

        {/* Step Content */}
              <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="bg-black/50 border border-red-500/20 rounded-xl p-8"
        >
          {currentStep === 1 && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-6">Basic Agent Information</h2>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Agent Name
                  </label>
                  <input
                    type="text"
                    value={agentConfig.name}
                    onChange={(e) => setAgentConfig(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-3 bg-black/30 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-colors"
                    placeholder="Enter agent name (e.g., 'Order Assistant')"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={agentConfig.description}
                    onChange={(e) => setAgentConfig(prev => ({ ...prev, description: e.target.value }))}
                    rows={4}
                    className="w-full px-4 py-3 bg-black/30 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-colors"
                    placeholder="Describe what this agent will do for your customers..."
                  />
          </div>
        </div>
      </div>
          )}

          {currentStep === 2 && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-6">Menu Configuration</h2>
              <div className="space-y-6">
                <p className="text-gray-400">
                  Add menu items that the agent can help customers order from.
                </p>
                
                {/* Add New Menu Item Form */}
                <div className="bg-neutral-800/30 border border-gray-600 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Add Menu Item</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Item Name
                      </label>
                      <input
                        type="text"
                        value={newMenuItem.name}
                        onChange={(e) => setNewMenuItem(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="e.g., Margherita Pizza"
                        className="w-full px-4 py-3 bg-black/30 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Price ($)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={newMenuItem.price}
                        onChange={(e) => setNewMenuItem(prev => ({ ...prev, price: e.target.value }))}
                        placeholder="12.99"
                        className="w-full px-4 py-3 bg-black/30 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-colors"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Description
                      </label>
                      <textarea
                        rows={3}
                        value={newMenuItem.description}
                        onChange={(e) => setNewMenuItem(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Fresh mozzarella, tomato sauce, basil..."
                        className="w-full px-4 py-3 bg-black/30 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-colors"
                      />
                    </div>
                    <div className="md:col-span-2 flex items-center gap-4">
                      <label className="flex items-center gap-2">
                        <input 
                          type="checkbox" 
                          checked={newMenuItem.isAvailable}
                          onChange={(e) => setNewMenuItem(prev => ({ ...prev, isAvailable: e.target.checked }))}
                          className="rounded border-gray-600 bg-black/30 text-red-500 focus:ring-red-500" 
                        />
                        <span className="text-gray-300">Available for ordering</span>
                      </label>
                      <button 
                        onClick={handleAddMenuItem}
                        className="ml-auto px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                      >
                        Add Item
                      </button>
                    </div>
                  </div>
                </div>

                {/* Existing Menu Items */}
                {agentConfig.menuItems.length > 0 ? (
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-4">Current Menu Items</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {agentConfig.menuItems.map((item, index) => (
                        <div key={index} className="bg-neutral-800/50 border border-gray-600 rounded-lg p-4">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="text-white font-medium">{item.name}</h4>
                            <button 
                              onClick={() => handleRemoveMenuItem(index)}
                              className="text-red-400 hover:text-red-300 text-sm"
                            >
                              Remove
                            </button>
                          </div>
                          <p className="text-gray-400 text-sm mb-2">{item.description}</p>
                          <p className="text-red-400 font-semibold">${item.price}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 bg-neutral-800/20 border border-gray-600 rounded-lg">
                    <Menu className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400">No menu items added yet</p>
                    <p className="text-gray-500 text-sm">Add your first menu item above</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-6">Operating Hours</h2>
              <div className="space-y-6">
                <p className="text-gray-400">
                  Set up your business operating hours so the agent knows when you're open.
                </p>
                
                {/* Operating Hours Configuration */}
                <div className="space-y-4">
                  {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, index) => (
                    <div key={index} className="bg-neutral-800/30 border border-gray-600 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <span className="text-white font-medium w-24">{day}</span>
                          <label className="flex items-center gap-2">
                            <input 
                              type="checkbox" 
                              checked={operatingHours[index].isClosed}
                              onChange={(e) => handleOperatingHoursChange(index, 'isClosed', e.target.checked)}
                              className="rounded border-gray-600 bg-black/30 text-red-500 focus:ring-red-500" 
                            />
                            <span className="text-gray-300 text-sm">Closed</span>
                          </label>
                        </div>
                        <div className="flex items-center gap-4">
                          <div>
                            <label className="block text-xs text-gray-400 mb-1">Open Time</label>
                            <input
                              type="time"
                              value={operatingHours[index].openTime}
                              onChange={(e) => handleOperatingHoursChange(index, 'openTime', e.target.value)}
                              className="px-3 py-2 bg-black/30 border border-gray-600 rounded text-white text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-400 mb-1">Close Time</label>
                            <input
                              type="time"
                              value={operatingHours[index].closeTime}
                              onChange={(e) => handleOperatingHoursChange(index, 'closeTime', e.target.value)}
                              className="px-3 py-2 bg-black/30 border border-gray-600 rounded text-white text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Quick Setup Options */}
                <div className="bg-neutral-800/20 border border-gray-600 rounded-lg p-4">
                  <h3 className="text-white font-medium mb-3">Quick Setup</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <button 
                      onClick={() => applyQuickSetup('mon-fri-9-5')}
                      className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors"
                    >
                      Mon-Fri 9-5
                    </button>
                    <button 
                      onClick={() => applyQuickSetup('mon-sat-8-8')}
                      className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors"
                    >
                      Mon-Sat 8-8
                    </button>
                    <button 
                      onClick={() => applyQuickSetup('24-7')}
                      className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors"
                    >
                      24/7 Open
                    </button>
                    <button className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors">
                      Custom
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-6">Policies & Locations</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Policies Section */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">Business Policies</h3>
                  
                  {/* Add Policy Form */}
                  <div className="bg-neutral-800/30 border border-gray-600 rounded-lg p-4 mb-4">
                    <h4 className="text-white font-medium mb-3">Add Policy</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">
                          Policy Title
                        </label>
                        <input
                          type="text"
                          value={newPolicy.title}
                          onChange={(e) => setNewPolicy(prev => ({ ...prev, title: e.target.value }))}
                          placeholder="e.g., Delivery Policy"
                          className="w-full px-3 py-2 bg-black/30 border border-gray-600 rounded text-white placeholder-gray-400 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">
                          Policy Type
                        </label>
                        <select 
                          value={newPolicy.type}
                          onChange={(e) => setNewPolicy(prev => ({ ...prev, type: e.target.value }))}
                          className="w-full px-3 py-2 bg-black/30 border border-gray-600 rounded text-white focus:border-red-500 focus:ring-1 focus:ring-red-500"
                        >
                          <option value="delivery">Delivery Policy</option>
                          <option value="refund">Refund Policy</option>
                          <option value="privacy">Privacy Policy</option>
                          <option value="terms">Terms of Service</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">
                          Policy Content
                        </label>
                        <textarea
                          rows={3}
                          value={newPolicy.content}
                          onChange={(e) => setNewPolicy(prev => ({ ...prev, content: e.target.value }))}
                          placeholder="Describe your policy..."
                          className="w-full px-3 py-2 bg-black/30 border border-gray-600 rounded text-white placeholder-gray-400 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                        />
                      </div>
                      <button 
                        onClick={handleAddPolicy}
                        className="w-full px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                      >
                        Add Policy
                      </button>
                    </div>
                  </div>

                  {/* Existing Policies */}
                  {agentConfig.policies.length > 0 ? (
                    <div className="space-y-2">
                      {agentConfig.policies.map((policy, index) => (
                        <div key={index} className="bg-neutral-800/50 border border-gray-600 rounded-lg p-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="text-white font-medium">{policy.title}</h4>
                              <p className="text-gray-400 text-sm">{policy.type}</p>
                            </div>
                            <button 
                              onClick={() => handleRemovePolicy(index)}
                              className="text-red-400 hover:text-red-300 text-sm"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 bg-neutral-800/20 border border-gray-600 rounded-lg">
                      <Shield className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                      <p className="text-gray-400 text-sm">No policies added yet</p>
                    </div>
                  )}
                </div>

                {/* Locations Section */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">Business Locations</h3>
                  
                  {/* Add Location Form */}
                  <div className="bg-neutral-800/30 border border-gray-600 rounded-lg p-4 mb-4">
                    <h4 className="text-white font-medium mb-3">Add Location</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">
                          Location Name
                        </label>
                        <input
                          type="text"
                          value={newLocation.name}
                          onChange={(e) => setNewLocation(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="e.g., Main Store"
                          className="w-full px-3 py-2 bg-black/30 border border-gray-600 rounded text-white placeholder-gray-400 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">
                          Address
                        </label>
                        <textarea
                          rows={2}
                          value={newLocation.address}
                          onChange={(e) => setNewLocation(prev => ({ ...prev, address: e.target.value }))}
                          placeholder="123 Main St, City, State 12345"
                          className="w-full px-3 py-2 bg-black/30 border border-gray-600 rounded text-white placeholder-gray-400 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">
                          Phone Number
                        </label>
                        <input
                          type="tel"
                          value={newLocation.phone}
                          onChange={(e) => setNewLocation(prev => ({ ...prev, phone: e.target.value }))}
                          placeholder="(555) 123-4567"
                          className="w-full px-3 py-2 bg-black/30 border border-gray-600 rounded text-white placeholder-gray-400 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                        />
                      </div>
                      <button 
                        onClick={handleAddLocation}
                        className="w-full px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                      >
                        Add Location
                      </button>
                    </div>
                  </div>

                  {/* Existing Locations */}
                  {agentConfig.locations.length > 0 ? (
                    <div className="space-y-2">
                      {agentConfig.locations.map((location, index) => (
                        <div key={index} className="bg-neutral-800/50 border border-gray-600 rounded-lg p-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="text-white font-medium">{location.name}</h4>
                              <p className="text-gray-400 text-sm">{location.address}</p>
                              <p className="text-gray-500 text-xs">{location.phone}</p>
                            </div>
                            <button 
                              onClick={() => handleRemoveLocation(index)}
                              className="text-red-400 hover:text-red-300 text-sm"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 bg-neutral-800/20 border border-gray-600 rounded-lg">
                      <MapPin className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                      <p className="text-gray-400 text-sm">No locations added yet</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {currentStep === 5 && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-6">Launch Your Agent</h2>
              <div className="text-center">
                <div className="w-24 h-24 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Play className="w-12 h-12 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white mb-4">Ready to Launch!</h3>
                <p className="text-gray-400 mb-8 max-w-2xl mx-auto">
                  Your order-taking agent is configured and ready to help your customers place orders. 
                  Click the button below to activate it.
                </p>
                <div className="space-y-4">
                  <div className="flex items-center justify-center gap-2 text-green-400">
                    <CheckCircle className="w-5 h-5" />
                    <span>Agent configuration saved</span>
                  </div>
                  <div className="flex items-center justify-center gap-2 text-green-400">
                    <CheckCircle className="w-5 h-5" />
                    <span>Menu items loaded ({agentConfig.menuItems.length})</span>
                  </div>
                  <div className="flex items-center justify-center gap-2 text-green-400">
                    <CheckCircle className="w-5 h-5" />
                    <span>Operating hours configured</span>
          </div>
        </div>
      </div>
            </div>
          )}
        </motion.div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8">
          <button
            onClick={prevStep}
            disabled={currentStep === 1}
            className="flex items-center gap-2 px-6 py-3 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Previous
          </button>

          <div className="flex items-center gap-4">
            {currentStep < totalSteps && (
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save Progress
              </button>
            )}

            {currentStep < totalSteps ? (
              <button
                onClick={nextStep}
                disabled={!isStepValid(currentStep)}
                className="flex items-center gap-2 px-6 py-3 bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                Next
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleLaunchAgent}
                disabled={isSaving}
                className="flex items-center gap-2 px-8 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg transition-colors"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                Launch Agent
              </button>
            )}
          </div>
        </div>
      {/* Notification Popup */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50">
          <div className="bg-green-600 text-white px-5 py-3 rounded-lg shadow-lg border border-green-300/30">
            {notification}
          </div>
        </div>
      )}
      </main>
    </div>
  )
}
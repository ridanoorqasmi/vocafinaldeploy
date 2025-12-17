'use client'

import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { 
  Upload, 
  FileText, 
  Plus, 
  Edit3, 
  Trash2, 
  Eye,
  EyeOff,
  Sparkles,
  CheckCircle,
  AlertCircle
} from 'lucide-react'

interface MenuItem {
  id: string
  item_name: string
  description: string
  price: number
  available: boolean
  category?: string
  ai_suggested?: boolean
}

interface MenuSetupProps {
  data: {
    items: MenuItem[]
    categories: string[]
  }
  onUpdate: (data: any) => void
}

export default function MenuSetup({ data, onUpdate }: MenuSetupProps) {
  const [items, setItems] = useState<MenuItem[]>(data.items)
  const [categories, setCategories] = useState<string[]>(data.categories)
  const [isUploading, setIsUploading] = useState(false)
  const [showManualForm, setShowManualForm] = useState(false)
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null)
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    
    try {
      const text = await file.text()
      const lines = text.split('\n')
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
      
      const uploadedItems: MenuItem[] = lines.slice(1)
        .filter(line => line.trim())
        .map((line, index) => {
          const values = line.split(',').map(v => v.trim())
          return {
            id: `uploaded-${index}`,
            item_name: values[headers.indexOf('item_name')] || '',
            description: values[headers.indexOf('description')] || '',
            price: parseFloat(values[headers.indexOf('price')]) || 0,
            available: values[headers.indexOf('available')]?.toLowerCase() === 'true',
            category: '',
            ai_suggested: false
          }
        })

      // AI categorization suggestions
      const aiCategories = generateAICategories(uploadedItems)
      setAiSuggestions(aiCategories)
      
      // Auto-assign categories based on AI suggestions
      const categorizedItems = uploadedItems.map(item => ({
        ...item,
        category: suggestCategory(item.item_name, aiCategories)
      }))

      setItems(categorizedItems)
      setCategories(aiCategories)
      onUpdate({ items: categorizedItems, categories: aiCategories })
      
    } catch (error) {
      console.error('Error parsing CSV:', error)
    } finally {
      setIsUploading(false)
    }
  }

  const generateAICategories = (menuItems: MenuItem[]): string[] => {
    // AI logic to suggest categories based on item names
    const categoryMap: { [key: string]: number } = {}
    
    menuItems.forEach(item => {
      const name = item.item_name.toLowerCase()
      
      if (name.includes('pizza') || name.includes('burger') || name.includes('sandwich')) {
        categoryMap['Main Course'] = (categoryMap['Main Course'] || 0) + 1
      } else if (name.includes('drink') || name.includes('juice') || name.includes('soda')) {
        categoryMap['Beverages'] = (categoryMap['Beverages'] || 0) + 1
      } else if (name.includes('cake') || name.includes('ice cream') || name.includes('dessert')) {
        categoryMap['Desserts'] = (categoryMap['Desserts'] || 0) + 1
      } else if (name.includes('salad') || name.includes('soup')) {
        categoryMap['Appetizers'] = (categoryMap['Appetizers'] || 0) + 1
      } else {
        categoryMap['Other'] = (categoryMap['Other'] || 0) + 1
      }
    })

    return Object.keys(categoryMap).sort((a, b) => categoryMap[b] - categoryMap[a])
  }

  const suggestCategory = (itemName: string, availableCategories: string[]): string => {
    const name = itemName.toLowerCase()
    
    if (name.includes('pizza') || name.includes('burger') || name.includes('sandwich')) {
      return availableCategories.find(c => c === 'Main Course') || 'Main Course'
    } else if (name.includes('drink') || name.includes('juice') || name.includes('soda')) {
      return availableCategories.find(c => c === 'Beverages') || 'Beverages'
    } else if (name.includes('cake') || name.includes('ice cream') || name.includes('dessert')) {
      return availableCategories.find(c => c === 'Desserts') || 'Desserts'
    } else if (name.includes('salad') || name.includes('soup')) {
      return availableCategories.find(c => c === 'Appetizers') || 'Appetizers'
    }
    
    return availableCategories[0] || 'Other'
  }

  const addItem = () => {
    const newItem: MenuItem = {
      id: `manual-${Date.now()}`,
      item_name: '',
      description: '',
      price: 0,
      available: true,
      category: categories[0] || 'Other'
    }
    setEditingItem(newItem)
    setShowManualForm(true)
  }

  const saveItem = (item: MenuItem) => {
    if (editingItem) {
      // Update existing item
      setItems(prev => prev.map(i => i.id === editingItem.id ? item : i))
    } else {
      // Add new item
      setItems(prev => [...prev, item])
    }
    
    setEditingItem(null)
    setShowManualForm(false)
    onUpdate({ items: items, categories })
  }

  const deleteItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id))
    onUpdate({ items: items.filter(item => item.id !== id), categories })
  }

  const updateCategory = (itemId: string, category: string) => {
    setItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, category } : item
    ))
    onUpdate({ items: items.map(item => 
      item.id === itemId ? { ...item, category } : item
    ), categories })
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* AI Assistant Sidebar */}
      <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-xl p-6 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Sparkles className="w-6 h-6 text-blue-400" />
          <h3 className="text-xl font-bold text-white">AI Assistant</h3>
        </div>
        <div className="space-y-3 text-sm text-gray-300">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-400" />
            <span>Auto-categorized {items.filter(i => i.category).length} items</span>
          </div>
          {aiSuggestions.length > 0 && (
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span>Suggested categories: {aiSuggestions.join(', ')}</span>
            </div>
          )}
          {items.some(i => !i.price) && (
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-400" />
              <span>Missing prices detected - please review</span>
            </div>
          )}
        </div>
      </div>

      {/* CSV Upload Section */}
      <div className="bg-black/50 border border-red-500/20 rounded-xl p-6 mb-8">
        <h3 className="text-xl font-bold text-white mb-4">Upload Menu CSV</h3>
        <div className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center">
          <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-400 mb-2">
            Upload a CSV file with columns: item_name, description, price, available
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            {isUploading ? 'Processing...' : 'Choose File'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      </div>

      {/* Manual Add Button */}
      <div className="mb-6">
        <button
          onClick={addItem}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Menu Item Manually
        </button>
      </div>

      {/* Menu Items List */}
      <div className="bg-black/50 border border-red-500/20 rounded-xl p-6">
        <h3 className="text-xl font-bold text-white mb-4">Menu Items ({items.length})</h3>
        
        {items.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>No menu items yet. Upload a CSV or add items manually.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-black/30 border border-gray-600 rounded-lg p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-2">
                      <h4 className="font-semibold text-white">{item.item_name}</h4>
                      {item.ai_suggested && (
                        <span className="bg-blue-500/20 text-blue-400 text-xs px-2 py-1 rounded">
                          AI Suggested
                        </span>
                      )}
                    </div>
                    <p className="text-gray-400 text-sm mb-2">{item.description}</p>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-green-400 font-medium">${item.price.toFixed(2)}</span>
                      <span className={`px-2 py-1 rounded text-xs ${
                        item.available 
                          ? 'bg-green-500/20 text-green-400' 
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {item.available ? 'Available' : 'Unavailable'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <select
                      value={item.category || ''}
                      onChange={(e) => updateCategory(item.id, e.target.value)}
                      className="bg-black/50 border border-gray-600 rounded px-3 py-1 text-white text-sm"
                    >
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    
                    <button
                      onClick={() => setEditingItem(item)}
                      className="text-blue-400 hover:text-blue-300 p-1"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    
                    <button
                      onClick={() => deleteItem(item.id)}
                      className="text-red-400 hover:text-red-300 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Manual Form Modal */}
      {showManualForm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-neutral-800 border border-red-500/20 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-white mb-4">
              {editingItem ? 'Edit Item' : 'Add New Item'}
            </h3>
            
            <form onSubmit={(e) => {
              e.preventDefault()
              if (editingItem) {
                saveItem(editingItem)
              }
            }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Item Name
                </label>
                <input
                  type="text"
                  value={editingItem?.item_name || ''}
                  onChange={(e) => setEditingItem(prev => prev ? {...prev, item_name: e.target.value} : null)}
                  className="w-full bg-black/50 border border-gray-600 rounded-lg px-3 py-2 text-white"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={editingItem?.description || ''}
                  onChange={(e) => setEditingItem(prev => prev ? {...prev, description: e.target.value} : null)}
                  className="w-full bg-black/50 border border-gray-600 rounded-lg px-3 py-2 text-white"
                  rows={3}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Price
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={editingItem?.price || 0}
                  onChange={(e) => setEditingItem(prev => prev ? {...prev, price: parseFloat(e.target.value)} : null)}
                  className="w-full bg-black/50 border border-gray-600 rounded-lg px-3 py-2 text-white"
                  required
                />
              </div>
              
              <div className="flex items-center gap-4">
                <button
                  type="submit"
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Save Item
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingItem(null)
                    setShowManualForm(false)
                  }}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}




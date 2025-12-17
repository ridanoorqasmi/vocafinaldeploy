'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { 
  Plus, 
  ShoppingCart, 
  CreditCard, 
  CheckCircle, 
  XCircle, 
  Settings,
  TrendingUp,
  DollarSign,
  Calendar
} from 'lucide-react';

interface AddOn {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  billingPeriod: string;
  eventType?: string;
  quantityIncluded?: number;
  isActive: boolean;
  sortOrder: number;
  metadata: Record<string, any>;
}

interface BusinessAddOn {
  id: string;
  businessId: string;
  addOnId: string;
  addOn: AddOn;
  status: string;
  quantity: number;
  priceCents: number;
  startedAt: string;
  cancelledAt?: string;
}

interface UpsellCampaign {
  id: string;
  name: string;
  description: string;
  triggerConditions: Record<string, any>;
  targetAddOnId: string;
  targetAddOn: AddOn;
  ctaText: string;
  ctaUrl?: string;
  isActive: boolean;
  priority: number;
}

interface AddOnsManagerProps {
  businessId: string;
}

export function AddOnsManager({ businessId }: AddOnsManagerProps) {
  const [addOns, setAddOns] = useState<AddOn[]>([]);
  const [businessAddOns, setBusinessAddOns] = useState<BusinessAddOn[]>([]);
  const [upsellCampaigns, setUpsellCampaigns] = useState<UpsellCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false);
  const [selectedAddOn, setSelectedAddOn] = useState<AddOn | null>(null);
  const [purchaseQuantity, setPurchaseQuantity] = useState(1);

  useEffect(() => {
    fetchAddOnsData();
  }, [businessId]);

  const fetchAddOnsData = async () => {
    try {
      setLoading(true);
      
      const [addOnsResponse, businessAddOnsResponse, campaignsResponse] = await Promise.all([
        fetch('/api/v1/monetization/addons?type=active'),
        fetch(`/api/v1/monetization/addons?type=business&businessId=${businessId}`),
        fetch(`/api/v1/monetization/addons?type=campaigns&businessId=${businessId}`)
      ]);

      const [addOnsResult, businessAddOnsResult, campaignsResult] = await Promise.all([
        addOnsResponse.json(),
        businessAddOnsResponse.json(),
        campaignsResponse.json()
      ]);

      if (addOnsResult.success) {
        setAddOns(addOnsResult.data);
      }

      if (businessAddOnsResult.success) {
        setBusinessAddOns(businessAddOnsResult.data);
      }

      if (campaignsResult.success) {
        setUpsellCampaigns(campaignsResult.data);
      }
    } catch (err) {
      setError('Failed to fetch add-ons data');
    } finally {
      setLoading(false);
    }
  };

  const handlePurchaseAddOn = async (addOn: AddOn, quantity: number) => {
    try {
      const response = await fetch('/api/v1/monetization/addons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'purchase',
          businessId,
          addOnId: addOn.id,
          quantity
        })
      });

      const result = await response.json();

      if (result.success) {
        // Redirect to Stripe checkout
        window.location.href = result.data.checkoutUrl;
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Failed to purchase add-on');
    }
  };

  const handleCancelAddOn = async (businessAddOnId: string) => {
    try {
      const response = await fetch('/api/v1/monetization/addons', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'cancel',
          businessAddOnId
        })
      });

      const result = await response.json();

      if (result.success) {
        await fetchAddOnsData(); // Refresh data
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Failed to cancel add-on');
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(cents / 100);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Active</Badge>;
      case 'cancelled':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Cancelled</Badge>;
      case 'paused':
        return <Badge variant="secondary"><Settings className="h-3 w-3 mr-1" />Paused</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">{error}</p>
        <Button onClick={fetchAddOnsData} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Add-ons & Upsells</h1>
          <p className="text-gray-600">Manage your additional services and features</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Add-on
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Add-on</DialogTitle>
              <DialogDescription>
                Add a new service or feature to your add-ons catalog
              </DialogDescription>
            </DialogHeader>
            <CreateAddOnForm onSuccess={() => {
              setShowCreateDialog(false);
              fetchAddOnsData();
            }} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Upsell Campaigns */}
      {upsellCampaigns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUp className="h-5 w-5 mr-2 text-blue-500" />
              Recommended for You
            </CardTitle>
            <CardDescription>Based on your usage patterns</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {upsellCampaigns.map((campaign) => (
                <div key={campaign.id} className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-medium">{campaign.targetAddOn.name}</h3>
                      <p className="text-sm text-gray-500">{campaign.description}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      Priority {campaign.priority}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-lg font-bold">
                      {formatCurrency(campaign.targetAddOn.priceCents)}
                      <span className="text-sm text-gray-500 ml-1">
                        /{campaign.targetAddOn.billingPeriod}
                      </span>
                    </div>
                    <Button 
                      size="sm"
                      onClick={() => {
                        setSelectedAddOn(campaign.targetAddOn);
                        setShowPurchaseDialog(true);
                      }}
                    >
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      {campaign.ctaText}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Available Add-ons */}
      <Card>
        <CardHeader>
          <CardTitle>Available Add-ons</CardTitle>
          <CardDescription>Browse and purchase additional services</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {addOns.map((addOn) => {
              const businessAddOn = businessAddOns.find(bao => bao.addOnId === addOn.id);
              const isPurchased = businessAddOn && businessAddOn.status === 'active';

              return (
                <div key={addOn.id} className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-medium">{addOn.name}</h3>
                      <p className="text-sm text-gray-500">{addOn.description}</p>
                    </div>
                    {isPurchased && (
                      <Badge variant="default" className="bg-green-100 text-green-800">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Active
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Price</span>
                      <span className="font-medium">
                        {formatCurrency(addOn.priceCents)}
                        <span className="text-sm text-gray-500 ml-1">
                          /{addOn.billingPeriod}
                        </span>
                      </span>
                    </div>
                    
                    {addOn.eventType && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Includes</span>
                        <span className="text-sm">
                          {addOn.quantityIncluded} {addOn.eventType.replace('_', ' ')}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {isPurchased ? (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleCancelAddOn(businessAddOn!.id)}
                        className="flex-1"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Cancel
                      </Button>
                    ) : (
                      <Button 
                        size="sm"
                        onClick={() => {
                          setSelectedAddOn(addOn);
                          setShowPurchaseDialog(true);
                        }}
                        className="flex-1"
                      >
                        <ShoppingCart className="h-4 w-4 mr-2" />
                        Purchase
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* My Add-ons */}
      {businessAddOns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>My Add-ons</CardTitle>
            <CardDescription>Your active and cancelled add-ons</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {businessAddOns.map((businessAddOn) => (
                <div key={businessAddOn.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div>
                      <h3 className="font-medium">{businessAddOn.addOn.name}</h3>
                      <p className="text-sm text-gray-500">
                        Started {new Date(businessAddOn.startedAt).toLocaleDateString()}
                      </p>
                    </div>
                    {getStatusBadge(businessAddOn.status)}
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <p className="font-medium">
                        {formatCurrency(businessAddOn.priceCents)}
                      </p>
                      <p className="text-sm text-gray-500">
                        Qty: {businessAddOn.quantity}
                      </p>
                    </div>
                    
                    {businessAddOn.status === 'active' && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleCancelAddOn(businessAddOn.id)}
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Purchase Dialog */}
      <Dialog open={showPurchaseDialog} onOpenChange={setShowPurchaseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Purchase Add-on</DialogTitle>
            <DialogDescription>
              Complete your add-on purchase
            </DialogDescription>
          </DialogHeader>
          {selectedAddOn && (
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium">{selectedAddOn.name}</h3>
                <p className="text-sm text-gray-500">{selectedAddOn.description}</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-lg font-bold">
                    {formatCurrency(selectedAddOn.priceCents)}
                  </span>
                  <span className="text-sm text-gray-500">
                    /{selectedAddOn.billingPeriod}
                  </span>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  value={purchaseQuantity}
                  onChange={(e) => setPurchaseQuantity(parseInt(e.target.value) || 1)}
                />
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowPurchaseDialog(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={() => handlePurchaseAddOn(selectedAddOn, purchaseQuantity)}
                  className="flex items-center"
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Purchase for {formatCurrency(selectedAddOn.priceCents * purchaseQuantity)}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Create Add-on Form Component
function CreateAddOnForm({ onSuccess }: { onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    priceCents: 0,
    billingPeriod: 'monthly',
    eventType: '',
    quantityIncluded: 0,
    isActive: true,
    sortOrder: 0
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/v1/monetization/addons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_addon',
          ...formData
        })
      });

      const result = await response.json();

      if (result.success) {
        onSuccess();
      } else {
        console.error('Failed to create add-on:', result.error);
      }
    } catch (error) {
      console.error('Error creating add-on:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="priceCents">Price (cents)</Label>
          <Input
            id="priceCents"
            type="number"
            value={formData.priceCents}
            onChange={(e) => setFormData({ ...formData, priceCents: parseInt(e.target.value) || 0 })}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="billingPeriod">Billing Period</Label>
          <Select
            value={formData.billingPeriod}
            onValueChange={(value) => setFormData({ ...formData, billingPeriod: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
              <SelectItem value="one_time">One Time</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="eventType">Event Type</Label>
          <Input
            id="eventType"
            value={formData.eventType}
            onChange={(e) => setFormData({ ...formData, eventType: e.target.value })}
            placeholder="e.g., api_call, voice_minute"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="quantityIncluded">Quantity Included</Label>
          <Input
            id="quantityIncluded"
            type="number"
            value={formData.quantityIncluded}
            onChange={(e) => setFormData({ ...formData, quantityIncluded: parseInt(e.target.value) || 0 })}
          />
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="isActive"
          checked={formData.isActive}
          onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
        />
        <Label htmlFor="isActive">Active</Label>
      </div>

      <div className="flex justify-end space-x-2">
        <Button type="submit" disabled={loading}>
          {loading ? 'Creating...' : 'Create Add-on'}
        </Button>
      </div>
    </form>
  );
}

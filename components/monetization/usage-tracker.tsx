'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Area,
  AreaChart
} from 'recharts';
import { 
  Activity, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle,
  Clock,
  Zap,
  Database,
  Brain
} from 'lucide-react';

interface UsageData {
  event_type: string;
  current_usage: number;
  quota_limit: number;
  usage_percentage: number;
  isOverQuota: boolean;
  remainingQuota: number;
  overagePercentage: number;
}

interface UsageAnalytics {
  event_type: string;
  event_count: number;
  total_quantity: number;
  total_cost_cents: number;
  avg_quantity_per_event: number;
  max_quantity_per_event: number;
  first_event: string;
  last_event: string;
}

interface UsageTrackerProps {
  businessId: string;
  startDate?: string;
  endDate?: string;
}

const EVENT_TYPE_ICONS = {
  'api_call': Zap,
  'voice_minute': Activity,
  'storage_mb': Database,
  'ai_query': Brain
};

const EVENT_TYPE_COLORS = {
  'api_call': '#0088FE',
  'voice_minute': '#00C49F',
  'storage_mb': '#FFBB28',
  'ai_query': '#FF8042'
};

export function UsageTracker({ businessId, startDate, endDate }: UsageTrackerProps) {
  const [usageData, setUsageData] = useState<UsageData[]>([]);
  const [analytics, setAnalytics] = useState<UsageAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchUsageData();
  }, [businessId, startDate, endDate]);

  const fetchUsageData = async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams({
        businessId,
        type: 'quota'
      });

      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const [usageResponse, analyticsResponse] = await Promise.all([
        fetch(`/api/v1/monetization/usage/analytics?${params}`),
        fetch(`/api/v1/monetization/usage/analytics?${params}&type=analytics`)
      ]);

      const [usageResult, analyticsResult] = await Promise.all([
        usageResponse.json(),
        analyticsResponse.json()
      ]);

      if (usageResult.success) {
        setUsageData(usageResult.data);
      }

      if (analyticsResult.success) {
        setAnalytics(analyticsResult.data);
      }
    } catch (err) {
      setError('Failed to fetch usage data');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(cents / 100);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const getEventTypeIcon = (eventType: string) => {
    const IconComponent = EVENT_TYPE_ICONS[eventType as keyof typeof EVENT_TYPE_ICONS] || Activity;
    return <IconComponent className="h-4 w-4" />;
  };

  const getEventTypeColor = (eventType: string) => {
    return EVENT_TYPE_COLORS[eventType as keyof typeof EVENT_TYPE_COLORS] || '#8884D8';
  };

  const getUsageStatus = (usagePercentage: number) => {
    if (usagePercentage >= 100) return { status: 'over', color: 'text-red-600', bgColor: 'bg-red-50' };
    if (usagePercentage >= 80) return { status: 'warning', color: 'text-orange-600', bgColor: 'bg-orange-50' };
    if (usagePercentage >= 50) return { status: 'moderate', color: 'text-yellow-600', bgColor: 'bg-yellow-50' };
    return { status: 'good', color: 'text-green-600', bgColor: 'bg-green-50' };
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
        <AlertTriangle className="mx-auto h-12 w-12 text-red-500 mb-4" />
        <p className="text-red-600">{error}</p>
        <Button onClick={fetchUsageData} className="mt-4">
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
          <h1 className="text-3xl font-bold">Usage Tracker</h1>
          <p className="text-gray-600">Monitor your usage against plan quotas</p>
        </div>
        <Button variant="outline" onClick={fetchUsageData}>
          <Activity className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Usage Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {usageData.map((item) => {
          const status = getUsageStatus(item.usage_percentage);
          const IconComponent = EVENT_TYPE_ICONS[item.event_type as keyof typeof EVENT_TYPE_ICONS] || Activity;
          
          return (
            <Card key={item.event_type} className={`${status.bgColor} border-l-4`} style={{ borderLeftColor: getEventTypeColor(item.event_type) }}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium capitalize">
                  {item.event_type.replace('_', ' ')}
                </CardTitle>
                <IconComponent className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatNumber(item.current_usage)}
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>of {formatNumber(item.quota_limit)}</span>
                  <Badge variant={status.status === 'over' ? 'destructive' : status.status === 'warning' ? 'secondary' : 'default'}>
                    {Math.round(item.usage_percentage)}%
                  </Badge>
                </div>
                <Progress value={item.usage_percentage} className="mt-2" />
                {item.isOverQuota && (
                  <p className="text-xs text-red-600 mt-1">
                    Over quota by {formatNumber(item.overagePercentage)} units
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Usage vs Quota Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Usage vs Quota</CardTitle>
                <CardDescription>Current usage against your plan limits</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={usageData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="event_type" />
                    <YAxis />
                    <Tooltip formatter={(value) => formatNumber(Number(value))} />
                    <Bar dataKey="current_usage" fill="#0088FE" name="Current Usage" />
                    <Bar dataKey="quota_limit" fill="#E5E7EB" name="Quota Limit" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Usage Status */}
            <Card>
              <CardHeader>
                <CardTitle>Usage Status</CardTitle>
                <CardDescription>Detailed breakdown by event type</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {usageData.map((item) => {
                    const status = getUsageStatus(item.usage_percentage);
                    const IconComponent = EVENT_TYPE_ICONS[item.event_type as keyof typeof EVENT_TYPE_ICONS] || Activity;
                    
                    return (
                      <div key={item.event_type} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <IconComponent className="h-4 w-4" />
                            <span className="font-medium capitalize">
                              {item.event_type.replace('_', ' ')}
                            </span>
                          </div>
                          <Badge variant={status.status === 'over' ? 'destructive' : status.status === 'warning' ? 'secondary' : 'default'}>
                            {Math.round(item.usage_percentage)}%
                          </Badge>
                        </div>
                        <Progress value={item.usage_percentage} className="h-2" />
                        <div className="flex justify-between text-sm text-gray-500">
                          <span>{formatNumber(item.current_usage)} used</span>
                          <span>{formatNumber(item.remainingQuota)} remaining</span>
                        </div>
                        {item.isOverQuota && (
                          <div className="flex items-center text-sm text-red-600">
                            <AlertTriangle className="h-4 w-4 mr-1" />
                            Over quota by {formatNumber(item.overagePercentage)} units
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Usage Analytics</CardTitle>
              <CardDescription>Detailed analytics for each event type</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics.map((item) => {
                  const IconComponent = EVENT_TYPE_ICONS[item.event_type as keyof typeof EVENT_TYPE_ICONS] || Activity;
                  
                  return (
                    <div key={item.event_type} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <IconComponent className="h-5 w-5" style={{ color: getEventTypeColor(item.event_type) }} />
                          <h3 className="font-medium capitalize">
                            {item.event_type.replace('_', ' ')}
                          </h3>
                        </div>
                        <Badge variant="outline">
                          {formatNumber(item.event_count)} events
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500">Total Quantity</p>
                          <p className="font-medium">{formatNumber(item.total_quantity)}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Total Cost</p>
                          <p className="font-medium">{formatCurrency(item.total_cost_cents)}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Avg per Event</p>
                          <p className="font-medium">{formatNumber(Math.round(item.avg_quantity_per_event))}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Max per Event</p>
                          <p className="font-medium">{formatNumber(item.max_quantity_per_event)}</p>
                        </div>
                      </div>
                      
                      <div className="mt-3 text-xs text-gray-500">
                        <p>First event: {new Date(item.first_event).toLocaleDateString()}</p>
                        <p>Last event: {new Date(item.last_event).toLocaleDateString()}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Usage Trends</CardTitle>
              <CardDescription>Usage patterns over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <TrendingUp className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-500">Usage trends chart will be available soon</p>
                <p className="text-sm text-gray-400">
                  This feature requires historical usage data
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Usage Alerts</CardTitle>
              <CardDescription>Quota warnings and notifications</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {usageData.filter(item => item.usage_percentage >= 80).map((item) => {
                  const IconComponent = EVENT_TYPE_ICONS[item.event_type as keyof typeof EVENT_TYPE_ICONS] || Activity;
                  
                  return (
                    <div key={item.event_type} className="flex items-center p-4 bg-orange-50 border border-orange-200 rounded-lg">
                      <AlertTriangle className="h-5 w-5 text-orange-500 mr-3" />
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <IconComponent className="h-4 w-4" />
                          <span className="font-medium capitalize">
                            {item.event_type.replace('_', ' ')} quota warning
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">
                          You've used {Math.round(item.usage_percentage)}% of your quota. 
                          {item.isOverQuota ? ' You are currently over quota.' : ' Consider upgrading your plan.'}
                        </p>
                      </div>
                      <Button variant="outline" size="sm">
                        Upgrade Plan
                      </Button>
                    </div>
                  );
                })}
                
                {usageData.filter(item => item.usage_percentage < 80).length === usageData.length && (
                  <div className="text-center py-8">
                    <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
                    <p className="text-green-600 font-medium">All quotas are within normal limits</p>
                    <p className="text-sm text-gray-500">
                      No usage alerts at this time
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

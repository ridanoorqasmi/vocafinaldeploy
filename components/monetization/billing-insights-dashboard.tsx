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
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  CreditCard, 
  AlertTriangle,
  CheckCircle,
  Clock,
  Download,
  Eye,
  Settings
} from 'lucide-react';

interface BillingInsightsData {
  monthlySpend: {
    monthlyData: Array<{
      month: string;
      total_spend_cents: number;
      subscription_cost_cents: number;
      usage_cost_cents: number;
      addon_cost_cents: number;
      tax_cents: number;
      discount_cents: number;
      referral_credits_cents: number;
      annual_savings_cents: number;
    }>;
    trends: {
      trend: string;
      changePercentage: number;
    };
  };
  usageVsQuota: Array<{
    event_type: string;
    current_usage: number;
    quota_limit: number;
    usage_percentage: number;
    isOverQuota: boolean;
    remainingQuota: number;
    overagePercentage: number;
  }>;
  referralCredits: {
    monthlyCredits: Array<{
      month: string;
      total_credits_cents: number;
      referral_count: number;
    }>;
    totalCredits: {
      total_credits_cents: number;
      total_referrals: number;
    };
  };
  annualSavings: {
    monthlySavings: Array<{
      month: string;
      monthly_savings_cents: number;
      annual_subscriptions: number;
    }>;
    totalSavings: {
      total_savings_cents: number;
      total_annual_subscriptions: number;
    };
  };
  addOnAnalytics: Array<{
    add_on_name: string;
    purchase_count: number;
    total_revenue_cents: number;
    active_count: number;
    cancelled_count: number;
  }>;
  invoiceHistory: {
    invoices: Array<{
      id: string;
      invoiceNumber: string;
      status: string;
      amountCents: number;
      amountPaidCents: number;
      createdAt: string;
    }>;
    summary: {
      total_invoices: number;
      paid_invoices: number;
      open_invoices: number;
      total_amount_cents: number;
      total_paid_cents: number;
      average_invoice_amount_cents: number;
    };
  };
  billingAlerts: Array<{
    id: string;
    alertType: string;
    alertData: any;
    severity: string;
    isRead: boolean;
    triggeredAt: string;
  }>;
  summary: {
    currentSpendCents: number;
    spendChangePercentage: number;
    totalQuotaUtilization: number;
    overageRisk: number;
    totalSavingsCents: number;
    addOnRevenueCents: number;
    recommendations: string[];
  };
}

interface BillingInsightsDashboardProps {
  businessId: string;
  startDate?: string;
  endDate?: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export function BillingInsightsDashboard({ 
  businessId, 
  startDate, 
  endDate 
}: BillingInsightsDashboardProps) {
  const [data, setData] = useState<BillingInsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchBillingInsights();
  }, [businessId, startDate, endDate]);

  const fetchBillingInsights = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        businessId,
        type: 'comprehensive'
      });

      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await fetch(`/api/v1/monetization/insights?${params}`);
      const result = await response.json();

      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Failed to fetch billing insights');
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

  const formatPercentage = (value: number) => {
    return `${Math.round(value * 100) / 100}%`;
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
        <Button onClick={fetchBillingInsights} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No billing data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Billing Insights</h1>
          <p className="text-gray-600">Monitor your spending, usage, and savings</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Spend</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(data.summary.currentSpendCents)}
            </div>
            <div className="flex items-center text-xs text-muted-foreground">
              {data.summary.spendChangePercentage > 0 ? (
                <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-500 mr-1" />
              )}
              {formatPercentage(Math.abs(data.summary.spendChangePercentage))} from last month
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quota Utilization</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatPercentage(data.summary.totalQuotaUtilization)}
            </div>
            <Progress 
              value={data.summary.totalQuotaUtilization} 
              className="mt-2"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Savings</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(data.summary.totalSavingsCents)}
            </div>
            <p className="text-xs text-muted-foreground">
              From referrals & annual plans
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Add-on Revenue</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(data.summary.addOnRevenueCents)}
            </div>
            <p className="text-xs text-muted-foreground">
              This month
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Billing Alerts */}
      {data.billingAlerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2 text-orange-500" />
              Billing Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.billingAlerts.slice(0, 3).map((alert) => (
                <div key={alert.id} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                  <div className="flex items-center">
                    <Badge 
                      variant={alert.severity === 'high' ? 'destructive' : 'secondary'}
                      className="mr-2"
                    >
                      {alert.severity}
                    </Badge>
                    <span className="text-sm">{alert.alertType}</span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(alert.triggeredAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
          <TabsTrigger value="spending">Spending</TabsTrigger>
          <TabsTrigger value="savings">Savings</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Monthly Spend Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Monthly Spending Trend</CardTitle>
                <CardDescription>Your spending over the last 12 months</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={data.monthlySpend.monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    <Line 
                      type="monotone" 
                      dataKey="total_spend_cents" 
                      stroke="#0088FE" 
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Usage vs Quota */}
            <Card>
              <CardHeader>
                <CardTitle>Usage vs Quota</CardTitle>
                <CardDescription>Current usage against your plan limits</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.usageVsQuota.map((item) => (
                    <div key={item.event_type} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="capitalize">{item.event_type.replace('_', ' ')}</span>
                        <span>{item.current_usage} / {item.quota_limit}</span>
                      </div>
                      <Progress 
                        value={item.usage_percentage} 
                        className="h-2"
                      />
                      {item.isOverQuota && (
                        <p className="text-xs text-red-600">
                          Over quota by {item.overagePercentage.toFixed(1)}%
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recommendations */}
          {data.summary.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recommendations</CardTitle>
                <CardDescription>Optimize your billing and usage</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.summary.recommendations.map((recommendation, index) => (
                    <div key={index} className="flex items-start p-3 bg-blue-50 rounded-lg">
                      <CheckCircle className="h-4 w-4 text-blue-500 mr-2 mt-0.5" />
                      <span className="text-sm">{recommendation}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="usage" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Usage Analytics</CardTitle>
              <CardDescription>Detailed breakdown of your usage patterns</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.usageVsQuota.map((item) => (
                  <div key={item.event_type} className="p-4 border rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="font-medium capitalize">
                        {item.event_type.replace('_', ' ')}
                      </h3>
                      <Badge variant={item.isOverQuota ? 'destructive' : 'secondary'}>
                        {formatPercentage(item.usage_percentage)}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Current Usage</p>
                        <p className="font-medium">{item.current_usage}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Quota Limit</p>
                        <p className="font-medium">{item.quota_limit}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Remaining</p>
                        <p className="font-medium">{item.remainingQuota}</p>
                      </div>
                    </div>
                    <Progress 
                      value={item.usage_percentage} 
                      className="mt-3"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="spending" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Spending Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Spending Breakdown</CardTitle>
                <CardDescription>Where your money goes</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Subscription', value: data.monthlySpend.monthlyData[0]?.subscription_cost_cents || 0 },
                        { name: 'Usage', value: data.monthlySpend.monthlyData[0]?.usage_cost_cents || 0 },
                        { name: 'Add-ons', value: data.monthlySpend.monthlyData[0]?.addon_cost_cents || 0 },
                        { name: 'Tax', value: data.monthlySpend.monthlyData[0]?.tax_cents || 0 }
                      ]}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {data.monthlySpend.monthlyData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Add-on Analytics */}
            <Card>
              <CardHeader>
                <CardTitle>Add-on Performance</CardTitle>
                <CardDescription>Revenue from add-ons</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.addOnAnalytics.map((addon) => (
                    <div key={addon.add_on_name} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium">{addon.add_on_name}</p>
                        <p className="text-sm text-gray-500">
                          {addon.purchase_count} purchases
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">
                          {formatCurrency(addon.total_revenue_cents)}
                        </p>
                        <p className="text-sm text-gray-500">
                          {addon.active_count} active
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="savings" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Referral Credits */}
            <Card>
              <CardHeader>
                <CardTitle>Referral Credits</CardTitle>
                <CardDescription>Earnings from referrals</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">
                    {formatCurrency(data.referralCredits.totalCredits.total_credits_cents)}
                  </div>
                  <p className="text-sm text-gray-500">
                    From {data.referralCredits.totalCredits.total_referrals} referrals
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Annual Savings */}
            <Card>
              <CardHeader>
                <CardTitle>Annual Plan Savings</CardTitle>
                <CardDescription>Savings from annual subscriptions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">
                    {formatCurrency(data.annualSavings.totalSavings.total_savings_cents)}
                  </div>
                  <p className="text-sm text-gray-500">
                    From {data.annualSavings.totalSavings.total_annual_subscriptions} annual plans
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="invoices" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Invoice History</CardTitle>
              <CardDescription>Your recent invoices and payment status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.invoiceHistory.invoices.map((invoice) => (
                  <div key={invoice.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div>
                        <p className="font-medium">{invoice.invoiceNumber}</p>
                        <p className="text-sm text-gray-500">
                          {new Date(invoice.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge 
                        variant={invoice.status === 'paid' ? 'default' : 'secondary'}
                      >
                        {invoice.status}
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="font-medium">
                          {formatCurrency(invoice.amountCents)}
                        </p>
                        <p className="text-sm text-gray-500">
                          Paid: {formatCurrency(invoice.amountPaidCents)}
                        </p>
                      </div>
                      <Button variant="outline" size="sm">
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

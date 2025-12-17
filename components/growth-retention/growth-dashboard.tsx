'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, 
  Users, 
  DollarSign, 
  Target,
  Lightbulb,
  Share2,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock
} from 'lucide-react';

import { OnboardingProgress } from './onboarding-progress';
import { UpgradeRecommendations } from './upgrade-recommendations';
import { ReferralDashboard } from './referral-dashboard';
import { AnnualDiscountOffers } from './annual-discount-offers';

interface DashboardData {
  onboarding: any;
  upgrades: any[];
  referrals: {
    stats: any;
    recentReferrals: any[];
  };
  annualDiscounts: any[];
  winback: any[];
}

interface GrowthDashboardProps {
  businessId: string;
}

export function GrowthDashboard({ businessId }: GrowthDashboardProps) {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchDashboardData();
  }, [businessId]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/v1/growth-retention/dashboard?businessId=${businessId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }

      const data = await response.json();
      setDashboardData(data.dashboardData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const getCompletionStatus = () => {
    if (!dashboardData?.onboarding) return { status: 'not_started', percentage: 0 };
    
    const percentage = dashboardData.onboarding.completionPercentage || 0;
    if (percentage >= 100) return { status: 'completed', percentage };
    if (percentage >= 50) return { status: 'in_progress', percentage };
    return { status: 'getting_started', percentage };
  };

  const getUpgradeUrgency = () => {
    if (!dashboardData?.upgrades?.length) return 'none';
    
    const highPriorityCount = dashboardData.upgrades.filter(
      (upgrade: any) => upgrade.urgencyLevel === 'high' || upgrade.urgencyLevel === 'critical'
    ).length;
    
    if (highPriorityCount > 0) return 'high';
    return 'medium';
  };

  const getReferralStatus = () => {
    if (!dashboardData?.referrals?.stats) return 'no_referrals';
    
    const { totalReferrals, successfulReferrals } = dashboardData.referrals.stats;
    if (successfulReferrals > 0) return 'active';
    if (totalReferrals > 0) return 'pending';
    return 'no_referrals';
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-20 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            <p>Error: {error}</p>
            <Button onClick={fetchDashboardData} className="mt-2">
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const completionStatus = getCompletionStatus();
  const upgradeUrgency = getUpgradeUrgency();
  const referralStatus = getReferralStatus();

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Lightbulb className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{completionStatus.percentage}%</div>
                <div className="text-sm text-gray-600">Onboarding</div>
                <Badge 
                  variant="outline" 
                  className={`text-xs ${
                    completionStatus.status === 'completed' 
                      ? 'text-green-600 border-green-200' 
                      : completionStatus.status === 'in_progress'
                      ? 'text-blue-600 border-blue-200'
                      : 'text-yellow-600 border-yellow-200'
                  }`}
                >
                  {completionStatus.status === 'completed' ? 'Complete' : 
                   completionStatus.status === 'in_progress' ? 'In Progress' : 'Getting Started'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{dashboardData?.upgrades?.length || 0}</div>
                <div className="text-sm text-gray-600">Upgrade Options</div>
                <Badge 
                  variant="outline" 
                  className={`text-xs ${
                    upgradeUrgency === 'high' 
                      ? 'text-red-600 border-red-200' 
                      : upgradeUrgency === 'medium'
                      ? 'text-yellow-600 border-yellow-200'
                      : 'text-gray-600 border-gray-200'
                  }`}
                >
                  {upgradeUrgency === 'high' ? 'High Priority' : 
                   upgradeUrgency === 'medium' ? 'Available' : 'None'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Share2 className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {dashboardData?.referrals?.stats?.totalReferrals || 0}
                </div>
                <div className="text-sm text-gray-600">Referrals</div>
                <Badge 
                  variant="outline" 
                  className={`text-xs ${
                    referralStatus === 'active' 
                      ? 'text-green-600 border-green-200' 
                      : referralStatus === 'pending'
                      ? 'text-yellow-600 border-yellow-200'
                      : 'text-gray-600 border-gray-200'
                  }`}
                >
                  {referralStatus === 'active' ? 'Active' : 
                   referralStatus === 'pending' ? 'Pending' : 'None'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Calendar className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{dashboardData?.annualDiscounts?.length || 0}</div>
                <div className="text-sm text-gray-600">Annual Offers</div>
                <Badge 
                  variant="outline" 
                  className="text-xs text-blue-600 border-blue-200"
                >
                  {dashboardData?.annualDiscounts?.length > 0 ? 'Available' : 'None'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="onboarding">Onboarding</TabsTrigger>
          <TabsTrigger value="upgrades">Upgrades</TabsTrigger>
          <TabsTrigger value="referrals">Referrals</TabsTrigger>
          <TabsTrigger value="annual">Annual</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {completionStatus.status !== 'completed' && (
                    <Button 
                      variant="outline" 
                      className="w-full justify-start"
                      onClick={() => setActiveTab('onboarding')}
                    >
                      <Lightbulb className="h-4 w-4 mr-2" />
                      Continue Onboarding
                    </Button>
                  )}
                  
                  {upgradeUrgency !== 'none' && (
                    <Button 
                      variant="outline" 
                      className="w-full justify-start"
                      onClick={() => setActiveTab('upgrades')}
                    >
                      <TrendingUp className="h-4 w-4 mr-2" />
                      Review Upgrade Options
                    </Button>
                  )}
                  
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => setActiveTab('referrals')}
                  >
                    <Share2 className="h-4 w-4 mr-2" />
                    Share Referral Link
                  </Button>
                  
                  {dashboardData?.annualDiscounts?.length > 0 && (
                    <Button 
                      variant="outline" 
                      className="w-full justify-start"
                      onClick={() => setActiveTab('annual')}
                    >
                      <Calendar className="h-4 w-4 mr-2" />
                      View Annual Offers
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {dashboardData?.referrals?.recentReferrals?.slice(0, 3).map((referral: any) => (
                    <div key={referral.id} className="flex items-center gap-3 p-2 rounded-lg bg-gray-50">
                      <Users className="h-4 w-4 text-gray-600" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{referral.referredBusiness.name}</p>
                        <p className="text-xs text-gray-600">Referred {new Date(referral.createdAt).toLocaleDateString()}</p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {referral.status}
                      </Badge>
                    </div>
                  ))}
                  
                  {(!dashboardData?.referrals?.recentReferrals?.length) && (
                    <div className="text-center py-4 text-gray-500">
                      <Clock className="h-8 w-8 mx-auto mb-2" />
                      <p className="text-sm">No recent activity</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="onboarding">
          <OnboardingProgress businessId={businessId} />
        </TabsContent>

        <TabsContent value="upgrades">
          <UpgradeRecommendations businessId={businessId} />
        </TabsContent>

        <TabsContent value="referrals">
          <ReferralDashboard businessId={businessId} />
        </TabsContent>

        <TabsContent value="annual">
          <AnnualDiscountOffers businessId={businessId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
